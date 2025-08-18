// homePage.js
import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from 'react';
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
} from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as IntentLauncher from 'expo-intent-launcher';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { WebView } from 'react-native-webview';

import ChatbotScreen from './chatbot';
import InteractiveMapModal from './interactiveMapModal';
import translations from './translations';

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
  getNowWeather,
  fetchOWForecast5d,
  groupOWForecastByDay,
  // snapshot helpers (NEW)
  loadEnvDatasetsFromFile,
} from './api';

import { useLanguage } from './language';

/* =========================================================================
   NOTIFICATION / ALERT ENGINE
   ========================================================================= */

const ALERT_COOLDOWN_MS = 10 * 60 * 1000;
const GEOFENCE_KM = 2;

// Mock disaster epicenter (Taman Jurong)
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
  const wrapped = (next.buttons?.length ? next.buttons : [{ text: 'OK' }]).map(
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
    if (status !== 'granted' && existing.canAskAgain) {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Alerts',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        lockscreenVisibility:
          Notifications.AndroidNotificationVisibility.PUBLIC,
        sound: 'default',
      });
    }
    return status === 'granted';
  } catch (e) {
    console.warn('ensureNotificationsReady failed', e);
    return false;
  }
}

async function presentDeviceNotification({ title, body, type }) {
  if (Platform.OS === 'web') return;
  const ok = await ensureNotificationsReady();
  if (!ok) return;
  try {
    await Notifications.presentNotificationAsync({
      title,
      body,
      sound: 'default',
      data: { type },
    });
  } catch (e) {
    console.warn('presentNotificationAsync failed', e);
  }
}

async function triggerAlert({
  title,
  body,
  type = 'general',
  showPopup = true,
  notifyDevice = true,
  bypassCooldown = false,
  onViewMap,
}) {
  const now = Date.now();
  const last = lastAlertByTypeRef.current[type] ?? 0;
  if (!bypassCooldown && now - last < ALERT_COOLDOWN_MS) {
    if (__DEV__) console.log(`[ALERT] cooldown suppress: ${type}`);
    return;
  }

  if (showPopup) {
    queueNativeAlert({
      title,
      body,
      buttons: [
        { text: 'OK', style: 'default' },
        onViewMap ? { text: 'View Map', onPress: onViewMap } : null,
      ].filter(Boolean),
    });
  }

  if (notifyDevice) {
    await presentDeviceNotification({ title, body, type });
  }

  lastAlertByTypeRef.current[type] = now;
}

function distKm(a, b) {
  return getDistanceFromLatLonInKm(a.latitude, a.longitude, b.latitude, b.longitude);
}

// ---------------- NEW (re-added): ChatbotModal ----------------
function ChatbotModal({ visible, onClose, ChatbotComponent }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalBackdrop} />
      </TouchableWithoutFeedback>
      <View style={[styles.modalSheet, { height: '80%' }]}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Assistant</Text>
          <TouchableOpacity onPress={onClose} accessibilityLabel="Close">
            <Ionicons name="close" size={20} color="#111827" />
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1 }}>
          <ChatbotComponent />
        </View>
      </View>
    </Modal>
  );
}

// ---------------- NEW (re-added): EmergencyContactsModal ----------------
const EMERGENCY_CONTACTS = [
  { key: 'scdf', name: 'SCDF (Fire / Ambulance)', number: '995', icon: 'flame', color: '#EF4444' },
  { key: 'ambulance', name: 'Non-Emergency Ambulance', number: '1777', icon: 'medkit', color: '#F59E0B' },
  { key: 'police', name: 'Police', number: '999', icon: 'shield', color: '#3B82F6' },
];
function EmergencyContactsModal({ visible, onClose }) {
  const onCall = (num) => {
    Alert.alert(
      `Call ${num}?`,
      'This will open your phone dialer.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Call', style: 'destructive', onPress: () => Linking.openURL(`tel:${num}`) },
      ],
      { cancelable: true }
    );
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
   UI helpers
   ========================================================================= */

const getRainSeverity = (mm) => {
  if (mm == null) return { label: 'N/A', color: '#9CA3AF' };
  if (mm === 0) return { label: 'No Rain', color: '#10B981' };
  if (mm <= 2) return { label: 'Light Rain', color: '#3B82F6' };
  if (mm <= 10) return { label: 'Moderate Rain', color: '#F59E0B' };
  return { label: 'Heavy Rain', color: '#EF4444' };
}

/* =========================================================================
   SCREEN
   ========================================================================= */

export default function HomeScreen() {
  const { lang } = useLanguage();
  const t = (key) => translations[lang][key] || key;
  const navigation = useNavigation();

  const [coords, setCoords] = useState(null);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [locDeniedBanner, setLocDeniedBanner] = useState(false);

  const [locPermission, setLocPermission] = useState('undetermined');
  const [servicesEnabled, setServicesEnabled] = useState(true);
  const [notifGranted, setNotifGranted] = useState(false);
  const initRanRef = useRef(false);

  const watchRef = useRef(null);
  const lastFetchTsRef = useRef(0);

  const [forecastText, setForecastText] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [rainInfo, setRainInfo] = useState(null);

  // nearest stat cards
  const [pm25Nearest, setPm25Nearest] = useState(null);
  const [tempNearest, setTempNearest] = useState(null);
  const [humidityNearest, setHumidityNearest] = useState(null);
  const [windNearest, setWindNearest] = useState(null);

  const [nowWx, setNowWx] = useState(null);
  const [owDays, setOwDays] = useState([]);

  const [menuOpen, setMenuOpen] = useState(false);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const [areaAdvisoryActive, setAreaAdvisoryActive] = useState(false);

  // NEW: full datasets for the map (rain is single nearest object; others are arrays)
  const [envDatasets, setEnvDatasets] = useState(null);

  const triggerAreaAdvisoryForCoords = useCallback(async (c) => {
    const inside = distKm(c, mockDefault) <= GEOFENCE_KM;
    setAreaAdvisoryActive(!!inside);
    if (!inside) return;
    await triggerAlert({
      title: '⚠️ Area Advisory: Taman Jurong',
      body: 'You are near a flood-prone area. Stay vigilant and check the map for reports.',
      type: 'geofence',
      showPopup: false,
    });
  }, []);

  // Helper to pick nearest for stat cards from a datasets blob
  const pickNearestFrom = useCallback((datasets, c) => {
    if (!datasets || !c) return;
    const pickNearest = (arr, getLatLng) => {
      if (!arr || !arr.length) return null;
      let best = null, bestD = Infinity;
      for (const item of arr) {
        const { lat, lng } = getLatLng(item) || {};
        if (typeof lat !== 'number' || typeof lng !== 'number') continue;
        const d = getDistanceFromLatLonInKm(c.latitude, c.longitude, lat, lng);
        if (d < bestD) { bestD = d; best = { ...item, _distKm: d }; }
      }
      return best;
    };
    setPm25Nearest(pickNearest(datasets.pm25, d => ({ lat: d?.location?.latitude, lng: d?.location?.longitude })));
    setTempNearest(pickNearest(datasets.temp, d => ({ lat: d?.location?.latitude, lng: d?.location?.longitude })));
    setHumidityNearest(pickNearest(datasets.humidity, d => ({ lat: d?.location?.latitude, lng: d?.location?.longitude })));
    setWindNearest(pickNearest(datasets.wind, d => ({ lat: d?.location?.latitude, lng: d?.location?.longitude })));
  }, []);

  const fetchAll = useCallback(
    async (pos, opts = {}) => {
      const { allowGeofence = true } = opts;
      const c = pos || coords;
      if (!c) return;

      // 1) NEA 2-hr forecast text near user
      const weatherData = await fetchWeatherForecast();
      if (weatherData) {
        const nearestArea = getNearestForecastArea(c, weatherData.metadata);
        const areaForecast = nearestArea
          ? weatherData.forecasts.find(
              (f) => f?.area?.trim?.().toLowerCase() === nearestArea?.trim?.().toLowerCase()
            )
          : null;
        setForecastText(areaForecast?.forecast ?? null);
      }

      // 2) Rainfall + Flood risk (nearest station)
      const rain = await fetchRainfallData(c);
      if (rain) {
        setRainInfo(rain);
        const risk = estimateFloodRisk(rain.rainfall, rain.lastHour);
        if (risk === 'High' || risk === 'Moderate') {
          await triggerAlert({
            title: `🚨 Flood Risk: ${risk}`,
            body: `Heavy rain detected at ${rain.station?.name ?? 'nearby station'}. Stay alert and follow safety procedures.`,
            type: 'risk',
            showPopup: true,
            onViewMap: () => setMapExpanded(true),
          });
        }
      }

      // 3) Geofence advisory
      if (allowGeofence) {
        const inside = distKm(c, mockDefault) <= GEOFENCE_KM;
        setAreaAdvisoryActive(!!inside);
        const prev = geofenceInsideRef.current;
        geofenceInsideRef.current = inside;
        if ((prev === null && inside) || (prev === false && inside)) {
          await triggerAlert({
            title: '⚠️ Area Advisory: Taman Jurong',
            body: 'You are near a flood-prone area. Stay vigilant and check the map for reports.',
            type: 'geofence',
            showPopup: false,
          });
        }
      } else {
        setAreaAdvisoryActive(distKm(c, mockDefault) <= GEOFENCE_KM);
        await triggerAreaAdvisoryForCoords(c);
      }

      // 4) Bulk fetch environment datasets (live)
      let [pm25, temp, humidity, wind] = await Promise.all([
        fetchPm25Data().catch(() => []),
        fetchTemperatureData().catch(() => []),
        fetchHumidityData().catch(() => []),
        fetchWindData().catch(() => []),
      ]);

      // 5) Fallback/merge with bundled snapshot only (no runtime writes)
      const base = await loadEnvDatasetsFromFile();

      const merged = {
        rain: rain || base?.rain || null,
        pm25: (Array.isArray(pm25) && pm25.length) ? pm25 : (base?.pm25 || []),
        temp: (Array.isArray(temp) && temp.length) ? temp : (base?.temp || []),
        humidity: (Array.isArray(humidity) && humidity.length) ? humidity : (base?.humidity || []),
        wind: (Array.isArray(wind) && wind.length) ? wind : (base?.wind || []),
      };

      // Save merged snapshot for next offline session (FILE primary; AsyncStorage optional)

      setEnvDatasets(merged);

      // 6) OpenWeather "now" + 5-day grouped (optional UI)
      const owNow = await getNowWeather(c, lang);
      setNowWx(owNow);

      const ow5d = await fetchOWForecast5d(c, { lang });
      const grouped = groupOWForecastByDay(ow5d);
      const labeled = grouped.map((d) => {
        const dt = new Date(d.date);
        return { ...d, label: dt.toLocaleDateString(undefined, { weekday: 'short' }) };
      });
      setOwDays(labeled);

      // 7) Derive nearest stats for cards from merged arrays
      pickNearestFrom(merged, c);

      setUpdatedAt(new Date().toISOString());
    },
    [coords, triggerAreaAdvisoryForCoords, lang, pickNearestFrom]
  );

  /* ---- Initial load ---- */
  useEffect(() => {
    if (initRanRef.current) return;
    initRanRef.current = true;

    (async () => {
      // 0) Prefill UI from offline snapshot (fast & works offline)
      try {
        const fileSnap = await loadEnvDatasetsFromFile();
        if (fileSnap) {
          setEnvDatasets(fileSnap);
          const seedCoords = coords || (usingMockRef.current ? mockDefault : null);
          if (seedCoords) pickNearestFrom(fileSnap, seedCoords);
        }
      } catch {
          console.warn('[snapshot] failed to load env_snapshot.json:', err);
          setEnvDatasets(null);
      }

      const grantedNotif = await ensureNotificationsReady();
      setNotifGranted(grantedNotif);

      if (Platform.OS === 'web') {
        // web: use demo + advisory
        usingMockRef.current = true;
        setCoords(mockDefault);
        setLocPermission('denied');
        setServicesEnabled(false);
        setLocDeniedBanner(true);

        await triggerAreaAdvisoryForCoords(mockDefault);
        await fetchAll(mockDefault, { allowGeofence: false });
        return;
      }

      try {
        const permReq = await Location.requestForegroundPermissionsAsync();
        setLocPermission(permReq.status);

        if (permReq.status !== 'granted') {
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
      } catch (e) {
        usingMockRef.current = true;
        setCoords(mockDefault);
        setLocPermission('denied');
        setServicesEnabled(false);
        setLocDeniedBanner(true);

        await triggerAreaAdvisoryForCoords(mockDefault);
        await fetchAll(mockDefault, { allowGeofence: false });
      }
    })();
  }, [fetchAll, triggerAreaAdvisoryForCoords, coords, pickNearestFrom]);

  /* ---- Auto refresh when returning from Settings ---- */
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state !== 'active') return;

      try {
        const perm = await Location.getForegroundPermissionsAsync();
        setLocPermission(perm.status);
        const svc = await Location.hasServicesEnabledAsync();
        setServicesEnabled(svc);

        if (perm.status === 'granted' && svc) {
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
        // ignore
      }
    });
    return () => sub.remove();
  }, [fetchAll]);

  /* ---- Keep coords fresh while app is open ---- */
  useEffect(() => {
    let cancelled = false;

    async function startWatch() {
      if (locPermission !== 'granted' || !servicesEnabled) {
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
          usingMockRef.current = false; // watch yields REAL updates
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

  /* ---- Enable location from banner ---- */
  const onEnableLocationPress = useCallback(async () => {
    if (Platform.OS === 'web') return;

    try {
      const current = await Location.getForegroundPermissionsAsync();
      if (current.status !== 'granted' && current.canAskAgain) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        setLocPermission(status);
        if (status !== 'granted') {
          setLocDeniedBanner(true);
          return;
        }
      }

      const svc = await Location.hasServicesEnabledAsync();
      setServicesEnabled(svc);

      if (!svc) {
        if (Platform.OS === 'android') {
          try {
            await IntentLauncher.startActivityAsync(
              IntentLauncher.ActivityAction.LOCATION_SOURCE_SETTINGS
            );
          } catch {
            Linking.openSettings?.();
          }
        } else {
          await Linking.openURL('app-settings:');
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
        locPermission === 'granted' && servicesEnabled && !usingMockRef.current;
      await fetchAll(undefined, { allowGeofence });
    } finally {
      setRefreshing(false);
    }
  }, [fetchAll, locPermission, servicesEnabled]);

  /* =========================
     Derived UI bits
     ========================= */
  const rainSeverity = useMemo(
    () => getRainSeverity(rainInfo?.rainfall ?? null),
    [rainInfo]
  );

  const statusLevel = useMemo(() => {
    let level = 'Low';
    if (rainInfo) {
      const r = estimateFloodRisk(rainInfo.rainfall, rainInfo.lastHour);
      if (r === 'High') return 'High';
      if (r === 'Moderate') level = 'Advisory';
    }
    if (areaAdvisoryActive && level === 'Low') level = 'Advisory';
    return level;
  }, [rainInfo, areaAdvisoryActive]);

  const formattedUpdated = updatedAt ? new Date(updatedAt).toLocaleTimeString() : '--:--';

  /* =========================
     RENDER
     ========================= */
  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>

        {/* Location disabled banner */}
        {locDeniedBanner && (
          <AlertBanner
            alert={{
              title: !servicesEnabled ? 'Location Services Off' : 'Location Permission Denied',
              body: 'Using demo data near Taman Jurong. Enable location for precise readings.',
              severity: 'info',
            }}
            onClose={() => setLocDeniedBanner(false)}>
            <TouchableOpacity onPress={onEnableLocationPress} style={styles.enableBtn}>
              <Text style={styles.enableBtnText}>Enable Location</Text>
            </TouchableOpacity>
          </AlertBanner>
        )}

        {/* Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View style={styles.statusLeft}>
              <Text style={styles.statusTitle}>
                {statusLevel === 'Low' && '✅ No Active Alerts'}
                {statusLevel === 'Advisory' && '⚠️ Advisory in your area'}
                {statusLevel === 'High' && '🚨 High Risk in your area'}
              </Text>
              <Text style={styles.statusSub}>
                🌦 {t('forecast')}: {translations[lang].weatherPhrases?.[forecastText] || forecastText || '—'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setMapExpanded(true)} style={styles.detailBtn}>
              <Text style={styles.detailBtnText}>View Map</Text>
            </TouchableOpacity>
          </View>

          {coords && (
            <TouchableOpacity onPress={() => setMapExpanded(true)} activeOpacity={0.9}>
              <LeafletMiniMap lat={coords.latitude} lng={coords.longitude} />
            </TouchableOpacity>
          )}
          <Text style={{ color: '#6B7280', marginTop: 6, fontSize: 12 }}>
            Updated at: {formattedUpdated}
          </Text>
        </View>

        {/* Quick Shortcuts */}
        <View style={{ marginBottom: 14 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            <QuickChip icon="book" label="Assets" onPress={() => navigation.navigate('Assets')} />
            <QuickChip icon="ribbon" label="Badges" onPress={() => navigation.navigate('Badges')} />
            <QuickChip icon="time" label="History" onPress={() => navigation.navigate('History')} />
            <QuickChip icon="school" label="Select Quiz" onPress={() => navigation.navigate('Quizzes')} />
          </ScrollView>
        </View>

        {/* Daily Quiz Card */}
        <DailyQuizCard streak={3} questionCount={5} onStart={() => navigation.navigate('DailyQuiz')} />

        {/* Updates Strip */}
        <UpdatesStrip />

        {/* 5-day forecast strip */}
        {owDays?.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Next 5 days</Text>
            <FiveDayStrip days={owDays} />
          </>
        )}

        {/* Quick Stats */}
        <Text style={styles.sectionTitle}>Now near you</Text>
        <View style={styles.statsGrid}>
          <StatCard
            icon="rainy"
            label="Rainfall"
            value={rainInfo?.rainfall != null ? `${rainInfo.rainfall} mm` : '—'}
            chipLabel={
              translations[lang].weatherPhrases?.[getRainSeverity(rainInfo?.rainfall ?? null).label] ||
              getRainSeverity(rainInfo?.rainfall ?? null).label
            }
            chipColor={getRainSeverity(rainInfo?.rainfall ?? null).color}
          />
          <StatCard
            icon="leaf"
            label="PM2.5"
            value={pm25Nearest?.value != null ? `${pm25Nearest.value}` : '—'}
            sub={pm25Nearest?.name || 'Nearest Region'}
          />
          <StatCard
            icon="thermometer"
            label="Temp"
            value={tempNearest?.value != null ? `${tempNearest.value} °C` : '—'}
            sub={tempNearest?.name || 'Nearest Station'}
          />
          <StatCard
            icon="water"
            label="Humidity"
            value={humidityNearest?.value != null ? `${humidityNearest.value}%` : '—'}
            sub={humidityNearest?.name || 'Nearest Station'}
          />
          <StatCard
            icon="navigate"
            label="Wind"
            value={windNearest?.speed != null ? `${windNearest.speed} km/h` : '—'}
            sub={
              windNearest?.direction != null
                ? `Dir ${windNearest.direction}°`
                : windNearest?.name || 'Nearest Station'
            }
          />
        </View>

        {/* CTAs */}
        <View style={styles.ctaRow}>
          <CTAButton icon="help-buoy" title="Daily Quiz" onPress={() => navigation.navigate('Quizzes')} />
          <CTAButton icon="stats-chart" title="Results" onPress={() => navigation.navigate('Result')} />
        </View>

        {/* Tip of the Day */}
        <TipCard />

        {/* Tips / Emergency instructions */}
        <View style={styles.tipsBlock}>
          <Text style={styles.tipsTitle}>{t('emergencyInstructions')}</Text>
          {t('instructions').map((instr, i) => (
            <Text key={i} style={styles.tipItem}>
              • {instr}
            </Text>
          ))}
        </View>
      </ScrollView>

      {/* FAB + menu */}
      {menuOpen && (
        <>
          <TouchableWithoutFeedback onPress={() => setMenuOpen(false)}>
            <View style={styles.menuOverlay} />
          </TouchableWithoutFeedback>
          <View style={styles.fabMenu}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuOpen(false);
                setChatOpen(true);
              }}>
              <Ionicons name="chatbubbles" size={16} color="#111827" />
              <Text style={styles.menuItemText}>Chatbot</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuOpen(false);
                navigation.navigate('Checklist');
              }}>
              <Ionicons name="list" size={16} color="#111827" />
              <Text style={styles.menuItemText}>Checklist</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuOpen(false);
                setEmergencyOpen(true);
              }}>
              <Ionicons name="call" size={16} color="#111827" />
              <Text style={styles.menuItemText}>Emergency contacts</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      <TouchableOpacity
        style={styles.chatBubble}
        activeOpacity={0.9}
        onPress={() => setMenuOpen((v) => !v)}
        accessibilityLabel="Open actions">
        <Ionicons name="ellipsis-vertical" size={20} color="#fff" />
      </TouchableOpacity>

      <EmergencyContactsModal visible={emergencyOpen} onClose={() => setEmergencyOpen(false)} />
      <ChatbotModal visible={chatOpen} onClose={() => setChatOpen(false)} ChatbotComponent={ChatbotScreen} />

      {/* IMPORTANT: pass preloaded datasets so the modal doesn't fetch on open */}
      <InteractiveMapModal
        visible={mapExpanded}
        onClose={() => setMapExpanded(false)}
        userCoords={coords}
        datasets={envDatasets}   // <<— preloaded datasets
      />
    </View>
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
    <View style={styles.mapShell}>
      <WebView originWhitelist={['*']} javaScriptEnabled domStorageEnabled source={{ html }} style={{ flex: 1 }} />
    </View>
  );
}

/* --- Small presentational components --- */
function AlertBanner({ alert, onClose, children }) {
  if (!alert) return null;
  const color =
    alert.severity === 'danger'
      ? '#EF4444'
      : alert.severity === 'warning'
      ? '#F97316'
      : alert.severity === 'advisory'
      ? '#F59E0B'
      : '#3B82F6';

  return (
    <View style={[styles.banner, { borderLeftColor: color }]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.bannerTitle}>{alert.title}</Text>
        <Text style={styles.bannerBody}>{alert.body}</Text>
        {children}
      </View>
      <TouchableOpacity onPress={onClose} accessibilityLabel="Dismiss alert">
        <Ionicons name="close" size={18} color="#111827" />
      </TouchableOpacity>
    </View>
  );
}

function QuickChip({ icon, label, onPress, testID }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.quickChip} accessibilityLabel={label} testID={testID}>
      <Ionicons name={icon} size={16} color="#374151" />
      <Text style={styles.quickChipText}>{label}</Text>
    </TouchableOpacity>
  );
}

function DailyQuizCard({ streak = 0, questionCount = 5, onStart }) {
  return (
    <View style={styles.dailyQuizCard}>
      <View style={styles.dailyQuizRow}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={styles.dailyQuizTitle}>Daily Quiz</Text>
          <Text style={styles.dailyQuizSub}>
            {questionCount} questions · ~{Math.max(2, Math.ceil(questionCount / 3))} min
          </Text>
          <View style={styles.dailyQuizChips}>
            <View style={[styles.chip, { backgroundColor: '#6366F1' }]}>
              <Text style={styles.chipText}>Streak: {streak}d</Text>
            </View>
            <View style={[styles.chip, { backgroundColor: '#4B5563' }]}>
              <Text style={styles.chipText}>+10 XP</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity onPress={onStart} style={styles.dailyQuizBtn} accessibilityLabel="Start daily quiz">
          <Text style={styles.dailyQuizBtnText}>Start</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const TIPS = [
  'Keep a battery-powered radio and spare batteries.',
  'Store at least 3 litres of water per person per day.',
  'Photograph important documents and back them up securely.',
  'Prepare a small cash reserve for emergencies.',
  'Add a whistle and thermal blanket to your kit.',
];

function useTipOfDay() {
  const [tip, setTip] = useState('');
  useEffect(() => {
    const dayIdx = Math.floor(Date.now() / (24 * 60 * 60 * 1000)) % TIPS.length;
    setTip(TIPS[dayIdx]);
  }, []);
  return tip;
}

function TipCard() {
  const tip = useTipOfDay();
  return (
    <View style={styles.tipCard}>
      <Text style={styles.tipsTitle}>Tip of the Day</Text>
      <Text style={styles.tipItem}>💡 {tip}</Text>
    </View>
  );
}

function UpdatesStrip() {
  return (
    <View style={styles.updatesStrip}>
      <Text style={styles.updatesTitle}>Updates</Text>
      <Text style={styles.updatesText}>
        NEA advisory: Thundery showers expected this afternoon. Stay indoors during lightning risk.
      </Text>
    </View>
  );
}

function FiveDayStrip({ days = [] }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 2 }}>
      {days.slice(0, 5).map((d) => (
        <View key={d.date || d.label} style={styles.fxPill}>
          <Text style={styles.fxLabel}>{d.label || d.date}</Text>
          {d.icon ? (
            <Image
              source={{ uri: `https://openweathermap.org/img/wn/${d.icon}@2x.png` }}
              style={{ width: 38, height: 38 }}
              resizeMode="contain"
            />
          ) : (
            <Ionicons name="cloud-outline" size={24} color="#6B7280" />
          )}
          <Text style={styles.fxTemps}>
            {d.max != null ? Math.round(d.max) : '--'}° / {d.min != null ? Math.round(d.min) : '--'}°
          </Text>
          {typeof d.popMax === 'number' && <Text style={styles.fxPop}>{Math.round(d.popMax * 100)}% rain</Text>}
        </View>
      ))}
    </ScrollView>
  );
}

function StatCard({ icon, label, value, sub, chipLabel, chipColor }) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statHeader}>
        <Ionicons name={icon} size={18} color="#6C63FF" />
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      <Text style={styles.statValue}>{value}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
      {chipLabel ? (
        <View style={[styles.chip, { backgroundColor: chipColor }]}>
          <Text style={styles.chipText}>{chipLabel}</Text>
        </View>
      ) : null}
    </View>
  );
}

function CTAButton({ icon, title, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.ctaBtn}>
      <Ionicons name={icon} size={18} color="#fff" />
      <Text style={styles.ctaText} numberOfLines={1} ellipsizeMode="tail">
        {title}
      </Text>
    </TouchableOpacity>
  );
}

/* =========================================================================
   STYLES
   ========================================================================= */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { padding: 16 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FEF3C7',
    borderLeftWidth: 4,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderColor: '#F59E0B',
    marginBottom: 12,
  },
  bannerTitle: { color: '#111827', fontWeight: '700', marginBottom: 2 },
  bannerBody: { color: '#374151' },

  enableBtn: {
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: '#6C63FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  enableBtnText: { color: '#fff', fontWeight: '700' },

  statusCard: {
    padding: 12,
    borderRadius: 16,
    marginBottom: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusLeft: { flex: 1, paddingRight: 12 },
  statusTitle: { color: '#111827', fontSize: 16, fontWeight: '700' },
  statusSub: { color: '#374151', marginTop: 4 },
  detailBtn: {
    backgroundColor: '#6C63FF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  detailBtnText: { color: '#fff', fontWeight: '700' },

  mapShell: {
    height: 200,
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  quickChip: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickChipText: { color: '#111827', fontWeight: '600' },

  dailyQuizCard: {
    backgroundColor: '#EEF2FF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 14,
  },
  dailyQuizRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dailyQuizTitle: { color: '#111827', fontWeight: '800', fontSize: 16 },
  dailyQuizSub: { color: '#374151', marginTop: 4 },
  dailyQuizChips: { flexDirection: 'row', gap: 8, marginTop: 8 },
  dailyQuizBtn: { backgroundColor: '#6C63FF', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  dailyQuizBtnText: { color: '#fff', fontWeight: '700' },

  updatesStrip: {
    backgroundColor: '#FFF7ED',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FED7AA',
    marginBottom: 14,
  },
  updatesTitle: { color: '#9A3412', fontWeight: '700' },
  updatesText: { color: '#7C2D12', marginTop: 4 },

  sectionTitle: {
    color: '#111827',
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 4,
  },

  fxPill: {
    width: 90,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 4,
  },
  fxLabel: { color: '#374151', fontWeight: '700', fontSize: 12 },
  fxTemps: { color: '#111827', fontWeight: '800' },
  fxPop: { color: '#6B7280', fontSize: 12 },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 6,
  },
  statLabel: { color: '#374151', fontSize: 12, fontWeight: '600' },
  statValue: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
  },
  statSub: { color: '#6B7280', fontSize: 12 },

  chip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    marginTop: 6,
  },
  chipText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  ctaRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  ctaBtn: {
    flex: 1,
    minHeight: 44,
    backgroundColor: '#6C63FF',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  ctaText: { color: '#fff', fontWeight: '700', maxWidth: 120 },

  menuOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'transparent' },
  fabMenu: {
    position: 'absolute',
    right: 16,
    bottom: 88,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    zIndex: 20,
    minWidth: 190,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  menuItemText: { color: '#111827', fontWeight: '600' },

  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)' },
  modalSheet: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  modalTitle: { color: '#111827', fontWeight: '700', fontSize: 16 },

  contactRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  contactLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  contactIconWrap: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  contactName: { color: '#111827', fontWeight: '600' },
  contactNumber: { color: '#6B7280', marginTop: 2 },
  callBtn: {
    backgroundColor: '#6C63FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  callBtnText: { color: '#fff', fontWeight: '700' },

  tipsBlock: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 40,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tipsTitle: { color: '#111827', fontWeight: '700', marginBottom: 6 },
  tipItem: { color: '#374151', marginBottom: 4 },

  tipCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 14,
  },

  chatBubble: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    backgroundColor: '#6C63FF',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    zIndex: 30,
  },
});
