/**
 * containers/SirenContainer.js — Emergency Siren (torch strobe + audio)
 *
 * Purpose
 * - Drive the full-screen emergency siren experience:
 *   • keep screen awake
 *   • loop siren audio
 *   • vibrate with a repeating pattern
 *   • strobe the camera torch as a visual alert
 * - Coordinate lifecycle with the rest of the app via `emergencyBus`.
 *
 * Key Behaviours
 * - Torch strobe:
 *   • Frequency clamped for safety (Android ≤3 Hz, iOS ≤8 Hz).
 *   • ~60% duty cycle (ON time), phase-locked scheduling via `scheduleNext()`.
 *   • Warm-up delay (shorter when `primed` is true) before stable strobing.
 * - Cover / readiness:
 *   • Fades a cover out when camera becomes ready.
 *   • Has a failsafe timeout to ensure the cover never gets “stuck”.
 * - Audio & haptics:
 *   • Starts siren + vibration on focus; stops both on cleanup.
 *   • Shows a one-time hint about device volume / DND.
 * - App focus:
 *   • Pauses strobe when app backgrounded; resumes when active and allowed.
 * - Permissions:
 *   • Requests camera permission on native platforms (no torch on web).
 * - Events:
 *   • Emits: "siren-open", "siren-camera-ready", "siren-closed".
 *
 * Inputs
 * - route.params.primed (boolean): if true, assume camera prewarmed and
 *   reduce warm-up delays for faster first flash.
 *
 * Exports
 * - Default React component <SirenContainer/> which renders <SirenScreen vm={...}>.
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Alert,
  Animated,
  AppState,
  InteractionManager,
  Platform,
  Vibration,
} from "react-native";
import {
  useNavigation,
  useFocusEffect,
  useRoute,
} from "@react-navigation/native";
import { useKeepAwake } from "expo-keep-awake";
import { CameraView, useCameraPermissions } from "expo-camera";
import { playSiren, stopSiren } from "../utils/sirenAudio";
import { emergencyBus } from "../utils/emergencyBus";

export default function SirenContainer() {
  useKeepAwake();
  const navigation = useNavigation();
  const route = useRoute();
  const primed = !!route?.params?.primed;

  // camera permission
  const [permission, requestPermission] = useCameraPermissions();
  const hasCameraPerm = !!permission?.granted;

  // strobe state
  const [torchOn, setTorchOn] = useState(false);
  const [strobing, setStrobing] = useState(true);
  const cameraReadyRef = useRef(false);

  // timing
  const timerRef = useRef(null);
  const phaseOnRef = useRef(false);
  const baseTsRef = useRef(0);
  const periodMsRef = useRef(0);
  const onMsRef = useRef(0);

  // web siren button
  const [webReady, setWebReady] = useState(Platform.OS !== "web");

  // fade cover
  const cover = useRef(new Animated.Value(1)).current;
  const [coverVisible, setCoverVisible] = useState(true);
  const coverFailsafeRef = useRef(null);
  const armCoverFailsafe = useCallback(() => {
    if (coverFailsafeRef.current) clearTimeout(coverFailsafeRef.current);
    coverFailsafeRef.current = setTimeout(() => {
      Animated.timing(cover, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start(() => setCoverVisible(false));
    }, 1600);
  }, [cover]);
  useEffect(
    () => () => {
      if (coverFailsafeRef.current) clearTimeout(coverFailsafeRef.current);
    },
    []
  );

  // mount the camera one frame later
  const [mountCam, setMountCam] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMountCam(true));
    return () => cancelAnimationFrame?.(id);
  }, []);

  // request camera permission on native
  useEffect(() => {
    (async () => {
      if (Platform.OS !== "web" && !hasCameraPerm) {
        try {
          await requestPermission();
        } catch {}
      }
    })();
  }, [hasCameraPerm, requestPermission]);

  // vibration helpers
  const startVibration = useCallback(() => {
    Vibration.vibrate([0, 600, 400, 600, 400], true);
  }, []);
  const stopVibration = useCallback(() => Vibration.cancel(), []);

  const nowTs = () => global?.performance?.now?.() ?? Date.now();

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
      nextBoundary =
        now < offThisCycle ? offThisCycle : base + (k + 1) * period + onMs;
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

  const startStrobe = useCallback(
    (hz = 6) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      const targetHz = Math.min(hz, Platform.OS === "android" ? 3 : 8);
      const period = 1000 / targetHz;
      const onMs = Math.max(180, period * 0.6);

      periodMsRef.current = period;
      onMsRef.current = onMs;
      baseTsRef.current = nowTs();
      phaseOnRef.current = true;
      setTorchOn(true);

      const warm = primed ? 120 : Platform.OS === "android" ? 350 : 220;
      timerRef.current = setTimeout(() => {
        InteractionManager.runAfterInteractions(() => {
          baseTsRef.current = nowTs();
          scheduleNext();
        });
      }, warm);
    },
    [scheduleNext, primed]
  );

  const stopStrobe = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    phaseOnRef.current = false;
    setTorchOn(false);
  }, []);

  // app focus
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") stopStrobe();
      else if (strobing) startStrobe();
    });
    return () => sub.remove();
  }, [strobing, startStrobe, stopStrobe]);

  // focus lifecycle (sound + vibration + cover)
  const volumeTipShownRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      emergencyBus.emit("siren-open");
      cover.setValue(1);
      setCoverVisible(true);
      armCoverFailsafe();
      startVibration();
      if (Platform.OS !== "web") playSiren();

      if (!volumeTipShownRef.current) {
        volumeTipShownRef.current = true;
        Alert.alert(
          "Heads up",
          "If you can't hear the siren, turn your device volume up and make sure Do Not Disturb is off.",
          [{ text: "OK" }]
        );
      }

      const t = setTimeout(() => {
        if (strobing && cameraReadyRef.current) startStrobe();
      }, 300);

      return () => {
        clearTimeout(t);
        stopVibration();
        stopSiren();
        stopStrobe();
        emergencyBus.emit("siren-closed");
      };
    }, [
      strobing,
      startStrobe,
      stopStrobe,
      startVibration,
      stopVibration,
      cover,
      armCoverFailsafe,
    ])
  );

  // screen handlers
  const onStop = useCallback(() => {
    stopVibration();
    stopSiren();
    stopStrobe();
    navigation.goBack();
  }, [navigation, stopStrobe, stopVibration]);

  const onToggleStrobe = useCallback(() => {
    if (strobing) {
      setStrobing(false);
      stopStrobe();
    } else {
      setStrobing(true);
      if (cameraReadyRef.current) startStrobe();
    }
  }, [strobing, startStrobe, stopStrobe]);

  const onCameraReady = useCallback(() => {
    cameraReadyRef.current = true;
    emergencyBus.emit("siren-camera-ready");
    if (strobing) setTimeout(() => startStrobe(), primed ? 60 : 120);

    if (coverFailsafeRef.current) clearTimeout(coverFailsafeRef.current);
    Animated.timing(cover, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => setCoverVisible(false));
  }, [strobing, startStrobe, primed, cover]);

  const onMountError = useCallback((error) => {
    console.log("Camera mount error:", error);
    cameraReadyRef.current = false;
    setStrobing(false);
  }, []);

  // Build VM for the presentational screen
  const vm = {
    // camera
    hasCameraPerm,
    mountCam,
    torchOn,
    onCameraReady,
    onMountError,

    // state/actions
    strobing,
    onToggleStrobe,
    onStop,

    // cover
    coverVisible,
    cover,

    // web siren action
    webReady,
    setWebReady,

    // pass CameraView to the screen to avoid re-imports there
    CameraView,
  };

  const SirenScreen = require("../screens/SirenScreen").default;
  return <SirenScreen vm={vm} />;
}
