// __tests__/comptest/SettingsContainer.test.js
import React from "react";
import { render, act } from "@testing-library/react-native";

/* ---------------- Fake timers ---------------- */
jest.useFakeTimers();

/* ---------------- Safe area ---------------- */
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

/* ---------------- Navigation ---------------- */
const mockSetOptions = jest.fn();
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock("@react-navigation/native", () => ({
  __esModule: true,
  useNavigation: () => ({
    setOptions: mockSetOptions,
    navigate: mockNavigate,
    goBack: mockGoBack,
  }),
}));

/* ---------------- Language ctx + i18n ---------------- */
jest.mock("../../translations/language", () => {
  const React = require("react");
  return {
    __esModule: true,
    LanguageContext: React.createContext({ lang: "en", setLang: jest.fn() }),
  };
});
jest.mock("../../translations/translation", () => ({
  __esModule: true,
  t: (k, opts) => (opts && opts.defaultValue) || k,
}));

/* ---------------- Assets ---------------- */
jest.mock("../../assets/profile.png", () => 1, { virtual: true });
jest.mock("../../assets/logo1.png", () => 1, { virtual: true });

/* ---------------- AsyncStorage ---------------- */
const mockGetItem = jest.fn(async () => null);
const mockSetItem = jest.fn(async () => {});
const mockClear = jest.fn(async () => {});
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (...a) => mockGetItem(...a),
    setItem: (...a) => mockSetItem(...a),
    clear: (...a) => mockClear(...a),
  },
}));

/* ---------------- AppPrefs ---------------- */
const mockSetNotificationsEnabled = jest.fn();
const mockSetSoundEnabled = jest.fn();
const mockSetVibrationEnabled = jest.fn();
jest.mock("../../utils/appPrefs", () => ({
  __esModule: true,
  setNotificationsEnabled: (...a) => mockSetNotificationsEnabled(...a),
  setSoundEnabled: (...a) => mockSetSoundEnabled(...a),
  setVibrationEnabled: (...a) => mockSetVibrationEnabled(...a),
}));

/* ---------------- ImagePicker ---------------- */
const mockRequestMediaPerms = jest.fn(async () => ({ granted: true, status: "granted" }));
const mockLaunchImageLib = jest.fn(async () => ({
  canceled: false,
  assets: [{ uri: "file:///tmp/avatar.jpg" }],
}));
const mockRequestCameraPerms = jest.fn(async () => ({ status: "granted" }));
const mockLaunchCamera = jest.fn(async () => ({ canceled: true }));
jest.mock("expo-image-picker", () => ({
  __esModule: true,
  requestMediaLibraryPermissionsAsync: (...a) => mockRequestMediaPerms(...a),
  requestCameraPermissionsAsync: (...a) => mockRequestCameraPerms(...a),
  launchImageLibraryAsync: (...a) => mockLaunchImageLib(...a),
  launchCameraAsync: (...a) => mockLaunchCamera(...a),
  MediaTypeOptions: { Images: "Images" },
}));

/* ---------------- Location ---------------- */
const mockReqLocPerms = jest.fn(async () => ({ status: "denied" }));
const mockGetPosition = jest.fn();
const mockReverseGeocode = jest.fn();
jest.mock("expo-location", () => ({
  __esModule: true,
  requestForegroundPermissionsAsync: (...a) => mockReqLocPerms(...a),
  getCurrentPositionAsync: (...a) => mockGetPosition(...a),
  reverseGeocodeAsync: (...a) => mockReverseGeocode(...a),
  Accuracy: { High: "High" },
}));

/* ---------------- RN partial stubs ---------------- */
import * as RN from "react-native";

jest.spyOn(RN.Alert, "alert").mockImplementation((_title, _msg, buttons) => {
  const destructive = buttons?.find?.((b) => b.style === "destructive");
  destructive?.onPress?.();
});
jest.spyOn(RN.Linking, "openURL").mockImplementation(jest.fn());
jest.spyOn(RN.Animated, "timing").mockImplementation((value, cfg) => ({
  start: (cb) => {
    if (typeof value.setValue === "function") value.setValue(cfg.toValue);
    cb && cb();
    return { stop: () => {} };
  },
  stop: () => {},
}));

/* ---------------- Supabase ---------------- */
const mockAuthGetSession = jest.fn(async () => ({
  data: { session: { access_token: "token-123", user: { id: "u1", email: "u@x.com" } } },
}));
const mockAuthOnChange = jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } }));
const mockAuthSignOut = jest.fn(async () => ({}));
const mockAuthUpdateUser = jest.fn(async () => ({ error: null }));

const mockFrom = jest.fn(() => ({
  select: () => ({ eq: () => ({ single: async () => ({ data: { id: "u1", name: "A", username: "a", avatar_url: "", region: "" } }) }) }),
  update: () => ({ eq: () => ({ error: null }) }),
  upsert: () => ({ onConflict: () => ({ error: null }) }),
  maybeSingle: () => ({ data: null }),
}));

const mockStorageFrom = jest.fn(() => ({
  getPublicUrl: () => ({ data: { publicUrl: "https://cdn.example/avatar.jpg" } }),
}));

jest.mock("../../supabase", () => ({
  __esModule: true,
  supabase: {
    auth: {
      getSession: (...a) => mockAuthGetSession(...a),
      onAuthStateChange: (...a) => mockAuthOnChange(...a),
      signOut: (...a) => mockAuthSignOut(...a),
      updateUser: (...a) => mockAuthUpdateUser(...a),
    },
    from: (...a) => mockFrom(...a),
    storage: { from: (...a) => mockStorageFrom(...a) },
  },
}));

/* ---------------- fetch (avatar upload) ---------------- */
global.fetch = jest.fn(async () => ({ ok: true, text: async () => "" }));

/* ---------------- Screen capture ---------------- */
let latestVm = null;
jest.mock("../../screens/SettingsScreen", () => ({
  __esModule: true,
  default: ({ vm }) => {
    latestVm = vm;
    return null;
  },
}));

/* ---------------- SUT ---------------- */
import SettingsContainer from "../../containers/SettingsContainer";

/* ---------------- Helpers ---------------- */
const flushMicrotasks = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  latestVm = null;
  mockGetItem.mockReset().mockImplementation(async (k) => {
    const map = {
      "settings:notifications": "1",
      "settings:sound": "1",
      "settings:vibration": "1",
      "settings:mock-location": "0",
      "settings:mock-disaster": "0",
      "settings:close-contacts": JSON.stringify([]),
    };
    return k in map ? map[k] : null;
  });
});

/* =================================================================== */
/*                                TESTS                                */
/* =================================================================== */

it("hides the native header and loads persisted toggles + contacts", async () => {
  render(<SettingsContainer />);
  await flushMicrotasks();

  expect(mockSetOptions).toHaveBeenCalledWith({ headerShown: false });
  expect(latestVm.notifications).toBe(true);
  expect(latestVm.sound).toBe(true);
  expect(latestVm.vibration).toBe(true);
  expect(latestVm.mockLocation).toBe(false);
  expect(latestVm.mockDisaster).toBe(false);
  expect(Array.isArray(latestVm.contacts)).toBe(true);
});

it("persists mock toggles to AsyncStorage and calls AppPrefs setters", async () => {
  render(<SettingsContainer />);
  await flushMicrotasks();

  await act(async () => {
    latestVm.setMockLocation(true);
    latestVm.setMockDisaster(true);
    latestVm.setNotifications(false);
    latestVm.setSound(false);
    latestVm.setVibration(false);
  });

  expect(mockSetItem).toHaveBeenCalledWith("settings:mock-location", "1");
  expect(mockSetItem).toHaveBeenCalledWith("settings:mock-disaster", "1");
  expect(mockSetNotificationsEnabled).toHaveBeenCalledWith(false);
  expect(mockSetSoundEnabled).toHaveBeenCalledWith(false);
  expect(mockSetVibrationEnabled).toHaveBeenCalledWith(false);
});

it("contacts CRUD saves to storage", async () => {
  render(<SettingsContainer />);
  await flushMicrotasks();

  // Fill the form first…
  await act(async () => {
    latestVm.setShowContacts(true);
    latestVm.openAddContact();
    latestVm.setCName("Alice");
    latestVm.setCRelation("Friend");
    latestVm.setCPhone("123");
  });
  // …then save in a separate tick so state is committed
  await act(async () => {
    latestVm.saveContact();
  });

  expect(mockSetItem).toHaveBeenCalledWith(
    "settings:close-contacts",
    expect.stringContaining("Alice")
  );

  const id = latestVm.contacts[0].id;

  // Edit
  await act(async () => {
    latestVm.openEditContact(latestVm.contacts[0]);
    latestVm.setCPhone("555");
  });
  await act(async () => latestVm.saveContact());
  expect(mockSetItem).toHaveBeenCalledWith(
    "settings:close-contacts",
    expect.stringContaining("555")
  );

  // Delete (Alert auto-confirms via spy)
  await act(async () => latestVm.deleteContact(id));
  await flushMicrotasks();
  expect(mockSetItem).toHaveBeenCalledWith(
    "settings:close-contacts",
    expect.stringContaining("[]")
  );
});

it("detectRegion → permission denied shows alert, no crash", async () => {
  mockReqLocPerms.mockResolvedValueOnce({ status: "denied" });

  render(<SettingsContainer />);
  await flushMicrotasks();

  await act(async () => {
    await latestVm.detectRegion();
  });
  await flushMicrotasks();

  expect(RN.Alert.alert).toHaveBeenCalled();
});

it("chooseFromGallery uploads avatar and updates profile", async () => {
  render(<SettingsContainer />);
  await flushMicrotasks();

  await act(async () => {
    await latestVm.chooseFromGallery();
  });

  expect(global.fetch).toHaveBeenCalled();
  expect(latestVm.avatarUrl).toBe("https://cdn.example/avatar.jpg");
});

it("onChangePassword calls supabase and closes modal", async () => {
  render(<SettingsContainer />);
  await flushMicrotasks();

  await act(async () => {
    latestVm.setShowPassword(true);
    latestVm.setNewPassword("newpass123");
  });

  await act(async () => {
    await latestVm.onChangePassword();
  });

  expect(mockAuthUpdateUser).toHaveBeenCalledWith({ password: "newpass123" });
});

it("onLogout signs out and clears AsyncStorage (alert auto-confirms)", async () => {
  render(<SettingsContainer />);
  await flushMicrotasks();

  await act(async () => latestVm.onLogout());
  await flushMicrotasks();

  expect(mockAuthSignOut).toHaveBeenCalled();
  expect(mockClear).toHaveBeenCalled();
});
