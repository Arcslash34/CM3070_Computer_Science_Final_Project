// __tests__/comptest/InteractiveMapModalContainer.test.js

import React from "react";
import { render, act, waitFor } from "@testing-library/react-native";

// ---- Fake timers (for any tiny queued tasks)
jest.useFakeTimers();

// ---- Translation helper: return key directly to avoid i18n complexity
jest.mock("../../translations/translation", () => ({
  t: (k) => k,
}));

// ---- Stub buildLeafletHtml: record args and return a minimal HTML shell
const mockBuildHtml = jest.fn(() => "<html>stub</html>");
jest.mock("../../utils/buildLeafletHtml", () => ({
  buildLeafletHtml: (...a) => mockBuildHtml(...a),
}));

// ---- Capture props passed to the screen
let latestProps = null;
jest.mock("../../screens/InteractiveMapModalScreen", () => ({
  __esModule: true,
  default: (props) => {
    latestProps = props;
    return null; // shallow screen stub
  },
}));

// mock WebView to avoid importing ESM from node_modules
jest.mock("react-native-webview", () => ({
  __esModule: true,
  WebView: () => null, // we only pass the ref through; we don't render it
}));

// ---- SUT + Language ctx
import InteractiveMapModalContainer from "../../containers/InteractiveMapModalContainer";
import { LanguageContext } from "../../translations/language";

// ---- Helpers
const flush = async () => {
  await act(async () => { await Promise.resolve(); });
};

describe("InteractiveMapModalContainer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    latestProps = null;
  });

  const wrap = (ui, { lang = "en" } = {}) => (
    <LanguageContext.Provider value={{ lang }}>
      {ui}
    </LanguageContext.Provider>
  );

  it("builds HTML on open and marks ready when datasets have content", async () => {
    const datasets = {
      rain: { stations: [{ name: "S1", location: { latitude: 1.33, longitude: 103.75 }, rainfall: 5 }] },
      pm25: [],
      wind: [],
      temp: [],
      humidity: [],
    };
    const userCoords = { latitude: 1.31, longitude: 103.77 };

    render(
      wrap(
        <InteractiveMapModalContainer
          visible={true}
          onClose={jest.fn()}
          userCoords={userCoords}
          datasets={datasets}
        />
      )
    );
    await flush();

    // HTML built with provided args
    expect(mockBuildHtml).toHaveBeenCalled();
    const args = mockBuildHtml.mock.calls[0][0];
    expect(args.userCoords).toEqual(userCoords);
    expect(args.datasets).toBe(datasets);
    expect(args.labels).toBeTruthy();

    // Screen receives html + ready=true
    expect(latestProps.html).toContain("stub");
    expect(latestProps.ready).toBe(true);

    // WebView is keyed with open sequence + coords
    expect(String(latestProps.webviewKey)).toMatch(/^map-open-\d+-1\.31-103\.77$/);
  });

  it("injects JS to toggle layer after WebView reports ready", async () => {
    const datasets = { rain: { stations: [{ name: "S1", location: { latitude: 1.33, longitude: 103.75 }, rainfall: 5 }] } };

    render(
      wrap(
        <InteractiveMapModalContainer
          visible={true}
          onClose={jest.fn()}
          userCoords={{ latitude: 1.33, longitude: 103.75 }}
          datasets={datasets}
        />
      )
    );
    await flush();

    // Provide a fake WebView instance for injection
    const inject = jest.fn();
    latestProps.webviewRef.current = { injectJavaScript: inject };

    // Signal the WebView finished loading
    act(() => {
      latestProps.onWVLoadEnd();
    });

    // Switch layer -> container should inject JavaScript
    act(() => {
      latestProps.setActiveLayer("pm25");
    });

    await flush();

    expect(inject).toHaveBeenCalled();
    const js = inject.mock.calls.at(-1)[0];
    expect(js).toContain("window.updateLayer");
    expect(js).toContain("pm25");
  });

  it("forces a fresh WebView mount per open, and also on language change", async () => {
    const datasets = { pm25: [{ location: { latitude: 1.34, longitude: 103.7 }, value: 20 }] };

    const { rerender } = render(
      wrap(
        <InteractiveMapModalContainer
          visible={false}
          onClose={jest.fn()}
          userCoords={{ latitude: 1.40, longitude: 103.85 }}
          datasets={datasets}
        />,
        { lang: "en" }
      )
    );
    await flush();

    // Open #1
    rerender(
      wrap(
        <InteractiveMapModalContainer
          visible={true}
          onClose={jest.fn()}
          userCoords={{ latitude: 1.40, longitude: 103.85 }}
          datasets={datasets}
        />,
        { lang: "en" }
      )
    );
    await flush();

    const key1 = latestProps.webviewKey;
    expect(key1).toMatch(/^map-open-\d+-1\.40-103\.85$/);

    // Close + reopen -> key must change
    rerender(
      wrap(
        <InteractiveMapModalContainer
          visible={false}
          onClose={jest.fn()}
          userCoords={{ latitude: 1.40, longitude: 103.85 }}
          datasets={datasets}
        />,
        { lang: "en" }
      )
    );
    await flush();

    rerender(
      wrap(
        <InteractiveMapModalContainer
          visible={true}
          onClose={jest.fn()}
          userCoords={{ latitude: 1.40, longitude: 103.85 }}
          datasets={datasets}
        />,
        { lang: "en" }
      )
    );
    await flush();

    const key2 = latestProps.webviewKey;
    expect(key2).not.toBe(key1);

    // Language change while open -> rebuilds & key changes again
    rerender(
      wrap(
        <InteractiveMapModalContainer
          visible={true}
          onClose={jest.fn()}
          userCoords={{ latitude: 1.40, longitude: 103.85 }}
          datasets={datasets}
        />,
        { lang: "zh" }
      )
    );
    await flush();

    const key3 = latestProps.webviewKey;
    expect(key3).not.toBe(key2);
    expect(mockBuildHtml).toHaveBeenCalledTimes(3); // open1, open2, lang change
  });

  it("marks not ready when all datasets are empty", async () => {
    render(
      wrap(
        <InteractiveMapModalContainer
          visible={true}
          onClose={jest.fn()}
          userCoords={{ latitude: 1.35, longitude: 103.82 }}
          datasets={{ rain: { stations: [] }, pm25: [], wind: [], temp: [], humidity: [] }}
        />
      )
    );
    await flush();

    expect(latestProps.ready).toBe(false);
    expect(latestProps.html).toContain("stub"); // HTML still built
  });
});
