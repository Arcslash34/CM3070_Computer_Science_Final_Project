// __tests__/unittest/buildLeafletHtml.test.js
import { buildLeafletHtml } from '../../utils/buildLeafletHtml';

function extractJSON(html, varName) {
  // grab: const VAR=...; (non-greedy until next semicolon)
  const m = html.match(new RegExp(`const\\s+${varName}\\s*=\\s*(.*?);\\s`,'s'));
  if (!m) throw new Error(`Could not extract ${varName}`);
  return JSON.parse(m[1]);
}

describe('buildLeafletHtml (unit)', () => {
  const userCoords = { latitude: 1.23, longitude: 4.56 };
  const datasets = {
    rain: {
      stations: [
        { name: 'A', rainfall: 7.8, location: { latitude: 1.24, longitude: 4.55 } },
        { name: 'B', rainfall: null, location: { latitude: 1.25, longitude: 4.57 } },
        null, // should be safely mapped/ignored by downstream checks
      ],
    },
    pm25: [
      { name: 'North', value: 23.4, location: { latitude: 1.26, longitude: 4.58 } },
    ],
    wind: [
      { name: 'Met1', speed: 12.3, direction: 'NE', location: { latitude: 1.27, longitude: 4.59 } },
    ],
    temp: [
      { name: 'Met2', value: 30.1, location: { latitude: 1.28, longitude: 4.60 } },
    ],
    humidity: [
      { name: 'Met3', value: 81, location: { latitude: 1.29, longitude: 4.61 } },
    ],
  };

  const labels = {
    youAreHere: 'You are here',
    units: { mm: 'mm', kn: 'kn', c: '°C', percent: '%' },
    popup: {
      location: 'Location',
      station: 'Station',
      region: 'Region',
      rainfall: 'Rainfall',
      pm25: 'PM2.5',
      windSpeed: 'Wind speed',
      temperature: 'Temperature',
      humidity: 'Humidity',
      na: 'N/A',
      tricky: 'Contains </script> tag', // will be escaped
    },
    legend: {
      rain: 'Rain legend', high: 'High', moderate: 'Moderate', low: 'Low',
      pm25: 'PM2.5 legend', wind: 'Wind legend', temp: 'Temp legend', humidity: 'Humidity legend',
      chipPm25: 'PM25 chip', chipWind: 'Wind chip', chipTemp: 'Temp chip', chipHumidity: 'Humid chip',
    },
  };

  test('packages data and defaults active layer to "rain"', () => {
    const html = buildLeafletHtml({ userCoords, datasets, labels });

    // basic HTML scaffolding present
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<div id="map"></div>');
    expect(html).toContain('leaflet.css');
    expect(html).toContain('leaflet.js');
    expect(html).toContain('window.updateLayer=updateLayer');

    // extract APP_DATA JSON and validate structure
    const APP_DATA = extractJSON(html, 'APP_DATA');
    expect(APP_DATA.activeLayer).toBe('rain');
    expect(APP_DATA.user).toEqual({ lat: 1.23, lng: 4.56 });

    // rain stations mapped
    expect(APP_DATA.rain).toHaveLength(3); // null is still mapped to an object with undefined fields
    expect(APP_DATA.rain[0]).toEqual(
      expect.objectContaining({ lat: 1.24, lng: 4.55, name: 'A', rainfall: 7.8 })
    );

    // other layers present and mapped
    expect(APP_DATA.pm25[0]).toEqual(
      expect.objectContaining({ name: 'North', value: 23.4, lat: 1.26, lng: 4.58 })
    );
    expect(APP_DATA.wind[0]).toEqual(
      expect.objectContaining({ name: 'Met1', speed: 12.3, direction: 'NE', lat: 1.27, lng: 4.59 })
    );
    expect(APP_DATA.temp[0]).toEqual(
      expect.objectContaining({ name: 'Met2', value: 30.1, lat: 1.28, lng: 4.60 })
    );
    expect(APP_DATA.humidity[0]).toEqual(
      expect.objectContaining({ name: 'Met3', value: 81, lat: 1.29, lng: 4.61 })
    );
  });

  test('respects startLayer override', () => {
    const html = buildLeafletHtml({ userCoords, datasets, labels, startLayer: 'pm25' });
    const APP_DATA = extractJSON(html, 'APP_DATA');
    expect(APP_DATA.activeLayer).toBe('pm25');
  });

  test('escapes </script> inside LABELS to avoid breaking the inline script', () => {
    const html = buildLeafletHtml({ userCoords, datasets, labels });
    // the raw `</script>` should not appear; escaped `<\/script>` should
    expect(html).not.toContain('</script> tag');
    expect(html).toContain('<\\/script> tag');
  });
});
