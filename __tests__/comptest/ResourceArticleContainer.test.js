// __tests__/comptest/ResourceArticleContainer.test.js
import React from "react";
import { render, act } from "@testing-library/react-native";

/* ---------- Safe area ---------- */
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 1, right: 2, bottom: 3, left: 4 }),
}));

/* ---------- Navigation (dynamic useRoute) ---------- */
const mockSetOptions = jest.fn();
const mockGoBack = jest.fn();

// IMPORTANT: name starts with "mock" so Jest allows it in the factory
let mockRouteState = {
  params: { article: { id: "flooding", title: "Flood Safety" } },
};
// Also wrap in a function (optional but tidy)
const mockUseRoute = () => mockRouteState;

jest.mock("@react-navigation/native", () => ({
  __esModule: true,
  useNavigation: () => ({ setOptions: mockSetOptions, goBack: mockGoBack }),
  useRoute: () => mockUseRoute(),
}));

/* ---------- Translation ---------- */
jest.mock("../../translations/translation", () => ({
  __esModule: true,
  t: (k) => k,
}));

/* ---------- Screen capture ---------- */
let latestVm = null;
jest.mock("../../screens/ResourceArticleScreen", () => ({
  __esModule: true,
  default: ({ vm }) => {
    latestVm = vm;
    return null;
  },
}));

/* ---------- SUT ---------- */
import ResourceArticleContainer from "../../containers/ResourceArticleContainer";

/* =================================================================== */
/*                                TESTS                                */
/* =================================================================== */

beforeEach(() => {
  jest.clearAllMocks();
  latestVm = null;
  mockRouteState = {
    params: { article: { id: "flooding", title: "Flood Safety" } },
  };
});

it("hides the native header and passes article param to screen", () => {
  render(<ResourceArticleContainer />);

  expect(mockSetOptions).toHaveBeenCalledWith({ headerShown: false });
  expect(latestVm.article).toEqual({ id: "flooding", title: "Flood Safety" });
  expect(latestVm.insets).toEqual({ top: 1, right: 2, bottom: 3, left: 4 });
  expect(typeof latestVm.onBack).toBe("function");
});

it("calls navigation.goBack() when onBack is invoked", () => {
  render(<ResourceArticleContainer />);
  act(() => latestVm.onBack());
  expect(mockGoBack).toHaveBeenCalled();
});

it("falls back to empty article when params are missing", () => {
  mockRouteState = {}; // simulate missing params
  render(<ResourceArticleContainer />);
  expect(latestVm.article).toEqual({});
});
