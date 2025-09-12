// __tests__/comptest/ResultSummaryContainer.test.js
import React from "react";
import { render } from "@testing-library/react-native";

/* ---------------- Navigation mocks ---------------- */
let mockNavigate = jest.fn();
let mockGoBack = jest.fn();
let mockCanGoBack = jest.fn(() => true);

/* ---- route params we can control per-test ---- */
let mockRouteParams = {};

jest.mock("@react-navigation/native", () => ({
  __esModule: true,
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    canGoBack: mockCanGoBack,
  }),
  useRoute: () => ({
    params: mockRouteParams, // IMPORTANT: use our mutable params
  }),
  useFocusEffect: (cb) => {
    const React = require("react");
    React.useEffect(() => {
      const cleanup = cb();
      return typeof cleanup === "function" ? cleanup : undefined;
    }, []);
  },
}));

/* ---------------- Translation mocks ---------------- */
jest.mock("../../translations/translation", () => ({
  __esModule: true,
  i18n: { locale: "en" },
  // Container uses defaultValue fallbacks; return those if provided
  t: (k, opts) => (opts && opts.defaultValue) || k,
}));

/* ---------------- Relocalization mocks ---------------- */
const mockBuildMap = jest.fn(() => ({ Q1: "localized Q1" }));
const mockRelocalize = jest.fn((row) => ({ ...row, q: "localized Q1" }));

jest.mock("../../utils/resultLocalization", () => ({
  __esModule: true,
  buildQuestionMap: () => mockBuildMap(),
  relocalizeReviewItem: (row, map) => mockRelocalize(row, map),
}));

/* ---------------- Screen mock ---------------- */
let latestVm = null;
jest.mock("../../screens/ResultSummaryScreen", () => ({
  __esModule: true,
  default: ({ vm }) => {
    latestVm = vm;
    return null;
  },
}));

/* ---------------- SUT ---------------- */
import ResultSummaryContainer from "../../containers/ResultSummaryContainer";

beforeEach(() => {
  jest.clearAllMocks();
  latestVm = null;
  mockRouteParams = {}; // reset per test
});

/* =================================================================== */
/*                                TESTS                                */
/* =================================================================== */

it("parses array reviewData", () => {
  mockRouteParams = { reviewData: [{ number: 1, question: "Q1" }] };
  render(<ResultSummaryContainer />);
  expect(latestVm.items.length).toBe(1);
  expect(mockRelocalize).toHaveBeenCalled();
});

it("parses JSON string reviewData", () => {
  mockRouteParams = { reviewData: JSON.stringify([{ number: 1, question: "Q1" }]) };
  render(<ResultSummaryContainer />);
  expect(latestVm.items.length).toBe(1);
});

it("parses review_data object", () => {
  mockRouteParams = { reviewData: { review_data: [{ number: 1, question: "Q1" }] } };
  render(<ResultSummaryContainer />);
  expect(latestVm.items.length).toBe(1);
});

it("falls back gracefully on invalid data", () => {
  const spy = jest.spyOn(console, "warn").mockImplementation(() => {});
  render(<ResultSummaryContainer route={{ params: { reviewData: "{bad}" } }} />);
  expect(latestVm.items.length).toBe(0);
  spy.mockRestore();
});

it("navigates back smartly → Quizzes tab", () => {
  mockRouteParams = { backTo: { screen: "Quizzes" } };
  render(<ResultSummaryContainer />);
  latestVm.goBackSmart();
  expect(mockNavigate).toHaveBeenCalledWith("MainTabs", { screen: "Quizzes" });
});

it("navigates back smartly → Other screen", () => {
  mockRouteParams = { backTo: { screen: "Other" } };
  render(<ResultSummaryContainer />);
  latestVm.goBackSmart();
  expect(mockNavigate).toHaveBeenCalledWith("Other", {});
});

it("falls back to goBack when possible", () => {
  mockCanGoBack.mockReturnValue(true);
  mockRouteParams = {};
  render(<ResultSummaryContainer />);
  latestVm.goBackSmart();
  expect(mockGoBack).toHaveBeenCalled();
});

it("navigates to Quizzes tab if cannot go back", () => {
  mockCanGoBack.mockReturnValue(false);
  mockRouteParams = {};
  render(<ResultSummaryContainer />);
  latestVm.goBackSmart();
  expect(mockNavigate).toHaveBeenCalledWith("MainTabs", { screen: "Quizzes" });
});

it("computes headlines correctly from scorePercent", () => {
  const cases = [
    { scorePercent: 95, expected: "Outstanding!" },
    { scorePercent: 80, expected: "Great job!" },
    { scorePercent: 60, expected: "Nice effort — keep going!" },
    { scorePercent: 40, expected: "Don't give up — try again!" },
  ];
  for (const { scorePercent, expected } of cases) {
    mockRouteParams = {
      reviewData: [{ number: 1, question: "Q1" }], // ensure 'new data' path
      scorePercent,
    };
    render(<ResultSummaryContainer />);
    expect(latestVm.headline).toBe(expected);
  }
});
