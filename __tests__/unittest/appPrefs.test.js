// __tests__/unittest/appPrefs.test.js

function setup({
  platform = 'android',
  withNotificationsModule = true,
  storage = {}, // initial AsyncStorage values e.g. {'settings:notifications':'0'}
  perms = { status: 'granted', canAskAgain: false }, // existing permissions
  permsAfterReq = { status: 'granted' }, // result of requestPermissionsAsync
} = {}) {
  jest.resetModules();

  // ---- mock react-native Platform (mutable OS) ----
  let currentOS = platform;
  jest.doMock('react-native', () => ({
    Platform: {
      get OS() { return currentOS; },
      set OS(v) { currentOS = v; },
      select: (map) => map[currentOS],
    },
  }), { virtual: true });

  // ---- mock AsyncStorage (in-memory) ----
  const mem = new Map(Object.entries(storage));
  const AsyncStorageMock = {
    getItem: jest.fn((k) => Promise.resolve(mem.get(k) ?? null)),
    setItem: jest.fn((k, v) => Promise.resolve(mem.set(k, v))),
  };
  jest.doMock('@react-native-async-storage/async-storage', () => AsyncStorageMock);

  // ---- mock expo-haptics ----
  const HapticsMock = {
    selectionAsync: jest.fn().mockResolvedValue(undefined),
    impactAsync: jest.fn().mockResolvedValue(undefined),
    notificationAsync: jest.fn().mockResolvedValue(undefined),
    ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
    NotificationFeedbackType: { Success: 'Success', Warning: 'Warning', Error: 'Error' },
  };
  jest.doMock('expo-haptics', () => HapticsMock);

  // ---- mock (or omit) expo-notifications ----
  let NotificationsMock;
  if (withNotificationsModule) {
    NotificationsMock = {
      setNotificationHandler: jest.fn(),
      setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
      AndroidImportance: { HIGH: 'HIGH', DEFAULT: 'DEFAULT' },
      AndroidNotificationVisibility: { PUBLIC: 'PUBLIC' },
      getPermissionsAsync: jest.fn().mockResolvedValue(perms),
      requestPermissionsAsync: jest.fn().mockResolvedValue(permsAfterReq),
      presentNotificationAsync: jest.fn().mockResolvedValue(undefined),
    };
    jest.doMock('expo-notifications', () => NotificationsMock);
  } else {
    jest.doMock('expo-notifications', () => ({}), { virtual: true });
  }

  // ---- import SUT ----
  // NOTE: appPrefs does dynamic require('expo-notifications') inside a try/catch.
  const appPrefs = require('../../utils/appPrefs');

  return {
    ...appPrefs,
    mocks: {
      AsyncStorageMock,
      HapticsMock,
      NotificationsMock,
      setPlatform: (os) => { require('react-native').Platform.OS = os; },
      getPlatform: () => require('react-native').Platform.OS,
    },
  };
}

describe('appPrefs (unit)', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  test('init uses defaults when storage empty; configures Android channel; sets handler when module exists', async () => {
    const {
      init,
      notificationsEnabled, soundEnabled, vibrationEnabled,
      mocks: { NotificationsMock },
    } = setup({ platform: 'android', withNotificationsModule: true, storage: {} });

    await init();

    expect(notificationsEnabled()).toBe(true);
    expect(soundEnabled()).toBe(true);
    expect(vibrationEnabled()).toBe(true);

    // handler set (not on web)
    expect(NotificationsMock.setNotificationHandler).toHaveBeenCalled();

    // Android channel configured with HIGH importance, vibration pattern, and default sound
    expect(NotificationsMock.setNotificationChannelAsync).toHaveBeenCalledWith(
      'default',
      expect.objectContaining({
        name: 'Alerts',
        importance: 'HIGH',
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        lockscreenVisibility: 'PUBLIC',
        sound: 'default',
      })
    );
  });

  test('init reads saved flags from AsyncStorage and configures channel accordingly', async () => {
    const storage = {
      'settings:notifications': '0',
      'settings:sound': '0',
      'settings:vibration': '0',
    };
    const {
      init,
      notificationsEnabled, soundEnabled, vibrationEnabled,
      mocks: { NotificationsMock },
    } = setup({ platform: 'android', withNotificationsModule: true, storage });

    await init();

    expect(notificationsEnabled()).toBe(false);
    expect(soundEnabled()).toBe(false);
    expect(vibrationEnabled()).toBe(false);

    // With notifications=false → DEFAULT importance, no vibration, no sound
    expect(NotificationsMock.setNotificationChannelAsync).toHaveBeenCalledWith(
      'default',
      expect.objectContaining({
        importance: 'DEFAULT',
        vibrationPattern: [],
        sound: undefined,
      })
    );
  });

  test('setters persist values and reconfigure Android channel', async () => {
    const {
      init,
      setSoundEnabled, setVibrationEnabled, setNotificationsEnabled,
      mocks: { AsyncStorageMock, NotificationsMock },
    } = setup({ platform: 'android', withNotificationsModule: true });

    await init();

    await setSoundEnabled(false);
    expect(AsyncStorageMock.setItem).toHaveBeenCalledWith('settings:sound', '0');

    await setVibrationEnabled(false);
    expect(AsyncStorageMock.setItem).toHaveBeenCalledWith('settings:vibration', '0');

    await setNotificationsEnabled(false);
    expect(AsyncStorageMock.setItem).toHaveBeenCalledWith('settings:notifications', '0');

    // reconfigured channel after each setter; last call reflects latest state (all false)
    const lastCall = NotificationsMock.setNotificationChannelAsync.mock.calls.at(-1);
    expect(lastCall[1]).toEqual(expect.objectContaining({
      importance: 'DEFAULT',
      vibrationPattern: [],
      sound: undefined,
    }));
  });

  test('ensurePermissions: returns false when notifications disabled or module absent', async () => {
    // Disabled state
    let {
      init, setNotificationsEnabled, ensurePermissions,
      mocks: { NotificationsMock },
    } = setup({ platform: 'android', withNotificationsModule: true });

    await init();
    await setNotificationsEnabled(false);

    await expect(ensurePermissions()).resolves.toBe(false);
    expect(NotificationsMock.getPermissionsAsync).not.toHaveBeenCalled();

    // Module absent
    ({ init, ensurePermissions } = setup({ platform: 'android', withNotificationsModule: false }));
    await init();
    await expect(ensurePermissions()).resolves.toBe(false);
  });

  test('ensurePermissions: granted immediately, or after request when canAskAgain', async () => {
    // already granted
    let {
      init, ensurePermissions,
      mocks: { NotificationsMock },
    } = setup({
      platform: 'android',
      withNotificationsModule: true,
      perms: { status: 'granted', canAskAgain: false },
    });
    await init();
    await expect(ensurePermissions()).resolves.toBe(true);
    expect(NotificationsMock.getPermissionsAsync).toHaveBeenCalled();

    // need to request, then granted
    ({ init, ensurePermissions, mocks: { NotificationsMock } } = setup({
      platform: 'android',
      withNotificationsModule: true,
      perms: { status: 'denied', canAskAgain: true },
      permsAfterReq: { status: 'granted' },
    }));
    await init();
    await expect(ensurePermissions()).resolves.toBe(true);
    expect(NotificationsMock.requestPermissionsAsync).toHaveBeenCalled();
  });

  test('presentNotification respects platform, state, and sound flag', async () => {
    const {
      init, setSoundEnabled, presentNotification,
      mocks: { NotificationsMock, setPlatform },
    } = setup({ platform: 'android', withNotificationsModule: true });

    await init();

    // Web: no-op
    setPlatform('web');
    await presentNotification({ title: 'T', body: 'B', data: { x: 1 } });
    expect(NotificationsMock.presentNotificationAsync).not.toHaveBeenCalled();

    // Android with sound on
    setPlatform('android');
    await presentNotification({ title: 'Hello', body: 'World', data: { a: 1 } });
    expect(NotificationsMock.presentNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Hello', body: 'World', sound: 'default' })
    );

    // Android with sound off
    NotificationsMock.presentNotificationAsync.mockClear();
    await setSoundEnabled(false);
    await presentNotification({ title: 'Hi', body: 'There' });
    expect(NotificationsMock.presentNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Hi', body: 'There', sound: undefined })
    );
  });

  test('haptics only runs when not web and vibration enabled', async () => {
    const {
      init, setVibrationEnabled, selection, impact, success, warning, error,
      mocks: { HapticsMock, setPlatform },
    } = setup({ platform: 'android', withNotificationsModule: false });

    await init();

    // Initially vibration ON (default)
    await selection();
    await impact(HapticsMock.ImpactFeedbackStyle.Medium);
    await success();
    await warning();
    await error();
    expect(HapticsMock.selectionAsync).toHaveBeenCalled();
    expect(HapticsMock.impactAsync).toHaveBeenCalledWith('Medium');
    expect(HapticsMock.notificationAsync).toHaveBeenCalledTimes(3);

    // Turn OFF vibration -> no calls
    HapticsMock.selectionAsync.mockClear();
    HapticsMock.impactAsync.mockClear();
    HapticsMock.notificationAsync.mockClear();
    await setVibrationEnabled(false);
    await selection(); await impact(); await success(); await warning(); await error();
    expect(HapticsMock.selectionAsync).not.toHaveBeenCalled();
    expect(HapticsMock.impactAsync).not.toHaveBeenCalled();
    expect(HapticsMock.notificationAsync).not.toHaveBeenCalled();

    // On web -> no calls even if vibration ON
    await setVibrationEnabled(true);
    setPlatform('web');
    await selection(); await impact(); await success(); await warning(); await error();
    expect(HapticsMock.selectionAsync).not.toHaveBeenCalled();
  });
});
