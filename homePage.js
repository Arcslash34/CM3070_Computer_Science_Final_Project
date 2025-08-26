// homePage.js
import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
  useLayoutEffect,
} from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  StyleSheet,
  RefreshControl,
  Alert,
  Linking,
  AppState,
  Modal,
  TouchableWithoutFeedback,
  Image,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as IntentLauncher from "expo-intent-launcher";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { WebView } from "react-native-webview";

import InteractiveMapModal from "./interactiveMapModal";
import translations from "./translations";

import {
  estimateFloodRisk,
  fetchWeatherForecast,
  getNearestForecastArea,
  getDistanceFromLatLonInKm,
  fetchRainfallData,
  fetchPm25Data,
  fetchWindData,
  fetchHumidityData,
  fetchTemperatureData,
  loadEnvDatasetsFromFile,
} from "./api";

import { useLanguage } from "./language";

// Hero sizing
const HERO_SRC = require("./assets/home.jpg");
const HERO_DIM = Image.resolveAssetSource(HERO_SRC);
const HERO_ASPECT = HERO_DIM.height / HERO_DIM.width;
const { width: SCREEN_W } = Dimensions.get("window");
const HERO_HEIGHT = Math.round(SCREEN_W * HERO_ASPECT);

/* ----------------- Notifications/alerts (unchanged) ----------------- */
const ALERT_COOLDOWN_MS = 10 * 60 * 1000;
const GEOFENCE_KM = 2;
const mockDefault = { latitude: 1.3405, longitude: 103.72 };

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const alertQueueRef = { current: [] };
const alertActiveRef = { current: false };
const lastAlertByTypeRef = { current: {} };
const geofenceInsideRef = { current: null };
const usingMockRef = { current: false };

function queueNativeAlert({ title, body, buttons }) {
  alertQueueRef.current.push({ title, body, buttons });
  pumpAlerts();
}
function pumpAlerts() {
  if (alertActiveRef.current) return;
  const next = alertQueueRef.current.shift();
  if (!next) return;
  alertActiveRef.current = true;
  const wrapped = (next.buttons?.length ? next.buttons : [{ text: "OK" }]).map(
    (b) => ({
      ...b,
      onPress: () => {
        try {
          b.onPress?.();
        } finally {
          alertActiveRef.current = false;
          setTimeout(pumpAlerts, 0);
        }
      },
    })
  );
  Alert.alert(next.title, next.body, wrapped, { cancelable: false });
}
async function ensureNotificationsReady() {
  try {
    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== "granted" && existing.canAskAgain) {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Alerts",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
        lockscreenVisibility:
          Notifications.AndroidNotificationVisibility.PUBLIC,
        sound: "default",
      });
    }
    return status === "granted";
  } catch {
    return false;
  }
}
async function presentDeviceNotification({ title, body, type }) {
  if (Platform.OS === "web") return;
  const ok = await ensureNotificationsReady();
  if (!ok) return;
  try {
    await Notifications.presentNotificationAsync({
      title,
      body,
      sound: "default",
      data: { type },
    });
  } catch {}
}
async function triggerAlert({
  title,
  body,
  type = "general",
  showPopup = true,
  notifyDevice = true,
  bypassCooldown = false,
  onViewMap,
}) {
  const now = Date.now();
  const last = lastAlertByTypeRef.current[type] ?? 0;
  if (!bypassCooldown && now - last < ALERT_COOLDOWN_MS) return;

  if (showPopup) {
    queueNativeAlert({
      title,
      body,
      buttons: [
        { text: "OK", style: "default" },
        onViewMap ? { text: "View Map", onPress: onViewMap } : null,
      ].filter(Boolean),
    });
  }
  if (notifyDevice) await presentDeviceNotification({ title, body, type });
  lastAlertByTypeRef.current[type] = now;
}
function distKm(a, b) {
  return getDistanceFromLatLonInKm(
    a.latitude,
    a.longitude,
    b.latitude,
    b.longitude
  );
}

/* ----------------- Emergency Contacts Modal ----------------- */
const EMERGENCY_CONTACTS = [
  { key: "scdf", name: "SCDF (Fire / Ambulance)", number: "995", icon: "flame", color: "#EF4444" },
  { key: "ambulance", name: "Non-Emergency Ambulance", number: "1777", icon: "medkit", color: "#F59E0B" },
  { key: "police", name: "Police", number: "999", icon: "shield", color: "#3B82F6" },
];
function EmergencyContactsModal({ visible, onClose }) {
  const onCall = (num) => {
    Alert.alert(`Call ${num}?`, "This will open your phone dialer.", [
      { text: "Cancel", style: "cancel" },
      { text: "Call", style: "destructive", onPress: () => Linking.openURL(`tel:${num}`) },
    ]);
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalBackdrop} />
      </TouchableWithoutFeedback>
      <View style={styles.modalSheet}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Emergency contacts</Text>
          <TouchableOpacity onPress={onClose} accessibilityLabel="Close">
            <Ionicons name="close" size={20} color="#111827" />
          </TouchableOpacity>
        </View>
        {EMERGENCY_CONTACTS.map((c) => (
          <View key={c.key} style={styles.contactRow}>
            <View style={styles.contactLeft}>
              <View style={[styles.contactIconWrap, { backgroundColor: c.color }]}>
                <Ionicons name={c.icon} size={16} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.contactName}>{c.name}</Text>
                <Text style={styles.contactNumber}>{c.number}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => onCall(c.number)} style={styles.callBtn} accessibilityLabel={`Call ${c.name}`}>
              <Ionicons name="call" size={16} color="#fff" />
              <Text style={styles.callBtnText}>Call</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </Modal>
  );
}

/* =========================================================================
   SCREEN
   ========================================================================= */
export default function HomeScreen() {
  const { lang } = useLanguage();
  const t = (key) => translations[lang][key] || key;
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions?.({ headerShown: false });
  }, [navigation]);

  const [coords, setCoords] = useState(null);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [locDeniedBanner, setLocDeniedBanner] = useState(false);
  const [locPermission, setLocPermission] = useState("undetermined");
  const [servicesEnabled, setServicesEnabled] = useState(true);
  const [notifGranted, setNotifGranted] = useState(false);
  const initRanRef = useRef(false);
  const watchRef = useRef(null);
  const lastFetchTsRef = useRef(0);

  const [forecastText, setForecastText] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [rainNearest, setRainNearest] = useState(null);

  const [pm25Nearest, setPm25Nearest] = useState(null);
  const [tempNearest, setTempNearest] = useState(null);
  const [humidityNearest, setHumidityNearest] = useState(null);
  const [windNearest, setWindNearest] = useState(null);

  const [emergencyOpen, setEmergencyOpen] = useState(false);

  const [areaAdvisoryActive, setAreaAdvisoryActive] = useState(false);
  const [envDatasets, setEnvDatasets] = useState(null);

  const triggerAreaAdvisoryForCoords = useCallback(async (c) => {
    const inside = distKm(c, mockDefault) <= GEOFENCE_KM;
    setAreaAdvisoryActive(!!inside);
    if (!inside) return;
    await triggerAlert({
      title: "⚠️ Area Advisory: Taman Jurong",
      body: "You are near a flood-prone area. Stay vigilant and check the map for reports.",
      type: "geofence",
      showPopup: false,
    });
  }, []);

  const pickNearestFrom = useCallback((datasets, c) => {
    if (!datasets || !c) return;
    const pickNearest = (arr, getLatLng) => {
      if (!arr || !arr.length) return null;
      let best = null, bestD = Infinity;
      for (const item of arr) {
        const { lat, lng } = getLatLng(item) || {};
        if (typeof lat !== "number" || typeof lng !== "number") continue;
        const d = getDistanceFromLatLonInKm(c.latitude, c.longitude, lat, lng);
        if (d < bestD) { bestD = d; best = { ...item, _distKm: d }; }
      }
      return best;
    };
    setPm25Nearest(pickNearest(datasets.pm25, (d) => ({ lat: d?.location?.latitude, lng: d?.location?.longitude })));
    setTempNearest(pickNearest(datasets.temp, (d) => ({ lat: d?.location?.latitude, lng: d?.location?.longitude })));
    setHumidityNearest(pickNearest(datasets.humidity, (d) => ({ lat: d?.location?.latitude, lng: d?.location?.longitude })));
    setWindNearest(pickNearest(datasets.wind, (d) => ({ lat: d?.location?.latitude, lng: d?.location?.longitude })));
  }, []);

  const fetchAll = useCallback(
    async (pos, opts = {}) => {
      const { allowGeofence = true } = opts;
      const c = pos || coords;
      if (!c) return;

      const weatherData = await fetchWeatherForecast();
      if (weatherData) {
        const nearestArea = getNearestForecastArea(c, weatherData.metadata);
        const areaForecast = nearestArea
          ? weatherData.forecasts.find(
              (f) =>
                f?.area?.trim?.().toLowerCase() ===
                nearestArea?.trim?.().toLowerCase()
            )
          : null;
        setForecastText(areaForecast?.forecast ?? null);
      }

      const rainAll = await fetchRainfallData(c);
      if (rainAll) {
        if (Array.isArray(rainAll.stations) && rainAll.stations.length) {
          let nearest = null, best = Infinity;
          for (const st of rainAll.stations) {
            if (
              typeof st?.location?.latitude !== "number" ||
              typeof st?.location?.longitude !== "number"
            ) continue;
            const d = getDistanceFromLatLonInKm(
              c.latitude, c.longitude, st.location.latitude, st.location.longitude
            );
            if (d < best) { best = d; nearest = st; }
          }
          setRainNearest(nearest || null);
          if (nearest) {
            const risk = estimateFloodRisk(nearest.rainfall, nearest.lastHour);
            if (risk === "High" || risk === "Moderate") {
              await triggerAlert({
                title: `🚨 Flood Risk: ${risk}`,
                body: `Heavy rain detected at ${nearest.name ?? "nearby station"}. Stay alert and follow safety procedures.`,
                type: "risk",
                showPopup: true,
                onViewMap: () => setMapExpanded(true),
              });
            }
          }
        }
      }

      if (allowGeofence) {
        const inside = distKm(c, mockDefault) <= GEOFENCE_KM;
        setAreaAdvisoryActive(!!inside);
        const prev = geofenceInsideRef.current;
        geofenceInsideRef.current = inside;
        if ((prev === null && inside) || (prev === false && inside)) {
          await triggerAlert({
            title: "⚠️ Area Advisory: Taman Jurong",
            body: "You are near a flood-prone area. Stay vigilant and check the map for reports.",
            type: "geofence",
            showPopup: false,
          });
        }
      } else {
        setAreaAdvisoryActive(distKm(c, mockDefault) <= GEOFENCE_KM);
        await triggerAreaAdvisoryForCoords(c);
      }

      let [pm25, temp, humidity, wind] = await Promise.all([
        fetchPm25Data().catch(() => []),
        fetchTemperatureData().catch(() => []),
        fetchHumidityData().catch(() => []),
        fetchWindData().catch(() => []),
      ]);

      const needSnapshot =
        !rainAll?.stations?.length ||
        !pm25?.length ||
        !temp?.length ||
        !humidity?.length ||
        !wind?.length;

      const base = needSnapshot ? await loadEnvDatasetsFromFile() : null;

      const merged = {
        rain: rainAll && Array.isArray(rainAll.stations) ? rainAll : base?.rain || { stations: [] },
        pm25: pm25?.length ? pm25 : base?.pm25 || [],
        temp: temp?.length ? temp : base?.temp || [],
        humidity: humidity?.length ? humidity : base?.humidity || [],
        wind: wind?.length ? wind : base?.wind || [],
      };

      setEnvDatasets(merged);
      pickNearestFrom(merged, c);
      setUpdatedAt(new Date().toISOString());
    },
    [coords, triggerAreaAdvisoryForCoords, pickNearestFrom]
  );

  /* ---- Initial load / resume / watch (unchanged) ---- */
  useEffect(() => {
    if (initRanRef.current) return;
    initRanRef.current = true;

    (async () => {
      try {
        const fileSnap = await loadEnvDatasetsFromFile();
        if (fileSnap) {
          setEnvDatasets(fileSnap);
          const seedCoords = coords || (usingMockRef.current ? mockDefault : null);
          if (seedCoords) pickNearestFrom(fileSnap, seedCoords);
        }
      } catch {
        setEnvDatasets(null);
      }

      const grantedNotif = await ensureNotificationsReady();
      setNotifGranted(grantedNotif);

      if (Platform.OS === "web") {
        usingMockRef.current = true;
        setCoords(mockDefault);
        setLocPermission("denied");
        setServicesEnabled(false);
        setLocDeniedBanner(true);
        await triggerAreaAdvisoryForCoords(mockDefault);
        await fetchAll(mockDefault, { allowGeofence: false });
        return;
      }

      try {
        const permReq = await Location.requestForegroundPermissionsAsync();
        setLocPermission(permReq.status);

        if (permReq.status !== "granted") {
          usingMockRef.current = true;
          setCoords(mockDefault);
          setLocDeniedBanner(true);
          setServicesEnabled(false);
          await triggerAreaAdvisoryForCoords(mockDefault);
          await fetchAll(mockDefault, { allowGeofence: false });
          return;
        }

        const svc = await Location.hasServicesEnabledAsync();
        setServicesEnabled(svc);

        if (!svc) {
          usingMockRef.current = true;
          setCoords(mockDefault);
          setLocDeniedBanner(true);
          await triggerAreaAdvisoryForCoords(mockDefault);
          await fetchAll(mockDefault, { allowGeofence: false });
          return;
        }

        usingMockRef.current = false;
        const loc = await Location.getCurrentPositionAsync({});
        setCoords(loc.coords);
        setLocDeniedBanner(false);
        geofenceInsideRef.current = null;
        lastAlertByTypeRef.current.geofence = 0;
        await fetchAll(loc.coords, { allowGeofence: true });
      } catch {
        usingMockRef.current = true;
        setCoords(mockDefault);
        setLocPermission("denied");
        setServicesEnabled(false);
        setLocDeniedBanner(true);
        await triggerAreaAdvisoryForCoords(mockDefault);
        await fetchAll(mockDefault, { allowGeofence: false });
      }
    })();
  }, [fetchAll, triggerAreaAdvisoryForCoords, coords, pickNearestFrom]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", async (state) => {
      if (state !== "active") return;
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        setLocPermission(perm.status);
        const svc = await Location.hasServicesEnabledAsync();
        setServicesEnabled(svc);
        if (perm.status === "granted" && svc) {
          if (usingMockRef.current) {
            geofenceInsideRef.current = null;
            lastAlertByTypeRef.current.geofence = 0;
          }
          usingMockRef.current = false;
          const loc = await Location.getCurrentPositionAsync({});
          setCoords(loc.coords);
          setLocDeniedBanner(false);
          await fetchAll(loc.coords, { allowGeofence: true });
        }
      } catch {}
    });
    return () => sub.remove();
  }, [fetchAll]);

  useEffect(() => {
    let cancelled = false;
    async function startWatch() {
      if (locPermission !== "granted" || !servicesEnabled) {
        watchRef.current?.remove?.();
        watchRef.current = null;
        return;
      }
      watchRef.current?.remove?.();
      watchRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 20000, distanceInterval: 100 },
        async (location) => {
          if (cancelled) return;
          usingMockRef.current = false;
          setCoords(location.coords);
          const now = Date.now();
          if (now - lastFetchTsRef.current > 15000) {
            lastFetchTsRef.current = now;
            await fetchAll(location.coords, { allowGeofence: true });
          }
        }
      );
    }
    startWatch();
    return () => {
      cancelled = true;
      watchRef.current?.remove?.();
      watchRef.current = null;
    };
  }, [locPermission, servicesEnabled, fetchAll]);

  const onEnableLocationPress = useCallback(async () => {
    if (Platform.OS === "web") return;
    try {
      const current = await Location.getForegroundPermissionsAsync();
      if (current.status !== "granted" && current.canAskAgain) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        setLocPermission(status);
        if (status !== "granted") {
          setLocDeniedBanner(true);
          return;
        }
      }
      const svc = await Location.hasServicesEnabledAsync();
      setServicesEnabled(svc);
      if (!svc) {
        if (Platform.OS === "android") {
          try {
            await IntentLauncher.startActivityAsync(
              IntentLauncher.ActivityAction.LOCATION_SOURCE_SETTINGS
            );
          } catch {
            Linking.openSettings?.();
          }
        } else {
          await Linking.openURL("app-settings:");
        }
        return;
      }
      if (usingMockRef.current) {
        geofenceInsideRef.current = null;
        lastAlertByTypeRef.current.geofence = 0;
      }
      usingMockRef.current = false;
      const loc = await Location.getCurrentPositionAsync({});
      setCoords(loc.coords);
      setLocDeniedBanner(false);
      await fetchAll(loc.coords, { allowGeofence: true });
    } catch {
      setLocDeniedBanner(true);
    }
  }, [fetchAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const allowGeofence =
        locPermission === "granted" && servicesEnabled && !usingMockRef.current;
      await fetchAll(undefined, { allowGeofence });
    } finally {
      setRefreshing(false);
    }
  }, [fetchAll, locPermission, servicesEnabled]);

  const formattedUpdated = updatedAt ? new Date(updatedAt).toLocaleTimeString() : "--:--";

  /* ========================= RENDER ========================= */
  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* HERO IMAGE */}
        <View style={styles.heroWrap}>
          <Image source={HERO_SRC} style={styles.heroImg} />
        </View>
        {/* Title + description */}
        <View style={styles.heroText}>
          <Text style={styles.heroTitle}>Always Be Prepared</Text>
          <Text style={styles.heroDesc}>
            Know what’s happening nearby, learn what to do, and act fast when it matters.
          </Text>
        </View>

        {/* LIVE MAP (title row only) */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Live Map</Text>
        </View>
        <View style={styles.mapShell}>
          {coords ? (
            <TouchableOpacity onPress={() => setMapExpanded(true)} activeOpacity={0.9}>
              <LeafletMiniMap lat={coords.latitude} lng={coords.longitude} />
            </TouchableOpacity>
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#6B7280" }}>Locating…</Text>
            </View>
          )}
        </View>
        {/* Updated time BELOW the map, right-aligned */}
        <Text style={styles.updatedBelow}>Updated at: {formattedUpdated}</Text>

        {/* Location banner — below the map */}
        {locDeniedBanner && (
          <View style={[styles.banner, { borderLeftColor: "#3B82F6", marginTop: 8 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>
                {!servicesEnabled ? "Location Services Off" : "Location Permission Denied"}
              </Text>
              <Text style={styles.bannerBody}>
                Using demo data near Taman Jurong. Enable location for precise readings.
              </Text>
              <TouchableOpacity onPress={onEnableLocationPress} style={styles.enableBtn}>
                <Text style={styles.enableBtnText}>Enable Location</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => setLocDeniedBanner(false)} accessibilityLabel="Dismiss alert">
              <Ionicons name="close" size={18} color="#111827" />
            </TouchableOpacity>
          </View>
        )}

        {/* LOCAL CONDITIONS */}
        <Text style={[styles.sectionTitle, { marginTop: 16, marginBottom: 8 }]}>Local Conditions</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsRow}>
          <HStatCard
            icon="rainy"
            label="Rainfall"
            value={rainNearest?.rainfall != null ? `${rainNearest.rainfall} mm` : "—"}
            sub={rainNearest?.name || "Nearest Station"}
          />
          <HStatCard
            icon="leaf"
            label="PM2.5"
            value={pm25Nearest?.value != null ? `${pm25Nearest.value} µg/m³` : "—"}
            sub={pm25Nearest?.name || "Nearest Region"}
          />
          <HStatCard
            icon="thermometer"
            label="Temp"
            value={tempNearest?.value != null ? `${tempNearest.value} °C` : "—"}
            sub={tempNearest?.name || "Nearest Station"}
          />
          <HStatCard
            icon="water"
            label="Humidity"
            value={humidityNearest?.value != null ? `${humidityNearest.value}%` : "—"}
            sub={humidityNearest?.name || "Nearest Station"}
          />
          <HStatCard
            icon="navigate"
            label="Wind"
            value={windNearest?.speed != null ? `${windNearest.speed} kn` : "—"}
            sub={windNearest?.direction != null ? `Dir ${windNearest.direction}°` : windNearest?.name || "Nearest"}
          />
        </ScrollView>

        {/* EMERGENCY PREPAREDNESS — image-top cards like Quizzes */}
        <Text style={[styles.sectionTitle, { marginTop: 16, marginBottom: 10 }]}>Emergency Preparedness</Text>
        <View style={styles.featuresGrid}>
          <FeatureCard
            title="Resource Hub"
            img={require("./assets/resource.jpg")}
            onPress={() => navigation.navigate("Resource")}
          />
          <FeatureCard
            title="Checklist"
            img={require("./assets/checklist.jpg")}
            onPress={() => navigation.navigate("Checklist")}
          />
          <FeatureCard
            title="Emergency Contact"
            img={require("./assets/emergency.jpg")}
            onPress={() => setEmergencyOpen(true)}
          />
          <FeatureCard
            title="Quiz Game"
            img={require("./assets/quiz.jpg")}
            onPress={() => navigation.navigate("Quizzes")}
          />
        </View>

        <View style={{ height: 10 }} />
      </ScrollView>

      {/* Chatbot FAB — now navigates to a full screen */}
      <TouchableOpacity
        style={styles.chatBubble}
        activeOpacity={0.9}
        onPress={() => navigation.navigate("Chatbot")}
        accessibilityLabel="Open chatbot"
      >
        <Ionicons name="chatbubbles" size={20} color="#fff" />
      </TouchableOpacity>

      <EmergencyContactsModal visible={emergencyOpen} onClose={() => setEmergencyOpen(false)} />

      {/* Keep interactive map as a modal */}
      <InteractiveMapModal
        visible={mapExpanded}
        onClose={() => setMapExpanded(false)}
        userCoords={coords}
        datasets={envDatasets}
      />
    </SafeAreaView>
  );
}

/* --- Mini Leaflet map (WebView) --- */
function LeafletMiniMap({ lat, lng }) {
  const html = `
  <!DOCTYPE html><html><head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
    <style>html,body,#map{height:100%;margin:0}.leaflet-control-zoom{display:none}</style>
  </head><body>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      (function(){
        var map=L.map('map',{zoomControl:false}).setView([${lat},${lng}],15);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
        L.marker([${lat},${lng}]).addTo(map).bindPopup('You are here');
      })();
    </script>
  </body></html>`;
  return (
    <View style={styles.mapShellInner}>
      <WebView originWhitelist={["*"]} javaScriptEnabled domStorageEnabled source={{ html }} style={{ flex: 1 }} />
    </View>
  );
}

/* --- Horizontal stat card (centered layout) --- */
function HStatCard({ icon, label, value, sub }) {
  return (
    <View style={styles.hStatCard}>
      <Ionicons name={icon} size={36} color="#4F46E5" style={{ alignSelf: "center" }} />
      <Text style={styles.hStatLabelCentered}>{label}</Text>
      <Text style={styles.hStatValueCentered}>{value}</Text>
      {!!sub && (
        <Text style={styles.hStatSubCentered} numberOfLines={1}>
          {sub}
        </Text>
      )}
    </View>
  );
}

/* --- Feature card (image top, title bottom like Quizzes) --- */
function FeatureCard({ title, img, onPress }) {
  return (
    <TouchableOpacity style={styles.featureCard} onPress={onPress} activeOpacity={0.9}>
      <Image source={img} style={styles.featureImage} />
      <Text style={styles.featureTitle} numberOfLines={1}>{title}</Text>
    </TouchableOpacity>
  );
}

/* =========================================================================
   STYLES
   ========================================================================= */
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFFFFF" },
  container: { padding: 16 },

  /* Banner */
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#EEF2FF",
    borderLeftWidth: 4,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderColor: "#C7D2FE",
    marginBottom: 12,
  },
  bannerTitle: { color: "#111827", fontWeight: "700", marginBottom: 2 },
  bannerBody: { color: "#374151" },
  enableBtn: {
    alignSelf: "flex-start",
    marginTop: 8,
    backgroundColor: "#6C63FF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  enableBtnText: { color: "#fff", fontWeight: "700" },

  /* HERO (full-bleed) */
  heroWrap: {
    overflow: "hidden",
    marginTop: -16,
    marginHorizontal: -16,
  },
  heroImg: {
    width: "100%",
    height: HERO_HEIGHT,
    resizeMode: "contain",
  },
  heroText: { marginTop: 12 },
  heroTitle: { fontSize: 20, fontWeight: "800", color: "#111827" },
  heroDesc: { color: "#6B7280", marginTop: 6 },

  /* Sections */
  sectionRow: {
    marginTop: 16,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: { color: "#111827", fontWeight: "800", fontSize: 18 },

  /* Map */
  mapShell: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
    backgroundColor: "#F3F4F6",
  },
  mapShellInner: { height: 220, width: "100%" },
  updatedBelow: { color: "#6B7280", fontSize: 12, marginTop: 6, alignSelf: "flex-end" },

  /* Horizontal stats row */
  statsRow: { gap: 10, paddingRight: 4 },
  hStatCard: {
    width: 110,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
  },
  hStatLabelCentered: { color: "#374151", fontSize: 12, fontWeight: "700", marginTop: 8 },
  hStatValueCentered: { color: "#111827", fontSize: 20, fontWeight: "800", marginTop: 4 },
  hStatSubCentered: { color: "#6B7280", fontSize: 12, marginTop: 4, alignSelf: "center", maxWidth: "100%" },

  /* Feature cards (Quizzes-style) */
  featuresGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
  },
  featureCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  featureImage: { width: "100%", height: 90, resizeMode: "cover" },
  featureTitle: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    color: "#111827",
    fontWeight: "700",
    fontSize: 15,
    textAlign: "center",
  },

  /* Modal shared */
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.25)" },
  modalSheet: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 24,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  modalTitle: { color: "#111827", fontWeight: "700", fontSize: 16 },

  contactRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10 },
  contactLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  contactIconWrap: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  contactName: { color: "#111827", fontWeight: "600" },
  contactNumber: { color: "#6B7280", marginTop: 2 },
  callBtn: {
    backgroundColor: "#6C63FF",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  callBtnText: { color: "#fff", fontWeight: "700" },

  /* Chat FAB */
  chatBubble: {
    position: "absolute",
    right: 16,
    bottom: 24,
    backgroundColor: "#6C63FF",
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    zIndex: 30,
  },
});
