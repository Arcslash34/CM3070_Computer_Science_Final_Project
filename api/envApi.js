// api/envApi.js
// NOTE: Local SG app. Primary data from data.gov.sg; OpenWeather used to augment/fallback.
// Offline fallback ONLY uses the bundled /assets/env_snapshot.json. No runtime saving.

import NetInfo from "@react-native-community/netinfo";
import bundledSnapshot from "../assets/env_snapshot.json";

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
  return fetch(url, { ...opts, signal: controller.signal }).finally(() =>
    clearTimeout(t)
  );
};

// throw on non-2xx
const requireOk = (res, label = "request") => {
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
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/* =========================================================================
   Simple in-memory cache + rate-limit helpers
   ========================================================================= */
const _cache = new Map(); // key -> { data, exp }
const _inflight = new Map(); // url -> Promise
const _lastWarnAt = new Map(); // label -> timestamp (to de-dup warnings)

const getCache = (k) => {
  const v = _cache.get(k);
  if (!v) return null;
  if (Date.now() > v.exp) {
    _cache.delete(k);
    return null;
  }
  return v.data;
};
const setCache = (k, data, ttlMs) =>
  _cache.set(k, { data, exp: Date.now() + ttlMs });

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
async function fetchJSON_RL(
  url,
  label,
  { ttlMs = 60000, timeoutMs = 8000 } = {}
) {
  // 1) Return cache if fresh
  const cached = getCache(url);
  if (cached) return cached;

  // 2) Deduplicate in-flight for same URL
  if (_inflight.has(url)) return _inflight.get(url);

  const run = async () => {
    if (!(await isConnected())) throw new Error("offline");
    let res = await fetchWithTimeout(url, {}, timeoutMs);

    if (res.status === 429) {
      // honor Retry-After header up to 2s; else backoff 800-1200ms
      const ra = res.headers.get("Retry-After");
      let waitMs = 0;
      if (ra) {
        const n = Number(ra);
        waitMs = Number.isFinite(n) ? Math.min(2000, Math.max(0, n * 1000)) : 0;
      }
      if (!waitMs) waitMs = 800 + Math.floor(Math.random() * 400);
      await new Promise((r) => setTimeout(r, waitMs));
      // retry once
      res = await fetchWithTimeout(url, {}, timeoutMs);
    }

    requireOk(res, label);
    const json = await res.json();
    setCache(url, json, ttlMs);
    return json;
  };

  const p = run()
    .finally(() => _inflight.delete(url))
    .catch((err) => {
      if (String(err?.message || "").includes("429")) {
        warnOnce(
          label,
          `${label} rate-limited (429) - using fallback if available`
        );
      } else {
        warnOnce(label, `${label} fetch error: ${err?.message || err}`);
      }
      throw err;
    });

  _inflight.set(url, p);
  return p;
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
    _lastSnapshotSource = "assets";
    if (__DEV__) console.log("[snapshot] Loaded bundled env_snapshot.json");
    _bundledSnapshotCache = bundledSnapshot; // Metro already parsed it
    return _bundledSnapshotCache;
  } catch (e) {
    console.warn("Bundled env_snapshot.json import failed:", e?.message || e);
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
export const estimateFloodRisk = (rainfall, opts = {}) => {
  const { nowHigh = 10, nowMod = 5 } = opts;
  const r = Number.isFinite(rainfall) ? rainfall : 0;

  if (r > nowHigh) return "High";
  if (r > nowMod) return "Moderate";
  return "Low";
};


export const getNearestForecastArea = (userCoords, metadata) => {
  let closest = null;
  let minDist = Infinity;
  for (const area of metadata || []) {
    const { latitude, longitude } = area.label_location || {};
    if (typeof latitude !== "number" || typeof longitude !== "number") continue;
    const dist = getDistanceFromLatLonInKm(
      userCoords.latitude,
      userCoords.longitude,
      latitude,
      longitude
    );
    if (dist < minDist) {
      minDist = dist;
      closest = area.name;
    }
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
  const sorted = [...readingSets].sort(
    (a, b) => _ts(b.timestamp) - _ts(a.timestamp)
  );

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
    const url = "https://api-open.data.gov.sg/v2/real-time/api/two-hr-forecast";
    const raw = await fetchJSON_RL(url, "NEA 2hr forecast", {
      ttlMs: 5 * 60 * 1000,
      timeoutMs: 8000,
    });

    const data = {
      forecasts: raw?.data?.items?.[0]?.forecasts ?? [],
      metadata: raw?.data?.area_metadata ?? [],
      timestamp: raw?.data?.items?.[0]?.timestamp ?? null,
    };
    if (!data.forecasts.length || !data.metadata.length)
      throw new Error("NEA 2hr payload empty");

    return data;
  } catch (err) {
    warnOnce(
      "NEA 2hr forecast",
      `fetchWeatherForecast -> fallback to bundled: ${err?.message || err}`
    );
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
   NEA: Real-time rainfall (ALL STATIONS, 5-min only)
   TTL 60s
   ========================================================================= */
export const fetchRainfallData = async (userCoords) => {
  try {
    const url = "https://api-open.data.gov.sg/v2/real-time/api/rainfall";
    const json = await fetchJSON_RL(url, "NEA rainfall", {
      ttlMs: 60 * 1000,
      timeoutMs: 8000,
    });

    const stations = json?.data?.stations ?? [];
    const readingSets = json?.data?.readings ?? [];
    if (!stations.length || !readingSets.length)
      throw new Error("NEA rainfall payload empty");

    // Normalize slots to last 60 min, dedup 5-min buckets, cap to 12
    const windowSlots = normalizeRainSlots(readingSets);
    if (!windowSlots.length) {
      return {
        stations: stations.map((s) => ({
          id: s.id,
          name: s.name,
          location: s.location,
          rainfall: null,
          distanceKm: null,
        })),
        timestamp: null,
      };
    }

    const currentReadings = windowSlots[0]?.data ?? [];
    const all = stations.map((stn) => {
    const rainfallNow =
      currentReadings.find((r) => r.stationId === stn.id)?.value ?? null;

    const distanceKm =
      userCoords && stn?.location
        ? getDistanceFromLatLonInKm(
            userCoords.latitude,
            userCoords.longitude,
            stn.location.latitude,
            stn.location.longitude
          )
        : null;

    return {
      id: stn.id,
      name: stn.name,
      location: stn.location,
      rainfall: rainfallNow,       // latest 5-min (mm)
      distanceKm,
    };
  });

    return { stations: all, timestamp: windowSlots[0]?.timestamp || null };
  } catch (err) {
    warnOnce(
      "NEA rainfall",
      `fetchRainfallData -> fallback to bundled: ${err?.message || err}`
    );

    // Fallback attempts to normalize snapshot...
    const norm = await snapOr((snap) => {
      const r = snap?.rain;
      if (!r) return null;

      // Case 1: already normalized
      if (Array.isArray(r?.stations)) {
        return { stations: r.stations.map(({ lastHour, lastHourCoverageMin, ...s }) => s), timestamp: r.timestamp ?? null };
      }

      // Case 2: legacy arrays
      const list = r?.stations || r?.readings || [];
      if (!Array.isArray(list) || !list.length) return null;

      const stations = list.map((s) => ({
        id: s.id,
        name: s.name,
        location: s.location,
        rainfall: s.rainfall ?? s.value ?? s.readings?.[0]?.value ?? null,
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
    const url = "https://api-open.data.gov.sg/v2/real-time/api/pm25";
    const json = await fetchJSON_RL(url, "NEA PM2.5", {
      ttlMs: 5 * 60 * 1000,
      timeoutMs: 8000,
    });

    const readings = json?.data?.items?.[0]?.readings?.pm25_one_hourly ?? {};
    const regions = json?.data?.regionMetadata ?? [];
    if (!regions.length) throw new Error("NEA PM2.5 payload empty");

    const out = regions.map((region) => ({
      name: region.name,
      location: region.labelLocation,
      value: readings[region.name] ?? null,
    }));

    return out;
  } catch (err) {
    warnOnce(
      "NEA PM2.5",
      `fetchPm25Data -> fallback to bundled: ${err?.message || err}`
    );
    return await snapOr((snap) => snap?.pm25 ?? [], []);
  }
};

/* =========================================================================
   NEA: Wind (speed + direction) (TTL 60s)
   ========================================================================= */
export const fetchWindData = async () => {
  try {
    const speedURL = "https://api-open.data.gov.sg/v2/real-time/api/wind-speed";
    const dirURL =
      "https://api-open.data.gov.sg/v2/real-time/api/wind-direction";

    const [speedJson, dirJson] = await Promise.all([
      fetchJSON_RL(speedURL, "NEA wind-speed", {
        ttlMs: 60 * 1000,
        timeoutMs: 8000,
      }),
      fetchJSON_RL(dirURL, "NEA wind-direction", {
        ttlMs: 60 * 1000,
        timeoutMs: 8000,
      }),
    ]);

    const stations = speedJson?.data?.stations ?? [];
    const speedReadings = speedJson?.data?.readings?.[0]?.data ?? [];
    const dirReadings = dirJson?.data?.readings?.[0]?.data ?? [];
    if (!stations.length) throw new Error("NEA wind payload empty");

    const out = stations.map((stn) => {
      const speed =
        speedReadings.find((r) => r.stationId === stn.id)?.value ?? null; // knots
      const direction =
        dirReadings.find((r) => r.stationId === stn.id)?.value ?? null; // degrees
      return {
        id: stn.id,
        name: stn.name,
        location: stn.location,
        speed,
        direction,
      };
    });

    return out;
  } catch (err) {
    warnOnce(
      "NEA wind",
      `fetchWindData -> fallback to bundled: ${err?.message || err}`
    );
    return await snapOr((snap) => {
      if (Array.isArray(snap?.wind) && snap.wind.length) return snap.wind;
      const ws = snap?.windSpeedStations ?? [];
      const wd = snap?.windDirStations ?? [];
      if (ws.length) {
        return ws.map((s) => ({
          id: s.id,
          name: s.name,
          location: s.location,
          speed: s.value ?? null,
          direction: wd.find((d) => d.id === s.id)?.value ?? null,
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
    const url =
      "https://api-open.data.gov.sg/v2/real-time/api/relative-humidity";
    const json = await fetchJSON_RL(url, "NEA humidity", {
      ttlMs: 2 * 60 * 1000,
      timeoutMs: 8000,
    });

    const stations = json?.data?.stations ?? [];
    const readings = json?.data?.readings?.[0]?.data ?? [];
    if (!stations.length) throw new Error("NEA humidity payload empty");

    const out = stations.map((stn) => ({
      id: stn.id,
      name: stn.name,
      location: stn.location,
      value: readings.find((r) => r.stationId === stn.id)?.value ?? null,
    }));

    return out;
  } catch (err) {
    warnOnce(
      "NEA humidity",
      `fetchHumidityData -> fallback to bundled: ${err?.message || err}`
    );
    return await snapOr((snap) => snap?.humidity ?? [], []);
  }
};

/* =========================================================================
   NEA: Temperature (TTL 2m)
   ========================================================================= */
export const fetchTemperatureData = async () => {
  try {
    const url = "https://api-open.data.gov.sg/v2/real-time/api/air-temperature";
    const json = await fetchJSON_RL(url, "NEA temperature", {
      ttlMs: 2 * 60 * 1000,
      timeoutMs: 8000,
    });

    const stations = json?.data?.stations ?? [];
    const readings = json?.data?.readings?.[0]?.data ?? [];
    if (!stations.length) throw new Error("NEA temperature payload empty");

    const out = stations.map((stn) => ({
      id: stn.id,
      name: stn.name,
      location: stn.location,
      value: readings.find((r) => r.stationId === stn.id)?.value ?? null,
    }));

    return out;
  } catch (err) {
    warnOnce(
      "NEA temperature",
      `fetchTemperatureData -> fallback to bundled: ${err?.message || err}`
    );
    return await snapOr((snap) => snap?.temp ?? [], []);
  }
};

export { getDistanceFromLatLonInKm };
