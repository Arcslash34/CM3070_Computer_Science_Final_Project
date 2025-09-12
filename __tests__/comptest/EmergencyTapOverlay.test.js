// __tests__/comptest/EmergencyTapOverlay.test.js
import React from "react";
import { render, act } from "@testing-library/react-native";

/* ---------------- Time & rAF polyfills ---------------- */
jest.useFakeTimers();
beforeAll(() => {
  if (!global.requestAnimationFrame) {
    global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
    global.cancelAnimationFrame = (id) => clearTimeout(id);
  }
});

/* ---------------- Silence/patch RN internals ---------------- */
jest.mock(
  "react-native/Libraries/Animated/NativeAnimatedHelper",
  () => ({}),
  { virtual: true }
);
jest.mock("react-native/Libraries/Settings/Settings", () => ({
  get: jest.fn(() => undefined),
  set: jest.fn(),
  watchKeys: jest.fn(() => ({ remove: jest.fn() })), // RN 0.76 compat
  clearWatch: jest.fn(),
}));
jest.mock("react-native/Libraries/EventEmitter/NativeEventEmitter");

/* ---------------- Mock Reanimated runOnJS ---------------- */
jest.mock("react-native-reanimated", () => ({
  runOnJS: (fn) => fn,
}));

/* ---------------- Mock RNGH with fire helper (no outer refs) ---------------- */
jest.mock("react-native-gesture-handler", () => {
  const React = require("react");
  const { View } = require("react-native");
  let tapEndCb;

  const chain = {
    numberOfTaps: () => chain,
    maxDuration: () => chain,
    maxDelay: () => chain,
    maxDistance: () => chain,
    cancelsTouchesInView: () => chain,
    shouldCancelWhenOutside: () => chain,
    simultaneousWithExternalGesture: () => chain,
    onEnd: (cb) => {
      tapEndCb = cb;
      return chain;
    },
  };

  return {
    __esModule: true,
    Gesture: {
      Tap: () => chain,
      Native: () => ({}),
    },
    GestureDetector: ({ children }) => <View>{children}</View>,
    __fireTapEnd: (success = true) => {
      if (tapEndCb) tapEndCb({}, success);
    },
  };
});

/* ---------------- Event bus mock (self-contained) ---------------- */
jest.mock("../../utils/emergencyBus", () => {
  let subs = [];
  return {
    emergencyBus: {
      emit: (msg) => subs.forEach((cb) => cb(msg)),
      on: (cb) => {
        subs.push(cb);
        return () => {
          subs = subs.filter((x) => x !== cb);
        };
      },
    },
  };
});
import { emergencyBus } from "../../utils/emergencyBus";

/* ---------------- Expo Camera mock (state kept INSIDE factory) ------------- */
jest.mock("expo-camera", () => {
  const React = require("react");
  const { View } = require("react-native");
  let mockPermission = { granted: true, canAskAgain: true };
  const mockRequestPermission = jest.fn(async () => {
    mockPermission = { ...mockPermission, granted: true };
  });

  return {
    __esModule: true,
    CameraView: (props) => <View testID="prewarmCam" {...props} />,
    useCameraPermissions: () => [mockPermission, mockRequestPermission],

    // test-only helpers
    __setPermission: (next) => {
      mockPermission = next;
    },
    __getRequestPermission: () => mockRequestPermission,
  };
});

/* ---------------- Import after mocks ---------------- */
import { Platform } from "react-native";
import EmergencyTapOverlay from "../../components/EmergencyTapOverlay";
import { __fireTapEnd } from "react-native-gesture-handler";
import {
  __setPermission as setCamPerm,
  __getRequestPermission as getReqPerm,
} from "expo-camera";

/* ---------------- Helpers ---------------- */
async function flush(ms = 0) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  setCamPerm({ granted: true, canAskAgain: true });
});

/* =================================================================== */
/*                                TESTS                                */
/* =================================================================== */

it("fires with prewarm (Android, permission granted) and unmounts on siren-camera-ready", async () => {
  Platform.OS = "android";
  const onTrigger = jest.fn();

  const { queryByTestId } = render(
    <EmergencyTapOverlay onTrigger={onTrigger}>
      <></>
    </EmergencyTapOverlay>
  );

  act(() => __fireTapEnd(true));
  await flush(430); // ~420ms prewarm delay + buffer

  expect(onTrigger).toHaveBeenCalledTimes(1);
  expect(queryByTestId("prewarmCam")).toBeTruthy();

  act(() => emergencyBus.emit("siren-camera-ready"));
  await flush(1);
  expect(queryByTestId("prewarmCam")).toBeNull();
});

it("skips prewarm and fires immediately on web", async () => {
  Platform.OS = "web";
  const onTrigger = jest.fn();

  render(
    <EmergencyTapOverlay onTrigger={onTrigger}>
      <></>
    </EmergencyTapOverlay>
  );

  act(() => __fireTapEnd(true));
  expect(onTrigger).toHaveBeenCalledTimes(1);
});

it("respects bus guards: blocks while opening/active and resumes after closed", async () => {
  Platform.OS = "android";
  const onTrigger = jest.fn();

  render(
    <EmergencyTapOverlay onTrigger={onTrigger}>
      <></>
    </EmergencyTapOverlay>
  );

  act(() => emergencyBus.emit("siren-opening"));
  act(() => __fireTapEnd(true));
  await flush(450);
  expect(onTrigger).not.toHaveBeenCalled();

  act(() => emergencyBus.emit("siren-open"));
  act(() => __fireTapEnd(true));
  await flush(450);
  expect(onTrigger).not.toHaveBeenCalled();

  act(() => emergencyBus.emit("siren-closed"));
  act(() => __fireTapEnd(true));
  await flush(450);
  expect(onTrigger).toHaveBeenCalledTimes(1);
});

it("cooldown prevents duplicate triggers within 1500ms", async () => {
  Platform.OS = "android";
  const onTrigger = jest.fn();

  render(
    <EmergencyTapOverlay onTrigger={onTrigger}>
      <></>
    </EmergencyTapOverlay>
  );

  act(() => __fireTapEnd(true));
  await flush(430);
  expect(onTrigger).toHaveBeenCalledTimes(1);

  act(() => __fireTapEnd(true));
  await flush(430);
  expect(onTrigger).toHaveBeenCalledTimes(1);

  act(() => emergencyBus.emit("siren-closed"));
  await flush(1500);
  act(() => __fireTapEnd(true));
  await flush(430);
  expect(onTrigger).toHaveBeenCalledTimes(2);
});

it("requests camera permission on native if not granted but askable", async () => {
  Platform.OS = "android";
  setCamPerm({ granted: false, canAskAgain: true });

  render(
    <EmergencyTapOverlay onTrigger={() => {}}>
      <></>
    </EmergencyTapOverlay>
  );

  expect(getReqPerm()).toHaveBeenCalled();
});
