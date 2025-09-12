// __tests__/comptest/ResourceHubContainer.test.js
import React from "react";
import { render, act } from "@testing-library/react-native";

/* ---------- Safe area ---------- */
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

/* ---------- Navigation ---------- */
const mockSetOptions = jest.fn();
const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  __esModule: true,
  useNavigation: () => ({ setOptions: mockSetOptions, navigate: mockNavigate }),
}));

/* ---------- Language context ---------- */
jest.mock("../../translations/language", () => {
  const React = require("react");
  return {
    __esModule: true,
    LanguageContext: React.createContext({ lang: "en" }),
  };
});
import { LanguageContext } from "../../translations/language";

/* ---------- Translation ---------- */
jest.mock("../../translations/translation", () => {
  const RES_EN = {
    "cpr-aed-adult": {
      title: "Adult CPR & AED",
      category: "Cardiac",
      tags: ["CPR", "AED", "defibrillator"],
      body: "steps...",
    },
    "severe-bleeding": {
      title: "Stop Severe Bleeding",
      category: "Trauma",
      tags: ["bleeding", "tourniquet", "pressure"],
      body: "steps...",
    },
    flooding: {
      title: "Flood Safety Basics",
      category: "Flooding",
      tags: ["rain", "evacuate", "sandbags"],
      body: "steps...",
    },
    burns: {
      title: "Treat Burns Quickly",
      category: "Burns",
      tags: ["cool water", "first aid"],
      body: "steps...",
    },
  };
  const RES_TA = {
    ...RES_EN,
    flooding: { ...RES_EN.flooding, title: "வெள்ள பாதுகாப்பு வழிகாட்டி" },
  };

  function t(key, opts) {
    const lang = global.__TEST_LANG || "en";
    if (key === "resources" && opts?.returnObjects) {
      return lang === "ta" ? RES_TA : RES_EN;
    }
    if (key === "resourceHub.all") return lang === "ta" ? "அனைத்தும்" : "All";
    if (key === "resourceHub.guide") return lang === "ta" ? "வழிகாட்டி" : "guide";
    if (key === "resourceHub.guides") return lang === "ta" ? "வழிகாட்டிகள்" : "guides";
    if (key === "resourceHub.allTopics") return lang === "ta" ? "அனைத்து தலைப்புகள்" : "All topics";
    if (key === "resourceHub.matching") {
      const q = opts?.q ?? "";
      return lang === "ta" ? `“${q}” பொருந்தும்` : `matching “${q}”`;
    }
    return key;
  }

  return { __esModule: true, t };
});

/* ---------- Screen capture ---------- */
let latestVm = null;
jest.mock("../../screens/ResourceHubScreen", () => ({
  __esModule: true,
  default: ({ vm }) => {
    latestVm = vm;
    return null;
  },
}));

/* ---------- SUT ---------- */
import ResourceHubContainer from "../../containers/ResourceHubContainer";

/* ---------- Helpers ---------- */
let currentLang = "en";
const Provider = ({ children }) => {
  global.__TEST_LANG = currentLang;
  return (
    <LanguageContext.Provider value={{ lang: currentLang }}>
      {children}
    </LanguageContext.Provider>
  );
};

beforeEach(() => {
  jest.clearAllMocks();
  latestVm = null;
  currentLang = "en";
  global.__TEST_LANG = "en";
});

/* =================================================================== */
/*                                TESTS                                */
/* =================================================================== */

it("builds list & categories, hides header", () => {
  render(
    <Provider>
      <ResourceHubContainer />
    </Provider>
  );

  expect(mockSetOptions).toHaveBeenCalledWith({ headerShown: false });

  // categories: localized "All" first + unique categories
  expect(latestVm.CATEGORIES[0]).toBe("All");
  expect(new Set(latestVm.CATEGORIES.slice(1))).toEqual(
    new Set(["Cardiac", "Trauma", "Flooding", "Burns"])
  );

  // items contain all resources
  const ids = latestVm.items.map((x) => x.id).sort();
  expect(ids).toEqual(["burns", "cpr-aed-adult", "flooding", "severe-bleeding"].sort());
});

it("filters by category and free-text query; supports A→Z sorting", async () => {
  render(
    <Provider>
      <ResourceHubContainer />
    </Provider>
  );

  await act(async () => latestVm.setCategory("Trauma"));
  expect(latestVm.items.map((x) => x.id)).toEqual(["severe-bleeding"]);

  await act(async () => {
    latestVm.setCategory("All");
    latestVm.setQuery("rain");
  });
  expect(latestVm.items.map((x) => x.id)).toEqual(["flooding"]);

  await act(async () => {
    latestVm.setQuery("");
    latestVm.setCategory("All");
    latestVm.setSortAlpha(true);
  });
  const titles = latestVm.items.map((x) => x.title);
  const sorted = [...titles].sort((a, b) => a.localeCompare(b));
  expect(titles).toEqual(sorted);
});

it("header copy & accent color reflect state", async () => {
  render(
    <Provider>
      <ResourceHubContainer />
    </Provider>
  );

  // all topics
  expect(latestVm.headerText).toMatch(/^4 guides • All topics$/);
  expect(latestVm.headerAccent).toBe("#6B7280");

  // category
  await act(async () => latestVm.setCategory("Cardiac"));
  expect(latestVm.headerText).toMatch(/^1 guide • Cardiac$/);
  expect(latestVm.headerAccent).toBe("#B91C1C");

  // search
  await act(async () => {
    latestVm.setCategory("All");
    latestVm.setQuery("aed");
  });
  expect(latestVm.headerText).toBe("1 guide • matching “aed”");
});

it("navigates to ResourceArticle on openArticle", async () => {
  render(
    <Provider>
      <ResourceHubContainer />
    </Provider>
  );

  const item = latestVm.items.find((x) => x.id === "flooding");
  await act(async () => latestVm.openArticle(item));
  expect(mockNavigate).toHaveBeenCalledWith("ResourceArticle", { article: item });
});

it("reacts to language change (categories + titles)", async () => {
  const { rerender } = render(
    <Provider>
      <ResourceHubContainer />
    </Provider>
  );

  // switch language
  currentLang = "ta";
  rerender(
    <Provider>
      <ResourceHubContainer />
    </Provider>
  );

  // update selected category to new localized 'All'
  await act(async () => latestVm.setCategory("அனைத்தும்"));

  expect(latestVm.CATEGORIES[0]).toBe("அனைத்தும்");
  const flooding = latestVm.items.find((x) => x.id === "flooding");
  expect(flooding.title).toBe("வெள்ள பாதுகாப்பு வழிகாட்டி");
  expect(latestVm.headerText).toMatch(/^4 வழிகாட்டிகள் • அனைத்து தலைப்புகள்$/);
});
