// utils/sirenAudio.js
import { Audio } from "expo-av";

let _sound = null;
let _loading = null;

export async function preloadSiren() {
  if (_sound) return _sound;
  if (_loading) return _loading;

  _loading = (async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require("../assets/siren.mp3"),
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

export async function stopSiren() {
  if (_sound) {
    try { await _sound.stopAsync(); } catch {}
  }
}
