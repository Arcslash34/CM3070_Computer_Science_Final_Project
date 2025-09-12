// __tests__/integration/ResourceHubFlow.test.js

// Silence only the "overlapping act()" warning while keeping other errors
const originalConsoleError = console.error;
beforeAll(() => {
  jest.spyOn(console, "error").mockImplementation((...args) => {
    const first = args[0];
    if (typeof first === "string" && first.includes("overlapping act()")) return;
    originalConsoleError(...args);
  });
});
afterAll(() => {
  console.error.mockRestore();
});

import React from "react";
import { render, fireEvent, waitFor, cleanup } from "@testing-library/react-native";

/* -------------------- Navigation mock (no real navigator needed) -------------------- */
// Shared mutable nav state (prefix with "mock" so Jest allows closure access)
const mockNavState = { route: "ResourceHub", params: null };

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    setOptions: jest.fn(),
    navigate: (name, params) => {
      mockNavState.route = name;
      mockNavState.params = params;
    },
    goBack: () => {
      mockNavState.route = "ResourceHub";
    },
  }),
  useRoute: () => ({ params: mockNavState.params }),
}));

/* -------------------------------- Other mocks -------------------------------- */

// Safe-area
jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  return {
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    SafeAreaProvider: ({ children }) => <>{children}</>,
    initialWindowMetrics: { insets: { top: 0, bottom: 0, left: 0, right: 0 } },
  };
});

// i18n
jest.mock("../../translations/translation", () => ({
  t: (key, opts) => {
    if (key === "resourceHub.all") return "All";
    if (key === "resourceHub.allTopics") return "All Topics";
    if (key === "resourceHub.guide") return "guide";
    if (key === "resourceHub.guides") return "guides";
    if (key === "resourceHub.matching") return `matching ${opts?.q}`;
    if (key === "resources") {
      return {
        flooding:     { id: "flooding",     title: "Flood Safety", category: "Flooding", tags: ["rain"] },
        "fire-safety": { id: "fire-safety", title: "Fire Safety",  category: "Fire",     tags: ["heat"] },
      };
    }
    return key;
  },
}));

jest.mock("../../translations/language", () => {
  const React = require("react");
  const ctx = React.createContext({ lang: "en", setLang: jest.fn() });
  return {
    LanguageContext: ctx,
    LanguageProvider: ({ children }) => <ctx.Provider value={{ lang: "en" }}>{children}</ctx.Provider>,
  };
});

// Screens (simple harnesses)
jest.mock("../../screens/ResourceHubScreen", () => {
  const React = require("react");
  const { Text, View, TouchableOpacity, TextInput } = require("react-native");
  function ResourceHubScreen({ vm }) {
    return (
      <View>
        <Text testID="header">{vm.headerText}</Text>
        <TextInput testID="search-input" value={vm.query} onChangeText={vm.setQuery} />
        {vm.items.map((item) => (
          <TouchableOpacity
            key={item.id}
            testID={`article-${item.id}`}
            onPress={() => vm.openArticle(item)}
          >
            <Text>{item.title}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }
  return { __esModule: true, default: ResourceHubScreen };
});

jest.mock("../../screens/ResourceArticleScreen", () => {
  const React = require("react");
  const { Text, View, TouchableOpacity } = require("react-native");
  function ResourceArticleScreen({ vm }) {
    return (
      <View>
        <Text testID="article-title">{vm.article.title}</Text>
        <TouchableOpacity testID="back-btn" onPress={vm.onBack}>
          <Text>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }
  return { __esModule: true, default: ResourceArticleScreen };
});

// Static assets that might be imported by containers
jest.mock("../../assets/profile.png", () => 1, { virtual: true });
jest.mock("../../assets/logo1.png", () => 1, { virtual: true });

/* ------------------------------- Imports after mocks ------------------------------- */
import ResourceHubContainer from "../../containers/ResourceHubContainer";
import ResourceArticleContainer from "../../containers/ResourceArticleContainer";

/* ------------------------------------- Test ------------------------------------- */
describe("ResourceHub → Article → back flow", () => {
  afterEach(cleanup);

  it("applies filter, opens article, and back restores state", async () => {
    // Keep the hub mounted the whole time to preserve its state
    const hub = render(<ResourceHubContainer />);

    // Initially shows 2 guides
    await waitFor(() => {
      expect(hub.getByTestId("header").props.children).toContain("2 guides");
    });

    // Filter for "fire"
    fireEvent.changeText(hub.getByTestId("search-input"), "fire");

    await waitFor(() => {
      expect(hub.getByTestId("header").props.children).toContain("1 guide • matching fire");
      expect(hub.getByTestId("article-fire-safety")).toBeTruthy();
      expect(hub.queryByTestId("article-flooding")).toBeNull();
    });

    // Open the article (this will set mockNavState.params)
    fireEvent.press(hub.getByTestId("article-fire-safety"));

    // Render the article view using the params captured by the mocked navigator
    const article = render(<ResourceArticleContainer />);

    await waitFor(() => {
      expect(article.getByTestId("article-title").props.children).toBe("Fire Safety");
    });

    // Back to hub
    fireEvent.press(article.getByTestId("back-btn"));
    article.unmount();

    // Hub remains filtered exactly as before
    await waitFor(() => {
      expect(hub.getByTestId("header").props.children).toContain("1 guide • matching fire");
      expect(hub.getByTestId("article-fire-safety")).toBeTruthy();
      expect(hub.queryByTestId("article-flooding")).toBeNull();
    });
  });
});
