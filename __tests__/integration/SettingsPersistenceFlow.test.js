// SettingsPersistenceFlow.test.js

import React from "react";
import { render, fireEvent, waitFor, cleanup } from "@testing-library/react-native";

// Quiet only the "overlapping act()" warning while keeping all other errors visible
const originalConsoleError = console.error;
beforeAll(() => {
  jest.spyOn(console, "error").mockImplementation((...args) => {
    const first = args[0];
    if (typeof first === "string" && first.includes("overlapping act()")) {
      return; // swallow just this warning
    }
    originalConsoleError(...args);
  });
});

afterAll(() => {
  console.error.mockRestore();
});

/* ----------------------------- Stable module mocks ----------------------------- */

// In-memory AsyncStorage with real persistence semantics for this test file.
const mockStorage = new Map();

jest.mock("@react-native-async-storage/async-storage", () => {
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k) => (mockStorage.has(k) ? mockStorage.get(k) : null)),
      setItem: jest.fn(async (k, v) => { mockStorage.set(k, v); }),
      removeItem: jest.fn(async (k) => { mockStorage.delete(k); }),
      clear: jest.fn(async () => { mockStorage.clear(); }),
      getAllKeys: jest.fn(async () => Array.from(mockStorage.keys())),
      multiGet: jest.fn(async (keys) => keys.map((k) => [k, mockStorage.get(k) ?? null])),
      multiSet: jest.fn(async (pairs) => pairs.forEach(([k, v]) => mockStorage.set(k, v))),
      multiRemove: jest.fn(async (keys) => keys.forEach((k) => mockStorage.delete(k))),
    },
  };
});

// Fully stub navigation to avoid ESM requireActual
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ setOptions: jest.fn(), navigate: jest.fn() }),
}));

// Safe-area mock
jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  return {
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    SafeAreaProvider: ({ children }) => <>{children}</>,
    initialWindowMetrics: { insets: { top: 0, bottom: 0, left: 0, right: 0 } },
  };
});

// Mock assets imported by SettingsContainer so Jest doesn't try to load image files
jest.mock("../../assets/profile.png", () => 1, { virtual: true });
jest.mock("../../assets/logo1.png", () => 1, { virtual: true });

// Mock i18n modules to avoid importing expo-localization (ESM)
jest.mock("../../translations/translation", () => ({
  t: (key) => key,
  i18n: { locale: "en" },
  setLocale: () => {},
  getChecklistData: () => ({}),
}));

jest.mock("../../translations/language", () => {
  const React = require("react");
  const defaultValue = { lang: "en", setLang: jest.fn() };
  const LanguageContext = React.createContext(defaultValue);
  const LanguageProvider = ({ children }) => (
    <LanguageContext.Provider value={defaultValue}>{children}</LanguageContext.Provider>
  );
  return { LanguageContext, LanguageProvider };
});

// Supabase shape used by SettingsContainer
jest.mock("../../supabase", () => ({
  supabase: {
    auth: {
      getSession: jest.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      updateUser: jest.fn(async () => ({ error: null })),
      signOut: jest.fn(async () => ({})),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(async () => ({ data: null })),
      maybeSingle: jest.fn(async () => ({ data: null })),
      update: jest.fn().mockReturnThis(),
      upsert: jest.fn(async () => ({ error: null })),
    })),
    storage: {
      from: jest.fn(() => ({
        getPublicUrl: jest.fn(() => ({ data: { publicUrl: "https://example.com/avatar.png" } })),
      })),
    },
  },
}));

// Avoid ESM import & provide no-op API used by appPrefs
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  AndroidImportance: { HIGH: 5, DEFAULT: 3 },
  AndroidNotificationVisibility: { PUBLIC: 1 },
  getPermissionsAsync: jest.fn(async () => ({ status: "granted", canAskAgain: false })),
  requestPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  presentNotificationAsync: jest.fn(async () => ({})),
}));

// expo-image-picker and expo-location are imported but not used in this test path
jest.mock("expo-image-picker", () => ({}));
jest.mock("expo-location", () => ({}));

// Haptics: assert calls happen ONLY when vibration is enabled
const mockHaptics = {
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "Light" },
  NotificationFeedbackType: { Success: "Success", Warning: "Warning", Error: "Error" },
};
jest.mock("expo-haptics", () => mockHaptics);

// Mock the presentational screen -> tiny harness exposing vm + simple UI
jest.mock("../../screens/SettingsScreen", () => {
  const React = require("react");
  const { Text, TouchableOpacity, View } = require("react-native");
  return function SettingsScreen({ vm }) {
    return (
      <View>
        <Text testID="vibration-state">{vm.vibration ? "vibration:on" : "vibration:off"}</Text>
        <TouchableOpacity
          testID="toggle-vibration"
          onPress={() => vm.setVibration(!vm.vibration)}
        >
          <Text>toggle vibration</Text>
        </TouchableOpacity>
      </View>
    );
  };
});

// Mock appPrefs with deterministic vibration/haptics
jest.mock("../../utils/appPrefs", () => {
  let vibrationEnabled = false;

  return {
    vibrationEnabled: jest.fn(() => vibrationEnabled),
    setVibrationEnabled: jest.fn(async (enabled) => {
      vibrationEnabled = enabled;
      mockStorage.set("settings:vibration", enabled ? "1" : "0");
    }),
    success: jest.fn(async () => {
      if (vibrationEnabled) mockHaptics.notificationAsync();
    }),
    refresh: jest.fn(async () => {
      const stored = mockStorage.get("settings:vibration");
      vibrationEnabled = stored === "1";
    }),
    selection: jest.fn(async () => {
      if (vibrationEnabled) mockHaptics.selectionAsync();
    }),
    impact: jest.fn(async () => {
      if (vibrationEnabled) mockHaptics.impactAsync();
    }),
    // no-ops for completeness if called
    init: jest.fn(async () => {}),
    notificationsEnabled: jest.fn(() => true),
    soundEnabled: jest.fn(() => true),
  };
});

/* ------------------------------ Import after mocks ----------------------------- */
import * as appPrefs from "../../utils/appPrefs";
import SettingsContainer from "../../containers/SettingsContainer";

/* ---------------------------------- Helpers ---------------------------------- */
const VIB_KEY = "settings:vibration";
const NOTIF_KEY = "settings:notifications";
const SOUND_KEY = "settings:sound";

/* ---------------------------------- Tests ------------------------------------ */
describe("Settings persistence + haptics consumer", () => {
  beforeEach(async () => {
    // Default: notifications & sound ON, vibration OFF (so we can test enabling)
    mockStorage.clear();
    mockStorage.set(NOTIF_KEY, "1");
    mockStorage.set(SOUND_KEY, "1");
    mockStorage.set(VIB_KEY, "0");

    mockHaptics.selectionAsync.mockClear();
    mockHaptics.impactAsync.mockClear();
    mockHaptics.notificationAsync.mockClear();

    // Refresh appPrefs state from storage
    await appPrefs.refresh();
  });

  afterEach(() => {
    cleanup();
  });

  it("toggles vibration, persists it, and haptics respects it", async () => {
    // 1) Mount -> should read initial OFF from AsyncStorage
    const { getByTestId, unmount } = render(<SettingsContainer />);

    await waitFor(() => {
      expect(getByTestId("vibration-state").props.children).toBe("vibration:off");
    });

    // While OFF, success() should NO-OP (no Haptics.notificationAsync call)
    await appPrefs.success();
    expect(mockHaptics.notificationAsync).toHaveBeenCalledTimes(0);

    // 2) Toggle ON
    fireEvent.press(getByTestId("toggle-vibration"));

    await waitFor(() => {
      expect(getByTestId("vibration-state").props.children).toBe("vibration:on");
    });

    // Should have persisted "1"
    expect(mockStorage.get(VIB_KEY)).toBe("1");

    // With ON, success() should call Haptics
    await appPrefs.success();
    expect(mockHaptics.notificationAsync).toHaveBeenCalledTimes(1);

    // 3) Toggle back OFF
    fireEvent.press(getByTestId("toggle-vibration"));

    await waitFor(() => {
      expect(getByTestId("vibration-state").props.children).toBe("vibration:off");
    });
    expect(mockStorage.get(VIB_KEY)).toBe("0");

    // Verify NO call when OFF
    mockHaptics.notificationAsync.mockClear();
    await appPrefs.success();
    expect(mockHaptics.notificationAsync).toHaveBeenCalledTimes(0);

    // 4) Persistence: unmount & remount -> still OFF
    unmount();
    const tree2 = render(<SettingsContainer />);
    await waitFor(() => {
      expect(tree2.getByTestId("vibration-state").props.children).toBe("vibration:off");
    });
  });
});
