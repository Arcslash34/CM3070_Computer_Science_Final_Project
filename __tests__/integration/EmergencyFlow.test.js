// __tests__/integration/EmergencyFlow.test.js
/**
 * Integration: Emergency flow (5-tap gesture → Siren → cleanup/re-arm)
 */

import React from "react";
import { Text, View, Alert, Vibration } from "react-native";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";

// silence warnings
const originalWarn = console.warn;
beforeAll(() => {
  jest.spyOn(console, "warn").mockImplementation((...args) => {
    const msg = String(args[0] ?? "");
    if (msg.includes("Badge awarding failed") || msg.includes("Quiz audio init error")) return;
    originalWarn(...args);
  });
});
afterAll(() => console.warn.mockRestore());

jest.useFakeTimers();

// RN animated helper
jest.mock("react-native/Libraries/Animated/NativeAnimatedHelper", () => ({}), {
  virtual: true,
});

// reanimated mock (inline stub, avoids requiring mock.ts ESM)
jest.mock("react-native-reanimated", () => {
  return {
    __esModule: true,
    default: {},
    runOnJS: (fn) => fn,
    View: require("react-native").View,
    Text: require("react-native").Text,
  };
});

// gesture-handler mock
jest.mock("react-native-gesture-handler", () => {
  const React = require("react");
  const { Pressable } = require("react-native");
  const Gesture = {
    Native: jest.fn(() => ({})),
    Tap: () => {
      const api = { _onEnd: null };
      [
        "numberOfTaps",
        "maxDuration",
        "maxDelay",
        "maxDistance",
        "cancelsTouchesInView",
        "shouldCancelWhenOutside",
        "simultaneousWithExternalGesture",
      ].forEach((m) => (api[m] = () => api));
      api.onEnd = (cb) => {
        api._onEnd = cb;
        return api;
      };
      return api;
    },
  };
  const GestureDetector = ({ gesture, children, testID }) => (
    <Pressable testID={testID || "gesture-surface"} onPress={() => gesture?._onEnd?.({}, true)}>
      {children}
    </Pressable>
  );
  return { Gesture, GestureDetector };
});

// camera mock
jest.mock("expo-camera", () => {
  const React = require("react");
  const { useEffect } = React;
  const { View } = require("react-native");
  const CameraView = ({ onCameraReady, ...rest }) => {
    useEffect(() => {
      const id = setTimeout(() => onCameraReady?.(), 0);
      return () => clearTimeout(id);
    }, [onCameraReady]);
    return <View testID="camera-view" {...rest} />;
  };
  const useCameraPermissions = () => [{ granted: true, canAskAgain: false }, jest.fn()];
  return { CameraView, useCameraPermissions };
});

// keep-awake mock
jest.mock("expo-keep-awake", () => ({ useKeepAwake: () => {} }));

// Ionicons mock
jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return { Ionicons: (props) => <Text accessibilityRole="image" {...props} /> };
});

// spies
jest.spyOn(Alert, "alert").mockImplementation(() => {});
jest.spyOn(Vibration, "vibrate").mockImplementation(() => {});
jest.spyOn(Vibration, "cancel").mockImplementation(() => {});

// sirenAudio mock (safe hoisting)
jest.mock("../../utils/sirenAudio", () => {
  return {
    playSiren: jest.fn().mockResolvedValue(undefined),
    stopSiren: jest.fn().mockResolvedValue(undefined),
  };
});
import { playSiren, stopSiren } from "../../utils/sirenAudio";

// emergencyBus mock
jest.mock("../../utils/emergencyBus", () => {
  const listeners = new Set();
  return {
    emergencyBus: {
      on(cb) {
        listeners.add(cb);
        return () => listeners.delete(cb);
      },
      emit(msg) {
        listeners.forEach((cb) => {
          try {
            cb(msg);
          } catch {}
        });
      },
    },
  };
});

// navigation mock
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

// SirenScreen mock
jest.mock("../../screens/SirenScreen", () => {
  const React = require("react");
  const { View, Text, Pressable } = require("react-native");
  return {
    __esModule: true,
    default: ({ vm }) => (
      <View>
        <Text testID="siren-screen">Siren</Text>
        <Text testID="torch-state">{vm.torchOn ? "torch:on" : "torch:off"}</Text>
        <Pressable testID="stop" onPress={vm.onStop}>
          <Text>STOP</Text>
        </Pressable>
      </View>
    ),
  };
});

// imports after mocks
import EmergencyTapOverlay from "../../components/EmergencyTapOverlay";
import SirenContainer from "../../containers/SirenContainer";
import { NavigationContainer } from "@react-navigation/native";

// simple home
function HomeScreen({ onTrigger }) {
  return (
    <EmergencyTapOverlay onTrigger={onTrigger}>
      <View>
        <Text testID="home-screen">Home</Text>
      </View>
    </EmergencyTapOverlay>
  );
}
function TestApp() {
  return (
    <NavigationContainer>
      {({ route, navigation }) =>
        route.name === "Siren" ? (
          <SirenContainer />
        ) : (
          <HomeScreen onTrigger={() => navigation.navigate("Siren", { primed: true })} />
        )
      }
    </NavigationContainer>
  );
}

// tests
describe("Emergency Flow", () => {
  beforeEach(() => jest.clearAllMocks());

  it("triggers siren, plays audio + vibration", async () => {
    const { getByTestId } = render(<TestApp />);
    fireEvent.press(getByTestId("gesture-surface"));
    act(() => jest.advanceTimersByTime(500));
    await waitFor(() => getByTestId("siren-screen"));
    expect(playSiren).toHaveBeenCalled();
    expect(Vibration.vibrate).toHaveBeenCalled();
  });

  it("STOP cleans up and re-arms overlay", async () => {
    const { getByTestId } = render(<TestApp />);
    fireEvent.press(getByTestId("gesture-surface"));
    act(() => jest.advanceTimersByTime(500));
    await waitFor(() => getByTestId("siren-screen"));

    fireEvent.press(getByTestId("stop"));
    act(() => jest.runOnlyPendingTimers());

    await waitFor(() => getByTestId("home-screen"));
    expect(stopSiren).toHaveBeenCalled();
    expect(Vibration.cancel).toHaveBeenCalled();

    // trigger again
    fireEvent.press(getByTestId("gesture-surface"));
    act(() => jest.advanceTimersByTime(500));
    await waitFor(() => getByTestId("siren-screen"));
    expect(playSiren).toHaveBeenCalledTimes(2);
  });
});
