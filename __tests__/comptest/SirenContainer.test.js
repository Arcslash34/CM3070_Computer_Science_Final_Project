// __tests__/comptest/SirenContainer.test.js

import React from "react";
import { render, act } from "@testing-library/react-native";
import SirenContainer from "../../containers/SirenContainer";

/* ---------------- Time & rAF polyfills ---------------- */
jest.useFakeTimers();
beforeAll(() => {
  if (!global.requestAnimationFrame) {
    global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
    global.cancelAnimationFrame = (id) => clearTimeout(id);
  }
});

/* ---------------- RN native/TurboModule stubs ---------------- */
// Silence Animated native helper (virtual so no real file is needed)
jest.mock(
  "react-native/Libraries/Animated/NativeAnimatedHelper",
  () => ({}),
  { virtual: true }
);

// Stub Settings to avoid TurboModule SettingsManager
jest.mock("react-native/Libraries/Settings/Settings", () => ({
  get: jest.fn(() => undefined),
  set: jest.fn(),
  watchKeys: jest.fn(() => ({ remove: jest.fn() })),
  clearWatch: jest.fn(),
}));

// Optional: silence NativeEventEmitter warnings
jest.mock("react-native/Libraries/EventEmitter/NativeEventEmitter");

/* ---------------- Local mock fns (keep names starting with 'mock') ---------------- */
let mockGoBack = jest.fn();
let mockPlaySiren = jest.fn();
let mockStopSiren = jest.fn();
let mockEmit = jest.fn();
let mockVibrate = jest.fn();
let mockCancelVibration = jest.fn();
let mockAlert = jest.fn();

/* ---------------- Patch specific RN APIs (do NOT mock whole RN) ---------------- */
import {
  Animated,
  InteractionManager,
  AppState,
  Alert,
  Vibration,
} from "react-native";

beforeAll(() => {
  // Make Animated.timing synchronous
  jest.spyOn(Animated, "timing").mockImplementation((value, config) => ({
    start: (cb) => {
      if (typeof value.setValue === "function") value.setValue(config.toValue);
      if (cb) cb();
      return { stop: () => {} };
    },
  }));

  // InteractionManager: run immediately
  // @ts-ignore
  InteractionManager.runAfterInteractions = (cb) =>
    typeof cb === "function" ? cb() : undefined;

  // AppState listener returns object with remove()
  // @ts-ignore
  AppState.addEventListener = () => ({ remove: jest.fn() });

  // Hook our spies
  // @ts-ignore
  Alert.alert = (...args) => mockAlert(...args);
  // @ts-ignore
  Vibration.vibrate = (...args) => mockVibrate(...args);
  // @ts-ignore
  Vibration.cancel = () => mockCancelVibration();
});

/* ---------------- react-navigation ----------------
   Runs focus effect immediately and returns proper cleanup.
---------------------------------------------------------------- */
jest.mock("@react-navigation/native", () => {
  const React = require("react");
  return {
    __esModule: true,
    useNavigation: () => ({ goBack: mockGoBack }),
    useRoute: () => ({ params: { primed: true } }),
    useFocusEffect: (cb) => {
      React.useEffect(() => {
        const cleanup = cb();
        return typeof cleanup === "function" ? cleanup : undefined;
      }, []);
    },
  };
});



/* ---------------- expo keep awake ---------------- */
jest.mock("expo-keep-awake", () => ({
  useKeepAwake: jest.fn(),
}));

/* ---------------- expo camera ---------------- */
jest.mock("expo-camera", () => ({
  CameraView: jest.fn(() => null),
  useCameraPermissions: () => [{ granted: true }, jest.fn()],
}));

/* ---------------- Audio + emergency bus ---------------- */
jest.mock("../../utils/sirenAudio", () => ({
  playSiren: (...args) => mockPlaySiren(...args),
  stopSiren: (...args) => mockStopSiren(...args),
}));
jest.mock("../../utils/emergencyBus", () => ({
  emergencyBus: { emit: (...args) => mockEmit(...args) },
}));

/* ---------------- Capture vm from the presentational screen ---------------- */
let latestVm = null;
const SirenScreenMock = ({ vm }) => {
  latestVm = vm;
  return null;
};
jest.mock("../../screens/SirenScreen", () => ({
  __esModule: true,
  default: (props) => <SirenScreenMock {...props} />,
}));

/* ---------------- Helpers ---------------- */
async function flush(ms = 0) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  latestVm = null;
  // reassign all mock refs (names must start with "mock" so jest allows usage in factories)
  mockGoBack = jest.fn();
  mockPlaySiren = jest.fn();
  mockStopSiren = jest.fn();
  mockEmit = jest.fn();
  mockVibrate = jest.fn();
  mockCancelVibration = jest.fn();
  mockAlert = jest.fn();
});

/* =================================================================== */
/*                                TESTS                                */
/* =================================================================== */
describe("SirenContainer", () => {
  it("starts siren + vibration and emits open on focus", async () => {
    render(<SirenContainer />);

    // rAF "mount cam one frame later"
    await flush(1);

    expect(mockPlaySiren).toHaveBeenCalledTimes(1);
    expect(mockVibrate).toHaveBeenCalled();
    expect(mockEmit).toHaveBeenCalledWith("siren-open");
    expect(mockAlert).toHaveBeenCalled();

    expect(latestVm).toBeTruthy();
    expect(latestVm.coverVisible).toBe(true);
    expect(latestVm.strobing).toBe(true);
  });

  it("emits camera-ready and begins strobing after camera ready + warmup", async () => {
    render(<SirenContainer />);
    await flush(1); // rAF

    act(() => latestVm.onCameraReady());

    // onCameraReady -> setTimeout(primed ? 60 : 120) -> startStrobe warmup (~120)
    await flush(60 + 5);
    await flush(120 + 5);

    // scheduleNext turns torch on at the next boundary; allow a bit of time
    await flush(200);

    expect(typeof latestVm.torchOn).toBe("boolean");
    expect(latestVm.torchOn).toBe(true);
    expect(mockEmit).toHaveBeenCalledWith("siren-camera-ready");
  });

  it("toggle strobe off and on via vm actions", async () => {
    render(<SirenContainer />);
    await flush(1);

    act(() => latestVm.onCameraReady());
    await flush(60 + 5);
    await flush(120 + 5);
    await flush(200);

    act(() => latestVm.onToggleStrobe());
    expect(latestVm.strobing).toBe(false);

    act(() => latestVm.onToggleStrobe());
    expect(latestVm.strobing).toBe(true);

    await flush(200);
    expect(latestVm.torchOn).toBe(true);
  });

  it("stop action cleans up and navigates back", async () => {
    const { unmount } = render(<SirenContainer />);
    await flush(1);

    act(() => latestVm.onStop());

    expect(mockCancelVibration).toHaveBeenCalled();
    expect(mockStopSiren).toHaveBeenCalled();
    expect(mockGoBack).toHaveBeenCalled();

    // unmount triggers focus-effect cleanup, which emits "siren-closed"
    unmount();
    expect(mockEmit).toHaveBeenCalledWith("siren-closed");
  });

  it("cover failsafe removes cover if camera never becomes ready", async () => {
    render(<SirenContainer />);
    await flush(1);

    // cover failsafe at 1600ms
    await flush(1650);
    expect(latestVm.coverVisible).toBe(false);
  });
});
