// scripts/snapshot.js
// Fetch live data and write ./assets/env_snapshot.json (for bundling)

'use strict';

const fs = require('node:fs');
const path = require('node:path');

// ---- Config ----
const OUT_PATH = path.resolve(__dirname, '../assets/env_snapshot.json');

// ---- Utils ----
const isFiniteNumber = (v) => typeof v === 'number' && Number.isFinite(v);

// Small helper: fetch with timeout (aborts the request)
async function fetchWithTimeout(url, ms = 8000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  if (typeof t.unref === 'function') t.unref(); // don't keep event loop alive

  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

// NEA endpoints
const NEA = {
  pm25: 'https://api-open.data.gov.sg/v2/real-time/api/pm25',
  windSpeed: 'https://api-open.data.gov.sg/v2/real-time/api/wind-speed',
  windDir: 'https://api-open.data.gov.sg/v2/real-time/api/wind-direction',
  humidity: 'https://api-open.data.gov.sg/v2/real-time/api/relative-humidity',
  temp: 'https://api-open.data.gov.sg/v2/real-time/api/air-temperature',
  rainfall: 'https://api-open.data.gov.sg/v2/real-time/api/rainfall',
};

// ---- Data fetchers ----
async function getPm25() {
  const json = await fetchWithTimeout(NEA.pm25);
  const readings = json?.data?.items?.[0]?.readings?.pm25_one_hourly ?? {};
  const regions = json?.data?.regionMetadata ?? [];
  return regions.map((r) => ({
    name: r.name,
    location: r.labelLocation,
    value: isFiniteNumber(readings[r.name]) ? readings[r.name] : null,
  }));
}

async function getWind() {
  const [speedJson, dirJson] = await Promise.all([
    fetchWithTimeout(NEA.windSpeed),
    fetchWithTimeout(NEA.windDir),
  ]);

  const stations = speedJson?.data?.stations ?? [];
  const speedReadings = speedJson?.data?.readings?.[0]?.data ?? [];
  const dirReadings = dirJson?.data?.readings?.[0]?.data ?? [];

  return stations.map((stn) => {
    const speed = speedReadings.find((r) => r.stationId === stn.id)?.value;
    const direction = dirReadings.find((r) => r.stationId === stn.id)?.value;
    return {
      id: stn.id,
      name: stn.name,
      location: stn.location,
      speed: isFiniteNumber(speed) ? speed : null,       // knots
      direction: isFiniteNumber(direction) ? direction : null, // degrees
    };
  });
}

async function getHumidity() {
  const json = await fetchWithTimeout(NEA.humidity);
  const stations = json?.data?.stations ?? [];
  const readings = json?.data?.readings?.[0]?.data ?? [];

  return stations.map((stn) => {
    const v = readings.find((r) => r.stationId === stn.id)?.value;
    return {
      id: stn.id,
      name: stn.name,
      location: stn.location,
      value: isFiniteNumber(v) ? v : null,
    };
  });
}

async function getTemp() {
  const json = await fetchWithTimeout(NEA.temp);
  const stations = json?.data?.stations ?? [];
  const readings = json?.data?.readings?.[0]?.data ?? [];

  return stations.map((stn) => {
    const v = readings.find((r) => r.stationId === stn.id)?.value;
    return {
      id: stn.id,
      name: stn.name,
      location: stn.location,
      value: isFiniteNumber(v) ? v : null,
    };
  });
}

/**
 * Normalize rainfall reading sets like api.js:
 *  - newest → oldest
 *  - dedupe to newest per 5-min bucket
 *  - trim to last 60 minutes (max 12 buckets)
 */
function normalizeRainSlots(readingSets) {
  const ts = (x) => {
    const n = new Date(x || 0).getTime();
    return Number.isFinite(n) ? n : 0;
  };
  if (!Array.isArray(readingSets) || !readingSets.length) return [];

  const sorted = [...readingSets].sort((a, b) => ts(b?.timestamp) - ts(a?.timestamp));
  const newestTs = ts(sorted[0]?.timestamp);
  if (!newestTs) return [];

  const cutoff = newestTs - 60 * 60 * 1000; // last 60 min
  const seenBuckets = new Set();
  const windowSlots = [];

  for (const s of sorted) {
    const t = ts(s?.timestamp);
    if (!t || t < cutoff) break;
    const bucketKey = Math.floor(t / (5 * 60 * 1000)); // 5-min bucket
    if (seenBuckets.has(bucketKey)) continue; // keep newest only
    seenBuckets.add(bucketKey);
    windowSlots.push(s);
    if (windowSlots.length >= 12) break; // cap ~60 min
  }

  return windowSlots;
}

/**
 * Rainfall snapshot (5-min only):
 *  - Keep latest 5-min `rainfall`
 *  - No 1-hour accumulation, no coverage fields
 */
async function getRainAll() {
  const json = await fetchWithTimeout(NEA.rainfall);

  const stations = json?.data?.stations ?? [];
  const readingSets = json?.data?.readings ?? [];

  const windowSlots = normalizeRainSlots(readingSets);
  if (!windowSlots.length) {
    return {
      stations: stations.map((stn) => ({
        id: stn.id,
        name: stn.name,
        location: stn.location,
        rainfall: null,
      })),
      timestamp: null,
    };
  }

  const latest = windowSlots[0];
  const latestData = latest?.data ?? [];
  const timestamp = latest?.timestamp ?? null;

  const round2 = (x) => (isFiniteNumber(x) ? Math.round(x * 100) / 100 : x);

  const stationsOut = stations.map((stn) => {
    const nowVal = latestData.find((r) => r.stationId === stn.id)?.value;
    const rainfall = isFiniteNumber(nowVal) ? round2(nowVal) : null;

    return {
      id: stn.id,
      name: stn.name,
      location: stn.location,
      rainfall,                 // latest 5-min (mm)
    };
  });

  return { stations: stationsOut, timestamp };
}

// ---- Main ----
async function main() {
  console.log('Generating assets/env_snapshot.json ...');

  const [pm25, wind, humidity, temp, rain] = await Promise.all([
    getPm25().catch(() => []),
    getWind().catch(() => []),
    getHumidity().catch(() => []),
    getTemp().catch(() => []),
    getRainAll().catch(() => null),
  ]);

  const snapshot = {
    rain,       // { timestamp, stations: [...] }
    pm25,       // array
    wind,       // array
    temp,       // array
    humidity,   // array
    _savedAt: Date.now(),
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(snapshot, null, 2), 'utf8');

  console.log(`Wrote ${OUT_PATH}`);
}

main().catch((err) => {
  console.error('Snapshot failed:', err);
  process.exit(1);
});
