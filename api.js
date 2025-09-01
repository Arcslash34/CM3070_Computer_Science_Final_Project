// api.js
// NOTE: Local SG app. Primary data from data.gov.sg; OpenWeather used to augment/fallback.
// Offline fallback ONLY uses the bundled /assets/env_snapshot.json. No runtime saving.

import NetInfo from '@react-native-community/netinfo';
import bundledSnapshot from './assets/env_snapshot.json';

/* =========================================================================
   Connectivity + fetch utils
   ========================================================================= */
const isConnected = async () => {
  const state = await NetInfo.fetch();
  return !!(state.isConnected && state.isInternetReachable);
};

const fetchWithTimeout = (url, opts = {}, ms = 8000) => {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(t));
};

// throw on non-2xx
const requireOk = (res, label = 'request') => {
  if (!res.ok) throw new Error(`${label} HTTP ${res.status}`);
};

// minimal truthy/empty check
const nonEmpty = (arrOrObj) =>
  Array.isArray(arrOrObj) ? arrOrObj.length > 0 : !!arrOrObj;

// helper: read from bundled snapshot or return fallback
const snapOr = async (selector, fallback) => {
  const snap = await loadBundledSnapshot();
  const val = selector(snap);
  return nonEmpty(val) ? val : fallback;
};

/* =========================================================================
   Math helpers
   ========================================================================= */
const deg2rad = (deg) => deg * (Math.PI / 180);
const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/* =========================================================================
   Simple in-memory cache + rate-limit helpers
   ========================================================================= */
const _cache = new Map();          // key -> { data, exp }
const _inflight = new Map();       // url -> Promise
const _lastWarnAt = new Map();     // label -> timestamp (to de-dup warnings)

const getCache = (k) => {
  const v = _cache.get(k);
  if (!v) return null;
  if (Date.now() > v.exp) { _cache.delete(k); return null; }
  return v.data;
};
const setCache = (k, data, ttlMs) => _cache.set(k, { data, exp: Date.now() + ttlMs });

function warnOnce(label, msg, everyMs = 60000) {
  const last = _lastWarnAt.get(label) || 0;
  const now = Date.now();
  if (now - last >= everyMs) {
    console.warn(msg);
    _lastWarnAt.set(label, now);
  }
}

/**
 * Rate-limit aware JSON fetcher:
 * - Dedupes concurrent calls to same URL
 * - Uses short TTL cache
 * - Retries once on 429 honoring Retry-After (max 2000ms)
 * - Falls back to cached (if fresh) or lets caller fallback
 */
async function fetchJSON_RL(url, label, { ttlMs = 60000, timeoutMs = 8000 } = {}) {
  // 1) Return cache if fresh
  const cached = getCache(url);
  if (cached) return cached;

  // 2) Deduplicate in-flight for same URL
  if (_inflight.has(url)) return _inflight.get(url);

  const run = async () => {
    if (!(await isConnected())) throw new Error('offline');
    let res = await fetchWithTimeout(url, {}, timeoutMs);

    if (res.status === 429) {
      // honor Retry-After header up to 2s; else backoff 800-1200ms
      const ra = res.headers.get('Retry-After');
      let waitMs = 0;
      if (ra) {
        const n = Number(ra);
        waitMs = Number.isFinite(n) ? Math.min(2000, Math.max(0, n * 1000)) : 0;
      }
      if (!waitMs) waitMs = 800 + Math.floor(Math.random() * 400);
      await new Promise(r => setTimeout(r, waitMs));
      // retry once
      res = await fetchWithTimeout(url, {}, timeoutMs);
    }

    requireOk(res, label);
    const json = await res.json();
    setCache(url, json, ttlMs);
    return json;
  };

  const p = run().finally(() => _inflight.delete(url)).catch((err) => {
    if (String(err?.message || '').includes('429')) {
      warnOnce(label, `${label} rate-limited (429) - using fallback if available`);
    } else {
      warnOnce(label, `${label} fetch error: ${err?.message || err}`);
    }
    throw err;
  });

  _inflight.set(url, p);
  return p;
}

/* =========================================================================
   Rolling rainfall buffer (for last-60-min when API only returns 1 slot)
   ========================================================================= */
// Map<stationId, Array<{ts:number, value:number}>>
const _rollingRain = new Map();

function _pushRollingRain(stationId, tsMs, value) {
  if (!Number.isFinite(value)) return;
  const arr = _rollingRain.get(stationId) || [];
  arr.push({ ts: tsMs, value: Math.max(0, value) });
  // keep only last ~65 minutes
  const cutoff = tsMs - 65 * 60 * 1000;
  const pruned = arr.filter((x) => x.ts >= cutoff);
  _rollingRain.set(stationId, pruned);
}

function _sumLastHourFromRolling(stationId, refTsMs) {
  const arr = _rollingRain.get(stationId) || [];
  const cutoff = refTsMs - 60 * 60 * 1000;
  let sum = 0;
  let found = false;
  for (const x of arr) {
    if (x.ts >= cutoff && x.ts <= refTsMs && Number.isFinite(x.value)) {
      sum += x.value;
      found = true;
    }
  }
  return found ? sum : null;
}

function _coverageLastHourFromRolling(stationId, refTsMs) {
  const arr = _rollingRain.get(stationId) || [];
  const cutoff = refTsMs - 60 * 60 * 1000;
  const within = arr.filter(x => x.ts >= cutoff && x.ts <= refTsMs);
  if (!within.length) return 0;
  const earliest = within.reduce((m, x) => Math.min(m, x.ts), within[0].ts);
  const mins = Math.max(0, Math.round((refTsMs - earliest) / 60000));
  return Math.min(60, mins);
}

/* =========================================================================
   Snapshot (bundled-only)
   ========================================================================= */
let _lastSnapshotSource = null; // 'assets' | null
let _bundledSnapshotCache = null;
export const getSnapshotDebugInfo = () => ({ source: _lastSnapshotSource });

async function loadBundledSnapshot() {
  try {
    if (_bundledSnapshotCache) {
      return _bundledSnapshotCache;
    }
    _lastSnapshotSource = 'assets';
    if (__DEV__) console.log('[snapshot] Loaded bundled env_snapshot.json');
    _bundledSnapshotCache = bundledSnapshot; // Metro already parsed it
    return _bundledSnapshotCache;
  } catch (e) {
    console.warn('Bundled env_snapshot.json import failed:', e?.message || e);
    _lastSnapshotSource = null;
    return null;
  }
}

// Public loader (kept name for minimal app changes)
export async function loadEnvDatasetsFromFile() {
  return await loadBundledSnapshot();
}

/* =========================================================================
   Domain helpers
   ========================================================================= */
export const estimateFloodRisk = (rainfall, lastHour, opts = {}) => {
  const {
    allowNull = false,
    minCoverageMin = 0,
    coverageMin = undefined,
    nowHigh = 10, hourHigh = 30,
    nowMod  = 5,  hourMod  = 15,
  } = opts;

  const hasR = Number.isFinite(rainfall);
  const hasH = Number.isFinite(lastHour);

  if (typeof coverageMin === 'number' && coverageMin < minCoverageMin) {
    return allowNull ? null : 'Low';
  }

  const r = hasR ? rainfall : 0;
  const h = hasH ? lastHour  : 0;

  if (r > nowHigh || h > hourHigh) return 'High';
  if (r > nowMod  || h > hourMod)  return 'Moderate';

  if (allowNull && !hasR && !hasH) return null;
  return 'Low';
};

export const getNearestForecastArea = (userCoords, metadata) => {
  let closest = null;
  let minDist = Infinity;
  for (const area of metadata || []) {
    const { latitude, longitude } = area.label_location || {};
    if (typeof latitude !== 'number' || typeof longitude !== 'number') continue;
    const dist = getDistanceFromLatLonInKm(userCoords.latitude, userCoords.longitude, latitude, longitude);
    if (dist < minDist) { minDist = dist; closest = area.name; }
  }
  return closest;
};

/* =========================================================================
   Helpers for rainfall slot normalization
   ========================================================================= */
function _ts(msOrISO) {
  const n = new Date(msOrISO || 0).getTime();
  return Number.isFinite(n) ? n : 0;
}

/**
 * NEA sometimes returns multiple reading sets for the same (or very close) time.
 * This function:
 *  - sorts newest → oldest
 *  - keeps only the newest item per 5-min bucket
 *  - trims to the last 60 minutes (max 12 buckets)
 */
function normalizeRainSlots(readingSets) {
  if (!Array.isArray(readingSets) || !readingSets.length) return [];

  // 1) Sort newest → oldest by timestamp
  const sorted = [...readingSets].sort((a, b) => _ts(b.timestamp) - _ts(a.timestamp));

  const newestTs = _ts(sorted[0]?.timestamp);
  if (!newestTs) return [];

  const cutoff = newestTs - 60 * 60 * 1000;
  // 2) Bucket by 5-min window key to dedupe jittered timestamps
  const seenBuckets = new Set();
  const windowSlots = [];
  for (const s of sorted) {
    const ts = _ts(s?.timestamp);
    if (!ts || ts < cutoff) break; // stop once we go past 60 min from newest
    const bucketKey = Math.floor(ts / (5 * 60 * 1000)); // 5-min bucket
    if (seenBuckets.has(bucketKey)) continue; // keep the newest one only
    seenBuckets.add(bucketKey);
    windowSlots.push(s);
    if (windowSlots.length >= 12) break; // cap to 12 buckets (~60 min)
  }

  return windowSlots;
}

/* =========================================================================
   NEA: 2-hour weather forecast (TTL 5m)
   ========================================================================= */
export const fetchWeatherForecast = async () => {
  try {
    const url = 'https://api-open.data.gov.sg/v2/real-time/api/two-hr-forecast';
    const raw = await fetchJSON_RL(url, 'NEA 2hr forecast', { ttlMs: 5 * 60 * 1000, timeoutMs: 8000 });

    const data = {
      forecasts: raw?.data?.items?.[0]?.forecasts ?? [],
      metadata: raw?.data?.area_metadata ?? [],
      timestamp: raw?.data?.items?.[0]?.timestamp ?? null,
    };
    if (!data.forecasts.length || !data.metadata.length) throw new Error('NEA 2hr payload empty');

    return data;
  } catch (err) {
    warnOnce('NEA 2hr forecast', `fetchWeatherForecast -> fallback to bundled: ${err?.message || err}`);
    return await snapOr((snap) => {
      const f = snap?.twoHr?.forecasts ?? snap?.forecasts ?? [];
      const m = snap?.twoHr?.metadata ?? snap?.area_metadata ?? [];
      const ts = snap?.twoHr?.timestamp ?? snap?.timestamp ?? null;
      if (!f.length || !m.length) return null;
      return { forecasts: f, metadata: m, timestamp: ts };
    }, null);
  }
};

/* =========================================================================
   NEA: Real-time rainfall (ALL STATIONS + per-station last-hour accumulation)
   TTL 60s
   ========================================================================= */
export const fetchRainfallData = async (userCoords) => {
  try {
    const url = 'https://api-open.data.gov.sg/v2/real-time/api/rainfall';
    const json = await fetchJSON_RL(url, 'NEA rainfall', { ttlMs: 60 * 1000, timeoutMs: 8000 });

    const stations = json?.data?.stations ?? [];
    const readingSets = json?.data?.readings ?? [];
    if (!stations.length || !readingSets.length) throw new Error('NEA rainfall payload empty');

    // Normalize slots to last 60 min, dedup 5-min buckets, cap to 12
    const windowSlots = normalizeRainSlots(readingSets);
    if (!windowSlots.length) {
      return { stations: stations.map(s => ({ id: s.id, name: s.name, location: s.location, rainfall: null, lastHour: null, lastHourCoverageMin: 0, distanceKm: null })), timestamp: null };
    }

    const newestTs = _ts(windowSlots[0]?.timestamp);

    // Seed rolling buffer (helps when API returns only 1 bucket intermittently)
    for (const s of windowSlots) {
      const tsMs = _ts(s?.timestamp);
      for (const d of (s.data || [])) {
        const val = (typeof d.value === 'number' && Number.isFinite(d.value) && d.value >= 0) ? d.value : 0;
        _pushRollingRain(d.stationId, tsMs, val);
      }
    }

    // Latest 5-min readings (“now”)
    const currentReadings = windowSlots[0]?.data ?? [];

    // Strict accumulation across the normalized window
    const accByStation = new Map(); // id -> sum(mm)
    for (const s of windowSlots) {
      for (const d of (s.data || [])) {
        const val = (typeof d.value === 'number' && Number.isFinite(d.value) && d.value >= 0) ? d.value : 0;
        accByStation.set(d.stationId, (accByStation.get(d.stationId) || 0) + val);
      }
    }

    const hasMultiSlots = windowSlots.length > 1;
    const coverageMinStrict = Math.min(60, windowSlots.length * 5);

    const all = stations.map((stn) => {
      const rainfallNow = currentReadings.find((r) => r.stationId === stn.id)?.value ?? null;

      // Preferred: strict sum from normalized window
      let lastHour = hasMultiSlots ? accByStation.get(stn.id) : null;
      let lastHourCoverageMin = hasMultiSlots ? coverageMinStrict : 0;

      // Fallback: rolling buffer when only 1 slot is available
      if (!hasMultiSlots) {
        lastHour = _sumLastHourFromRolling(stn.id, newestTs);
        lastHourCoverageMin = _coverageLastHourFromRolling(stn.id, newestTs);
      }

      // Sanity: clamp negatives and NaNs
      if (!Number.isFinite(lastHour) || lastHour < 0) lastHour = null;

      const distanceKm = (userCoords && stn?.location)
        ? getDistanceFromLatLonInKm(
            userCoords.latitude, userCoords.longitude,
            stn.location.latitude, stn.location.longitude
          )
        : null;

      return {
        id: stn.id,
        name: stn.name,
        location: stn.location,           // { latitude, longitude }
        rainfall: rainfallNow,            // latest 5-min (mm)
        lastHour,                         // true last 60-min total (mm)
        lastHourCoverageMin,              // minutes of data considered (0..60)
        distanceKm,                       // for nearest logic in UI
      };
    });

    return { stations: all, timestamp: windowSlots[0]?.timestamp || null };
  } catch (err) {
    warnOnce('NEA rainfall', `fetchRainfallData -> fallback to bundled: ${err?.message || err}`);

    // Fallback attempts to normalize snapshot into the same { stations: [], timestamp } shape
    const norm = await snapOr((snap) => {
      const r = snap?.rain;
      if (!r) return null;

      // Case 1: already normalized
      if (Array.isArray(r?.stations)) {
        return { stations: r.stations, timestamp: r.timestamp ?? null };
      }

      // Case 2: legacy arrays
      const list = r?.stations || r?.readings || [];
      if (!Array.isArray(list) || !list.length) return null;

      const stations = list.map((s) => ({
        id: s.id,
        name: s.name,
        location: s.location,
        rainfall: s.rainfall ?? s.value ?? s.readings?.[0]?.value ?? null,
        lastHour: s.lastHour ?? 0,
        lastHourCoverageMin: 0,
        distanceKm: null,
      }));

      return { stations, timestamp: r.timestamp ?? null };
    }, null);

    return norm || { stations: [], timestamp: null };
  }
};

/* =========================================================================
   NEA: PM2.5 (TTL 5m)
   ========================================================================= */
export const fetchPm25Data = async () => {
  try {
    const url = 'https://api-open.data.gov.sg/v2/real-time/api/pm25';
    const json = await fetchJSON_RL(url, 'NEA PM2.5', { ttlMs: 5 * 60 * 1000, timeoutMs: 8000 });

    const readings = json?.data?.items?.[0]?.readings?.pm25_one_hourly ?? {};
    const regions  = json?.data?.regionMetadata ?? [];
    if (!regions.length) throw new Error('NEA PM2.5 payload empty');

    const out = regions.map((region) => ({
      name: region.name,
      location: region.labelLocation,
      value: readings[region.name] ?? null,
    }));

    return out;
  } catch (err) {
    warnOnce('NEA PM2.5', `fetchPm25Data -> fallback to bundled: ${err?.message || err}`);
    return await snapOr((snap) => snap?.pm25 ?? [], []);
  }
};

/* =========================================================================
   NEA: Wind (speed + direction) (TTL 60s)
   ========================================================================= */
export const fetchWindData = async () => {
  try {
    const speedURL = 'https://api-open.data.gov.sg/v2/real-time/api/wind-speed';
    const dirURL   = 'https://api-open.data.gov.sg/v2/real-time/api/wind-direction';

    const [speedJson, dirJson] = await Promise.all([
      fetchJSON_RL(speedURL, 'NEA wind-speed', { ttlMs: 60 * 1000, timeoutMs: 8000 }),
      fetchJSON_RL(dirURL,   'NEA wind-direction', { ttlMs: 60 * 1000, timeoutMs: 8000 }),
    ]);

    const stations      = speedJson?.data?.stations ?? [];
    const speedReadings = speedJson?.data?.readings?.[0]?.data ?? [];
    const dirReadings   = dirJson?.data?.readings?.[0]?.data ?? [];
    if (!stations.length) throw new Error('NEA wind payload empty');

    const out = stations.map((stn) => {
      const speed     = speedReadings.find((r) => r.stationId === stn.id)?.value ?? null;   // knots
      const direction = dirReadings.find((r) => r.stationId === stn.id)?.value ?? null;     // degrees
      return { id: stn.id, name: stn.name, location: stn.location, speed, direction };
    });

    return out;
  } catch (err) {
    warnOnce('NEA wind', `fetchWindData -> fallback to bundled: ${err?.message || err}`);
    return await snapOr((snap) => {
      if (Array.isArray(snap?.wind) && snap.wind.length) return snap.wind;
      const ws = snap?.windSpeedStations ?? [];
      const wd = snap?.windDirStations ?? [];
      if (ws.length) {
        return ws.map((s) => ({
          id: s.id, name: s.name, location: s.location,
          speed: s.value ?? null,
          direction: wd.find((d) => d.id === s.id)?.value ?? null
        }));
      }
      return [];
    }, []);
  }
};

/* =========================================================================
   NEA: Humidity (TTL 2m)
   ========================================================================= */
export const fetchHumidityData = async () => {
  try {
    const url = 'https://api-open.data.gov.sg/v2/real-time/api/relative-humidity';
    const json = await fetchJSON_RL(url, 'NEA humidity', { ttlMs: 2 * 60 * 1000, timeoutMs: 8000 });

    const stations = json?.data?.stations ?? [];
    const readings = json?.data?.readings?.[0]?.data ?? [];
    if (!stations.length) throw new Error('NEA humidity payload empty');

    const out = stations.map((stn) => ({
      id: stn.id,
      name: stn.name,
      location: stn.location,
      value: readings.find((r) => r.stationId === stn.id)?.value ?? null,
    }));

    return out;
  } catch (err) {
    warnOnce('NEA humidity', `fetchHumidityData -> fallback to bundled: ${err?.message || err}`);
    return await snapOr((snap) => snap?.humidity ?? [], []);
  }
};

/* =========================================================================
   NEA: Temperature (TTL 2m)
   ========================================================================= */
export const fetchTemperatureData = async () => {
  try {
    const url = 'https://api-open.data.gov.sg/v2/real-time/api/air-temperature';
    const json = await fetchJSON_RL(url, 'NEA temperature', { ttlMs: 2 * 60 * 1000, timeoutMs: 8000 });

    const stations = json?.data?.stations ?? [];
    const readings = json?.data?.readings?.[0]?.data ?? [];
    if (!stations.length) throw new Error('NEA temperature payload empty');

    const out = stations.map((stn) => ({
      id: stn.id,
      name: stn.name,
      location: stn.location,
      value: readings.find((r) => r.stationId === stn.id)?.value ?? null,
    }));

    return out;
  } catch (err) {
    warnOnce('NEA temperature', `fetchTemperatureData -> fallback to bundled: ${err?.message || err}`);
    return await snapOr((snap) => snap?.temp ?? [], []);
  }
};

// /* =========================================================================
//    OpenWeather (fallback/augment)
//    ========================================================================= */
// const OPENWEATHER_API_KEY = '01850dee0efccf6a94d704212d11bbc3'; // consider env var in production
// const OW_BASE = 'https://api.openweathermap.org/data/2.5';

// export const fetchOWCurrent = async (userCoords, opts = {}) => {
//   if (!(await isConnected())) {
//     console.warn('No internet connection – skipping OpenWeather current fetch.');
//     return null;
//   }
//   const { latitude, longitude } = userCoords || {};
//   if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;

//   const lang = opts.lang || 'en';
//   const cacheKey = `ow:current:${latitude.toFixed(3)},${longitude.toFixed(3)}:${lang}`;
//   const cached = getCache(cacheKey);
//   if (cached) return cached;

//   const params = new URLSearchParams({
//     lat: String(latitude),
//     lon: String(longitude),
//     appid: OPENWEATHER_API_KEY,
//     units: 'metric',
//     lang,
//   });

//   try {
//     const res = await fetchWithTimeout(`${OW_BASE}/weather?${params.toString()}`);
//     requireOk(res, 'OW current');
//     const json = await res.json();
//     setCache(cacheKey, json, 2 * 60 * 1000);
//     return json;
//   } catch (err) {
//     console.error('Error fetching OpenWeather current:', err);
//     return null;
//   }
// };

// export const fetchOWForecast5d = async (userCoords, opts = {}) => {
//   if (!(await isConnected())) {
//     console.warn('No internet connection – skipping OpenWeather forecast fetch.');
//     return null;
//   }
//   const { latitude, longitude } = userCoords || {};
//   if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;

//   const lang = opts.lang || 'en';
//   const cnt = opts.cnt ? Number(opts.cnt) : undefined;
//   const cacheKey = `ow:5d:${latitude.toFixed(3)},${longitude.toFixed(3)}:${lang}:${cnt || 'all'}`;
//   const cached = getCache(cacheKey);
//   if (cached) return cached;

//   const params = new URLSearchParams({
//     lat: String(latitude),
//     lon: String(longitude),
//     appid: OPENWEATHER_API_KEY,
//     units: 'metric',
//     lang,
//   });
//   if (cnt) params.set('cnt', String(cnt));

//   try {
//     const res = await fetchWithTimeout(`${OW_BASE}/forecast?${params.toString()}`);
//     requireOk(res, 'OW forecast');
//     const json = await res.json();
//     setCache(cacheKey, json, 45 * 60 * 1000);
//     return json;
//   } catch (err) {
//     console.error('Error fetching OpenWeather 5-day forecast:', err);
//     return null;
//   }
// };

// /* =========================================================================
//    Convenience aggregators
//    ========================================================================= */
// export const getNowWeather = async (userCoords, lang = 'en') => {
//   const nea = await fetchWeatherForecast();
//   let nearestArea = null;
//   let neaForecastText = null;

//   if (nea?.metadata?.length && userCoords) {
//     const areaName = getNearestForecastArea(userCoords, nea.metadata);
//     nearestArea = areaName || null;
//     if (areaName) {
//       neaForecastText = nea?.forecasts?.find((f) => f.area === areaName)?.forecast || null;
//     }
//   }

//   const ow = await fetchOWCurrent(userCoords, { lang });

//   return {
//     area: nearestArea,
//     neaForecastText,                 // e.g., "Light Rain"
//     temp: ow?.main?.temp ?? null,    // °C
//     feelsLike: ow?.main?.feels_like ?? null,
//     pressure: ow?.main?.pressure ?? null, // hPa
//     humidity: ow?.main?.humidity ?? null, // %
//     visibility: ow?.visibility ?? null,   // m
//     windSpeed: ow?.wind?.speed ?? null,   // m/s (OW)
//     windDeg: ow?.wind?.deg ?? null,
//     clouds: ow?.clouds?.all ?? null,      // %
//     rain1h: ow?.rain?.['1h'] ?? null,     // mm
//     timestamp: ow?.dt ? new Date(ow.dt * 1000).toISOString() : null,
//     source: { nea: Boolean(nea), openweather: Boolean(ow) },
//   };
// };

// export const groupOWForecastByDay = (ow5d) => {
//   if (!ow5d?.list?.length) return [];
//   const byDay = {};
//   ow5d.list.forEach((slot) => {
//     const d = new Date((slot.dt || 0) * 1000);
//     const key = d.toISOString().slice(0, 10);
//     (byDay[key] ||= []).push(slot);
//   });
//   return Object.entries(byDay).map(([date, slots]) => {
//     const temps = slots.map((s) => s?.main?.temp).filter((v) => typeof v === 'number');
//     const popMax = Math.max(0, ...slots.map((s) => (typeof s.pop === 'number' ? s.pop : 0)));
//     const min = temps.length ? Math.min(...temps) : null;
//     const max = temps.length ? Math.max(...temps) : null;
//     const midday = slots.find((s) => (s.dt_txt || '').includes('12:00:00')) || slots[0];
//     const icon = midday?.weather?.[0]?.icon || null;
//     const desc = midday?.weather?.[0]?.description || null;
//     return { date, min, max, popMax, icon, desc, slots };
//   });
// };

export { getDistanceFromLatLonInKm };
