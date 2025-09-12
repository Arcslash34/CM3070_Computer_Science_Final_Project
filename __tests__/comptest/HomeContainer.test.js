// __tests__/comptest/HomeContainer.test.js

jest.mock("react-native/Libraries/Utilities/warnOnce", () => {
  const fn = jest.fn();
  return fn;
});

const __originalConsoleWarn = console.warn;
console.warn = jest.fn((...args) => {
  const msg = String(args[0] ?? "");
  if (/ProgressBarAndroid|Clipboard|PushNotificationIOS|NativeEventEmitter/.test(msg)) {
    return; // swallow just these
  }
  return __originalConsoleWarn.apply(console, args);
});

// -----------------------------------------------------------------------------
// Imports
// -----------------------------------------------------------------------------
import React from "react";
import { render, act, waitFor } from "@testing-library/react-native";

// -------------------- Fake timers --------------------
jest.useFakeTimers();

// -------------------- TurboModule shim (MUST come first) --------------------
jest.mock("react-native/Libraries/TurboModule/TurboModuleRegistry", () => {
  const makeEmitter = () => ({
    addListener: jest.fn(),
    removeListeners: jest.fn(),
  });

  const deviceInfoConstants = {
    Dimensions: {
      windowPhysicalPixels: {
        width: 1080,
        height: 1920,
        scale: 2,
        fontScale: 1,
        densityDpi: 320,
      },
      screenPhysicalPixels: {
        width: 1080,
        height: 1920,
        scale: 2,
        fontScale: 1,
        densityDpi: 320,
      },
    },
    isTesting: true,
  };

  const platformConstants = {
    forceTouchAvailable: false,
    interfaceIdiom: "phone",
    osVersion: "14.0",
    systemName: "iOS",
    isTesting: true,
    isDisableAnimations: false,
    reactNativeVersion: { major: 0, minor: 72, patch: 0 },
  };

  const i18nConstants = {
    isRTL: false,
    doLeftAndRightSwapInRTL: false,
    allowRTL: false,
    forceRTL: false,
    swapLeftAndRightInRTL: false,
    localeIdentifier: "en_US",
  };

  const modules = {
    AlertManager: { showAlert: jest.fn(), alertWithArgs: jest.fn(), ...makeEmitter() },
    SettingsManager: { getConstants: () => ({ settings: {} }), ...makeEmitter() },
    DeviceInfo: { getConstants: () => deviceInfoConstants, ...makeEmitter() },
    PlatformConstants: { getConstants: () => platformConstants, ...makeEmitter() },
    I18nManager: {
      getConstants: () => i18nConstants,
      allowRTL: jest.fn(),
      forceRTL: jest.fn(),
      swapLeftAndRightInRTL: jest.fn(),
      ...makeEmitter(),
    },
  };

  const get = (name) => modules[name] ?? makeEmitter();
  const getEnforcing = (name) => get(name);
  return { get, getEnforcing };
});

// -------------------- Safe area --------------------
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

// -------------------- react-native (AppState/Linking/Alert) --------------------
jest.mock("react-native", () => {
  const RN = jest.requireActual("react-native");
  return {
    ...RN,
    AppState: {
      addEventListener: jest.fn((_event, _handler) => ({ remove: jest.fn() })),
      removeEventListener: jest.fn(),
      currentState: "active",
    },
    Linking: {
      ...RN.Linking,
      openURL: jest.fn(),
      openSettings: jest.fn(),
    },
    Alert: { alert: jest.fn() },
  };
});

// -------------------- Navigation --------------------
const mockSetOptions = jest.fn();
jest.mock("@react-navigation/native", () => ({
  __esModule: true,
  useNavigation: () => ({
    setOptions: mockSetOptions,
    addListener: (_evt, cb) => cb,
  }),
}));

// -------------------- Language ctx --------------------
jest.mock("../../translations/language", () => {
  const React = require("react");
  return { __esModule: true, LanguageContext: React.createContext({ lang: "en" }) };
});

// -------------------- AsyncStorage --------------------
const mockGetItem = jest.fn(async () => null);
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: (...a) => mockGetItem(...a), setItem: jest.fn() },
}));

// -------------------- AppPrefs --------------------
const mockRefreshPrefs = jest.fn(async () => {});
const mockEnsurePerms = jest.fn(async () => true);
const mockPresentNotif = jest.fn(async () => {});
jest.mock("../../utils/appPrefs", () => ({
  __esModule: true,
  refresh: (...a) => mockRefreshPrefs(...a),
  ensurePermissions: (...a) => mockEnsurePerms(...a),
  presentNotification: (...a) => mockPresentNotif(...a),
}));

// -------------------- Intent launcher (no-op) --------------------
jest.mock("expo-intent-launcher", () => ({
  __esModule: true,
  startActivityAsync: jest.fn(async () => {}),
  ActivityAction: { LOCATION_SOURCE_SETTINGS: "settings" },
}));

// -------------------- Location --------------------
const mockReqPerm = jest.fn(async () => ({ status: "granted", canAskAgain: true }));
const mockGetPerm = jest.fn(async () => ({ status: "granted", canAskAgain: true }));
const mockHasSvc = jest.fn(async () => true);
const mockGetPos = jest.fn(async () => ({ coords: { latitude: 1.33, longitude: 103.75 } }));
const mockWatch = jest.fn(async (_opts, _cb) => ({ remove: jest.fn() }));

jest.mock("expo-location", () => ({
  __esModule: true,
  requestForegroundPermissionsAsync: (...a) => mockReqPerm(...a),
  getForegroundPermissionsAsync: (...a) => mockGetPerm(...a),
  hasServicesEnabledAsync: (...a) => mockHasSvc(...a),
  getCurrentPositionAsync: (...a) => mockGetPos(...a),
  watchPositionAsync: (...a) => mockWatch(...a),
  reverseGeocodeAsync: jest.fn(async () => []),
  Accuracy: { Balanced: "Balanced", High: "High" },
}));

// -------------------- envApi --------------------
const mockEstimateFloodRisk = jest.fn(() => "High");
const mockFetchWeatherForecast = jest.fn(async () => ({ metadata: { whatever: true } }));
const mockGetNearestForecastArea = jest.fn(() => "Taman Jurong");
const mockGetDistance = jest.fn((aLat, aLng, bLat, bLng) => Math.hypot(aLat - bLat, aLng - bLng));
const mockFetchRainfall = jest.fn(async () => ({
  stations: [{ name: "Demo Rain Station", location: { latitude: 1.339, longitude: 103.721 }, rainfall: 90 }],
}));
const mockFetchPm25 = jest.fn(async () => [{ location: { latitude: 1.34, longitude: 103.7 }, value: 10 }]);
const mockFetchWind = jest.fn(async () => [{ location: { latitude: 1.35, longitude: 103.71 }, value: 2 }]);
const mockFetchHumidity = jest.fn(async () => [{ location: { latitude: 1.36, longitude: 103.72 }, value: 70 }]);
const mockFetchTemp = jest.fn(async () => [{ location: { latitude: 1.37, longitude: 103.73 }, value: 30 }]);
const mockLoadSnapshot = jest.fn(async () => ({ rain: { stations: [] }, pm25: [], wind: [], humidity: [], temp: [] }));

jest.mock("../../api/envApi", () => ({
  __esModule: true,
  estimateFloodRisk: (...a) => mockEstimateFloodRisk(...a),
  fetchWeatherForecast: (...a) => mockFetchWeatherForecast(...a),
  getNearestForecastArea: (...a) => mockGetNearestForecastArea(...a),
  getDistanceFromLatLonInKm: (...a) => mockGetDistance(...a),
  fetchRainfallData: (...a) => mockFetchRainfall(...a),
  fetchPm25Data: (...a) => mockFetchPm25(...a),
  fetchWindData: (...a) => mockFetchWind(...a),
  fetchHumidityData: (...a) => mockFetchHumidity(...a),
  fetchTemperatureData: (...a) => mockFetchTemp(...a),
  loadEnvDatasetsFromFile: (...a) => mockLoadSnapshot(...a),
}));

// -------------------- Capture the VM from HomeScreen --------------------
let latestVm = null;
jest.mock("../../screens/HomeScreen", () => ({
  __esModule: true,
  default: ({ vm }) => {
    latestVm = vm;
    return null;
  },
}));

// -------------------- SUT --------------------
import HomeContainer from "../../containers/HomeContainer";

// -------------------- Helpers --------------------
const flushMicrotasks = async () => {
  await act(async () => { await Promise.resolve(); });
};
const tickAll = async () => {
  await act(async () => {
    jest.runOnlyPendingTimers();
    await Promise.resolve();
  });
};

const setPlatform = (os) => {
  const RN = require("react-native");
  Object.defineProperty(RN.Platform, "OS", { configurable: true, value: os });
};

beforeEach(() => {
  jest.clearAllMocks();
  latestVm = null;
  mockGetItem.mockImplementation(async (k) => {
    const map = { "settings:mock-location": "0", "settings:mock-disaster": "0" };
    return map[k] ?? null;
  });
});

// ===================================================================
//                                TESTS
// ===================================================================

it("hides the native header and boots with real location (no mocks)", async () => {
  setPlatform("ios");
  render(<HomeContainer />);
  await flushMicrotasks();

  expect(mockSetOptions).toHaveBeenCalledWith({ headerShown: false });
  expect(latestVm.coords).toEqual({ latitude: 1.33, longitude: 103.75 });
  expect(latestVm.rainNearest?.name).toBe("Demo Rain Station");
  expect(latestVm.nearestAreaName).toBe("Taman Jurong");
  expect(mockEnsurePerms).toHaveBeenCalled();
});

it("honors mock-location toggle: seeds coords to demo point and marks advisory state", async () => {
  setPlatform("ios");
  mockGetItem.mockImplementation(async (k) => {
    const map = { "settings:mock-location": "1", "settings:mock-disaster": "0" };
    return map[k] ?? null;
  });

  render(<HomeContainer />);
  await flushMicrotasks();

  expect(latestVm.coords).toEqual({ latitude: 1.3405, longitude: 103.72 });
  expect(typeof latestVm.areaAdvisoryActive).toBe("boolean");
});

it("onEnableLocationPress requests permissions, reads location, and updates coords", async () => {
  setPlatform("ios");
  mockGetPerm.mockResolvedValueOnce({ status: "denied", canAskAgain: true });
  mockReqPerm.mockResolvedValueOnce({ status: "granted", canAskAgain: true });
  mockHasSvc.mockResolvedValueOnce(true);

  render(<HomeContainer />);
  await flushMicrotasks();

  mockGetPos.mockResolvedValueOnce({ coords: { latitude: 1.3, longitude: 103.8 } });

  await act(async () => { await latestVm.onEnableLocationPress(); });
  expect(latestVm.coords).toEqual({ latitude: 1.3, longitude: 103.8 });
});

it("onRefresh triggers a new data fetch pass", async () => {
  setPlatform("ios");
  render(<HomeContainer />);
  await flushMicrotasks();

  mockFetchRainfall.mockClear();
  mockFetchPm25.mockClear();
  mockFetchTemp.mockClear();
  mockFetchHumidity.mockClear();
  mockFetchWind.mockClear();

  await act(async () => { await latestVm.onRefresh(); });

  expect(mockFetchRainfall).toHaveBeenCalled();
  expect(mockFetchPm25).toHaveBeenCalled();
  expect(mockFetchTemp).toHaveBeenCalled();
  expect(mockFetchHumidity).toHaveBeenCalled();
  expect(mockFetchWind).toHaveBeenCalled();
});

// ------------------------------------------------------------------
// Flood-risk notification: boot with LOW rainfall (no alert),
// then raise to HIGH + set estimator to High, drive native pass,
// refresh datasets, and flush timers.
// ------------------------------------------------------------------
it("pushes a flood-risk notification on high rainfall", async () => {
  setPlatform("ios");

  // >>> Expire any prior cooldown so risk alerts can fire in this test
  await act(async () => {
    jest.advanceTimersByTime(10 * 60 * 1000 + 1); // 10 minutes + 1ms
  });

  // Native (not mock toggles)
  mockGetItem.mockImplementation(async (k) => {
    const map = { "settings:mock-location": "0", "settings:mock-disaster": "0" };
    return map[k] ?? null;
  });

  // Boot: LOW rainfall so no alert can fire early
  mockFetchRainfall.mockResolvedValueOnce({
    stations: [{
      name: "Demo Rain Station",
      location: { latitude: 1.339, longitude: 103.721 },
      rainfall: 5,
    }],
  });

  // During boot we keep risk LOW (even if container computes more than once)
  mockEstimateFloodRisk.mockReset()
    .mockReturnValueOnce("Low")
    .mockReturnValueOnce("Low")
    .mockReturnValue("Low");

  render(<HomeContainer />);

  // Wait for boot to finish (coords present)
  await waitFor(() => expect(latestVm?.coords).toBeTruthy());

  // Clear any early notifications
  mockPresentNotif.mockClear();

  // Re-arm estimator: from now on, risk = High
  mockEstimateFloodRisk.mockReset().mockReturnValue("High");

  // Next dataset fetch returns HIGH rainfall
  mockFetchRainfall.mockResolvedValueOnce({
    stations: [{
      name: "Demo Rain Station",
      location: { latitude: 1.339, longitude: 103.721 },
      rainfall: 90,
    }],
  });

  // Make sure we drive the native (non-mock) path too
  mockGetPerm.mockResolvedValueOnce({ status: "granted", canAskAgain: true });
  mockHasSvc.mockResolvedValueOnce(true);
  mockGetPos.mockResolvedValueOnce({ coords: { latitude: 1.339, longitude: 103.721 } });

  // Update location and refresh datasets
  await act(async () => { await latestVm.onEnableLocationPress(); });
  await act(async () => { await latestVm.onRefresh(); });

  // Flush all timers/debounces
  await tickAll();
  await tickAll();

  // Expect a notification
  await waitFor(() => expect(mockPresentNotif).toHaveBeenCalled());

  const [arg] = mockPresentNotif.mock.calls.at(-1) || [{}];
  expect(arg?.title).toMatch(/Flood Risk/i);
});

it("notifies area advisory when mockDisaster is ON and user is inside geofence", async () => {
  setPlatform("ios");
  mockGetItem.mockImplementation(async (k) => {
    const map = { "settings:mock-location": "1", "settings:mock-disaster": "1" };
    return map[k] ?? null;
  });

  render(<HomeContainer />);
  await flushMicrotasks();

  expect(latestVm.areaAdvisoryActive).toBe(true);
  const titles = mockPresentNotif.mock.calls.map(([p]) => p?.title || "");
  expect(titles.some((t) => /Area Advisory/i.test(t))).toBe(true);
});

it("onEnableLocationPress opens app settings when services are disabled", async () => {
  setPlatform("ios");
  render(<HomeContainer />);

  await waitFor(() => expect(latestVm.coords).toBeTruthy());

  mockGetPerm.mockResolvedValueOnce({ status: "denied", canAskAgain: true });
  mockReqPerm.mockResolvedValueOnce({ status: "granted", canAskAgain: true });
  mockHasSvc.mockResolvedValueOnce(false);

  const RN = require("react-native");
  const { Linking } = RN;
  const IntentLauncher = require("expo-intent-launcher");

  await act(async () => { await latestVm.onEnableLocationPress(); });

  const iosCalled = Linking.openURL.mock.calls.some(([url]) => url === "app-settings:");
  const androidCalled = IntentLauncher.startActivityAsync.mock.calls.length > 0;
  expect(iosCalled || androidCalled).toBe(true);
});

it("merges bundled snapshot when network datasets are empty", async () => {
  setPlatform("ios");
  mockFetchRainfall.mockResolvedValueOnce({ stations: [] });
  mockFetchPm25.mockResolvedValueOnce([]);
  mockFetchTemp.mockResolvedValueOnce([]);
  mockFetchHumidity.mockResolvedValueOnce([]);
  mockFetchWind.mockResolvedValueOnce([]);

  mockLoadSnapshot.mockResolvedValueOnce({
    rain: { stations: [{ name: "Snap Rain", location: { latitude: 1.34, longitude: 103.72 }, rainfall: 1 }] },
    pm25: [{ location: { latitude: 1.34, longitude: 103.7 }, value: 22 }],
    wind: [{ location: { latitude: 1.35, longitude: 103.71 }, value: 3 }],
    humidity: [{ location: { latitude: 1.36, longitude: 103.72 }, value: 60 }],
    temp: [{ location: { latitude: 1.37, longitude: 103.73 }, value: 29 }],
  });

  render(<HomeContainer />);
  await flushMicrotasks();

  await act(async () => { await latestVm.onRefresh(); });

  expect(latestVm.envDatasets?.pm25?.length).toBe(1);
  expect(latestVm.envDatasets?.temp?.length).toBe(1);
  expect(latestVm.envDatasets?.humidity?.length).toBe(1);
  expect(latestVm.envDatasets?.wind?.length).toBe(1);
});

it("does not start watchPosition when mock-location is ON", async () => {
  setPlatform("ios");
  mockGetItem.mockImplementation(async (k) => {
    const map = { "settings:mock-location": "1", "settings:mock-disaster": "0" };
    return map[k] ?? null;
  });

  render(<HomeContainer />);
  await flushMicrotasks();

  expect(mockWatch).not.toHaveBeenCalled();
});

// Optionally restore the original console.warn at the very end
afterAll(() => {
  console.warn = __originalConsoleWarn;
});
