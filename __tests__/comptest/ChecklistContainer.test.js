// __tests__/comptest/ChecklistContainer.test.js
import React from "react";
import { render, act } from "@testing-library/react-native";

jest.useFakeTimers();

/* ---------- Navigation ---------- */
const mockGoBack = jest.fn();
jest.mock("@react-navigation/native", () => ({
  __esModule: true,
  useNavigation: () => ({ goBack: mockGoBack }),
}));

/* ---------- AsyncStorage (prefix with mock*) ---------- */
const mockGetItem = jest.fn(async () => null);
const mockSetItem = jest.fn(async () => {});
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (...a) => mockGetItem(...a),
    setItem: (...a) => mockSetItem(...a),
  },
}));

/* ---------- Animated.timing → instant ---------- */
import { Animated } from "react-native";
jest.spyOn(Animated, "timing").mockImplementation((value, cfg) => ({
  start: (cb) => {
    if (typeof value.setValue === "function") value.setValue(cfg.toValue);
    cb && cb();
    return { stop: () => {} };
  },
  stop: () => {},
}));

/* ---------- Language + translations ---------- */
jest.mock("../../translations/language", () => {
  const React = require("react");
  return {
    __esModule: true,
    LanguageContext: React.createContext({ lang: "en" }),
  };
});

const FIX = {
  categories: [
    {
      id: "home",
      title: "Home",
      subcategories: [
        {
          id: "water",
          title: "Water",
          items: [
            { id: "water-1", label: "Store water", desc: "3L per person/day" },
            { id: "water-2", label: "Rotate stock", desc: "every 6 months" },
          ],
        },
        {
          id: "food",
          title: "Food",
          items: [{ id: "food-1", label: "Canned food", desc: "check expiry" }],
        },
      ],
    },
    {
      id: "go-bag",
      title: "Go Bag",
      subcategories: [
        {
          id: "bag-core",
          title: "Core",
          items: [
            { id: "bag-1", label: "Torch", desc: "with batteries" },
            { id: "bag-2", label: "First aid", desc: "compact kit" },
          ],
        },
      ],
    },
  ],
};

const mockSetLocale = jest.fn();
const mockT = jest.fn((k) => k);
const mockGetChecklistData = jest.fn(() => FIX);

jest.mock("../../translations/translation", () => ({
  __esModule: true,
  t: (...a) => mockT(...a),
  setLocale: (...a) => mockSetLocale(...a),
  getChecklistData: () => mockGetChecklistData(),
}));

/* ---------- AppPrefs ---------- */
const mockSelection = jest.fn();
const mockImpact = jest.fn();
const mockSuccess = jest.fn();
jest.mock("../../utils/appPrefs", () => ({
  __esModule: true,
  selection: (...a) => mockSelection(...a),
  impact: (...a) => mockImpact(...a),
  success: (...a) => mockSuccess(...a),
}));

/* ---------- Screen capture ---------- */
let latestVm = null;
jest.mock("../../screens/ChecklistScreen", () => ({
  __esModule: true,
  default: ({ vm }) => {
    latestVm = vm;
    return null;
  },
}));

/* ---------- SUT ---------- */
import ChecklistContainer from "../../containers/ChecklistContainer";

/* ---------- Helpers ---------- */
const flushTimers = async (ms = 0) =>
  act(() => {
    jest.advanceTimersByTime(ms);
  });

// Flush pending microtasks (e.g., AsyncStorage promise -> setState)
const flushMicrotasks = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  latestVm = null;
  // IMPORTANT: set a persistent default, not "once"
  mockGetItem.mockResolvedValue(null);
});

/* =================================================================== */
/*                                TESTS                                */
/* =================================================================== */

it("builds dataset, computes progress, and toggles items", async () => {
  render(<ChecklistContainer />);
  await flushMicrotasks();

  expect(latestVm.categories.map((c) => c.id)).toEqual(["home", "go-bag"]);
  expect(latestVm.currentCategory.id).toBe("home");

  expect(latestVm.overallPercent).toBe(0);
  expect(latestVm.catTotal).toBe(3);
  expect(latestVm.catDone).toBe(0);

  await act(async () => {
    latestVm.toggle("water-1");
    latestVm.toggle("food-1");
  });
  expect(mockSelection).toHaveBeenCalled();
  expect(latestVm.catDone).toBe(2);
  expect(latestVm.catPercent).toBe(67);

  await act(async () => latestVm.toggle("water-2"));
  expect(latestVm.catPercent).toBe(100);
  expect(latestVm.showCongrats).toBe(true);
  expect(mockSuccess).toHaveBeenCalled();
});

it("filters by free-text and reports catHasMatches", async () => {
  render(<ChecklistContainer />);
  await flushMicrotasks();

  await act(async () => latestVm.setQuery("rotate"));
  expect(latestVm.catHasMatches).toBe(true);

  await act(async () => latestVm.setQuery("zzz-not-there"));
  expect(latestVm.catHasMatches).toBe(false);

  await act(async () => latestVm.setQuery(""));
  expect(latestVm.catHasMatches).toBe(true);
});

it("resetCurrentCategory clears only current category checks", async () => {
  render(<ChecklistContainer />);
  await flushMicrotasks();

  await act(async () => {
    latestVm.toggle("water-1");
    latestVm.setSelectedCatId("go-bag");
  });
  await act(async () => latestVm.toggle("bag-1"));

  await act(async () => latestVm.resetCurrentCategory());
  expect(mockImpact).toHaveBeenCalled();

  expect(latestVm.checked["bag-1"]).toBeFalsy();
  expect(latestVm.checked["water-1"]).toBeTruthy();
});

it("persists checked state (load + save)", async () => {
  // Override the *first* call specifically for this test
  mockGetItem.mockResolvedValueOnce(
    JSON.stringify({ checked: { "water-2": true } })
  );

  render(<ChecklistContainer />);
  // let the AsyncStorage load and setState settle
  await flushMicrotasks();
  await flushTimers(1);

  expect(latestVm.checked["water-2"]).toBe(true);

  await act(async () => latestVm.toggle("food-1"));
  expect(mockSetItem).toHaveBeenCalled();
});

it("calls goBack from vm.onBack", async () => {
  render(<ChecklistContainer />);
  await flushMicrotasks();
  act(() => latestVm.onBack());
  expect(mockGoBack).toHaveBeenCalled();
});
