// scripts/snapshot.js
// Fetch live data and write ./assets/env_snapshot.json (for bundling)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// If you're on Node <18, install node-fetch and import it.
// import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---- Config ----
const OUT_PATH = path.resolve(__dirname, '../assets/env_snapshot.json');
const OW_API_KEY = process.env.OW_API_KEY || '01850dee0efccf6a94d704212d11bbc3';

// Small helper to fetch with timeout
async function fetchWithTimeout(url, ms = 8000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) throw new Error(`${url} -> ${res.status}`);
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

async function getPm25() {
  const json = await fetchWithTimeout(NEA.pm25);
  const readings = json.data?.items?.[0]?.readings?.pm25_one_hourly ?? {};
  const regions = json.data?.regionMetadata ?? [];
  return regions.map(r => ({
    name: r.name,
    location: r.labelLocation,
    value: readings[r.name] ?? null,
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
  return stations.map(stn => {
    const speed = speedReadings.find(r => r.stationId === stn.id)?.value ?? null;
    const direction = dirReadings.find(r => r.stationId === stn.id)?.value ?? null;
    return { id: stn.id, name: stn.name, location: stn.location, speed, direction };
  });
}

async function getHumidity() {
  const json = await fetchWithTimeout(NEA.humidity);
  const stations = json.data?.stations ?? [];
  const readings = json.data?.readings?.[0]?.data ?? [];
  return stations.map(stn => ({
    id: stn.id, name: stn.name, location: stn.location,
    value: readings.find(r => r.stationId === stn.id)?.value ?? null,
  }));
}

async function getTemp() {
  const json = await fetchWithTimeout(NEA.temp);
  const stations = json.data?.stations ?? [];
  const readings = json.data?.readings?.[0]?.data ?? [];
  return stations.map(stn => ({
    id: stn.id, name: stn.name, location: stn.location,
    value: readings.find(r => r.stationId === stn.id)?.value ?? null,
  }));
}

/**
 * Rainfall: capture ALL stations, plus computed lastHour per station.
 * NEA returns multiple "readings" arrays (most recent first).
 * We sum the first 12 sets for lastHour (5-min bins -> ~60min).
 */
async function getRainAll() {
  const json = await fetchWithTimeout(NEA.rainfall);

  const stations = json.data?.stations ?? [];
  const readingSets = json.data?.readings ?? [];      // array of { timestamp, data: [{stationId, value}] }
  const latest = readingSets?.[0]?.data ?? [];
  const timestamp = json.data?.readings?.[0]?.timestamp ?? null;

  // Take the most recent 12 sets to approximate last hour
  const lastHourSets = readingSets.slice(0, 12);

  const stationsOut = stations.map(stn => {
    const rainfall = latest.find(r => r.stationId === stn.id)?.value ?? null;

    let lastHour = 0;
    for (const set of lastHourSets) {
      const v = set?.data?.find(d => d.stationId === stn.id)?.value ?? 0;
      // Values are in mm per interval; sum them
      lastHour += (typeof v === 'number' ? v : 0);
    }

    return {
      id: stn.id,
      name: stn.name,
      location: stn.location,
      rainfall,
      lastHour,
    };
  });

  return {
    stations: stationsOut,
    timestamp,
  };
}

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

  // Ensure ./assets exists
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(snapshot, null, 2), 'utf8');

  console.log(`Wrote ${OUT_PATH}`);
}

main().catch(err => {
  console.error('Snapshot failed:', err);
  process.exit(1);
});