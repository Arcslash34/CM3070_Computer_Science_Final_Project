// components/FirstTimeTutorial.js
import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
// import * as Haptics from "expo-haptics"; // optional

const TUTORIAL_KEY = "hasSeenTutorial";
const REQUIRED_TAPS = 5;
const TAP_GAP_MS = 1000; // max ms allowed between consecutive taps
const RESET_HINT_MS = 1100; // show “try faster” if reset happens
const AUTO_CLOSE_MS = 1200; // delay before closing on success

export default function FirstTimeTutorial({
  visible,
  onComplete,
  onSkip,
  disableRealOverlay,
}) {
  const [step, setStep] = useState("intro"); // "intro" | "practice" | "success"
  const [tapCount, setTapCount] = useState(0);
  const [showHint, setShowHint] = useState(false);

  // refs for timing/logic that shouldn't lag behind state
  const lastTapRef = useRef(0);
  const resetTimerRef = useRef(null);
  const closeTimerRef = useRef(null);

  // when visible, start at intro
  useEffect(() => {
    if (visible) {
      setStep("intro");
      setTapCount(0);
      setShowHint(false);
      lastTapRef.current = 0;
      // tell parent to pause real overlay if they wired it (optional)
      disableRealOverlay?.(true);
    } else {
      disableRealOverlay?.(false);
    }
    return () => {
      clearTimeout(resetTimerRef.current);
      clearTimeout(closeTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const persistSeen = useCallback(async () => {
    try {
      await AsyncStorage.setItem(TUTORIAL_KEY, "1"); // use "1"/"0" consistently
    } catch {}
  }, []);

  const beginPractice = useCallback(() => {
    setStep("practice");
    setTapCount(0);
    setShowHint(false);
    lastTapRef.current = 0;
  }, []);

  const handleSkip = useCallback(async () => {
    await persistSeen();
    onSkip?.(); // if provided
    onComplete?.(); // close tutorial
  }, [onComplete, onSkip, persistSeen]);

  const resetProgress = useCallback((withHint = false) => {
    setTapCount(0);
    lastTapRef.current = 0;
    if (withHint) {
      setShowHint(true);
      // Optionally vibrate
      // Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  }, []);

  const handleTap = useCallback(() => {
    const now = Date.now();
    const last = lastTapRef.current;

    // If first tap, or too slow since last tap → reset to 1
    let nextCount;
    if (!last || now - last > TAP_GAP_MS) {
      nextCount = 1;
      setShowHint(false); // hide hint when they try again
    } else {
      nextCount = tapCount + 1;
    }

    lastTapRef.current = now;
    setTapCount(nextCount);

    // Optional: light haptic tick each tap
    // Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // If they paused too long previously, show hint briefly
    if (last && now - last > RESET_HINT_MS) {
      setShowHint(true);
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => setShowHint(false), 1200);
    }

    if (nextCount >= REQUIRED_TAPS) {
      setStep("success");
      // Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = setTimeout(async () => {
        await persistSeen();
        onComplete?.();
      }, AUTO_CLOSE_MS);
    }
  }, [tapCount, persistSeen, onComplete, resetProgress]);

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.scrim}>
        <View style={styles.card}>
          {/* Header row */}
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>
              {step === "intro" && "Emergency Tap Tutorial"}
              {step === "practice" && "Practice the 5-tap"}
              {step === "success" && "All set!"}
            </Text>
            <Pressable
              onPress={handleSkip}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Skip tutorial"
              testID="tutorial-skip"
            >
              <Text style={styles.skip}>Skip</Text>
            </Pressable>
          </View>

          {/* Body */}
          {step === "intro" && (
            <>
              <Text style={styles.body}>
                In an emergency, tap anywhere on the screen{" "}
                <Text style={styles.bold}>{REQUIRED_TAPS} times quickly</Text>{" "}
                to activate the alarm.
              </Text>
              <View style={styles.tipBox}>
                <Text style={styles.tipText}>
                  Tip: This tutorial is a{" "}
                  <Text style={styles.bold}>silent practice</Text> — it won’t
                  sound the real siren.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={beginPractice}
                accessibilityRole="button"
                testID="tutorial-begin"
              >
                <Text style={styles.primaryBtnText}>Try it</Text>
              </TouchableOpacity>
            </>
          )}

          {step === "practice" && (
            <>
              <Text style={styles.body}>
                Tap the big area below {REQUIRED_TAPS} times, keeping a quick
                rhythm.
              </Text>

              <TouchableOpacity
                style={styles.tapArea}
                onPress={handleTap}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Practice tap area"
                testID="tutorial-tap-area"
              >
                <Text style={styles.tapText}>Tap here</Text>
                <View style={styles.progressRow}>
                  {Array.from({ length: REQUIRED_TAPS }).map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.dot,
                        i < tapCount ? styles.dotActive : styles.dotIdle,
                      ]}
                    />
                  ))}
                </View>
              </TouchableOpacity>

              {showHint && (
                <Text style={styles.hint}>Try a little faster 👆</Text>
              )}

              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => resetProgress(false)}
              >
                <Text style={styles.secondaryBtnText}>Reset</Text>
              </TouchableOpacity>
            </>
          )}

          {step === "success" && (
            <>
              <Text style={styles.bodyCenter}>
                Great job! You’ve learned the 5-tap alarm. In real emergencies,
                this will open the siren screen.
              </Text>
              <View style={styles.checkWrap}>
                <Text style={styles.check}>✅</Text>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 460,
    borderRadius: 20,
    backgroundColor: "#141414",
    padding: 20,
    gap: 14,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  skip: {
    color: "#9aa0a6",
    fontSize: 16,
  },
  body: {
    color: "#d5d7db",
    fontSize: 16,
    lineHeight: 22,
  },
  bodyCenter: {
    color: "#d5d7db",
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 4,
  },
  bold: { fontWeight: "700", color: "#fff" },
  tipBox: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 12,
    marginTop: 6,
  },
  tipText: {
    color: "#c7d2fe",
    fontSize: 14,
  },
  primaryBtn: {
    marginTop: 10,
    backgroundColor: "#2563eb",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  secondaryBtn: {
    alignSelf: "center",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#374151",
    marginTop: 6,
  },
  secondaryBtnText: {
    color: "#cbd5e1",
    fontSize: 14,
  },
  tapArea: {
    backgroundColor: "#242424",
    borderRadius: 18,
    paddingVertical: 38,
    alignItems: "center",
    marginTop: 6,
  },
  tapText: {
    color: "#fff",
    fontSize: 20,
    marginBottom: 14,
  },
  progressRow: {
    flexDirection: "row",
    gap: 10,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#333",
  },
  dotActive: { backgroundColor: "#34d399" },
  dotIdle: { backgroundColor: "#3a3a3a" },
  hint: {
    color: "#fca5a5",
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
  },
  checkWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  check: {
    fontSize: 44,
  },
});
