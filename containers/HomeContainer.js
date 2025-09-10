/**
 * containers/HomeContainer.js — Home dashboard controller (location + env data)
 *
 * Purpose
 * - Drive the Home screen: permissions, location, data fetches, mock/demo flags, and alerts.
 * - Aggregate NEA datasets (rainfall, forecast, PM2.5, wind, humidity, temperature) and pick nearest.
 * - Manage geofence advisory and flood-risk alerts with cooldown + queued native alerts.
 *
 * Key Behaviours
 * - Mock switches (AsyncStorage): settings:mock-location, settings:mock-disaster.
 * - Geofence: 2 km around `mockDefault` (Taman Jurong demo); advisory triggers when entering.
 * - Alerts: queued popups; device notifications via AppPrefs; cooldown per alert type.
 * - Permissions: location (Expo Location), notifications (AppPrefs.ensurePermissions()).
 * - Data: falls back to bundled snapshot when online fetches are incomplete.
 *
 * Exports
 * - Default React component <HomeContainer/> which renders <HomeScreen vm={...}/> .
 */

import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useLayoutEffect,
  useContext,
} from "react";
import { Platform, Alert, Linking, AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as AppPrefs from "../utils/appPrefs";
import * as IntentLauncher from "expo-intent-launcher";
import { useNavigation } from "@react-navigation/native";
import { LanguageContext } from "../translations/language";
import HomeScreen from "../screens/HomeScreen";

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
} from "../api/envApi";

// ---------------------------------------------------------------------------
// Constants / helpers
// ---------------------------------------------------------------------------
const ALERT_COOLDOWN_MS = 10 * 60 * 1000;
const GEOFENCE_KM = 2;
const mockDefault = { latitude: 1.3405, longitude: 103.72 };

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
  showPopup = false,
  notifyDevice = true,
  bypassCooldown = false,
  onViewMap,
}) {
  const now = Date.now();
  const last = lastAlertByTypeRef.current[type] ?? 0;
  if (!bypassCooldown && now - last < ALERT_COOLDOWN_MS) return;

  let delivered = false;
  if (showPopup) {
    queueNativeAlert({
      title,
      body,
      buttons: [
        { text: "OK", style: "default" },
        onViewMap ? { text: "View Map", onPress: onViewMap } : null,
      ].filter(Boolean),
    });
    delivered = true;
  }
  if (notifyDevice) {
    try {
      await AppPrefs.presentNotification({ title, body, data: { type } });
      delivered = true;
    } catch (_e) {
      /* dev: ignore */
    }
  }
  if (delivered) lastAlertByTypeRef.current[type] = now;
}

function distKm(a, b) {
  return getDistanceFromLatLonInKm(
    a.latitude,
    a.longitude,
    b.latitude,
    b.longitude
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function HomeContainer() {
  const { lang } = useContext(LanguageContext);
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions?.({ headerShown: false });
  }, [navigation]);

  // UI state
  const [coords, setCoords] = useState(null);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [emergencyOpen, setEmergencyOpen] = useState(false);

  // Permissions / services
  const [locDeniedBanner, setLocDeniedBanner] = useState(false);
  const [locPermission, setLocPermission] = useState("undetermined");
  const [servicesEnabled, setServicesEnabled] = useState(true);
  const [notifGranted, setNotifGranted] = useState(false);

  // Data
  const [updatedAt, setUpdatedAt] = useState(null);
  const [rainNearest, setRainNearest] = useState(null);
  const [pm25Nearest, setPm25Nearest] = useState(null);
  const [tempNearest, setTempNearest] = useState(null);
  const [humidityNearest, setHumidityNearest] = useState(null);
  const [windNearest, setWindNearest] = useState(null);
  const [envDatasets, setEnvDatasets] = useState(null);

  // Risk / advisory state
  const [uiRiskLevel, setUiRiskLevel] = useState(null); // "High" | "Moderate" | "Low" | null
  const [nearestAreaName, setNearestAreaName] = useState(null);
  const [areaAdvisoryActive, setAreaAdvisoryActive] = useState(false);

  // Demo flags
  const [mockLocationOn, setMockLocationOn] = useState(false);
  const [mockDisasterOn, setMockDisasterOn] = useState(false);

  // refs
  const initRanRef = useRef(false);
  const watchRef = useRef(null);
  const lastFetchTsRef = useRef(0);
  const mockBootstrappedRef = useRef(false);

  // -------------------------------------------------------------------------
  // Demo toggles
  // -------------------------------------------------------------------------
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

  // -------------------------------------------------------------------------
  // Fetch all datasets (and trigger advisories)
  // -------------------------------------------------------------------------
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

          if (nearest) {
            const risk = estimateFloodRisk(nearest.rainfall);
            setUiRiskLevel(risk || null);

            if (risk === "High" || risk === "Moderate") {
              const isMockEnv = usingMockRef.current || mockLocationOn;
              const shouldNotify =
                mockDisasterOn || mockLocationOn || !isMockEnv;
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
            if (mockDisasterOn && (mockLocationOn || usingMockRef.current)) {
              const forcedRedButNoRealRisk = !(
                risk === "High" || risk === "Moderate"
              );
              if (forcedRedButNoRealRisk) {
                await triggerAlert({
                  title: "🚨 Flash Flood Warning",
                  body: "Demo: Flash flood warning active near Taman Jurong. Stay vigilant and check the map.",
                  type: "mock-flood",
                  notifyDevice: true,
                  bypassCooldown: true,
                  showPopup: false,
                  onViewMap: () => setMapExpanded(true),
                });
              }
            }
          } else {
            setUiRiskLevel(null);
          }
        } else {
          setUiRiskLevel(null);
        }
      }

      // Geofence advisory (mock disaster only)
      if (allowGeofence) {
        const inside = distKm(c, mockDefault) <= GEOFENCE_KM;
        setAreaAdvisoryActive(!!inside);
        const prev = geofenceInsideRef.current;
        geofenceInsideRef.current = inside;
        if ((prev === null && inside) || (prev === false && inside)) {
          if (mockDisasterOn) {
            await triggerAlert({
              title: "⚠️ Area Advisory: Taman Jurong",
              body: "You are near a flood-prone area. Stay vigilant and check the map for reports.",
              type: "geofence",
              notifyDevice: true,
              bypassCooldown: true,
            });
          }
        }
      } else {
        setAreaAdvisoryActive(distKm(c, mockDefault) <= GEOFENCE_KM);
        await triggerAreaAdvisoryForCoords(c);
      }

      // Other datasets
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
    [coords, pickNearestFrom, mockDisasterOn, mockLocationOn]
  );

  // -------------------------------------------------------------------------
  // Apply mock flags
  // -------------------------------------------------------------------------
  const applyMockFlags = useCallback(async () => {
    if (mockLocationOn) {
      if (mockBootstrappedRef.current) return;
      mockBootstrappedRef.current = true;
      usingMockRef.current = true;
      setCoords(mockDefault);
      setLocDeniedBanner(false);
      await fetchAll(mockDefault, { allowGeofence: false });
    } else {
      mockBootstrappedRef.current = false;
    }
  }, [mockLocationOn, fetchAll]);

  // -------------------------------------------------------------------------
  // Initial boot / resume
  // -------------------------------------------------------------------------
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

      await AppPrefs.refresh();
      const grantedNotif = await AppPrefs.ensurePermissions();
      setNotifGranted(grantedNotif);

      // Mock short-circuit
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

  // If mock disaster turns ON and we’re already inside geofence, push once
  useEffect(() => {
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

  // Refresh flags on focus
  useEffect(() => {
    const unsub = navigation.addListener("focus", async () => {
      await loadDemoToggles();
      await applyMockFlags();
      await AppPrefs.refresh();
    });
    return unsub;
  }, [navigation, loadDemoToggles, applyMockFlags]);

  // App comes to foreground
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
      } catch {
        /* ignore */
      }
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

  // -------------------------------------------------------------------------
  // Handlers exposed to view
  // -------------------------------------------------------------------------
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

  // -------------------------------------------------------------------------
  // View-model
  // -------------------------------------------------------------------------
  const vm = {
    // nav
    navigation,

    // language
    lang,

    // state for map & emergency modal
    mapExpanded,
    setMapExpanded,
    emergencyOpen,
    setEmergencyOpen,

    // data & nearest stats
    coords,
    envDatasets,
    rainNearest,
    pm25Nearest,
    tempNearest,
    humidityNearest,
    windNearest,
    nearestAreaName,

    // risk banner inputs
    uiRiskLevel,
    areaAdvisoryActive,
    mockDisasterOn,
    mockLocationOn,
    updatedAt,

    // banners/permissions
    locDeniedBanner,
    locPermission,
    servicesEnabled,

    // actions
    onEnableLocationPress,
    onRefresh,

    // list/refresh
    refreshing,
  };

  return <HomeScreen vm={vm} />;
}
