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
   Simple in-memory cache
   ========================================================================= */
const _cache = new Map();
const getCache = (k) => {
  const v = _cache.get(k);
  if (!v) return null;
  if (Date.now() > v.exp) { _cache.delete(k); return null; }
  return v.data;
};
const setCache = (k, data, ttlMs) => _cache.set(k, { data, exp: Date.now() + ttlMs });

/* =========================================================================
   Snapshot (bundled-only)
   ========================================================================= */
let _lastSnapshotSource = null; // 'assets' | null
export const getSnapshotDebugInfo = () => ({ source: _lastSnapshotSource });

async function loadBundledSnapshot() {
  try {
    _lastSnapshotSource = 'assets';
    if (__DEV__) console.log('[snapshot] Loaded bundled env_snapshot.json');
    return bundledSnapshot; // Metro already parsed it
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
export const estimateFloodRisk = (rainfall, lastHour) => {
  if (rainfall > 10 || lastHour > 30) return 'High';
  if (rainfall > 5 || lastHour > 15) return 'Moderate';
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
   NEA: 2-hour weather forecast
   ========================================================================= */
export const fetchWeatherForecast = async () => {
  try {
    if (!(await isConnected())) throw new Error('offline');

    const cacheKey = 'nea:twohr';
    const cached = getCache(cacheKey);
    if (cached) return cached;

    const res = await fetchWithTimeout('https://api-open.data.gov.sg/v2/real-time/api/two-hr-forecast');
    requireOk(res, 'NEA 2hr forecast');

    const json = await res.json();
    const data = {
      forecasts: json?.data?.items?.[0]?.forecasts ?? [],
      metadata: json?.data?.area_metadata ?? [],
      timestamp: json?.data?.items?.[0]?.timestamp ?? null,
    };
    if (!data.forecasts.length || !data.metadata.length) {
      throw new Error('NEA 2hr payload empty');
    }

    setCache(cacheKey, data, 5 * 60 * 1000);
    return data;
  } catch (err) {
    console.warn('fetchWeatherForecast -> fallback to bundled:', err?.message || err);
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
   NEA: Real-time rainfall (ALL STATIONS + last-hour accumulation)
   ========================================================================= */
export const fetchRainfallData = async (userCoords) => {
  try {
    if (!(await isConnected())) throw new Error('offline');

    const res = await fetchWithTimeout('https://api-open.data.gov.sg/v2/real-time/api/rainfall');
    requireOk(res, 'NEA rainfall');

    const json = await res.json();
    const stations = json?.data?.stations ?? [];
    const readingSets = json?.data?.readings ?? []; // multiple 5-min sets (most recent first)
    const firstTs = readingSets?.[0]?.timestamp ?? null;
    if (!stations.length || !readingSets.length) throw new Error('NEA rainfall payload empty');

    // Build a map of last-hour accumulation per station
    const lastHourCount = Math.min(12, readingSets.length); // 12 * 5min = 60min
    const accByStation = new Map();
    for (let i = 0; i < lastHourCount; i++) {
      for (const d of (readingSets[i]?.data ?? [])) {
        const prev = accByStation.get(d.stationId) ?? 0;
        const val = (typeof d.value === 'number' && Number.isFinite(d.value)) ? d.value : 0;
        accByStation.set(d.stationId, prev + val);
      }
    }

    // Single “current” reading set to display “now” value
    const currentReadings = readingSets[0]?.data ?? [];

    const all = stations.map((stn) => {
      const rainfallNow = currentReadings.find((r) => r.stationId === stn.id)?.value ?? null;
      const lastHour = accByStation.get(stn.id) ?? 0;
      const distanceKm = (userCoords && stn?.location)
        ? getDistanceFromLatLonInKm(
            userCoords.latitude, userCoords.longitude,
            stn.location.latitude, stn.location.longitude
          )
        : null;

      return {
        id: stn.id,
        name: stn.name,
        location: stn.location,       // { latitude, longitude }
        rainfall: rainfallNow,        // mm in the latest 5-min window
        lastHour,                     // mm accumulated over last hour
        distanceKm,                   // convenience for UI
      };
    });

    return { stations: all, timestamp: firstTs };
  } catch (err) {
    console.warn('fetchRainfallData -> fallback to bundled:', err?.message || err);

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
        distanceKm: null,
      }));

      return { stations, timestamp: r.timestamp ?? null };
    }, null);

    return norm || { stations: [], timestamp: null };
  }
};

/* =========================================================================
   NEA: PM2.5
   ========================================================================= */
export const fetchPm25Data = async () => {
  try {
    if (!(await isConnected())) throw new Error('offline');

    const cacheKey = 'nea:pm25';
    const cached = getCache(cacheKey);
    if (cached) return cached;

    const res = await fetchWithTimeout('https://api-open.data.gov.sg/v2/real-time/api/pm25');
    requireOk(res, 'NEA PM2.5');

    const json = await res.json();
    const readings = json?.data?.items?.[0]?.readings?.pm25_one_hourly ?? {};
    const regions  = json?.data?.regionMetadata ?? [];
    if (!regions.length) throw new Error('NEA PM2.5 payload empty');

    const out = regions.map((region) => ({
      name: region.name,
      location: region.labelLocation,
      value: readings[region.name] ?? null,
    }));

    setCache(cacheKey, out, 5 * 60 * 1000);
    return out;
  } catch (err) {
    console.warn('fetchPm25Data -> fallback to bundled:', err?.message || err);
    return await snapOr((snap) => snap?.pm25 ?? [], []);
  }
};

/* =========================================================================
   NEA: Wind (speed + direction)
   ========================================================================= */
export const fetchWindData = async () => {
  try {
    if (!(await isConnected())) throw new Error('offline');

    const cacheKey = 'nea:wind';
    const cached = getCache(cacheKey);
    if (cached) return cached;

    const speedRes = await fetchWithTimeout('https://api-open.data.gov.sg/v2/real-time/api/wind-speed');
    const dirRes   = await fetchWithTimeout('https://api-open.data.gov.sg/v2/real-time/api/wind-direction');
    requireOk(speedRes, 'NEA wind-speed');
    requireOk(dirRes,   'NEA wind-direction');

    const speedJson = await speedRes.json();
    const dirJson   = await dirRes.json();

    const stations      = speedJson?.data?.stations ?? [];
    const speedReadings = speedJson?.data?.readings?.[0]?.data ?? [];
    const dirReadings   = dirJson?.data?.readings?.[0]?.data ?? [];
    if (!stations.length) throw new Error('NEA wind payload empty');

    const out = stations.map((stn) => {
      const speed     = speedReadings.find((r) => r.stationId === stn.id)?.value ?? null;   // km/h
      const direction = dirReadings.find((r) => r.stationId === stn.id)?.value ?? null;     // degrees
      return { id: stn.id, name: stn.name, location: stn.location, speed, direction };
    });

    setCache(cacheKey, out, 2 * 60 * 1000);
    return out;
  } catch (err) {
    console.warn('fetchWindData -> fallback to bundled:', err?.message || err);
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
   NEA: Humidity
   ========================================================================= */
export const fetchHumidityData = async () => {
  try {
    if (!(await isConnected())) throw new Error('offline');

    const cacheKey = 'nea:humidity';
    const cached = getCache(cacheKey);
    if (cached) return cached;

    const res = await fetchWithTimeout('https://api-open.data.gov.sg/v2/real-time/api/relative-humidity');
    requireOk(res, 'NEA humidity');

    const json = await res.json();
    const stations = json?.data?.stations ?? [];
    const readings = json?.data?.readings?.[0]?.data ?? [];
    if (!stations.length) throw new Error('NEA humidity payload empty');

    const out = stations.map((stn) => ({
      id: stn.id,
      name: stn.name,
      location: stn.location,
      value: readings.find((r) => r.stationId === stn.id)?.value ?? null,
    }));

    setCache(cacheKey, out, 2 * 60 * 1000);
    return out;
  } catch (err) {
    console.warn('fetchHumidityData -> fallback to bundled:', err?.message || err);
    return await snapOr((snap) => snap?.humidity ?? [], []);
  }
};

/* =========================================================================
   NEA: Temperature
   ========================================================================= */
export const fetchTemperatureData = async () => {
  try {
    if (!(await isConnected())) throw new Error('offline');

    const cacheKey = 'nea:temp';
    const cached = getCache(cacheKey);
    if (cached) return cached;

    const res = await fetchWithTimeout('https://api-open.data.gov.sg/v2/real-time/api/air-temperature');
    requireOk(res, 'NEA temperature');

    const json = await res.json();
    const stations = json?.data?.stations ?? [];
    const readings = json?.data?.readings?.[0]?.data ?? [];
    if (!stations.length) throw new Error('NEA temperature payload empty');

    const out = stations.map((stn) => ({
      id: stn.id,
      name: stn.name,
      location: stn.location,
      value: readings.find((r) => r.stationId === stn.id)?.value ?? null,
    }));

    setCache(cacheKey, out, 2 * 60 * 1000);
    return out;
  } catch (err) {
    console.warn('fetchTemperatureData -> fallback to bundled:', err?.message || err);
    return await snapOr((snap) => snap?.temp ?? [], []);
  }
};

/* =========================================================================
   OpenWeather (fallback/augment)
   ========================================================================= */
const OPENWEATHER_API_KEY = '01850dee0efccf6a94d704212d11bbc3'; // consider env var in production
const OW_BASE = 'https://api.openweathermap.org/data/2.5';

export const fetchOWCurrent = async (userCoords, opts = {}) => {
  if (!(await isConnected())) {
    console.warn('No internet connection – skipping OpenWeather current fetch.');
    return null;
  }
  const { latitude, longitude } = userCoords || {};
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;

  const lang = opts.lang || 'en';
  const cacheKey = `ow:current:${latitude.toFixed(3)},${longitude.toFixed(3)}:${lang}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    appid: OPENWEATHER_API_KEY,
    units: 'metric',
    lang,
  });

  try {
    const res = await fetchWithTimeout(`${OW_BASE}/weather?${params.toString()}`);
    requireOk(res, 'OW current');
    const json = await res.json();
    setCache(cacheKey, json, 2 * 60 * 1000);
    return json;
  } catch (err) {
    console.error('Error fetching OpenWeather current:', err);
    return null;
  }
};

export const fetchOWForecast5d = async (userCoords, opts = {}) => {
  if (!(await isConnected())) {
    console.warn('No internet connection – skipping OpenWeather forecast fetch.');
    return null;
  }
  const { latitude, longitude } = userCoords || {};
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;

  const lang = opts.lang || 'en';
  const cnt = opts.cnt ? Number(opts.cnt) : undefined;
  const cacheKey = `ow:5d:${latitude.toFixed(3)},${longitude.toFixed(3)}:${lang}:${cnt || 'all'}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    appid: OPENWEATHER_API_KEY,
    units: 'metric',
    lang,
  });
  if (cnt) params.set('cnt', String(cnt));

  try {
    const res = await fetchWithTimeout(`${OW_BASE}/forecast?${params.toString()}`);
    requireOk(res, 'OW forecast');
    const json = await res.json();
    setCache(cacheKey, json, 45 * 60 * 1000);
    return json;
  } catch (err) {
    console.error('Error fetching OpenWeather 5-day forecast:', err);
    return null;
  }
};

/* =========================================================================
   Convenience aggregators
   ========================================================================= */
export const getNowWeather = async (userCoords, lang = 'en') => {
  const nea = await fetchWeatherForecast();
  let nearestArea = null;
  let neaForecastText = null;

  if (nea?.metadata?.length && userCoords) {
    const areaName = getNearestForecastArea(userCoords, nea.metadata);
    nearestArea = areaName || null;
    if (areaName) {
      neaForecastText = nea?.forecasts?.find((f) => f.area === areaName)?.forecast || null;
    }
  }

  const ow = await fetchOWCurrent(userCoords, { lang });

  return {
    area: nearestArea,
    neaForecastText,                 // e.g., "Light Rain"
    temp: ow?.main?.temp ?? null,    // °C
    feelsLike: ow?.main?.feels_like ?? null,
    pressure: ow?.main?.pressure ?? null, // hPa
    humidity: ow?.main?.humidity ?? null, // %
    visibility: ow?.visibility ?? null,   // m
    windSpeed: ow?.wind?.speed ?? null,   // m/s (OW)
    windDeg: ow?.wind?.deg ?? null,
    clouds: ow?.clouds?.all ?? null,      // %
    rain1h: ow?.rain?.['1h'] ?? null,     // mm
    timestamp: ow?.dt ? new Date(ow.dt * 1000).toISOString() : null,
    source: { nea: Boolean(nea), openweather: Boolean(ow) },
  };
};

export const groupOWForecastByDay = (ow5d) => {
  if (!ow5d?.list?.length) return [];
  const byDay = {};
  ow5d.list.forEach((slot) => {
    const d = new Date((slot.dt || 0) * 1000);
    const key = d.toISOString().slice(0, 10);
    (byDay[key] ||= []).push(slot);
  });
  return Object.entries(byDay).map(([date, slots]) => {
    const temps = slots.map((s) => s?.main?.temp).filter((v) => typeof v === 'number');
    const popMax = Math.max(0, ...slots.map((s) => (typeof s.pop === 'number' ? s.pop : 0)));
    const min = temps.length ? Math.min(...temps) : null;
    const max = temps.length ? Math.max(...temps) : null;
    const midday = slots.find((s) => (s.dt_txt || '').includes('12:00:00')) || slots[0];
    const icon = midday?.weather?.[0]?.icon || null;
    const desc = midday?.weather?.[0]?.description || null;
    return { date, min, max, popMax, icon, desc, slots };
  });
};

export { getDistanceFromLatLonInKm };
