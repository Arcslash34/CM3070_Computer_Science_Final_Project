// EmergencyTapOverlay.js
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { emergencyBus } from '../utils/emergencyBus';

const WINDOW_MS = 1300;

export default function EmergencyTapOverlay({ onTrigger, children }) {
  const [prewarm, setPrewarm] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  // ---- Gate: block triggers while Siren is opening/active -------------------
  const openingRef = useRef(false);
  const activeRef  = useRef(false);

  useEffect(() => {
    const off = emergencyBus.on((msg) => {
      if (msg === 'siren-opening') openingRef.current = true;
      if (msg === 'siren-open')    { openingRef.current = false; activeRef.current = true; }
      if (msg === 'siren-closed')  { openingRef.current = false; activeRef.current = false; }
    });
    return off;
  }, []);

  // Ask camera permission quietly so prewarm can work
  useEffect(() => {
    if (Platform.OS !== 'web' && permission && !permission.granted && permission.canAskAgain) {
      requestPermission().catch((e) => {
        if (__DEV__) console.warn('[EmergencyTapOverlay] requestPermission failed:', e);
      });
    }
  }, [permission, requestPermission]);

  // one-shot guard just in case
  const firedRef = useRef(false);
  const fireOnce = useCallback(() => {
    if (firedRef.current || openingRef.current || activeRef.current) return;
    firedRef.current = true;

    // tell others we’re navigating to Siren now
    emergencyBus.emit('siren-opening');

    try { onTrigger?.(); } catch (e) {
      if (__DEV__) console.warn('[EmergencyTapOverlay] onTrigger failed:', e);
    }
    setTimeout(() => { firedRef.current = false; }, 1500);
  }, [onTrigger]);

  // Start tiny prewarm preview, then navigate. No fade/Modal here.
  const triggerWithPrewarm = useCallback(() => {
    const delay = Platform.OS === 'android' ? 420 : 200;
    if (Platform.OS !== 'web' && permission?.granted) {
      setPrewarm(true);
      setTimeout(() => {
        fireOnce();
        // Keep prewarm until Siren says its camera is up.
      }, delay);
    } else {
      fireOnce();
    }
  }, [permission, fireOnce]);

  // Stop prewarm when Siren’s camera is alive
  useEffect(() => {
    const off = emergencyBus.on((msg) => {
      if (msg === 'siren-camera-ready') setPrewarm(false);
    });
    return off;
  }, []);

  const gesture = useMemo(() => {
    return Gesture.Tap()
      .numberOfTaps(5)
      .maxDuration(WINDOW_MS)
      .maxDelay(300)
      .maxDistance(24)
      .cancelsTouchesInView(false)
      .shouldCancelWhenOutside(false)
      .simultaneousWithExternalGesture(Gesture.Native())
      .onEnd((_evt, success) => {
        if (!success) return;
        runOnJS(triggerWithPrewarm)();
      });
  }, [triggerWithPrewarm]);

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.container}>
        {children}

        {/* off-screen 120×120 preview to wake camera HAL; never visible */}
        {prewarm && Platform.OS !== 'web' && (
          <View pointerEvents="none" style={styles.prewarmWrap}>
            <CameraView
              active
              facing="back"
              flash="off"
              enableTorch={false}
              style={styles.prewarmCam}
            />
          </View>
        )}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  prewarmWrap: {
    position: 'absolute',
    transform: [{ translateX: -2000 }, { translateY: -2000 }, { scale: 0.01 }],
    width: 120,
    height: 120,
    zIndex: 1,
  },
  prewarmCam: {
    width: '100%',
    height: '100%',
    opacity: 0.0001,
    backgroundColor: 'transparent',
    renderToHardwareTextureAndroid: true,
  },
});
