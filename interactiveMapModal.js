// interactiveMapModal.js
import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

export default function InteractiveMapModal({ visible, onClose, userCoords, datasets }) {
  const [activeLayer, setActiveLayer] = React.useState('rain');

  // Build HTML payload from preloaded datasets; no fetching here
  const { html, ready } = useMemo(() => {
    const uc = userCoords || { latitude: 1.3521, longitude: 103.8198 };
    const d = datasets || {};
    const packaged = {
      activeLayer,
      user: { lat: uc.latitude, lng: uc.longitude },
      rain: d.rain
        ? [
            {
              lat: d.rain?.station?.location?.latitude,
              lng: d.rain?.station?.location?.longitude,
              name: d.rain?.station?.name,
              rainfall: d.rain?.rainfall,
              lastHour: d.rain?.lastHour,
            },
          ]
        : [],
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
      <!DOCTYPE html><html><head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
        <style>
          html, body, #map { height:100%; margin:0; }
          .legend {
            position:absolute; bottom:10px; left:10px; background:#fff;
            padding:6px 8px; border-radius:6px; box-shadow:0 1px 4px rgba(0,0,0,0.2);
            font:12px/1.2 sans-serif; min-width:120px;
          }
          .legend div { margin:2px 0; white-space:nowrap; }
          .dot { display:inline-block; width:10px; height:10px; border-radius:50%; margin-right:6px; }
        </style>
      </head><body>
        <div id="map"></div>
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <script>
          const APP_DATA = ${dataStr};

          const map = L.map('map').setView([APP_DATA.user.lat, APP_DATA.user.lng], 15);
          L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

          const userIcon = L.icon({
            iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
            iconSize: [25,41], iconAnchor:[12,41], popupAnchor:[1,-34]
          });
          L.marker([APP_DATA.user.lat, APP_DATA.user.lng], { icon: userIcon })
            .addTo(map).bindPopup('You are here');

          function addMarkers(list, color){
            (list || []).filter(p => p && p.lat && p.lng).forEach(p => {
              const marker = L.circleMarker([p.lat, p.lng], {
                radius: 7, color, weight: 2, fillColor: color, fillOpacity: 0.75
              }).addTo(map);
              let desc = '';
              if (p.rainfall != null) desc = 'Rainfall: ' + p.rainfall + ' mm\\nLast 1hr: ' + (p.lastHour ?? 'N/A') + ' mm';
              if (p.value != null && !desc) desc = 'Value: ' + p.value;
              if (p.speed != null && !desc) desc = 'Wind: ' + (p.speed ?? '?') + ' km/h\\nDir: ' + (p.direction ?? '?') + '°';
              marker.bindPopup((p.name || 'Station') + (desc ? '<br/>' + desc.replace(/\\n/g,'<br/>') : ''));
            });
          }

          switch (APP_DATA.activeLayer) {
            case 'rain':     addMarkers(APP_DATA.rain,     '#00BCD4'); break;
            case 'pm25':     addMarkers(APP_DATA.pm25,     '#FF9800'); break;
            case 'wind':     addMarkers(APP_DATA.wind,     '#9C27B0'); break;
            case 'temp':     addMarkers(APP_DATA.temp,     '#F44336'); break;
            case 'humidity': addMarkers(APP_DATA.humidity, '#009688'); break;
          }

          const legend = L.control({position:'bottomleft'});
          legend.onAdd = function(){
            const div = L.DomUtil.create('div', 'legend');
            const items = { rain:'#00BCD4', pm25:'#FF9800', wind:'#9C27B0', temp:'#F44336', humidity:'#009688' };
            div.innerHTML = '<strong>Layer</strong>';
            Object.keys(items).forEach(k => {
              const c = items[k], name = k.toUpperCase();
              div.innerHTML += '<div><span class="dot" style="background:'+c+'"></span>'+name+'</div>';
            });
            return div;
          };
          legend.addTo(map);
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
  }, [activeLayer, userCoords, datasets]);

  if (!visible) return null;

  if (Platform.OS === 'web') {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 }}>
          <Text>🗺️ Full-screen map not supported on web preview.</Text>
          <TouchableOpacity onPress={onClose} style={{ marginTop: 16 }}>
            <Text style={{ color: '#007AFF', fontSize: 16 }}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS === 'android'}
      hardwareAccelerated
      presentationStyle="fullScreen"
    >
     <SafeAreaView style={styles.container} edges={['top','bottom','left','right']}>
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
              originWhitelist={['*']}
              javaScriptEnabled
              domStorageEnabled
              key={`${activeLayer}-${userCoords?.latitude ?? 'na'}-${userCoords?.longitude ?? 'na'}`}
              source={{ html }}
              style={{ flex: 1 }}
            />
          ) : (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" />
              <Text style={styles.loadingText}>Preparing map data...</Text>
            </View>
          )}
        </View>
     </SafeAreaView>
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
