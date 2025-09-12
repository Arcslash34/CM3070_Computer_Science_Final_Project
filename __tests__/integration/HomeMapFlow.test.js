// __tests__/integration/HomeMapFlow.test.js
/**
 * Integration: Home → Interactive Map
 * Verifies:
 *  - Home fetches datasets (via envApi)
 *  - Map modal opens from Home
 *  - HTML is built once per open
 *  - Changing layer injects JS (window.updateLayer)
 */

import React from "react";
import { Text, View, Pressable } from "react-native";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";

// ---------------------------------------------------------------------------
// Quiet expected warnings
// ---------------------------------------------------------------------------
const originalWarn = console.warn;
beforeAll(() => {
  jest.spyOn(console, "warn").mockImplementation((...args) => {
    const msg = String(args[0] ?? "");
    if (
      msg.includes("fetch error") ||
      msg.includes("rate-limited") ||
      msg.includes("snapshot")
    ) return;
    originalWarn(...args);
  });
});
afterAll(() => console.warn.mockRestore());

jest.useFakeTimers();

// RN Animated helper stub
jest.mock("react-native/Libraries/Animated/NativeAnimatedHelper", () => ({}), { virtual: true });

// ---------------------------------------------------------------------------
// NetInfo → online
// ---------------------------------------------------------------------------
jest.mock("@react-native-community/netinfo", () => ({
  fetch: jest.fn().mockResolvedValue({ isConnected: true, isInternetReachable: true }),
}));

// ---------------------------------------------------------------------------
// AsyncStorage (used by HomeContainer demo toggles)
// ---------------------------------------------------------------------------
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Expo Location (grant, but we won’t actually move the GPS)
// ---------------------------------------------------------------------------
jest.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: "granted", canAskAgain: true }),
  getForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: "granted", canAskAgain: true }),
  hasServicesEnabledAsync: jest.fn().mockResolvedValue(true),
  getCurrentPositionAsync: jest.fn().mockResolvedValue({
    coords: { latitude: 1.35, longitude: 103.82 },
  }),
  watchPositionAsync: jest.fn().mockResolvedValue({ remove: jest.fn() }),
  Accuracy: { Balanced: 2 },
}));

// ---------------------------------------------------------------------------
// AppPrefs (notifications)
// ---------------------------------------------------------------------------
jest.mock("../../utils/appPrefs", () => ({
  refresh: jest.fn().mockResolvedValue(undefined),
  ensurePermissions: jest.fn().mockResolvedValue(true),
  presentNotification: jest.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Translations
// ---------------------------------------------------------------------------
jest.mock("../../translations/language", () => {
  const React = require("react");
  // simple context with static lang
  const LanguageContext = React.createContext({ lang: "en" });
  return { LanguageContext };
});
jest.mock("../../translations/translation", () => ({
  t: (k) => {
    const dict = {
      "map.title": "Interactive Map",
      "map.a11yClose": "Close map",
      "map.loading": "Loading map…",
      "map.layers.rain": "Rain",
      "map.layers.pm25": "PM2.5",
      "map.layers.wind": "Wind",
      "map.layers.temp": "Temp",
      "map.layers.humidity": "Humidity",
      "map.a11yLayer.rain": "Show rain layer",
      "map.a11yLayer.pm25": "Show PM2.5 layer",
      "map.a11yLayer.wind": "Show wind layer",
      "map.a11yLayer.temp": "Show temperature layer",
      "map.a11yLayer.humidity": "Show humidity layer",
      "map.html.youAreHere": "You are here",
      "map.html.legend.rain": "Rainfall (5 min)",
      "map.html.legend.high": "High",
      "map.html.legend.moderate": "Moderate",
      "map.html.legend.low": "Low",
      "map.html.legend.pm25": "PM2.5 (µg/m³)",
      "map.html.legend.wind": "Wind (kn)",
      "map.html.legend.temp": "Temperature (°C)",
      "map.html.legend.humidity": "Humidity (%)",
      "map.html.legend.chipPm25": "Region PM2.5",
      "map.html.legend.chipWind": "Station wind",
      "map.html.legend.chipTemp": "Station temp",
      "map.html.legend.chipHumidity": "Station humidity",
      "map.html.popup.location": "Location",
      "map.html.popup.station": "Station",
      "map.html.popup.region": "Region",
      "map.html.popup.rainfall": "Rainfall (5m)",
      "map.html.popup.floodRisk": "Flood Risk",
      "map.html.popup.pm25": "PM2.5",
      "map.html.popup.windSpeed": "Wind",
      "map.html.popup.temperature": "Temperature",
      "map.html.popup.humidity": "Humidity",
      "map.html.popup.na": "N/A",
      "map.html.units.mm": "mm",
      "map.html.units.kn": "kn",
      "map.html.units.c": "°C",
      "map.html.units.percent": "%",
    };
    return dict[k] ?? k;
  },
}));

// ---------------------------------------------------------------------------
// WebView mock — captures injectJavaScript calls
// ---------------------------------------------------------------------------
const mockInjected = [];
jest.mock("react-native-webview", () => {
  const React = require("react");
  const { useEffect, forwardRef, useImperativeHandle } = React;
  const { View, Text } = require("react-native");

  const WebView = forwardRef(({ onLoadEnd, onLoadStart, ...props }, ref) => {
    useImperativeHandle(ref, () => ({
      injectJavaScript: (code) => mockInjected.push(code),
    }));
    useEffect(() => {
      onLoadStart?.();
      // simulate load finishing on next tick
      const id = setTimeout(() => onLoadEnd?.(), 0);
      return () => clearTimeout(id);
    }, [onLoadStart, onLoadEnd]);

    return (
      <View testID="webview">
        <Text>WV</Text>
      </View>
    );
  });
  return { WebView };
});

// ---------------------------------------------------------------------------
// envApi — return deterministic datasets
// ---------------------------------------------------------------------------
jest.mock("../../api/envApi", () => {
  const real = jest.requireActual("../../api/envApi");
  return {
    ...real,
    fetchWeatherForecast: jest.fn().mockResolvedValue({
      forecasts: [],
      metadata: [],
      timestamp: Date.now(),
    }),
    fetchRainfallData: jest.fn().mockResolvedValue({
      stations: [
        { id: "A", name: "Rain A", location: { latitude: 1.34, longitude: 103.82 }, rainfall: 7.2 },
      ],
      timestamp: Date.now(),
    }),
    fetchPm25Data: jest.fn().mockResolvedValue([
      { name: "west", location: { latitude: 1.35, longitude: 103.7 }, value: 23 },
    ]),
    fetchWindData: jest.fn().mockResolvedValue([
      { id: "W1", name: "Wind A", location: { latitude: 1.33, longitude: 103.84 }, speed: 9, direction: 220 },
    ]),
    fetchHumidityData: jest.fn().mockResolvedValue([
      { id: "H1", name: "Hum A", location: { latitude: 1.36, longitude: 103.83 }, value: 84 },
    ]),
    fetchTemperatureData: jest.fn().mockResolvedValue([
      { id: "T1", name: "Temp A", location: { latitude: 1.31, longitude: 103.86 }, value: 31 },
    ]),
    loadEnvDatasetsFromFile: jest.fn().mockResolvedValue({
      // ensure "ready" true even if network skipped
      rain: { stations: [{ id: "S", name: "Snap", location: { latitude: 1.35, longitude: 103.82 }, rainfall: 3 }] },
      pm25: [{ name: "central", location: { latitude: 1.35, longitude: 103.8 }, value: 20 }],
      wind: [{ id: "W2", name: "Snap Wind", location: { latitude: 1.35, longitude: 103.85 }, speed: 5, direction: 90 }],
      temp: [{ id: "T2", name: "Snap Temp", location: { latitude: 1.34, longitude: 103.82 }, value: 30 }],
      humidity: [{ id: "H2", name: "Snap Hum", location: { latitude: 1.34, longitude: 103.83 }, value: 70 }],
    }),
  };
});

// ---------------------------------------------------------------------------
// buildLeafletHtml — spy to verify single build per open
// ---------------------------------------------------------------------------
jest.mock("../../utils/buildLeafletHtml", () => {
  const buildLeafletHtml = jest.fn((..._args) => "<html><body>map</body></html>");
  return { buildLeafletHtml };
});
import { buildLeafletHtml } from "../../utils/buildLeafletHtml";

// ---------------------------------------------------------------------------
// Minimal navigation mock (matches pattern used elsewhere)
// ---------------------------------------------------------------------------
jest.mock("@react-navigation/native", () => {
  const React = require("react");
  const Ctx = React.createContext(null);
  function NavigationContainer({ children, initialRouteName = "Home" }) {
    const [stack, setStack] = React.useState([{ name: initialRouteName, params: {} }]);
    const route = stack[stack.length - 1];
    const navigation = {
      navigate: (name, params) => setStack((s) => [...s, { name, params: params || {} }]),
      goBack: () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)),
      setOptions: () => {},
      addListener: () => () => {},
      canGoBack: () => stack.length > 1,
    };
    return (
      <Ctx.Provider value={{ route, navigation }}>
        {typeof children === "function" ? children({ route, navigation }) : children}
      </Ctx.Provider>
    );
  }
  const useNavigation = () => React.useContext(Ctx).navigation;
  const useRoute = () => React.useContext(Ctx).route;
  const useFocusEffect = (effect) => {
    React.useEffect(() => effect() || (() => {}), [effect]);
  };
  return { NavigationContainer, useNavigation, useRoute, useFocusEffect };
});

// ---------------------------------------------------------------------------
// Screen stubs
//  - HomeScreen includes a button to open the map modal
//  - We directly render InteractiveMapModalContainer using vm state
// ---------------------------------------------------------------------------
jest.mock("../../screens/HomeScreen", () => {
  const React = require("react");
  const { View, Text, Pressable } = require("react-native");
  const InteractiveMapModalContainer = require("../../containers/InteractiveMapModalContainer").default;

  const Screen = ({ vm }) => (
    <View>
      <Text testID="home-screen">Home</Text>

      <Pressable
        testID="open-map"
        onPress={() => vm.setMapExpanded(true)}
      >
        <Text>Open Map</Text>
      </Pressable>

      {/* Render the modal here using current vm props */}
      <InteractiveMapModalContainer
        visible={vm.mapExpanded}
        onClose={() => vm.setMapExpanded(false)}
        userCoords={vm.coords}
        datasets={vm.envDatasets}
      />
    </View>
  );
  return { __esModule: true, default: Screen };
});

// Ionicons stub used by InteractiveMapModalScreen
jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return { Ionicons: (props) => <Text accessibilityRole="image" {...props} /> };
});

// Safe area
jest.mock("react-native-safe-area-context", () => {
  const RN = jest.requireActual("react-native");
  return {
    SafeAreaProvider: ({ children }) => <>{children}</>,
    SafeAreaView: RN.View,
    useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
  };
});

// ---------------------------------------------------------------------------
// Expo Intent Launcher (ESM → mock to avoid syntax errors)
// ---------------------------------------------------------------------------
jest.mock("expo-intent-launcher", () => ({
  startActivityAsync: jest.fn().mockResolvedValue(undefined),
  ActivityAction: { LOCATION_SOURCE_SETTINGS: "android.settings.LOCATION_SOURCE_SETTINGS" },
}));

// ---------------------------------------------------------------------------
// Import real containers after mocks
// ---------------------------------------------------------------------------
import HomeContainer from "../../containers/HomeContainer";
import { NavigationContainer } from "@react-navigation/native";

// Helper app
function App() {
  return (
    <NavigationContainer>
      {() => <HomeContainer />}
    </NavigationContainer>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("Home → Interactive Map", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInjected.length = 0;
  });

  it("loads datasets, opens modal, builds HTML once, switches layer via JS injection", async () => {
    const { getByTestId, queryByTestId, getByText, getByLabelText } = render(<App />);

    // Home visible
    await waitFor(() => getByTestId("home-screen"));

    // Open the map modal
    act(() => {
      fireEvent.press(getByTestId("open-map"));
    });

    // WebView should mount and load
    await waitFor(() => getByTestId("webview"));

    // HTML built once on open
    expect(buildLeafletHtml).toHaveBeenCalledTimes(1);

    // After WebView load end (mocked), map is ready → switching layers should inject JS
    // Tap the PM2.5 button rendered by the presentational screen
    act(() => {
      fireEvent.press(getByText("PM2.5"));
    });

    // Let onLoadEnd and state settle
    act(() => jest.runOnlyPendingTimers());

    // Confirm JS injection happened and targeted PM2.5
    const last = mockInjected[mockInjected.length - 1] || "";
    expect(last).toContain("window.updateLayer");
    expect(last).toContain("pm25");

    // Close and reopen: build should run again for a new open
    // Close
    const close = getByLabelText("Close map");
    act(() => {
      fireEvent.press(close);
      jest.runOnlyPendingTimers();
    });
    await waitFor(() => expect(queryByTestId("webview")).toBeNull());

    // Reopen
    act(() => {
      fireEvent.press(getByTestId("open-map"));
    });
    await waitFor(() => getByTestId("webview"));

    expect(buildLeafletHtml).toHaveBeenCalledTimes(2);
  });
});
