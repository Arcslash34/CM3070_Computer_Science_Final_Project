// __tests__/unittest/sirenAudio.test.js

// ---- Mock expo-av at module scope ----
const mockSound = {
  setIsMutedAsync: jest.fn().mockResolvedValue(undefined),
  setVolumeAsync: jest.fn().mockResolvedValue(undefined),
  playAsync: jest.fn().mockResolvedValue(undefined),
  stopAsync: jest.fn().mockResolvedValue(undefined),
};

let createAsyncImpl = jest.fn(async () => ({ sound: mockSound }));

const mockAudio = {
  Audio: {
    Sound: {
      createAsync: (...args) => createAsyncImpl(...args),
    },
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
  },
};

jest.mock('expo-av', () => mockAudio);

// ---- Fresh-load the module under test each time to reset its internal state ----
function loadSirenModule() {
  jest.resetModules();

  // Mock the siren asset so Jest doesn't try to parse the real MP3
  // NOTE: path is relative to THIS test file, matching sirenAudio's "../assets/siren.mp3"
  jest.doMock('../../assets/siren.mp3', () => 1, { virtual: true });

  return require('../../utils/sirenAudio');
}

beforeEach(() => {
  // reset mocks & default implementation
  jest.clearAllMocks();
  createAsyncImpl.mockReset().mockImplementation(async () => ({ sound: mockSound }));
  mockSound.setIsMutedAsync.mockClear();
  mockSound.setVolumeAsync.mockClear();
  mockSound.playAsync.mockClear();
  mockSound.stopAsync.mockClear();
  mockAudio.Audio.setAudioModeAsync.mockClear();
});

describe('sirenAudio', () => {
  test('preloadSiren creates and caches the sound (no duplicates)', async () => {
    const { preloadSiren } = loadSirenModule();

    // First load -> creates sound
    const s1 = await preloadSiren();
    expect(createAsyncImpl).toHaveBeenCalledTimes(1);
    expect(s1).toBe(mockSound);

    // Second load -> uses cached sound (no new create)
    const s2 = await preloadSiren();
    expect(createAsyncImpl).toHaveBeenCalledTimes(1);
    expect(s2).toBe(mockSound);
  });

  test('preloadSiren dedupes concurrent loads', async () => {
    const { preloadSiren } = loadSirenModule();

    // Simulate a slow createAsync to test in-flight dedupe
    let resolveCreate;
    createAsyncImpl.mockImplementation(
      () =>
        new Promise((res) => {
          resolveCreate = () => res({ sound: mockSound });
        })
    );

    const p1 = preloadSiren();
    const p2 = preloadSiren();
    const p3 = preloadSiren();

    // Still only one create call in-flight
    expect(createAsyncImpl).toHaveBeenCalledTimes(1);

    // Resolve creation
    resolveCreate();
    const [s1, s2, s3] = await Promise.all([p1, p2, p3]);
    expect(s1).toBe(mockSound);
    expect(s2).toBe(mockSound);
    expect(s3).toBe(mockSound);

    // Subsequent call after resolution uses cache; no new create
    await preloadSiren();
    expect(createAsyncImpl).toHaveBeenCalledTimes(1);
  });

  test('playSiren sets audio mode, unmutes, sets volume, and plays', async () => {
    const { playSiren } = loadSirenModule();

    await playSiren();

    // preload must have happened
    expect(createAsyncImpl).toHaveBeenCalledTimes(1);

    // Audio mode set with expected options
    expect(mockAudio.Audio.setAudioModeAsync).toHaveBeenCalledWith({
      playsInSilentModeIOS: true,
      allowsRecordingIOS: false,
      staysActiveInBackground: true,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    });

    // sound controls invoked
    expect(mockSound.setIsMutedAsync).toHaveBeenCalledWith(false);
    expect(mockSound.setVolumeAsync).toHaveBeenCalledWith(1.0);
    expect(mockSound.playAsync).toHaveBeenCalled();
  });

  test('stopSiren is safe when no sound has been loaded', async () => {
    const { stopSiren } = loadSirenModule();
    await expect(stopSiren()).resolves.toBeUndefined();
    expect(mockSound.stopAsync).not.toHaveBeenCalled();
  });

  test('stopSiren stops when a sound exists', async () => {
    const { preloadSiren, stopSiren } = loadSirenModule();

    await preloadSiren(); // ensures mockSound is cached inside the module
    await stopSiren();

    expect(mockSound.stopAsync).toHaveBeenCalled();
  });
});
