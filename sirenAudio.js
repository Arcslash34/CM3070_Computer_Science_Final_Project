// sirenAudio.js
import { Audio } from 'expo-av';

let _sound = null;
let _loading = null;

/**
 * Preload the siren sound once. Safe to call multiple times.
 */
export async function preloadSiren() {
  if (_sound) return _sound;
  if (_loading) return _loading;

  _loading = (async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        // Ensure this path exists in your project
        require('./assets/siren.mp3'),
        { isLooping: true, shouldPlay: false }
      );
      _sound = sound;
      return _sound;
    } finally {
      _loading = null;
    }
  })();

  return _loading;
}

/**
 * Play the siren (in silent mode too).
 */
export async function playSiren() {
  await preloadSiren();

  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    allowsRecordingIOS: false,
    staysActiveInBackground: true,
    shouldDuckAndroid: false,
    playThroughEarpieceAndroid: false,
  });

  await _sound.setIsMutedAsync(false);
  await _sound.setVolumeAsync(1.0);
  await _sound.playAsync();
}

/**
 * Stop (but do not unload) so the next start is instant.
 */
export async function stopSiren() {
  if (_sound) {
    try {
      await _sound.stopAsync();
    } catch (e) {
      if (__DEV__) console.warn('[sirenAudio] stopAsync failed:', e);
    }
  }
}
