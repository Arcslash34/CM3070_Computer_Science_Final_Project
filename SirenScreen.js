// SirenScreen.js
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Vibration,
  Platform,
  Alert,
  AppState,
  InteractionManager,
  Animated,
  Modal,
} from 'react-native';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useKeepAwake } from 'expo-keep-awake';
import { Ionicons } from '@expo/vector-icons';
import { playSiren, stopSiren } from './sirenAudio';
import { emergencyBus } from './emergencyBus';

export default function SirenScreen() {
  useKeepAwake();
  const navigation = useNavigation();
  const route = useRoute();
  const primed = !!route?.params?.primed;

  const [permission, requestPermission] = useCameraPermissions();
  const hasCameraPerm = !!permission?.granted;
  const [torchOn, setTorchOn] = useState(false);
  const [strobing, setStrobing] = useState(true);
  const cameraReadyRef = useRef(false);

  const timerRef = useRef(null);
  const phaseOnRef = useRef(false);
  const baseTsRef = useRef(0);
  const periodMsRef = useRef(0);
  const onMsRef = useRef(0);

  const [webReady, setWebReady] = useState(Platform.OS !== 'web');
  const volumeTipShownRef = useRef(false);

  // Full-window fade cover (in a Modal) + failsafe
  const cover = useRef(new Animated.Value(1)).current;
  const [coverVisible, setCoverVisible] = useState(true);
  const coverFailsafeRef = useRef(null);
  const armCoverFailsafe = useCallback(() => {
    if (coverFailsafeRef.current) clearTimeout(coverFailsafeRef.current);
    coverFailsafeRef.current = setTimeout(() => {
      Animated.timing(cover, { toValue: 0, duration: 180, useNativeDriver: true })
        .start(() => setCoverVisible(false));
    }, 1600); // clear even if onCameraReady never fires
  }, [cover]);
  useEffect(() => () => { if (coverFailsafeRef.current) clearTimeout(coverFailsafeRef.current); }, []);

  // IMPORTANT: mount camera one frame later so the cover paints first
  const [mountCam, setMountCam] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMountCam(true));
    return () => cancelAnimationFrame?.(id);
  }, []);

  useEffect(() => {
    (async () => {
      if (Platform.OS !== 'web' && !hasCameraPerm) {
        try {
          await requestPermission();
        } catch (e) {
          if (__DEV__) console.warn('[SirenScreen] requestPermission failed:', e);
        }
      }
    })();
  }, [hasCameraPerm, requestPermission]);

  const startVibration = useCallback(() => {
    Vibration.vibrate([0, 600, 400, 600, 400], true);
  }, []);
  const stopVibration = useCallback(() => Vibration.cancel(), []);

  const nowTs = () => (global?.performance?.now?.() ?? Date.now());

  const scheduleNext = useCallback(() => {
    const base = baseTsRef.current;
    const period = periodMsRef.current;
    const onMs = onMsRef.current;
    const now = nowTs();
    const k = Math.floor((now - base) / period);
    const curOn = phaseOnRef.current;

    let nextBoundary;
    if (curOn) {
      const offThisCycle = base + k * period + onMs;
      nextBoundary = now < offThisCycle ? offThisCycle : base + (k + 1) * period + onMs;
    } else {
      const nextStart = base + (k + 1) * period;
      nextBoundary = now < nextStart ? nextStart : base + (k + 2) * period;
    }

    const delay = Math.max(0, nextBoundary - now);
    timerRef.current = setTimeout(() => {
      phaseOnRef.current = !phaseOnRef.current;
      setTorchOn(phaseOnRef.current);
      scheduleNext();
    }, delay);
  }, []);

  const startStrobe = useCallback((hz = 6) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const targetHz = Math.min(hz, Platform.OS === 'android' ? 3 : 8);
    const period = 1000 / targetHz;
    const onMs = Math.max(180, period * 0.6);

    periodMsRef.current = period;
    onMsRef.current = onMs;
    baseTsRef.current = nowTs();
    phaseOnRef.current = true;
    setTorchOn(true);

    const warm = primed ? 120 : (Platform.OS === 'android' ? 350 : 220);
    timerRef.current = setTimeout(() => {
      InteractionManager.runAfterInteractions(() => {
        baseTsRef.current = nowTs();
        scheduleNext();
      });
    }, warm);
  }, [scheduleNext, primed]);

  const stopStrobe = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    phaseOnRef.current = false;
    setTorchOn(false);
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') stopStrobe();
      else if (strobing) startStrobe();
    });
    return () => sub.remove();
  }, [strobing, startStrobe, stopStrobe]);

  useFocusEffect(
    useCallback(() => {
      emergencyBus.emit('siren-open');
      cover.setValue(1);
      setCoverVisible(true);
      armCoverFailsafe();
      startVibration();
      if (Platform.OS !== 'web') playSiren();

      if (!volumeTipShownRef.current) {
        volumeTipShownRef.current = true;
        Alert.alert('Heads up', "If you can't hear the siren, turn your device volume up and make sure Do Not Disturb is off.", [{ text: 'OK' }]);
      }

      const t = setTimeout(() => {
        if (strobing && cameraReadyRef.current) startStrobe();
      }, 300);

      return () => {
        clearTimeout(t);
        stopVibration();
        stopSiren();
        stopStrobe();
        emergencyBus.emit('siren-closed');
      };
    }, [strobing, startStrobe, stopStrobe, startVibration, stopVibration, cover, armCoverFailsafe])
  );

  const onStop = useCallback(() => {
    stopVibration();
    stopSiren();
    stopStrobe();
    navigation.goBack();
  }, [navigation, stopStrobe, stopVibration]);

  const onToggleStrobe = useCallback(() => {
    if (strobing) { setStrobing(false); stopStrobe(); }
    else { setStrobing(true); if (cameraReadyRef.current) startStrobe(); }
  }, [strobing, startStrobe, stopStrobe]);

  return (
    <View style={styles.root}>
      {/* 1) Camera FIRST (stealth 1×1) but mounted one frame late */}
      {Platform.OS !== 'web' && hasCameraPerm && mountCam && (
        <CameraView
          style={styles.stealthCam}
          active
          facing="back"
          flash="off"
          enableTorch={torchOn}
          onCameraReady={() => {
            cameraReadyRef.current = true;
            emergencyBus.emit('siren-camera-ready');
            if (strobing) setTimeout(() => startStrobe(), primed ? 60 : 120);

            // 2) Fade the local cover AFTER camera is alive
            if (coverFailsafeRef.current) clearTimeout(coverFailsafeRef.current);
            Animated.timing(cover, { toValue: 0, duration: 180, useNativeDriver: true })
              .start(() => setCoverVisible(false));
          }}
          onMountError={(error) => {
            console.log('Camera mount error:', error);
            cameraReadyRef.current = false;
            setStrobing(false);
          }}
        />
      )}

      {/* small screen flash fallback */}
      {Platform.OS !== 'web' && (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: phaseOnRef.current ? '#FFFFFF' : 'transparent', opacity: 0.12 }]}
        />
      )}

      {/* UI card */}
      <View style={styles.card}>
        <View style={styles.header}>
          <Ionicons name="alert" size={20} color="#fff" />
          <Text style={styles.title}>Emergency Siren</Text>
        </View>

        <Text style={styles.subtitle}>
          Siren, vibration and {Platform.OS !== 'web' ? 'flashlight' : 'screen alert'} are ACTIVE.
        </Text>

        <View style={styles.tipBanner}>
          <Text style={styles.tipText}>Can’t hear the siren? Increase your device volume and disable Do Not Disturb.</Text>
        </View>

        {Platform.OS === 'web' && !webReady && (
          <TouchableOpacity style={[styles.btn, styles.secondary, { marginBottom: 10 }]} onPress={() => setWebReady(true)}>
            <Ionicons name="volume-high" size={16} color="#111827" />
            <Text style={styles.btnTextDark}>Play Siren</Text>
          </TouchableOpacity>
        )}

        <View style={styles.row}>
          {Platform.OS !== 'web' && hasCameraPerm ? (
            <TouchableOpacity onPress={onToggleStrobe} style={[styles.btn, styles.secondary]}>
              <Ionicons name="flash" size={16} color="#9CA3AF" />
              <Text style={styles.btnTextDark}>{strobing ? 'Stop Strobe' : 'Strobe Flash'}</Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.btn, styles.disabled]}>
              <Ionicons name="flash" size={16} color="#9CA3AF" />
              <Text style={[styles.btnTextDark, { color: '#9CA3AF' }]}>Flash Unavailable</Text>
            </View>
          )}

          <TouchableOpacity onPress={onStop} style={[styles.btn, styles.danger]}>
            <Ionicons name="close" size={16} color="#fff" />
            <Text style={styles.btnText}>STOP</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 3) COVER LAST so it’s guaranteed on top */}
      {coverVisible && (
        <Modal visible transparent statusBarTranslucent animationType="none">
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFillObject, styles.coverTop, { opacity: cover }]}
          />
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center', padding: 16 },
  stealthCam: {
    position: 'absolute',
    transform: [{ translateX: -2000 }, { translateY: -2000 }, { scale: 0.01 }],
    width: 120,
    height: 120,
    opacity: 0.0001,
    backgroundColor: 'transparent',
    renderToHardwareTextureAndroid: true,
  },

  coverTop: { backgroundColor: '#000', zIndex: 9999, elevation: 1 },

  card: { width: '100%', backgroundColor: '#1F2937', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#374151' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  title: { color: '#fff', fontWeight: '800', fontSize: 18 },
  subtitle: { color: '#E5E7EB', marginBottom: 12 },
  tipBanner: { backgroundColor: '#111827', borderColor: '#374151', borderWidth: 1, borderRadius: 12, padding: 10, marginBottom: 10 },
  tipText: { color: '#E5E7EB', marginBottom: 6, fontSize: 12 },
  row: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  secondary: { backgroundColor: '#F3F4F6' },
  disabled: { backgroundColor: '#E5E7EB' },
  danger: { backgroundColor: '#EF4444' },
  btnText: { color: '#fff', fontWeight: '800' },
  btnTextDark: { color: '#111827', fontWeight: '800' },
});
