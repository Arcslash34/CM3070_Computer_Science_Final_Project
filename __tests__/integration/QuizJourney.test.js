// __tests__/integration/QuizJourney.test.js

/**
 * Integration: Quizzes -> QuizSet -> QuizGame -> ResultSummary (+ Daily, Timer, History)
 */

import React from "react";
import { Text, View, Pressable } from "react-native";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";

// Quiet expected warnings from dynamic import & audio init during tests
const originalWarn = console.warn;
beforeAll(() => {
  jest.spyOn(console, "warn").mockImplementation((...args) => {
    const msg = String(args[0] ?? "");
    if (
      msg.includes("Badge awarding failed") ||
      msg.includes("Quiz audio init error")
    ) {
      return; // suppress these known benign warnings in tests
    }
    originalWarn(...args);
  });
});

afterAll(() => {
  console.warn.mockRestore();
});

// Stub RN's Animated helper (path varies by RN versions)
jest.mock(
  "react-native/Libraries/Animated/NativeAnimatedHelper",
  () => ({}),
  { virtual: true }
);

// (Optional but often helpful in RN test envs)
jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));

// Use fake timers
jest.useFakeTimers();

// ---------------------------------------------------------------------------
// Silence/avoid asset + dynamic import warnings
// ---------------------------------------------------------------------------
// Mock MP3 asset modules so `require()` inside the container doesn't blow up.
jest.mock("../../assets/music/quiz-bgm.mp3", () => 1, { virtual: true });
jest.mock("../../assets/music/correct.mp3", () => 1, { virtual: true });
jest.mock("../../assets/music/incorrect.mp3", () => 1, { virtual: true });

// Mock badgesLogic to satisfy the dynamic import in QuizGameContainer.
jest.mock(
  "../../utils/badgesLogic",
  () => ({ checkAndAwardBadges: jest.fn().mockResolvedValue(undefined) }),
  { virtual: true }
);

// ---------------------------------------------------------------------------
// Minimal router mock: @react-navigation/native
// - Provides NavigationContainer, useNavigation, useRoute, useFocusEffect.
// - Uses an internal stack so navigate/goBack work.
// - Exposes a render-prop child to select which container to render.
// ---------------------------------------------------------------------------
jest.mock("@react-navigation/native", () => {
  const React = require("react");
  const Ctx = React.createContext(null);

  function NavigationContainer({ children, initialRouteName = "Quizzes" }) {
    const [stack, setStack] = React.useState([{ name: initialRouteName, params: {} }]);
    const route = stack[stack.length - 1];

    const navigation = {
      navigate: (name, params) => setStack((s) => [...s, { name, params: params || {} }]),
      goBack: () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)),
      setOptions: () => {},
      canGoBack: () => stack.length > 1,
    };

    const value = { route, navigation };
    return (
      <Ctx.Provider value={value}>
        {typeof children === "function" ? children(value) : children}
      </Ctx.Provider>
    );
  }

  const useNavigation = () => React.useContext(Ctx).navigation;
  const useRoute = () => React.useContext(Ctx).route;
  const useFocusEffect = (effect) => {
    React.useEffect(() => {
      const cleanup = effect();
      return cleanup;
    }, [effect]);
  };

  return { NavigationContainer, useNavigation, useRoute, useFocusEffect };
});

// ---------------------------------------------------------------------------
// Mocks: i18n / translation layer
// ---------------------------------------------------------------------------
jest.mock("../../translations/translation", () => {
  const i18n = { locale: "en" };
  const t = (key, opts = {}) => {
    const dict = {
      "quizzes.daily.title": "Daily Quiz",
      "quizSet.today": "Today",
      "quizSet.quiz": "Quiz",
      "quizGame.dailyTitle": "Daily Quiz",
      "quizGame.timesUp": "Time's up!",
      "quizGame.plusXp": `+${opts?.xp ?? 0} XP`,
      "quizGame.niceTry": "Nice try!",
      "quizGame.leaveTitle": "Leave quiz?",
      "quizGame.leaveMsg": "Are you sure?",
      "quizGame.stay": "Stay",
      "quizGame.leave": "Leave",
      "resultSummary.headlineOutstanding": "Outstanding!",
      "resultSummary.headlineGreat": "Great job!",
      "resultSummary.headlineNice": "Nice effort — keep going!",
      "resultSummary.headlineKeepTrying": "Don't give up — try again!",
      "common.cancel": "Cancel",
      "common.delete": "Delete",
    };
    return dict[key] ?? opts?.defaultValue ?? key;
  };
  return { i18n, t, setLocale: (loc) => (i18n.locale = loc) };
});

// enQuizzes (used for English fallback titles)
jest.mock(
  "../../translations/en/quizzes.json",
  () => ({ daily: { title: "Daily Quiz" } }),
  { virtual: true }
);

// ---------------------------------------------------------------------------
// Mocks: Safe Area
// ---------------------------------------------------------------------------
jest.mock("react-native-safe-area-context", () => {
  const RN = jest.requireActual("react-native");
  return {
    SafeAreaProvider: ({ children }) => <>{children}</>,
    SafeAreaView: RN.View,
    useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
  };
});

// ---------------------------------------------------------------------------
// Mocks: expo-av audio (no-ops)
// ---------------------------------------------------------------------------
jest.mock("expo-av", () => ({
  Audio: {
    Sound: class {
      async loadAsync() {}
      async setIsLoopingAsync() {}
      async setVolumeAsync() {}
      async playAsync() {}
      async pauseAsync() {}
      async stopAsync() {}
      async unloadAsync() {}
      async replayAsync() {}
    },
  },
}));

// ---------------------------------------------------------------------------
// Mocks: AppPrefs (haptics/sound flags)
// ---------------------------------------------------------------------------
jest.mock("../../utils/appPrefs", () => ({
  soundEnabled: () => false,
  success: () => {},
  warning: () => {},
  error: () => {},
}));

// ---------------------------------------------------------------------------
// Mocks: Supabase (auth + quiz_results table)
// IMPORTANT: use `mock*` prefix so Jest allows referencing it in the factory.
// ---------------------------------------------------------------------------
const mockInsert = jest.fn().mockResolvedValue({ data: null, error: null });
jest.mock("../../supabase", () => {
  const from = jest.fn(() => ({
    insert: mockInsert,
    select: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue({ data: [], error: null }),
  }));
  return {
    supabase: {
      auth: {
        getUser: jest
          .fn()
          .mockResolvedValue({ data: { user: { id: "user1" } }, error: null }),
        getSession: jest
          .fn()
          .mockResolvedValue({ session: { user: { id: "user1" } } }),
      },
      from,
    },
  };
});

// ---------------------------------------------------------------------------
// Mocks: quiz DB (deterministic tiny dataset)
// ---------------------------------------------------------------------------
jest.mock("../../utils/quizLoader", () => {
  const DB = {
    categories: [
      {
        id: "flood",
        title: "Flood Safety",
        sets: [
          {
            id: "flood-1",
            title: "Basics",
            questions: [
              {
                question: "Move to ____ ground during floods.",
                options: ["lower", "higher", "same"],
                answer: "higher",
                explanation: "You should seek higher ground.",
              },
              {
                question: "Avoid walking through ____ water.",
                options: ["standing", "clean", "tap"],
                answer: "standing",
                explanation: "Standing water can conceal hazards.",
              },
            ],
          },
        ],
      },
    ],
  };
  return { getQuiz: () => DB };
});

// ---------------------------------------------------------------------------
// Screen stubs
// ---------------------------------------------------------------------------
jest.mock("../../screens/QuizzesScreen", () => {
  const React = require("react");
  const { View, Text, Pressable } = require("react-native");
  const QuizzesScreen = ({ vm }) => (
    <View>
      <Text testID="quizzes-screen">Quizzes</Text>
      <Pressable testID="open-daily" onPress={vm.onOpenDaily}>
        <Text>Open Daily</Text>
      </Pressable>
      <Pressable testID="open-history" onPress={vm.onOpenHistory}>
        <Text>Open History</Text>
      </Pressable>
      {vm.topics.map((topic) => (
        <Pressable
          key={topic.id}
          testID={`topic-${topic.id}`}
          onPress={() => vm.onOpenTopic(topic)}
        >
          <Text>{topic.title}</Text>
        </Pressable>
      ))}
    </View>
  );
  return { __esModule: true, default: QuizzesScreen };
});

jest.mock("../../screens/QuizSetScreen", () => {
  const React = require("react");
  const { View, Text, Pressable } = require("react-native");
  const QuizSetScreen = ({ vm }) => (
    <View>
      <Text testID="quizset-screen">{vm.topicTitle}</Text>
      {vm.sets.map((s, i) => (
        <Pressable key={s.id} testID={`start-set-${i + 1}`} onPress={s.start}>
          <Text>Start {s.title}</Text>
        </Pressable>
      ))}
    </View>
  );
  return { __esModule: true, default: QuizSetScreen };
});

jest.mock("../../screens/QuizGameScreen", () => {
  const React = require("react");
  const { View, Text, Pressable } = require("react-native");
  const QuizGameScreen = ({ vm }) => {
    const q = vm.current;
    return (
      <View>
        <Text testID="quizgame-screen">Game</Text>
        {q ? (
          <>
            <Text testID="question">{q.q}</Text>
            {q.options.map((opt, idx) => (
              <Pressable
                key={idx}
                testID={`option-${idx}`}
                onPress={() => vm.setSelectedIndex(idx)}
              >
                <Text>{String(opt)}</Text>
              </Pressable>
            ))}
            <Pressable testID="submit" onPress={vm.onSubmit}>
              <Text>Submit</Text>
            </Pressable>
            <Pressable testID="next" onPress={vm.goNext}>
              <Text>Next</Text>
            </Pressable>
          </>
        ) : (
          <Text>Loading…</Text>
        )}
      </View>
    );
  };
  return { __esModule: true, default: QuizGameScreen };
});

jest.mock("../../screens/ResultSummaryScreen", () => {
  const React = require("react");
  const { View, Text } = require("react-native");
  const ResultSummaryScreen = ({ vm }) => (
    <View>
      <Text testID="result-screen">Result</Text>
      <Text>{vm.quizTitle}</Text>
      <Text>Score: {vm.headerScore}</Text>
      <Text>XP: {vm.xp}</Text>
    </View>
  );
  return { __esModule: true, default: ResultSummaryScreen };
});

jest.mock("../../screens/HistoryScreen", () => {
  const React = require("react");
  const { View, Text } = require("react-native");
  const HistoryScreen = ({ vm }) => (
    <View>
      <Text testID="history-screen">History</Text>
      <Text>Results: {vm.filtered?.length ?? 0}</Text>
    </View>
  );
  return { __esModule: true, default: HistoryScreen };
});

// ---------------------------------------------------------------------------
// Import containers after mocks
// ---------------------------------------------------------------------------
import QuizzesContainer from "../../containers/QuizzesContainer";
import QuizSetContainer from "../../containers/QuizSetContainer";
import QuizGameContainer from "../../containers/QuizGameContainer";
import ResultSummaryContainer from "../../containers/ResultSummaryContainer";
import HistoryContainer from "../../containers/HistoryContainer";

// ---------------------------------------------------------------------------
// Helper: Render app "stack" with our minimal router
// ---------------------------------------------------------------------------
import { NavigationContainer } from "@react-navigation/native";

function AppStack() {
  return (
    <NavigationContainer>
      {({ route }) => {
        switch (route.name) {
          case "Quizzes":
            return <QuizzesContainer />;
          case "QuizSet":
            return <QuizSetContainer />;
          case "QuizGame":
            return <QuizGameContainer />;
          case "ResultSummary":
            return <ResultSummaryContainer />;
          case "HistoryContainer":
            return <HistoryContainer />;
          default:
            return <QuizzesContainer />;
        }
      }}
    </NavigationContainer>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("QuizJourney integration", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("passes through Quizzes → Set → Game → Result and saves to history", async () => {
    const { getByTestId } = render(<AppStack />);

    // On Quizzes
    expect(getByTestId("quizzes-screen")).toBeTruthy();

    // Open a topic ("flood")
    act(() => {
      fireEvent.press(getByTestId("topic-flood"));
    });

    // On QuizSet
    await waitFor(() => getByTestId("quizset-screen"));
    act(() => {
      fireEvent.press(getByTestId("start-set-1"));
    });

    // On QuizGame
    await waitFor(() => getByTestId("quizgame-screen"));

    // Q1
    act(() => {
      fireEvent.press(getByTestId("option-0"));
    });
    act(() => {
      fireEvent.press(getByTestId("submit"));
    });
    act(() => {
      fireEvent.press(getByTestId("next"));
    });

    // Q2
    await waitFor(() => getByTestId("quizgame-screen"));
    act(() => {
      fireEvent.press(getByTestId("option-0"));
    });
    act(() => {
      fireEvent.press(getByTestId("submit"));
    });
    act(() => {
      fireEvent.press(getByTestId("next"));
    });

    // Result + Supabase save
    await waitFor(() => getByTestId("result-screen"));
    await waitFor(() => expect(mockInsert).toHaveBeenCalledTimes(1));

    // Flush timers
    act(() => {
      jest.runOnlyPendingTimers();
    });
  });

  it("Daily → Game → Result works (single set)", async () => {
    const { getByTestId } = render(<AppStack />);

    // Quizzes
    expect(getByTestId("quizzes-screen")).toBeTruthy();
    fireEvent.press(getByTestId("open-daily"));

    // Daily goes straight to QuizGame (no QuizSet)
    await waitFor(() => getByTestId("quizgame-screen"));

    // Q1
    fireEvent.press(getByTestId("option-0"));
    fireEvent.press(getByTestId("submit"));
    fireEvent.press(getByTestId("next"));

    // Q2 (finish)
    await waitFor(() => getByTestId("quizgame-screen"));
    fireEvent.press(getByTestId("option-0"));
    fireEvent.press(getByTestId("submit"));
    fireEvent.press(getByTestId("next"));

    // Result
    await waitFor(() => getByTestId("result-screen"));
  });

  it("auto-submits when timer expires", async () => {
    const { getByTestId } = render(<AppStack />);

    // Quizzes → topic
    fireEvent.press(getByTestId("topic-flood"));

    // QuizSet → start
    await waitFor(() => getByTestId("quizset-screen"));
    fireEvent.press(getByTestId("start-set-1"));

    // On QuizGame
    await waitFor(() => getByTestId("quizgame-screen"));

    // Don't pick an option; advance time beyond 30s
    act(() => {
      jest.advanceTimersByTime(31_000);
    });

    // Next should proceed even without manual submit
    fireEvent.press(getByTestId("next"));

    // On Q2 now
    await waitFor(() => getByTestId("quizgame-screen"));

    // Finish the second question quickly
    fireEvent.press(getByTestId("option-0"));
    fireEvent.press(getByTestId("submit"));
    fireEvent.press(getByTestId("next"));

    await waitFor(() => getByTestId("result-screen"));
  });

  it("opens History from Quizzes", async () => {
    const { getByTestId } = render(<AppStack />);

    // Quizzes
    expect(getByTestId("quizzes-screen")).toBeTruthy();

    // Open History
    fireEvent.press(getByTestId("open-history"));

    // History screen should render (mock returns 0 results by default)
    await waitFor(() => getByTestId("history-screen"));
  });
});
