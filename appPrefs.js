// appPrefs.js
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";

// Try to load expo-notifications, but don't explode if it's missing
let Notifications = null;
try {
  // eslint-disable-next-line global-require
  Notifications = require("expo-notifications");
} catch (_) {
  Notifications = null;
}

const KEYS = {
  notifications: "settings:notifications",
  sound: "settings:sound",
  vibration: "settings:vibration",
};

const state = {
  notifications: true,
  sound: true,
  vibration: true,
  ready: false,
};

/* ---------------------------- init / refresh ---------------------------- */
export async function init() {
  await loadFromStorage();

  // Only set handler if the module exists and not on Web
  if (Notifications?.setNotificationHandler && Platform.OS !== "web") {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: !!state.sound,
        shouldSetBadge: false,
      }),
    });
  }

  await configureAndroidChannel();
  state.ready = true;
}

export async function refresh() {
  await loadFromStorage();
  await configureAndroidChannel();
}

async function loadFromStorage() {
  try {
    const [n, s, v] = await Promise.all([
      AsyncStorage.getItem(KEYS.notifications),
      AsyncStorage.getItem(KEYS.sound),
      AsyncStorage.getItem(KEYS.vibration),
    ]);
    state.notifications = n !== "0";
    state.sound = s !== "0";
    state.vibration = v !== "0";
  } catch {
    // keep defaults
  }
}

async function configureAndroidChannel() {
  // Guard for Web & when the module isn't available
  if (Platform.OS !== "android" || !Notifications?.setNotificationChannelAsync) return;
  try {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Alerts",
      importance: state.notifications
        ? Notifications.AndroidImportance.HIGH
        : Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: state.vibration ? [0, 250, 250, 250] : [],
      lightColor: "#FF231F7C",
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      sound: state.sound ? "default" : undefined,
    });
  } catch {}
}

/* ------------------------------- getters ------------------------------- */
export const notificationsEnabled = () => !!state.notifications;
export const soundEnabled = () => !!state.sound;
export const vibrationEnabled = () => !!state.vibration;

/* ------------------------------- setters ------------------------------- */
export async function setNotificationsEnabled(v) {
  state.notifications = !!v;
  await AsyncStorage.setItem(KEYS.notifications, v ? "1" : "0").catch(() => {});
  await configureAndroidChannel();
}

export async function setSoundEnabled(v) {
  state.sound = !!v;
  await AsyncStorage.setItem(KEYS.sound, v ? "1" : "0").catch(() => {});
  await configureAndroidChannel();
}

export async function setVibrationEnabled(v) {
  state.vibration = !!v;
  await AsyncStorage.setItem(KEYS.vibration, v ? "1" : "0").catch(() => {});
  await configureAndroidChannel();
}

/* -------------------------- notifications API -------------------------- */
export async function ensurePermissions() {
  if (!state.notifications || !Notifications?.getPermissionsAsync) return false;
  try {
    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== "granted" && existing.canAskAgain && Notifications.requestPermissionsAsync) {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    return status === "granted";
  } catch {
    return false;
  }
}

export async function presentNotification({ title, body, data }) {
  // No-ops on Web or if module is absent
  if (Platform.OS === "web" || !Notifications?.presentNotificationAsync) return;
  if (!state.notifications) return;
  const ok = await ensurePermissions();
  if (!ok) return;
  try {
    await Notifications.presentNotificationAsync({
      title,
      body,
      sound: state.sound ? "default" : undefined,
      data,
    });
  } catch {}
}

/* ------------------------------ haptics API ---------------------------- */
function hapticsOK() {
  return Platform.OS !== "web" && state.vibration;
}

export async function selection() {
  if (!hapticsOK()) return;
  try { await Haptics.selectionAsync(); } catch {}
}

export async function impact(style = Haptics.ImpactFeedbackStyle.Light) {
  if (!hapticsOK()) return;
  try { await Haptics.impactAsync(style); } catch {}
}

export async function success() {
  if (!hapticsOK()) return;
  try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
}

export async function warning() {
  if (!hapticsOK()) return;
  try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } catch {}
}

export async function error() {
  if (!hapticsOK()) return;
  try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
}
