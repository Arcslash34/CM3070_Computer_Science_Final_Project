// scripts/snapshot.js
// Fetch live data and write ./assets/env_snapshot.json (for bundling)
//
// Runtime: Node 18+ (native fetch & AbortController).
// For Node <18, uncomment the line below and add node-fetch@3:
// const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

'use strict';

const fs = require('node:fs');
const path = require('node:path');

// ---- Config ----
const OUT_PATH = path.resolve(__dirname, '../assets/env_snapshot.json');

// ---- Utils ----
const isFiniteNumber = (v) => typeof v === 'number' && Number.isFinite(v);

// Small helper to fetch with timeout (aborts the request)
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
  const readings = json.data?.items?.[0]?.readings?.pm25_one_hourly ?? {};
  const regions = json.data?.regionMetadata ?? [];
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

  const stations = speedJson.data?.stations ?? [];
  const speedReadings = speedJson.data?.readings?.[0]?.data ?? [];
  const dirReadings = dirJson.data?.readings?.[0]?.data ?? [];

  return stations.map((stn) => {
    const speed = speedReadings.find((r) => r.stationId === stn.id)?.value;
    const direction = dirReadings.find((r) => r.stationId === stn.id)?.value;
    return {
      id: stn.id,
      name: stn.name,
      location: stn.location,
      speed: isFiniteNumber(speed) ? speed : null,
      direction: isFiniteNumber(direction) ? direction : null,
    };
  });
}

async function getHumidity() {
  const json = await fetchWithTimeout(NEA.humidity);
  const stations = json.data?.stations ?? [];
  const readings = json.data?.readings?.[0]?.data ?? [];

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
  const stations = json.data?.stations ?? [];
  const readings = json.data?.readings?.[0]?.data ?? [];

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
 * Rainfall: capture ALL stations, plus computed lastHour per station.
 * NEA returns multiple "readings" arrays. We:
 *   1) sort them latest->oldest by timestamp (defensive)
 *   2) include only sets within ~1 hour of the latest set (with 2-min slack)
 *   3) sum the values per station across those sets
 */
async function getRainAll() {
  const json = await fetchWithTimeout(NEA.rainfall);

  const stations = json.data?.stations ?? [];
  const readingsRaw = json.data?.readings ?? []; // [{ timestamp, data: [{stationId, value}] }]
  const readingSets = [...readingsRaw].sort(
    (a, b) => new Date(b?.timestamp || 0) - new Date(a?.timestamp || 0)
  );

  const latestSet = readingSets[0];
  const latestTs = new Date(latestSet?.timestamp || 0).getTime();
  const slackMs = 2 * 60 * 1000;

  // time-gated 1-hour window
  const lastHourSets = readingSets.filter((s) => {
    const t = new Date(s?.timestamp || 0).getTime();
    return Number.isFinite(t) && Number.isFinite(latestTs) && (latestTs - t) <= 60 * 60 * 1000 + slackMs;
  });

  const latest = latestSet?.data ?? [];
  const timestamp = latestSet?.timestamp ?? null;

  const stationsOut = stations.map((stn) => {
    const nowValRaw = latest.find((r) => r.stationId === stn.id)?.value;
    const rainfall = isFiniteNumber(nowValRaw) ? nowValRaw : null;

    let lastHour = 0;
    for (const set of lastHourSets) {
      const v = set?.data?.find((d) => d.stationId === stn.id)?.value;
      lastHour += isFiniteNumber(v) ? v : 0;
    }

    const round2 = (x) => (isFiniteNumber(x) ? Math.round(x * 100) / 100 : x);

    return {
      id: stn.id,
      name: stn.name,
      location: stn.location,
      rainfall: round2(rainfall),
      lastHour: round2(lastHour),
    };
  });

  return {
    stations: stationsOut,
    timestamp,
  };
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
