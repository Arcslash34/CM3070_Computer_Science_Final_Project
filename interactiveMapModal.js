// interactiveMapModal.js
import React, { useMemo, useState, useRef, useEffect, useContext } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";

// i18n
import { LanguageContext } from "./translations/language";
import { t } from "./translations/translation";

export default function InteractiveMapModal({
  visible,
  onClose,
  userCoords,
  datasets,
}) {
  const { lang } = useContext(LanguageContext);

  // labels from i18n (recompute when lang changes)
  const mapLabels = useMemo(
    () => ({
      title: t("map.title"),
      a11yClose: t("map.a11yClose"),
      loading: t("map.loading"),
      layers: {
        rain: t("map.layers.rain"),
        pm25: t("map.layers.pm25"),
        wind: t("map.layers.wind"),
        temp: t("map.layers.temp"),
        humidity: t("map.layers.humidity"),
      },
      a11yLayer: {
        rain: t("map.a11yLayer.rain"),
        pm25: t("map.a11yLayer.pm25"),
        wind: t("map.a11yLayer.wind"),
        temp: t("map.a11yLayer.temp"),
        humidity: t("map.a11yLayer.humidity"),
      },
      // strings used inside the WebView HTML
      html: {
        youAreHere: t("map.html.youAreHere"),
        legend: {
          rain: t("map.html.legend.rain"),
          high: t("map.html.legend.high"),
          moderate: t("map.html.legend.moderate"),
          low: t("map.html.legend.low"),
          pm25: t("map.html.legend.pm25"),
          wind: t("map.html.legend.wind"),
          temp: t("map.html.legend.temp"),
          humidity: t("map.html.legend.humidity"),
          chipPm25: t("map.html.legend.chipPm25"),
          chipWind: t("map.html.legend.chipWind"),
          chipTemp: t("map.html.legend.chipTemp"),
          chipHumidity: t("map.html.legend.chipHumidity"),
        },
        popup: {
          location: t("map.html.popup.location"),
          station: t("map.html.popup.station"),
          region: t("map.html.popup.region"),
          rainfall: t("map.html.popup.rainfall"),
          last1h: t("map.html.popup.last1h"),
          floodRisk: t("map.html.popup.floodRisk"),
          pm25: t("map.html.popup.pm25"),
          windSpeed: t("map.html.popup.windSpeed"),
          temperature: t("map.html.popup.temperature"),
          humidity: t("map.html.popup.humidity"),
          na: t("map.html.popup.na"),
        },
        units: {
          mm: t("map.html.units.mm"),
          kn: t("map.html.units.kn"),
          c: t("map.html.units.c"),
          percent: t("map.html.units.percent"),
        },
      },
    }),
    [lang]
  );

  const [activeLayer, setActiveLayer] = useState("rain");
  const [webviewReady, setWebviewReady] = useState(false);
  const webViewRef = useRef(null);

  // snapshot of props while modal is open
  const frozenRef = useRef({ userCoords: null, datasets: null });

  // force exactly one WebView mount per open
  const [openSeq, setOpenSeq] = useState(0);

  // built HTML and ready flag are STABLE while visible (no re-renders every second)
  const [html, setHtml] = useState("");
  const [ready, setReady] = useState(false);

  // build HTML once per open from a snapshot
  const buildHtml = (snapUC, snapD, startLayer = "rain") => {
    const packaged = {
      activeLayer: startLayer, // initial only; later changes via injected JS
      user: { lat: snapUC.latitude, lng: snapUC.longitude },
      rain: (snapD?.rain?.stations || []).map((s) => ({
        lat: s?.location?.latitude,
        lng: s?.location?.longitude,
        name: s?.name,
        rainfall: s?.rainfall,
        lastHour: s?.lastHour,
        coverageMin: s?.lastHourCoverageMin,
      })),
      pm25: (snapD?.pm25 || []).map((x) => ({
        lat: x?.location?.latitude,
        lng: x?.location?.longitude,
        name: x?.name,
        value: x?.value,
      })),
      wind: (snapD?.wind || []).map((x) => ({
        lat: x?.location?.latitude,
        lng: x?.location?.longitude,
        name: x?.name,
        speed: x?.speed,
        direction: x?.direction,
      })),
      temp: (snapD?.temp || []).map((x) => ({
        lat: x?.location?.latitude,
        lng: x?.location?.longitude,
        name: x?.name,
        value: x?.value,
      })),
      humidity: (snapD?.humidity || []).map((x) => ({
        lat: x?.location?.latitude,
        lng: x?.location?.longitude,
        name: x?.name,
        value: x?.value,
      })),
    };

    const dataStr = JSON.stringify(packaged).replace(/<\/script>/g, "<\\/script>");
    const labelsStr = JSON.stringify(mapLabels.html).replace(/<\/script>/g, "<\\/script>");

    return `
      <!DOCTYPE html>
      <html><head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
        <style>
          html, body, #map { height:100%; margin:0; }
          .legend {
            position: absolute; bottom: 80px; left: 0px;
            background: #fff; padding: 6px 8px; border-radius: 6px;
            box-shadow: 0 1px 4px rgba(0,0,0,0.2);
            font: 12px/1.2 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
            min-width: 140px; z-index: 1000;
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
          const LABELS = ${labelsStr};
          let map, currentMarkers = [];

          function initMap() {
            if (map) return;
            map = L.map('map', { zoomControl: true }).setView([APP_DATA.user.lat, APP_DATA.user.lng], 13);
            L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
            const userIcon = L.icon({
              iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
              iconSize: [25,41], iconAnchor:[12,41], popupAnchor:[1,-34]
            });
            L.marker([APP_DATA.user.lat, APP_DATA.user.lng], { icon: userIcon })
              .addTo(map).bindPopup(LABELS.youAreHere);
            updateLayer(APP_DATA.activeLayer);
          }

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

          function clearMarkers() { currentMarkers.forEach(m => map.removeLayer(m)); currentMarkers = []; }
          function addChip({ lat, lng, label, popupTitle, popupLines, klass, inlineBg }){
            if (!(lat && lng)) return null;
            const html = '<div class="chip '+klass+'" style="'+(inlineBg ? ('background:'+inlineBg+';') : '')+'">'+label+'</div>';
            const icon = L.divIcon({ html, className: '', iconSize: [40,40], iconAnchor: [20,20], popupAnchor: [0,-20] });
            const m = L.marker([lat, lng], { icon }).addTo(map);
            const content = '<b>'+(popupTitle || LABELS.popup.location)+'</b><br/>'+(popupLines || []).join('<br/>');
            m.bindPopup(content);
            return m;
          }

          function updateLegend(layer) {
            const existing = document.querySelector('.legend-control');
            if (existing) existing.remove();
            const legend = L.control({position:'bottomleft'});
            legend.onAdd = function(){
              const div = L.DomUtil.create('div', 'legend legend-control');
              if (layer === 'rain') {
                div.innerHTML = '<strong>'+LABELS.legend.rain+'</strong>'
                              + '<div><span class="dot" style="background:#EF4444"></span>'+LABELS.legend.high+'</div>'
                              + '<div><span class="dot" style="background:#F59E0B"></span>'+LABELS.legend.moderate+'</div>'
                              + '<div><span class="dot" style="background:#10B981"></span>'+LABELS.legend.low+'</div>';
              } else if (layer === 'pm25') { div.innerHTML = '<strong>'+LABELS.legend.pm25+'</strong><div>'+LABELS.legend.chipPm25+'</div>'; }
              else if (layer === 'wind')  { div.innerHTML = '<strong>'+LABELS.legend.wind+'</strong><div>'+LABELS.legend.chipWind+'</div>'; }
              else if (layer === 'temp')  { div.innerHTML = '<strong>'+LABELS.legend.temp+'</strong><div>'+LABELS.legend.chipTemp+'</div>'; }
              else if (layer === 'humidity') { div.innerHTML = '<strong>'+LABELS.legend.humidity+'</strong><div>'+LABELS.legend.chipHumidity+'</div>'; }
              return div;
            };
            legend.addTo(map);
          }

          function updateLayer(layerName) {
            if (!map) return;
            clearMarkers();
            updateLegend(layerName);
            if (layerName === 'rain') {
              (APP_DATA.rain || []).forEach(p => {
                if (!(p && p.lat && p.lng)) return;
                const risk = estimateFloodRisk(p.rainfall, p.lastHour);
                const color = riskColor(risk);
                const nowVal = (p.rainfall != null) ? (Math.round(p.rainfall) + ' ' + LABELS.units.mm) : '-';
                const hourVal = (p.lastHour != null) ? (p.lastHour + ' ' + LABELS.units.mm) : LABELS.popup.na;
                const m = addChip({
                  lat:p.lat, lng:p.lng, label:nowVal, klass:'rain', inlineBg:color,
                  popupTitle:(p.name || LABELS.popup.station),
                  popupLines:[
                    (p.rainfall != null ? (LABELS.popup.rainfall + ': ' + p.rainfall + ' ' + LABELS.units.mm) : (LABELS.popup.rainfall + ': ' + LABELS.popup.na)),
                    (LABELS.popup.last1h + ': ' + hourVal),
                    (LABELS.popup.floodRisk + ': ' + risk),
                  ],
                }); if (m) currentMarkers.push(m);
              });
            } else if (layerName === 'pm25') {
              (APP_DATA.pm25 || []).forEach(p => {
                const v = (p.value != null) ? Math.round(p.value) : null;
                const m = addChip({
                  lat:p.lat, lng:p.lng, klass:'pm25', label:(v!=null ? (v+' µg') : '-'),
                  popupTitle:(p.name || LABELS.popup.region),
                  popupLines:[ (v!=null ? (LABELS.popup.pm25 + ': ' + v + ' µg/m³') : (LABELS.popup.pm25 + ': ' + LABELS.popup.na)) ],
                }); if (m) currentMarkers.push(m);
              });
            } else if (layerName === 'wind') {
              (APP_DATA.wind || []).forEach(p => {
                const sp = (p.speed != null ? Math.round(p.speed) : null);
                const m = addChip({
                  lat:p.lat, lng:p.lng, klass:'wind', label:(sp!=null ? (sp+' ' + LABELS.units.kn) : '-'),
                  popupTitle:(p.name || LABELS.popup.station),
                  popupLines:[ (sp!=null ? (LABELS.popup.windSpeed + ': ' + sp + ' ' + LABELS.units.kn) : (LABELS.popup.windSpeed + ': ' + LABELS.popup.na)) + (p.direction ? (' ('+p.direction+')') : '') ],
                }); if (m) currentMarkers.push(m);
              });
            } else if (layerName === 'temp') {
              (APP_DATA.temp || []).forEach(p => {
                const t = (p.value != null) ? Math.round(p.value) : null;
                const m = addChip({
                  lat:p.lat, lng:p.lng, klass:'temp', label:(t!=null ? (t+' ' + LABELS.units.c) : '-'),
                  popupTitle:(p.name || LABELS.popup.station),
                  popupLines:[ (t!=null ? (LABELS.popup.temperature + ': ' + t + ' ' + LABELS.units.c) : (LABELS.popup.temperature + ': ' + LABELS.popup.na)) ],
                }); if (m) currentMarkers.push(m);
              });
            } else if (layerName === 'humidity') {
              (APP_DATA.humidity || []).forEach(p => {
                const h = (p.value != null) ? Math.round(p.value) : null;
                const m = addChip({
                  lat:p.lat, lng:p.lng, klass:'humidity', label:(h!=null ? (h+' ' + LABELS.units.percent) : '-'),
                  popupTitle:(p.name || LABELS.popup.station),
                  popupLines:[ (h!=null ? (LABELS.popup.humidity + ': ' + h + ' ' + LABELS.units.percent) : (LABELS.popup.humidity + ': ' + LABELS.popup.na)) ],
                }); if (m) currentMarkers.push(m);
              });
            }
          }

          window.addEventListener('load', initMap);
          window.updateLayer = updateLayer;
        </script>
      </body></html>
    `;
  };

  // take snapshot & build HTML ONCE when the modal opens
  useEffect(() => {
    if (visible) {
      const uc = userCoords || { latitude: 1.3521, longitude: 103.8198 };
      frozenRef.current = { userCoords: uc, datasets };
      const htmlOnce = buildHtml(uc, datasets, "rain");
      setHtml(htmlOnce);
      const hasData =
        (datasets?.rain?.stations?.length ?? 0) ||
        (datasets?.pm25?.length ?? 0) ||
        (datasets?.wind?.length ?? 0) ||
        (datasets?.temp?.length ?? 0) ||
        (datasets?.humidity?.length ?? 0);
      setReady(!!hasData);
      setOpenSeq((n) => n + 1); // re-key WebView once per open
      setWebviewReady(false);
    } else {
      // closing — clear ready state for next open
      setWebviewReady(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, lang]); // include lang so we rebuild HTML when language changes while open

  // key only changes per open; never for layer/data churn
  const webviewKey = useMemo(() => {
    const uc = frozenRef.current.userCoords || userCoords || { latitude: 1.3521, longitude: 103.8198 };
    const lat = uc?.latitude?.toFixed(2) || "1.35";
    const lng = uc?.longitude?.toFixed(2) || "103.82";
    return `map-open-${openSeq}-${lat}-${lng}`;
  }, [openSeq, userCoords]);

  // layer switching without reloading the WebView
  useEffect(() => {
    if (visible && webviewReady && webViewRef.current) {
      webViewRef.current.injectJavaScript(
        `window.updateLayer && window.updateLayer('${activeLayer}'); true;`
      );
    }
  }, [activeLayer, visible, webviewReady]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS === "android"}
      hardwareAccelerated
      presentationStyle="fullScreen"
    >
      <SafeAreaView style={styles.container} edges={["top", "left", "right", "bottom"]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🌍 {mapLabels.title}</Text>
          <TouchableOpacity onPress={onClose} accessibilityLabel={mapLabels.a11yClose}>
            <Ionicons name="close" size={22} color="#111827" />
          </TouchableOpacity>
        </View>

        {/* Map */}
        <View style={styles.mapBox}>
          {ready ? (
            <WebView
              ref={webViewRef}
              originWhitelist={["*"]}
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
              <Text style={styles.loadingText}>{mapLabels.loading}</Text>
            </View>
          )}

          {/* Bottom floating filters */}
          <View style={styles.bottomFilters} pointerEvents="box-none">
            <View style={styles.filtersBar}>
              {[
                { key: "rain", label: mapLabels.layers.rain, icon: "rainy", a11y: mapLabels.a11yLayer.rain },
                { key: "pm25", label: mapLabels.layers.pm25, icon: "leaf", a11y: mapLabels.a11yLayer.pm25 },
                { key: "wind", label: mapLabels.layers.wind, icon: "navigate", a11y: mapLabels.a11yLayer.wind },
                { key: "temp", label: mapLabels.layers.temp, icon: "thermometer", a11y: mapLabels.a11yLayer.temp },
                { key: "humidity", label: mapLabels.layers.humidity, icon: "water", a11y: mapLabels.a11yLayer.humidity },
              ].map(({ key, label, icon, a11y }) => {
                const active = activeLayer === key;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.filterButton, active && styles.activeFilterButton]}
                    onPress={() => setActiveLayer(key)}
                    accessibilityRole="button"
                    accessibilityLabel={a11y}
                  >
                    <Ionicons
                      name={icon}
                      size={18}
                      color={active ? "#fff" : "#374151"}
                      style={{ marginBottom: 4 }}
                    />
                    <Text style={[styles.filterText, active && styles.activeFilterText]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerTitle: { fontSize: 16, fontWeight: "800", color: "#111827" },
  mapBox: { flex: 1, position: "relative" },
  bottomFilters: { position: "absolute", left: 0, right: 0, bottom: 0, paddingBottom: 8 },
  filtersBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "#FFFFFFEE",
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginHorizontal: 10,
    alignSelf: "stretch",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  filterButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "#E5E7EB",
    minWidth: 58,
  },
  activeFilterButton: { backgroundColor: "#4F46E5" },
  filterText: { fontSize: 11, fontWeight: "800", color: "#374151", letterSpacing: 0.5 },
  activeFilterText: { color: "#fff" },
  loadingOverlay: { position: "absolute", top: "40%", alignSelf: "center", alignItems: "center" },
  loadingText: { marginTop: 10, fontSize: 14, color: "#374151" },
});
