// __tests__/comptest/QuizGameContainer.test.js
import React from "react";
import { render, act } from "@testing-library/react-native";

beforeAll(() => {
  jest.spyOn(console, "warn").mockImplementation((...args) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes("Badge awarding failed")
    ) {
      return; // swallow this specific warning
    }
    console.warn(...args);
  });
});

/* ---------------- Time & rAF ---------------- */
jest.useFakeTimers();
beforeAll(() => {
  if (!global.requestAnimationFrame) {
    global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
    global.cancelAnimationFrame = (id) => clearTimeout(id);
  }
}); 

/* ---------------- Silence RN internals ---------------- */
jest.mock(
  "react-native/Libraries/Animated/NativeAnimatedHelper",
  () => ({}),
  { virtual: true }
);
jest.mock("react-native/Libraries/Settings/Settings", () => ({
  get: jest.fn(() => undefined),
  set: jest.fn(),
  watchKeys: jest.fn(() => ({ remove: jest.fn() })),
  clearWatch: jest.fn(),
}));
jest.mock("react-native/Libraries/EventEmitter/NativeEventEmitter");

/* ---------------- Navigation ---------------- */
let mockNavigate = jest.fn();
let mockSetOptions = jest.fn();
jest.mock("@react-navigation/native", () => {
  return {
    __esModule: true,
    useNavigation: () => ({
      navigate: mockNavigate,
      setOptions: mockSetOptions,
      goBack: jest.fn(),
    }),
    useRoute: () => ({
      params: {
        topicId: "safety",
        setIndex: 1,
        isDaily: false,
        topicTitle: "Safety Quiz",
      },
    }),
    useFocusEffect: (cb) => {
      const React = require("react");
      React.useEffect(() => {
        const cleanup = cb();
        return typeof cleanup === "function" ? cleanup : undefined;
      }, []);
    },
  };
});

/* ---------------- Safe area ---------------- */
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

/* ---------------- i18n / translations ---------------- */
jest.mock("../../translations/translation", () => {
  const t = (k, opts) =>
    (opts && opts.defaultValue) ||
    ({
      "quizGame.plusXp": ({ xp }) => `+${xp} XP`,
      "quizGame.niceTry": "Nice try",
      "quizGame.timesUp": "Time’s up",
      "quizGame.leaveTitle": "Leave?",
      "quizGame.leaveMsg": "Leave the quiz?",
      "quizGame.stay": "Stay",
      "quizGame.leave": "Leave",
      "quizzes.daily.title": "Daily Quiz",
      "quizGame.dailyTitle": "Daily Quiz",
      "quizSet.quiz": "Quiz",
    }[k] || k);
  return {
    __esModule: true,
    i18n: { locale: "en" },
    t,
    setLocale: () => {},
  };
});

/* ---------------- Quiz DB (localized + EN) ---------------- */
const MOCK_DB = {
  categories: [
    {
      id: "safety",
      title: "Safety",
      sets: [
        {
          title: "Set 1",
          questions: [
            {
              question: "What is 2+2?",
              options: ["1", "4", "3", "2"],
              answer: "4",
              explanation: "Basic math",
            },
          ],
        },
      ],
    },
  ],
};
jest.mock("../../utils/quizLoader", () => ({
  __esModule: true,
  getQuiz: () => MOCK_DB,
}));

/* ---------------- AppPrefs (sound + haptics) ---------------- */
let mockSoundEnabled = jest.fn(() => true);
let mockSuccess = jest.fn();
let mockError = jest.fn();
let mockWarning = jest.fn();
jest.mock("../../utils/appPrefs", () => ({
  __esModule: true,
  soundEnabled: () => mockSoundEnabled(),
  success: (...a) => mockSuccess(...a),
  error: (...a) => mockError(...a),
  warning: (...a) => mockWarning(...a),
}));

/* ---------------- Stub binary assets (MP3s) so require() doesn't explode --- */
jest.mock("../../assets/music/quiz-bgm.mp3", () => 1, { virtual: true });
jest.mock("../../assets/music/correct.mp3", () => 1, { virtual: true });
jest.mock("../../assets/music/incorrect.mp3", () => 1, { virtual: true });

/* ---------------- Stop badges dynamic import warning ---------------- */
jest.mock("../../utils/badgesLogic", () => ({
  __esModule: true,
  checkAndAwardBadges: jest.fn(async () => {}),
}));

/* ---------------- Expo-AV (Audio) ---------------- */
const mockPlaySpy = jest.fn(async () => {});
const mockPauseSpy = jest.fn(async () => {});
const mockStopSpy = jest.fn(async () => {});
const mockUnloadSpy = jest.fn(async () => {});
const mockReplaySpy = jest.fn(async () => {});
jest.mock("expo-av", () => {
  class Sound {
    async loadAsync() {}
    async setIsLoopingAsync() {}
    async setVolumeAsync() {}
    async playAsync() { return mockPlaySpy(); }
    async pauseAsync() { return mockPauseSpy(); }
    async stopAsync() { return mockStopSpy(); }
    async unloadAsync() { return mockUnloadSpy(); }
    async replayAsync() { return mockReplaySpy(); }
  }
  return { __esModule: true, Audio: { Sound } };
});

/* ---------------- Supabase ---------------- */
const mockInsertSpy = jest.fn(async () => ({ error: null }));
jest.mock("../../supabase", () => ({
  __esModule: true,
  supabase: {
    auth: {
      getUser: async () => ({
        data: { user: { id: "user-123" } },
        error: null,
      }),
    },
    from: () => ({ insert: mockInsertSpy }),
  },
}));

/* ---------------- Screen capture ---------------- */
let latestVm = null;
jest.mock("../../screens/QuizGameScreen", () => ({
  __esModule: true,
  default: ({ vm }) => {
    latestVm = vm;
    return null;
  },
}));

/* ---------------- SUT (import AFTER all mocks) ---------------- */
import { Animated, BackHandler } from "react-native";
import QuizGameContainer from "../../containers/QuizGameContainer";

/* ---------------- Patch after-import bits ---------------- */
beforeAll(() => {
  // Make Animated.timing "instant"
  jest.spyOn(Animated, "timing").mockImplementation((value, cfg) => ({
    start: (cb) => {
      if (typeof value.setValue === "function") value.setValue(cfg.toValue);
      cb && cb();
      return { stop: () => {} };
    },
    stop: () => {},
  }));
  // Simple back handler stubs
  BackHandler.addEventListener = jest.fn(() => ({ remove: jest.fn() }));
  BackHandler.removeEventListener = jest.fn();
});

/* ---------------- Helpers ---------------- */
async function flush(ms = 0) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}
beforeEach(() => {
  jest.clearAllMocks();
  latestVm = null;
});

/* =================================================================== */
/*                                TESTS                                */
/* =================================================================== */

it("builds a 1-question quiz from DB and shows core vm fields", async () => {
  render(<QuizGameContainer />);
  await flush(1);
  expect(latestVm).toBeTruthy();
  expect(latestVm.questionCount).toBe(1);
  expect(latestVm.current.q || latestVm.current.question).toBeDefined();
  expect(mockSetOptions).toHaveBeenCalledWith({ headerShown: false });
});

it("submits correct answer immediately → 100 XP and navigates with payload", async () => {
  render(<QuizGameContainer />);
  await flush(1);

  const correctIdx = latestVm.current.correctIndex;
  act(() => latestVm.setSelectedIndex(correctIdx));

  await act(async () => {
    await latestVm.onSubmit();
  });

  await act(async () => {
    await latestVm.goNext();
  });

  expect(mockSuccess).toHaveBeenCalled();
  const navArgs = mockNavigate.mock.calls[0][1];
  expect(navArgs.xp).toBe(100);
  expect(navArgs.scorePercent).toBe(100);
  expect(mockInsertSpy).toHaveBeenCalled();
});

it("hint halves XP: correct with hint gives ~50 XP", async () => {
  render(<QuizGameContainer />);
  await flush(1);

  act(() => latestVm.handleHint());
  const correctIdx = latestVm.current.correctIndex;
  act(() => latestVm.setSelectedIndex(correctIdx));

  await act(async () => {
    await latestVm.onSubmit();
  });
  await act(async () => {
    await latestVm.goNext();
  });

  const navArgs = mockNavigate.mock.calls[0][1];
  expect(navArgs.xp).toBe(50);
});

it("times out with no answer → 0 XP, auto-submits", async () => {
  render(<QuizGameContainer />);
  await flush(1);

  await flush(31_000); // 30s timer + 1s buffer

  await act(async () => {
    await latestVm.goNext();
  });

  const navArgs = mockNavigate.mock.calls[0][1];
  expect(navArgs.xp).toBe(0);
  expect(navArgs.scorePercent).toBe(0);
  expect(mockWarning).toHaveBeenCalled();
});

it("BGM respects soundEnabled preference during focus", async () => {
  // sound ON
  mockSoundEnabled = jest.fn(() => true);
  render(<QuizGameContainer />);
  // let the async IIFE that loads/plays BGM settle
  await Promise.resolve();
  await flush(1);
  expect(mockPlaySpy).toHaveBeenCalled();

  // sound OFF (remount)
  mockSoundEnabled = jest.fn(() => false);
  render(<QuizGameContainer />);
  await Promise.resolve();
  await flush(1);
  expect(mockPauseSpy).toHaveBeenCalled();
});
