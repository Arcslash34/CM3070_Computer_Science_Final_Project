// interactiveMapModal.js
import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

export default function InteractiveMapModal({ visible, onClose, userCoords, datasets }) {
  const [activeLayer, setActiveLayer] = useState('rain');
  const [webviewReady, setWebviewReady] = useState(false);
  const insets = useSafeAreaInsets();
  const webViewRef = useRef(null);

  // Generate a stable key that doesn't change with every render
  const webviewKey = useMemo(() => {
    const lat = userCoords?.latitude?.toFixed(2) || '1.35';
    const lng = userCoords?.longitude?.toFixed(2) || '103.82';
    return `map-${activeLayer}-${lat}-${lng}`;
  }, [activeLayer, userCoords?.latitude, userCoords?.longitude]);

  const { html, ready } = useMemo(() => {
    const uc = userCoords || { latitude: 1.3521, longitude: 103.8198 };
    const d = datasets || {};
    const packaged = {
      activeLayer,
      user: { lat: uc.latitude, lng: uc.longitude },
      rain: (d.rain?.stations || []).map((s) => ({
        lat: s?.location?.latitude,
        lng: s?.location?.longitude,
        name: s?.name,
        rainfall: s?.rainfall,
        lastHour: s?.lastHour,
      })),
      pm25: (d.pm25 || []).map((x) => ({
        lat: x?.location?.latitude,
        lng: x?.location?.longitude,
        name: x?.name,
        value: x?.value,
      })),
      wind: (d.wind || []).map((x) => ({
        lat: x?.location?.latitude,
        lng: x?.location?.longitude,
        name: x?.name,
        speed: x?.speed,
        direction: x?.direction,
      })),
      temp: (d.temp || []).map((x) => ({
        lat: x?.location?.latitude,
        lng: x?.location?.longitude,
        name: x?.name,
        value: x?.value,
      })),
      humidity: (d.humidity || []).map((x) => ({
        lat: x?.location?.latitude,
        lng: x?.location?.longitude,
        name: x?.name,
        value: x?.value,
      })),
    };

    const dataStr = JSON.stringify(packaged).replace(/<\/script>/g, '<\\/script>');

    const htmlStr = `
      <!DOCTYPE html>
      <html><head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
        <style>
          html, body, #map { height:100%; margin:0; }
          .legend {
            position:absolute; bottom:10px; left:10px; background:#fff;
            padding:6px 8px; border-radius:6px; box-shadow:0 1px 4px rgba(0,0,0,0.2);
            font:12px/1.2 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; min-width:140px;
          }
          .legend div { margin:2px 0; white-space:nowrap; }
          .dot { display:inline-block; width:10px; height:10px; border-radius:50%; margin-right:6px; }

          .chip {
            display:flex; align-items:center; justify-content:center;
            width:40px; height:40px; border-radius:50%;
            border:2px solid rgba(0,0,0,0.25);
            box-shadow: 0 1px 3px rgba(0,0,0,0.25);
            font: 800 11px/1.05 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
            color:#fff; text-shadow: 0 1px 2px rgba(0,0,0,0.35);
          }
          .chip.rain { }
          .chip.pm25 { background:#FF9800; }
          .chip.wind { background:#9C27B0; }
          .chip.temp { background:#F44336; }
          .chip.humidity { background:#009688; }

          .leaflet-popup-content { margin: 8px 12px; font: 13px/1.35 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
          .leaflet-popup-content b { font-weight: 800; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <script>
          const APP_DATA = ${dataStr};
          let map, currentMarkers = [];

          function initMap() {
            if (map) return; // Map already initialized
            
            map = L.map('map', { zoomControl: true }).setView([APP_DATA.user.lat, APP_DATA.user.lng], 13);
            L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

            const userIcon = L.icon({
              iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
              iconSize: [25,41], iconAnchor:[12,41], popupAnchor:[1,-34]
            });
            L.marker([APP_DATA.user.lat, APP_DATA.user.lng], { icon: userIcon })
              .addTo(map).bindPopup('You are here');
              
            updateLayer(APP_DATA.activeLayer);
          }

          // Flood risk helpers
          function estimateFloodRisk(rainfall, lastHour){
            if ((rainfall ?? 0) > 10 || (lastHour ?? 0) > 30) return 'High';
            if ((rainfall ?? 0) > 5  || (lastHour ?? 0) > 15) return 'Moderate';
            return 'Low';
          }
          
          function riskColor(risk){
            if (risk === 'High') return '#EF4444';
            if (risk === 'Moderate') return '#F59E0B';
            return '#10B981';
          }

          // Clear all markers
          function clearMarkers() {
            currentMarkers.forEach(marker => map.removeLayer(marker));
            currentMarkers = [];
          }

          // Add a chip marker
          function addChip({ lat, lng, label, popupTitle, popupLines, klass, inlineBg }){
            if (!(lat && lng)) return null;
            const html = '<div class="chip '+klass+'" style="'+(inlineBg ? ('background:'+inlineBg+';') : '')+'">'+label+'</div>';
            const icon = L.divIcon({
              html,
              className: '',
              iconSize: [40,40],
              iconAnchor: [20,20],
              popupAnchor: [0,-20],
            });
            const m = L.marker([lat, lng], { icon }).addTo(map);
            const content = '<b>'+(popupTitle || 'Location')+'</b><br/>'+ (popupLines || []).join('<br/>');
            m.bindPopup(content);
            return m;
          }

          // Update legend
          function updateLegend(layer) {
            // Remove existing legend if any
            const existingLegend = document.querySelector('.legend-control');
            if (existingLegend) existingLegend.remove();
            
            const legend = L.control({position:'bottomleft'});
            legend.onAdd = function(){
              const div = L.DomUtil.create('div', 'legend legend-control');
              if (layer === 'rain') {
                div.innerHTML = '<strong>Flood Risk</strong>';
                div.innerHTML += '<div><span class="dot" style="background:#EF4444"></span>High</div>';
                div.innerHTML += '<div><span class="dot" style="background:#F59E0B"></span>Moderate</div>';
                div.innerHTML += '<div><span class="dot" style="background:#10B981"></span>Low</div>';
              } else if (layer === 'pm25') {
                div.innerHTML = '<strong>PM2.5</strong><div>Chip: µg/m³</div>';
              } else if (layer === 'wind') {
                div.innerHTML = '<strong>Wind</strong><div>Chip: km/s</div>';
              } else if (layer === 'temp') {
                div.innerHTML = '<strong>Temperature</strong><div>Chip: °C</div>';
              } else if (layer === 'humidity') {
                div.innerHTML = '<strong>Humidity</strong><div>Chip: %</div>';
              }
              return div;
            };
            legend.addTo(map);
          }

          // Update the visible layer
          function updateLayer(layerName) {
            if (!map) return;
            
            clearMarkers();
            updateLegend(layerName);
            
            if (layerName === 'rain') {
              (APP_DATA.rain || []).forEach(p => {
                if (!(p && p.lat && p.lng)) return;
                const risk = estimateFloodRisk(p.rainfall, p.lastHour);
                const color = riskColor(risk);
                const val = (p.rainfall != null) ? (Math.round(p.rainfall) + ' mm') : '-';
                const marker = addChip({
                  lat: p.lat, lng: p.lng,
                  label: val,
                  popupTitle: (p.name || 'Station'),
                  popupLines: [
                    (p.rainfall != null ? ('Rainfall: ' + p.rainfall + ' mm') : 'Rainfall: n/a'),
                    (p.lastHour != null ? ('Last 1h: ' + p.lastHour + ' mm') : 'Last 1h: n/a'),
                    ('Flood Risk: ' + risk)
                  ],
                  klass: 'rain',
                  inlineBg: color
                });
                if (marker) currentMarkers.push(marker);
              });
            } else if (layerName === 'pm25') {
              (APP_DATA.pm25 || []).forEach(p => {
                const value = (p.value != null) ? Math.round(p.value) : null;
                const marker = addChip({
                  lat: p.lat, lng: p.lng,
                  label: (value != null ? (value + ' µg') : '-'),
                  popupTitle: (p.name || 'Region'),
                  popupLines: [ (value != null ? ('PM2.5: ' + value + ' µg/m³') : 'PM2.5: n/a') ],
                  klass: 'pm25'
                });
                if (marker) currentMarkers.push(marker);
              });
            } else if (layerName === 'wind') {
              (APP_DATA.wind || []).forEach(p => {
                const sp = (p.speed != null ? Math.round(p.speed) : null);
                const marker = addChip({
                  lat: p.lat, lng: p.lng,
                  label: (sp != null ? (sp + ' km/s') : '-'),
                  popupTitle: (p.name || 'Station'),
                  popupLines: [
                    (sp != null ? ('Wind speed: ' + sp + ' km/s') : 'Wind speed: n/a')
                    + (p.direction ? (' ('+p.direction+')') : '')
                  ],
                  klass: 'wind'
                });
                if (marker) currentMarkers.push(marker);
              });
            } else if (layerName === 'temp') {
              (APP_DATA.temp || []).forEach(p => {
                const t = (p.value != null) ? Math.round(p.value) : null;
                const marker = addChip({
                  lat: p.lat, lng: p.lng,
                  label: (t != null ? (t + ' °C') : '-'),
                  popupTitle: (p.name || 'Station'),
                  popupLines: [ (t != null ? ('Temperature: ' + t + ' °C') : 'Temperature: n/a') ],
                  klass: 'temp'
                });
                if (marker) currentMarkers.push(marker);
              });
            } else if (layerName === 'humidity') {
              (APP_DATA.humidity || []).forEach(p => {
                const h = (p.value != null) ? Math.round(p.value) : null;
                const marker = addChip({
                  lat: p.lat, lng: p.lng,
                  label: (h != null ? (h + ' %') : '-'),
                  popupTitle: (p.name || 'Station'),
                  popupLines: [ (h != null ? ('Humidity: ' + h + ' %') : 'Humidity: n/a') ],
                  klass: 'humidity'
                });
                if (marker) currentMarkers.push(marker);
              });
            }
          }

          // Initialize the map when the page loads
          window.addEventListener('load', initMap);
          
          // Expose the updateLayer function to the parent
          window.updateLayer = updateLayer;
        </script>
      </body></html>
    `;

    const readyNow =
      packaged.rain.length ||
      packaged.pm25.length ||
      packaged.wind.length ||
      packaged.temp.length ||
      packaged.humidity.length;

    return { html: htmlStr, ready: !!readyNow };
  }, [userCoords, datasets, activeLayer]);

  // Update the WebView when activeLayer changes
  useEffect(() => {
    if (webviewReady && webViewRef.current) {
      const js = `window.updateLayer && window.updateLayer('${activeLayer}');`;
      webViewRef.current.injectJavaScript(js);
    }
  }, [activeLayer, webviewReady]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS === 'android'}
      hardwareAccelerated
      presentationStyle="fullScreen"
    >
      <View
        style={[
          styles.container,
          {
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            paddingLeft: insets.left,
            paddingRight: insets.right,
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🌍 Live Environmental Map</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeBtn}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Filters */}
        <View style={styles.filters}>
          {['rain', 'pm25', 'wind', 'temp', 'humidity'].map((key) => (
            <TouchableOpacity
              key={key}
              style={[styles.filterButton, activeLayer === key && styles.activeFilterButton]}
              onPress={() => setActiveLayer(key)}
            >
              <Text style={[styles.filterText, activeLayer === key && styles.activeFilterText]}>
                {key.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Map */}
        <View style={styles.mapBox}>
          {ready ? (
            <WebView
              ref={webViewRef}
              originWhitelist={['*']}
              javaScriptEnabled
              domStorageEnabled
              key={webviewKey}
              source={{ html }}
              style={{ flex: 1 }}
              onLoadEnd={() => setWebviewReady(true)}
              onLoadStart={() => setWebviewReady(false)}
            />
          ) : (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" />
              <Text style={styles.loadingText}>Preparing map data...</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  closeBtn: { fontSize: 22, color: '#d00', padding: 4 },
  filters: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
    backgroundColor: '#f8f8f8',
  },
  filterButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#ddd',
    marginHorizontal: 4,
  },
  activeFilterButton: { backgroundColor: '#007AFF' },
  filterText: { fontSize: 12, fontWeight: '600', color: '#333' },
  activeFilterText: { color: '#fff' },
  mapBox: { flex: 1, position: 'relative' },
  loadingOverlay: {
    position: 'absolute',
    top: '40%',
    alignSelf: 'center',
    alignItems: 'center',
  },
  loadingText: { marginTop: 10, fontSize: 16, color: '#333' },
});