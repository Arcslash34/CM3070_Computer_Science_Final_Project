// __tests__/integration/AppBoot.test.js
import { render, waitFor, act } from "@testing-library/react-native";

/* Quiet RN warnings */
jest.mock("react-native/Libraries/Utilities/warnOnce", () => jest.fn());

/* Safe-area stub */
jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  return {
    SafeAreaProvider: ({ children }) =>
      React.createElement(React.Fragment, null, children),
    initialWindowMetrics: {
      frame: { x: 0, y: 0, width: 0, height: 0 },
      insets: { top: 0, left: 0, right: 0, bottom: 0 },
    },
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

/* Reanimated: hand-rolled mock */
jest.mock("react-native-reanimated", () => {
  const React = require("react");
  const NOOP = (v) => v;
  return {
    __esModule: true,
    default: {},
    Easing: {},
    useSharedValue: (v) => ({ value: v }),
    useAnimatedStyle: (fn) => (fn ? fn() : {}),
    useAnimatedGestureHandler: (h) => h || {},
    withTiming: NOOP,
    withSpring: NOOP,
    withRepeat: NOOP,
    cancelAnimation: () => {},
    runOnJS: (fn) => fn,
    runOnUI: (fn) => fn,
    Animated: {
      View: (props) => React.createElement("View", props, props.children),
    },
  };
});

/* Gesture handler stub */
jest.mock("react-native-gesture-handler", () => {
  const React = require("react");
  return {
    GestureHandlerRootView: ({ children }) =>
      React.createElement(React.Fragment, null, children),
  };
});

/* @react-navigation/native stub (forwardRef to avoid ref warnings) */
jest.mock("@react-navigation/native", () => {
  const React = require("react");
  const NavigationContainer = React.forwardRef(({ children }, _ref) =>
    React.createElement(React.Fragment, null, children)
  );
  const sharedRef = { isReady: () => true, navigate: jest.fn() };
  return {
    __esModule: true,
    NavigationContainer,
    createNavigationContainerRef: () => sharedRef,
  };
});

/* native-stack to pure JS */
jest.mock("@react-navigation/native-stack", () => {
  const React = require("react");
  const Stack = {
    Navigator: ({ children }) =>
      React.createElement(React.Fragment, null, children),
    Screen: ({ children }) =>
      typeof children === "function" ? children({}) : null,
  };
  return { __esModule: true, createNativeStackNavigator: () => Stack };
});

/* Siren screen stub */
jest.mock("../../containers/SirenContainer", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    __esModule: true,
    default: () => React.createElement(Text, { testID: "siren" }, "Siren"),
  };
});

/* Splash: auto-dismiss + counter getter */
jest.mock("../../SplashView", () => {
  const React = require("react");
  const { Text } = require("react-native");
  let renders = 0;
  const Splash = ({ onDone }) => {
    renders += 1;
    React.useEffect(() => { onDone && onDone(); }, [onDone]);
    return React.createElement(Text, { testID: "splash" }, "Splash");
  };
  const __getSplashRenders = () => renders;
  const __resetSplashRenders = () => { renders = 0; };
  return { __esModule: true, default: Splash, __getSplashRenders, __resetSplashRenders };
});

/* Overlay passthrough + capture props */
jest.mock("../../components/EmergencyTapOverlay", () => {
  const React = require("react");
  let lastProps;
  const Overlay = (props) => {
    lastProps = props;
    return React.createElement(React.Fragment, null, props.children);
  };
  const __getLastOverlayProps = () => lastProps;
  return { __esModule: true, default: Overlay, __getLastOverlayProps };
});

/* Tutorial mock with props getter */
jest.mock("../../components/FirstTimeTutorial", () => {
  let lastProps;
  const React = require("react");
  const Tutorial = (p) => { lastProps = p; return null; };
  const __getTutorialProps = () => lastProps;
  return { __esModule: true, default: Tutorial, __getTutorialProps };
});

/* AsyncStorage mock with runtime switchable flag */
jest.mock("@react-native-async-storage/async-storage", () => {
  let seen = "1"; // default: tutorial seen
  const set = (v) => { seen = v ? "1" : "0"; };
  return {
    __esModule: true,
    default: {
      getItem: async (k) => (k === "hasSeenTutorial" ? seen : null),
    },
    __setTutorialSeen: set,
  };
});

/* Prefs & siren preload: no-ops */
jest.mock("../../utils/appPrefs", () => ({ __esModule: true, init: jest.fn() }));
jest.mock("../../utils/sirenAudio", () => ({ __esModule: true, preloadSiren: jest.fn() }));

/* Language provider/context: fixed en */
jest.mock("../../translations/language", () => {
  const React = require("react");
  const LanguageContext = React.createContext({ lang: "en" });
  const LanguageProvider = ({ children }) =>
    React.createElement(LanguageContext.Provider, { value: { lang: "en" } }, children);
  return { __esModule: true, LanguageProvider, LanguageContext };
});

/* navigationRef to assert navigate() */
jest.mock("../../navigation/navigationRef", () => ({
  __esModule: true,
  navigationRef: { isReady: () => true, navigate: jest.fn() },
}));

/* AuthWrapper: internal signed-in flag with setter */
jest.mock("../../authWrapper", () => {
  const React = require("react");
  const { Text } = require("react-native");
  let signedIn = false;
  const listeners = new Set();

  const __setSignedIn = (v) => {
    signedIn = !!v;
    listeners.forEach((fn) => fn(signedIn));
  };

  function AuthWrapper() {
    const [on, setOn] = React.useState(signedIn);
    React.useEffect(() => {
      const sub = (v) => setOn(!!v);
      listeners.add(sub);
      return () => listeners.delete(sub);
    }, []);
    return on
      ? React.createElement(Text, { testID: "main-tabs" }, "MainTabs")
      : React.createElement(Text, { testID: "auth-stack" }, "AuthStack");
  }

  return { __esModule: true, default: AuthWrapper, __setSignedIn };
});

/* Pull helpers from mocks */
const { __setSignedIn } = require("../../authWrapper");
const { __getLastOverlayProps } = require("../../components/EmergencyTapOverlay");
const { navigationRef: mockNav } = require("../../navigation/navigationRef");
const { __getTutorialProps } = require("../../components/FirstTimeTutorial");
const { __setTutorialSeen } = require("@react-native-async-storage/async-storage");
const { __getSplashRenders, __resetSplashRenders } = require("../../SplashView");

/* SUT */
import App from "../../App";

/* Helper */
const flush = async () => { await act(async () => { await Promise.resolve(); }); };

describe("App boot + navigation/auth", () => {
  beforeEach(() => {
    __setSignedIn(false);
    __setTutorialSeen(true); // default: tutorial seen -> overlay allowed
    mockNav.navigate.mockClear();
    __resetSplashRenders();
  });

  it("shows unauth flow on first boot", async () => {
    const { getByTestId, queryByTestId } = render(<App />);
    await flush();
    expect(getByTestId("auth-stack")).toBeTruthy();
    expect(queryByTestId("main-tabs")).toBeNull();
  });

  it("switches to authenticated flow after sign-in", async () => {
    const { getByTestId, queryByTestId } = render(<App />);
    await flush();
    expect(getByTestId("auth-stack")).toBeTruthy();

    act(() => { __setSignedIn(true); });

    await waitFor(() => expect(getByTestId("main-tabs")).toBeTruthy());
    expect(queryByTestId("auth-stack")).toBeNull();
  });

  it("mounts main tabs without crashing when already signed in", async () => {
    act(() => { __setSignedIn(true); });
    const { getByTestId } = render(<App />);
    await flush();
    expect(getByTestId("main-tabs")).toBeTruthy();
  });

  it("navigates to Siren when overlay triggers and tutorial is not visible", async () => {
    render(<App />);
    await flush();
    const overlayProps = __getLastOverlayProps();
    overlayProps.onTrigger();
    expect(mockNav.navigate).toHaveBeenCalledWith("Siren", { primed: true });
  });

  it("blocks siren while tutorial is visible, then allows after onComplete", async () => {
    __setTutorialSeen(false);     // tutorial not seen -> visible on boot
    render(<App />);
    await flush();

    // tutorial rendered + visible
    expect(__getTutorialProps().visible).toBe(true);

    mockNav.navigate.mockClear();

    // overlay trigger ignored
    __getLastOverlayProps().onTrigger();
    expect(mockNav.navigate).not.toHaveBeenCalled();

    // complete tutorial -> now triggers should navigate
    act(() => __getTutorialProps().onComplete());
    __getLastOverlayProps().onTrigger();
    expect(mockNav.navigate).toHaveBeenCalledWith("Siren", { primed: true });
  });

  it("renders Splash once, then dismisses to auth/main", async () => {
    render(<App />);
    await flush();
    expect(__getSplashRenders()).toBe(1);
    // after auto-dismiss we should be on auth
    // (main-tabs appears only after __setSignedIn(true))
  });
});
