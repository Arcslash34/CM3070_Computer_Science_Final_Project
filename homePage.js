// homePage.js
import React, {
  useEffect,
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
  FlatList,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import * as AppPrefs from "./appPrefs";
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

/* ----------------- Notifications/alerts ----------------- */
const ALERT_COOLDOWN_MS = 10 * 60 * 1000;
const GEOFENCE_KM = 2;
const mockDefault = { latitude: 1.3405, longitude: 103.72 };

// Demo keys (shared with Settings)
const DEMO_KEYS = {
  mockLocation: "settings:mock-location",
  mockDisaster: "settings:mock-disaster",
};

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
async function triggerAlert({
  title,
  body,
  type = "general",
  showPopup = false, // <-- default: NO POPUP
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
  if (notifyDevice) {
    await AppPrefs.presentNotification({ title, body, data: { type } });
  }

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
  {
    key: "scdf",
    name: "SCDF (Fire / Ambulance)",
    number: "995",
    icon: "flame",
    color: "#EF4444",
  },
  {
    key: "ambulance",
    name: "Non-Emergency Ambulance",
    number: "1777",
    icon: "medkit",
    color: "#F59E0B",
  },
  {
    key: "police",
    name: "Police",
    number: "999",
    icon: "shield",
    color: "#3B82F6",
  },
];
function EmergencyContactsModal({ visible, onClose }) {
  const onCall = (num) => {
    Alert.alert(`Call ${num}?`, "This will open your phone dialer.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Call",
        style: "destructive",
        onPress: () => Linking.openURL(`tel:${num}`),
      },
    ]);
  };
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
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
              <View
                style={[styles.contactIconWrap, { backgroundColor: c.color }]}
              >
                <Ionicons name={c.icon} size={16} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.contactName}>{c.name}</Text>
                <Text style={styles.contactNumber}>{c.number}</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => onCall(c.number)}
              style={styles.callBtn}
              accessibilityLabel={`Call ${c.name}`}
            >
              <Ionicons name="call" size={16} color="#fff" />
              <Text style={styles.callBtnText}>Call</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </Modal>
  );
}

/* ----------------- Quick Articles ----------------- */
const ARTICLE_ITEMS = [
  {
    id: "st-flood",
    title:
      "Flash flood in Jurong Town Hall Road; warning issued for Dunearn Road",
    source: "The Straits Times",
    url: "https://www.straitstimes.com/singapore/risk-of-flash-floods-along-dunearn-road-avoid-road-for-the-next-hour-pub",
  },
  {
    id: "nea-haze",
    title: "Haze: 1-hr PM2.5 & 24-hr PSI (Live Map)",
    source: "NEA",
    url: "https://www.haze.gov.sg/",
  },
  {
    id: "nea-dengue-zika",
    title: "Dengue & Zika: Clusters, prevention, cases",
    source: "NEA",
    url: "https://www.nea.gov.sg/dengue-zika",
  },
  {
    id: "scdf-fire-residential",
    title: "Fire Safety Guidelines for Residential Estate",
    source: "SCDF",
    url: "https://www.scdf.gov.sg/home/community-and-volunteers/fire-emergency-guides/fire-safety-guidelines-for--residential-estate",
  },
  {
    id: "independent-johor-quakes",
    title: "Weekend quakes jolt Johor",
    source: "The Independent Singapore",
    url: "https://theindependent.sg/weekend-quakes-jolt-johor-experts-warn-peninsular-malaysia-and-singapore-not-immune-to-future-tremors/",
  },
];

/* =========================================================================
   Helpers for the alert card’s date row (design only)
   ========================================================================= */
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
function formatFancyDate(dt) {
  if (!dt) return "—";
  return `${DAYS[dt.getDay()]}, ${dt.getDate()} ${
    MONTHS[dt.getMonth()]
  } ${dt.getFullYear()}`;
}
function formatAgo(dt) {
  if (!dt) return "";
  const ms = Date.now() - dt.getTime();
  if (ms < 60_000) return "Just Now";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? "s" : ""} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

/* =========================================================================
   Alert card UI (new design only; logic below stays the same)
   ========================================================================= */
function RiskAlertCard({ variant, title, whenISO, areasText }) {
  const dt = whenISO ? new Date(whenISO) : null;

  const palette =
    variant === "red"
      ? {
          wrap: styles.alertRed,
          icon: "warning",
          iconColor: "#fff",
          text: styles.alertTextLight,
        }
      : variant === "orange"
      ? {
          wrap: styles.alertOrange,
          icon: "warning-outline",
          iconColor: "#111827",
          text: styles.alertTextDark,
        }
      : {
          wrap: styles.alertGreen,
          icon: "checkmark-circle",
          iconColor: "#064e3b",
          text: styles.alertTextDark,
        };

  const isFlashFlood = title.includes("Flash Flood Warning");

  return (
    <View style={[styles.alertCard, palette.wrap]}>
      {/* Title row */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons
          name={palette.icon}
          size={18}
          color={palette.iconColor}
          style={{ marginRight: 6 }}
        />
        <Text
          style={[
            styles.alertTitle,
            palette.text,
            isFlashFlood && styles.alertTitleBig,
          ]}
        >
          {title}
        </Text>
        {isFlashFlood && (
          <Ionicons
            name={palette.icon}
            size={18}
            color={palette.iconColor}
            style={{ marginLeft: 6 }}
          />
        )}
      </View>

      {/* Date row */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          marginTop: 4,
        }}
      >
        <Ionicons
          name="calendar-outline"
          size={14}
          color={palette.iconColor}
          style={{ marginRight: 4 }}
        />
        <Text style={[styles.alertMeta, palette.text, styles.alertSpaced]}>
          {formatFancyDate(dt)} • {formatAgo(dt)}
        </Text>
      </View>

      {/* Location row */}
      {!!areasText && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            marginTop: 2,
          }}
        >
          <Ionicons
            name="location-outline"
            size={14}
            color={palette.iconColor}
            style={{ marginRight: 4 }}
          />
          <Text
            style={[styles.alertMeta, palette.text, styles.alertSpaced]}
            numberOfLines={2}
            textAlign="center"
          >
            {areasText}
          </Text>
        </View>
      )}
    </View>
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

  const [updatedAt, setUpdatedAt] = useState(null);
  const [rainNearest, setRainNearest] = useState(null);

  const [pm25Nearest, setPm25Nearest] = useState(null);
  const [tempNearest, setTempNearest] = useState(null);
  const [humidityNearest, setHumidityNearest] = useState(null);
  const [windNearest, setWindNearest] = useState(null);

  const [emergencyOpen, setEmergencyOpen] = useState(false);

  const [areaAdvisoryActive, setAreaAdvisoryActive] = useState(false);
  const [envDatasets, setEnvDatasets] = useState(null);

  // Risk banner & nearest area label
  const [uiRiskLevel, setUiRiskLevel] = useState(null); // "High" | "Moderate" | "Low" | null
  const [nearestAreaName, setNearestAreaName] = useState(null);

  // Mock flags (from Settings)
  const [mockLocationOn, setMockLocationOn] = useState(false);
  const [mockDisasterOn, setMockDisasterOn] = useState(false);

  /** Load demo toggles and return their booleans */
  const loadDemoToggles = useCallback(async () => {
    try {
      const [ml, md] = await Promise.all([
        AsyncStorage.getItem(DEMO_KEYS.mockLocation),
        AsyncStorage.getItem(DEMO_KEYS.mockDisaster),
      ]);
      const mlOn = ml === "1";
      const mdOn = md === "1";
      setMockLocationOn(mlOn);
      setMockDisasterOn(mdOn);
      return { mlOn, mdOn };
    } catch {
      setMockLocationOn(false);
      setMockDisasterOn(false);
      return { mlOn: false, mdOn: false };
    }
  }, []);

  async function triggerAreaAdvisoryForCoords(c) {
    const inside = distKm(c, mockDefault) <= GEOFENCE_KM;
    const prev = geofenceInsideRef.current;
    setAreaAdvisoryActive(!!inside);
    geofenceInsideRef.current = inside;
    if (!inside) return;

    // Only notify for geofence when MOCK DISASTER is ON
    if (!mockDisasterOn) return;

    const firstEntry = prev === null || prev === false;
    await triggerAlert({
      title: "⚠️ Area Advisory: Taman Jurong",
      body: "You are near a flood-prone area. Stay vigilant and check the map for reports.",
      type: "geofence",
      notifyDevice: true,
      bypassCooldown: firstEntry,
    });
  }

  const pickNearestFrom = useCallback((datasets, c) => {
    if (!datasets || !c) return;
    const pickNearest = (arr, getLatLng) => {
      if (!arr || !arr.length) return null;
      let best = null,
        bestD = Infinity;
      for (const item of arr) {
        const { lat, lng } = getLatLng(item) || {};
        if (typeof lat !== "number" || typeof lng !== "number") continue;
        const d = getDistanceFromLatLonInKm(c.latitude, c.longitude, lat, lng);
        if (d < bestD) {
          bestD = d;
          best = { ...item, _distKm: d };
        }
      }
      return best;
    };
    setPm25Nearest(
      pickNearest(datasets.pm25, (d) => ({
        lat: d?.location?.latitude,
        lng: d?.location?.longitude,
      }))
    );
    setTempNearest(
      pickNearest(datasets.temp, (d) => ({
        lat: d?.location?.latitude,
        lng: d?.location?.longitude,
      }))
    );
    setHumidityNearest(
      pickNearest(datasets.humidity, (d) => ({
        lat: d?.location?.latitude,
        lng: d?.location?.longitude,
      }))
    );
    setWindNearest(
      pickNearest(datasets.wind, (d) => ({
        lat: d?.location?.latitude,
        lng: d?.location?.longitude,
      }))
    );
  }, []);

  const fetchAll = useCallback(
    async (pos, opts = {}) => {
      const { allowGeofence = true } = opts;
      const c = pos || coords;
      if (!c) return;

      const weatherData = await fetchWeatherForecast();
      if (weatherData) {
        const nearestArea = getNearestForecastArea(c, weatherData.metadata);
        setNearestAreaName(nearestArea || null);
      }

      const rainAll = await fetchRainfallData(c);
      if (rainAll) {
        if (Array.isArray(rainAll.stations) && rainAll.stations.length) {
          let nearest = null,
            best = Infinity;
          for (const st of rainAll.stations) {
            if (
              typeof st?.location?.latitude !== "number" ||
              typeof st?.location?.longitude !== "number"
            )
              continue;
            const d = getDistanceFromLatLonInKm(
              c.latitude,
              c.longitude,
              st.location.latitude,
              st.location.longitude
            );
            if (d < best) {
              best = d;
              nearest = st;
            }
          }
          setRainNearest(nearest || null);

          // UI risk banner level from rainfall data
          if (nearest) {
            const risk = estimateFloodRisk(nearest.rainfall, nearest.lastHour);
            setUiRiskLevel(risk || null);

            if (risk === "High" || risk === "Moderate") {
              const isMockEnv = usingMockRef.current || mockLocationOn;
              const shouldNotify = mockDisasterOn || !isMockEnv; // push in real env, or when mock disaster is ON
              await triggerAlert({
                title: `🚨 Flood Risk: ${risk}`,
                body: `Heavy rain detected at ${
                  nearest.name ?? "nearby station"
                }. Stay alert and follow safety procedures.`,
                type: "risk",
                showPopup: false,
                onViewMap: () => setMapExpanded(true),
                notifyDevice: shouldNotify,
              });
            }
          } else {
            setUiRiskLevel(null);
          }
        } else {
          setUiRiskLevel(null);
        }
      }

      // --- Geofence advisory (only when mock disaster is ON) ---
      if (allowGeofence) {
        const inside = distKm(c, mockDefault) <= GEOFENCE_KM;
        setAreaAdvisoryActive(!!inside);
        const prev = geofenceInsideRef.current;
        geofenceInsideRef.current = inside;
        if ((prev === null && inside) || (prev === false && inside)) {
          if (mockDisasterOn) {
            const firstEntry = true; // by definition of the condition above
            await triggerAlert({
              title: "⚠️ Area Advisory: Taman Jurong",
              body: "You are near a flood-prone area. Stay vigilant and check the map for reports.",
              type: "geofence",
              notifyDevice: true,
              bypassCooldown: firstEntry,
            });
          }
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
        rain:
          rainAll && Array.isArray(rainAll.stations)
            ? rainAll
            : base?.rain || { stations: [] },
        pm25: pm25?.length ? pm25 : base?.pm25 || [],
        temp: temp?.length ? temp : base?.temp || [],
        humidity: humidity?.length ? humidity : base?.humidity || [],
        wind: wind?.length ? wind : base?.wind || [],
      };

      setEnvDatasets(merged);
      pickNearestFrom(merged, c);
      setUpdatedAt(new Date().toISOString());
    },
    [
      coords,
      triggerAreaAdvisoryForCoords,
      pickNearestFrom,
      mockDisasterOn,
      mockLocationOn,
    ]
  );

  /** Apply mock flags immediately when they change / on focus */
  const applyMockFlags = useCallback(async () => {
    if (mockLocationOn) {
      usingMockRef.current = true;
      setCoords(mockDefault);
      setLocDeniedBanner(false);
      await fetchAll(mockDefault, { allowGeofence: false });
    }
  }, [mockLocationOn, fetchAll]);

  /* ---- Initial load / resume ---- */
  useEffect(() => {
    if (initRanRef.current) return;
    initRanRef.current = true;

    (async () => {
      const { mlOn } = await loadDemoToggles();

      try {
        const fileSnap = await loadEnvDatasetsFromFile();
        if (fileSnap) {
          setEnvDatasets(fileSnap);
          const seedCoords =
            coords || (usingMockRef.current ? mockDefault : null);
          if (seedCoords) pickNearestFrom(fileSnap, seedCoords);
        }
      } catch {
        setEnvDatasets(null);
      }

      await AppPrefs.refresh(); // read toggles & configure Android channel (if native)
      const grantedNotif = await AppPrefs.ensurePermissions();
      setNotifGranted(grantedNotif);

      // If mock location is ON, short-circuit to mock
      if (mlOn) {
        usingMockRef.current = true;
        setCoords(mockDefault);
        setLocDeniedBanner(false);
        await fetchAll(mockDefault, { allowGeofence: false });
        return;
      }

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
  }, [
    fetchAll,
    triggerAreaAdvisoryForCoords,
    coords,
    pickNearestFrom,
    loadDemoToggles,
  ]);

  // Re-apply when toggles change
  useEffect(() => {
    applyMockFlags();
  }, [applyMockFlags]);

  useEffect(() => {
    // If mock disaster just turned ON and we are already inside the geofence,
    // send the notification immediately (no popup, just device push).
    if (mockDisasterOn && areaAdvisoryActive) {
      triggerAlert({
        title: "⚠️ Area Advisory: Taman Jurong",
        body: "You are near a flood-prone area. Stay vigilant and check the map for reports.",
        type: "geofence",
        notifyDevice: true,
        bypassCooldown: true,
        showPopup: false,
      });
    }
  }, [mockDisasterOn, areaAdvisoryActive]);

  // Also refresh flags on screen focus (+ refresh notif prefs)
  useEffect(() => {
    const unsub = navigation.addListener("focus", async () => {
      await loadDemoToggles();
      await applyMockFlags();
      await AppPrefs.refresh();
    });
    return unsub;
  }, [navigation, loadDemoToggles, applyMockFlags]);

  // Reload on app foreground; if real location available, fetch; otherwise respect mock
  useEffect(() => {
    const sub = AppState.addEventListener("change", async (state) => {
      if (state !== "active") return;
      await loadDemoToggles();
      await AppPrefs.refresh();
      if (mockLocationOn) {
        await applyMockFlags();
        return;
      }
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
  }, [fetchAll, loadDemoToggles, mockLocationOn, applyMockFlags]);

  // Watch location (disabled while mocking)
  useEffect(() => {
    let cancelled = false;
    async function startWatch() {
      if (mockLocationOn || locPermission !== "granted" || !servicesEnabled) {
        watchRef.current?.remove?.();
        watchRef.current = null;
        return;
      }
      watchRef.current?.remove?.();
      watchRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 20000,
          distanceInterval: 100,
        },
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
  }, [locPermission, servicesEnabled, fetchAll, mockLocationOn]);

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
        !mockLocationOn &&
        locPermission === "granted" &&
        servicesEnabled &&
        !usingMockRef.current;
      await fetchAll(undefined, { allowGeofence });
    } finally {
      setRefreshing(false);
    }
  }, [fetchAll, locPermission, servicesEnabled, mockLocationOn]);

  const formattedUpdated = updatedAt
    ? new Date(updatedAt).toLocaleTimeString()
    : "--:--";

  /* --------- Risk banner below the map --------- */
  const realLocationOn = locPermission === "granted" && servicesEnabled;
  const riskBanner = (() => {
    // Forced red when mock disaster is ON (with mock location or no real location)
    if (mockDisasterOn && (mockLocationOn || areaAdvisoryActive)) {
      return (
        <RiskAlertCard
          variant="red"
          title="Flash Flood Warning"
          whenISO={updatedAt || new Date().toISOString()}
          areasText="Taman Jurong, Lakeside"
        />
      );
    }

    // If we have coords and a computed risk, show status for nearest area/station
    if (coords && uiRiskLevel) {
      const locName = rainNearest?.name || nearestAreaName || "your location";
      if (uiRiskLevel === "High") {
        return (
          <RiskAlertCard
            variant="red"
            title="Flash Flood Warning"
            whenISO={updatedAt}
            areasText={locName}
          />
        );
      }
      if (uiRiskLevel === "Moderate") {
        return (
          <RiskAlertCard
            variant="orange"
            title="Moderate Flood Risk"
            whenISO={updatedAt}
            areasText={locName}
          />
        );
      }
      // Low
      return (
        <RiskAlertCard variant="green" title={`No Alert`} whenISO={updatedAt} />
      );
    }

    // No coords and no forced mock disaster — show nothing
    return null;
  })();

  /* ========================= RENDER ========================= */
  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* HERO IMAGE */}
        <View style={styles.heroWrap}>
          <Image source={HERO_SRC} style={styles.heroImg} />
        </View>
        {/* Title + description */}
        <View style={styles.heroText}>
          <Text style={styles.heroTitle}>Always Be Prepared</Text>
          <Text style={styles.heroDesc}>
            Know what’s happening nearby, learn what to do, and act fast when it
            matters.
          </Text>
        </View>

        {/* LIVE MAP */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Live Map</Text>
        </View>
        <View style={styles.mapShell}>
          {coords ? (
            <TouchableOpacity
              onPress={() => setMapExpanded(true)}
              activeOpacity={0.9}
            >
              <LeafletMiniMap lat={coords.latitude} lng={coords.longitude} />
            </TouchableOpacity>
          ) : (
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#6B7280" }}>Locating…</Text>
            </View>
          )}
        </View>

        {/* Risk / Warning card (new design) */}
        {riskBanner}

        {/* Location banner — permissions/services */}
        {locDeniedBanner && (
          <View
            style={[
              styles.banner,
              { borderLeftColor: "#3B82F6", marginTop: 8 },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>
                {!servicesEnabled
                  ? "Location Services Off"
                  : "Location Permission Denied"}
              </Text>
              <Text style={styles.bannerBody}>
                Using demo data near Taman Jurong. Enable location for precise
                readings.
              </Text>
              <TouchableOpacity
                onPress={onEnableLocationPress}
                style={styles.enableBtn}
              >
                <Text style={styles.enableBtnText}>Enable Location</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={() => setLocDeniedBanner(false)}
              accessibilityLabel="Dismiss alert"
            >
              <Ionicons name="close" size={18} color="#111827" />
            </TouchableOpacity>
          </View>
        )}

        {/* News */}
        <View style={[styles.sectionRow, { marginTop: 12 }]}>
          <Text style={styles.sectionTitle}>Articles</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate("Articles")}
            activeOpacity={0.8}
          >
            <Text style={styles.viewAll}>View all</Text>
          </TouchableOpacity>
        </View>
        <HomeNewsStrip onOpen={(url) => Linking.openURL(url)} />

        {/* Local conditions */}
        <Text style={[styles.sectionTitle, { marginTop: 16, marginBottom: 8 }]}>
          Local Conditions
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statsRow}
        >
          <HStatCard
            icon="rainy"
            label="Rainfall"
            value={
              rainNearest?.rainfall != null ? `${rainNearest.rainfall} mm` : "—"
            }
            sub={rainNearest?.name || "Nearest Station"}
          />
          <HStatCard
            icon="leaf"
            label="PM2.5"
            value={
              pm25Nearest?.value != null ? `${pm25Nearest.value} µg/m³` : "—"
            }
            sub={pm25Nearest?.name || "Nearest Region"}
          />
          <HStatCard
            icon="thermometer"
            label="Temp"
            value={
              tempNearest?.value != null ? `${tempNearest?.value} °C` : "—"
            }
            sub={tempNearest?.name || "Nearest Station"}
          />
          <HStatCard
            icon="water"
            label="Humidity"
            value={
              humidityNearest?.value != null ? `${humidityNearest.value}%` : "—"
            }
            sub={humidityNearest?.name || "Nearest Station"}
          />
          <HStatCard
            icon="navigate"
            label="Wind"
            value={windNearest?.speed != null ? `${windNearest.speed} kn` : "—"}
            sub={
              windNearest?.direction != null
                ? `Dir ${windNearest.direction}°`
                : windNearest?.name || "Nearest"
            }
          />
        </ScrollView>

        {/* Features */}
        <Text
          style={[styles.sectionTitle, { marginTop: 16, marginBottom: 10 }]}
        >
          Emergency Preparedness
        </Text>
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
            title="Quiz Game"
            img={require("./assets/quiz.jpg")}
            onPress={() => navigation.navigate("Quizzes")}
          />
          <FeatureCard
            title="Emergency Contact"
            img={require("./assets/emergency.jpg")}
            onPress={() => setEmergencyOpen(true)}
          />
        </View>

        <View style={{ height: 10 }} />
      </ScrollView>

      {/* Chatbot FAB */}
      <TouchableOpacity
        style={styles.chatBubble}
        activeOpacity={0.9}
        onPress={() => navigation.navigate("Chatbot")}
        accessibilityLabel="Open chatbot"
      >
        <Ionicons name="chatbubbles" size={20} color="#fff" />
      </TouchableOpacity>

      <EmergencyContactsModal
        visible={emergencyOpen}
        onClose={() => setEmergencyOpen(false)}
      />

      {/* Interactive map modal */}
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
      <WebView
        originWhitelist={["*"]}
        javaScriptEnabled
        domStorageEnabled
        source={{ html }}
        style={{ flex: 1 }}
      />
    </View>
  );
}

/* --- Horizontal stat card (centered layout) --- */
function HStatCard({ icon, label, value, sub }) {
  return (
    <View style={styles.hStatCard}>
      <Ionicons
        name={icon}
        size={36}
        color="#4F46E5"
        style={{ alignSelf: "center" }}
      />
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
    <TouchableOpacity
      style={styles.featureCard}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <Image source={img} style={styles.featureImage} />
      <Text style={styles.featureTitle} numberOfLines={1}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

/* --- News carousel (auto-scrolls every 5s) --- */
function HomeNewsStrip({ onOpen }) {
  const listRef = React.useRef(null);
  const [idx, setIdx] = useState(0);
  const [mounted, setMounted] = useState(false);

  // width = screen width minus horizontal padding (16*2)
  const CARD_W = SCREEN_W - 32;
  const SPACING = 10;

  const getItemLayout = (_data, index) => ({
    length: CARD_W + SPACING,
    offset: (CARD_W + SPACING) * index,
    index,
  });

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const t = setInterval(() => {
      setIdx((prev) => {
        const next = (prev + 1) % ARTICLE_ITEMS.length;
        try {
          listRef.current?.scrollToIndex?.({ index: next, animated: true });
        } catch {}
        return next;
      });
    }, 5000);
    return () => clearInterval(t);
  }, [mounted]);

  const onMomentumEnd = (e) => {
    const x = e.nativeEvent.contentOffset.x;
    const newIdx = Math.round(x / (CARD_W + SPACING));
    if (!Number.isNaN(newIdx)) {
      setIdx(Math.max(0, Math.min(ARTICLE_ITEMS.length - 1, newIdx)));
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => onOpen(item.url)}
      style={[newsStyles.card, { width: CARD_W, marginRight: SPACING }]}
    >
      <View style={newsStyles.rowTop}>
        <Ionicons name="newspaper-outline" size={18} color="#111827" />
        <Text style={newsStyles.source}>{item.source}</Text>
      </View>
      <Text style={newsStyles.title} numberOfLines={2}>
        {item.title}
      </Text>
      <View style={newsStyles.rowBottom}>
        <Text style={newsStyles.linkText}>Open article</Text>
        <Ionicons name="open-outline" size={16} color="#6366F1" />
      </View>
    </TouchableOpacity>
  );

  return (
    <FlatList
      ref={listRef}
      data={ARTICLE_ITEMS}
      keyExtractor={(it) => it.id}
      renderItem={renderItem}
      horizontal
      showsHorizontalScrollIndicator={false}
      getItemLayout={getItemLayout}
      snapToInterval={CARD_W + SPACING}
      snapToAlignment="start"
      decelerationRate="fast"
      disableIntervalMomentum
      nestedScrollEnabled
      onMomentumScrollEnd={onMomentumEnd}
      contentContainerStyle={{ paddingLeft: 0, paddingRight: 16 }}
      initialScrollIndex={0}
    />
  );
}

const newsStyles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "ios" ? 0.06 : 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  source: { color: "#6B7280", fontWeight: "700", fontSize: 12 },
  title: { color: "#111827", fontSize: 15, fontWeight: "800", lineHeight: 20 },
  rowBottom: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  linkText: { color: "#6366F1", fontWeight: "700" },
});

/* =========================================================================
   STYLES
   ========================================================================= */
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFFFFF" },
  container: { padding: 16 },

  /* Banner (permissions/services) */
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

  /* NEW – Alert card design (screenshot-like) */
  alertCard: {
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 8,
    marginBottom: 8,
  },
  alertRed: { backgroundColor: "#ef4444" },
  alertOrange: { backgroundColor: "#f59e0b" },
  alertGreen: { backgroundColor: "#d1fae5" },
  alertTitle: { fontSize: 16, fontWeight: "800", letterSpacing: 0.5 },
  alertTitleBig: { fontSize: 18, letterSpacing: 0.4 }, // 👈 Bigger + spaced for Flash Flood
  alertMeta: { marginTop: 4, fontSize: 13, fontWeight: "600" },
  alertSpaced: { letterSpacing: 0.4 },
  alertTextLight: { color: "#fff" },
  alertTextDark: { color: "#111827" },
  dot: { opacity: 0.85 },

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
  viewAll: { color: "#6366F1", fontWeight: "800" },

  /* Map */
  mapShell: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
    backgroundColor: "#F3F4F6",
  },
  mapShellInner: { height: 220, width: "100%" },
  updatedBelow: {
    color: "#6B7280",
    fontSize: 12,
    marginTop: 6,
    alignSelf: "flex-end",
  },

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
  hStatLabelCentered: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 8,
  },
  hStatValueCentered: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "800",
    marginTop: 4,
  },
  hStatSubCentered: {
    color: "#6B7280",
    fontSize: 12,
    marginTop: 4,
    alignSelf: "center",
    maxWidth: "100%",
  },

  /* Feature cards */
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
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
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
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  modalTitle: { color: "#111827", fontWeight: "700", fontSize: 16 },

  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  contactLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  contactIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
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
