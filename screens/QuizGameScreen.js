// screens/QuizGameScreen.js
import React, { useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  ActivityIndicator,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

export default function QuizGameScreen({ vm }) {
  const {
    t,
    insets,
    isDaily,
    dailyTitle,
    topicTitle,

    current,
    questionCount,
    index,

    selectedIndex,
    setSelectedIndex,
    submitted,
    onSubmit,

    eliminatedOption,
    usedHint,
    handleHint,

    remainingTime,
    progressAnim,
    flashAnim,
    isLowTime,
    barColor,

    feedback,
    showExplanation,
    setShowExplanation,

    confirmExit,
    goNext,

    uploading,
  } = vm;

  // flash animation driver (visual only)
  useEffect(() => {
    if (!isLowTime) {
      flashAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(flashAnim, {
          toValue: 0.2,
          duration: 300,
          useNativeDriver: false,
        }),
        Animated.timing(flashAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: false,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isLowTime, flashAnim]);

  if (!current) {
    return (
      <View style={c.uploadOverlay}>
        <Text style={c.uploadText}>{t("quizGame.loading")}</Text>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  const optionStyle = (optIdx) => {
    if (!submitted)
      return selectedIndex === optIdx ? [g.option, g.optionSelected] : g.option;
    if (optIdx === current.correctIndex) return [g.option, g.optionCorrect];
    if (selectedIndex === optIdx && optIdx !== current.correctIndex)
      return [g.option, g.optionWrong];
    return g.option;
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
      <SafeAreaView edges={["top", "left", "right"]} style={g.topSafe}>
        <View style={g.topBar}>
          <TouchableOpacity
            onPress={confirmExit}
            accessibilityLabel={t("quizGame.back")}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={g.topBtn}
          >
            <Ionicons name="chevron-back" size={22} color="#111827" />
          </TouchableOpacity>

          <Text style={g.topTitle} numberOfLines={1}>
            {isDaily ? dailyTitle : topicTitle}
          </Text>

          <TouchableOpacity
            onPress={handleHint}
            disabled={usedHint}
            accessibilityLabel={t("quizGame.hint")}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={[g.topBtn, usedHint && { opacity: 0.4 }]}
          >
            <Ionicons name="bulb-outline" size={20} color="#4F46E5" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={[
          g.container,
          { paddingBottom: 160 + insets.bottom },
        ]}
      >
        {/* Question */}
        <View style={g.questionCard}>
          <Text style={g.qNumber}>
            {t("quizGame.qOfTotal", { n: index + 1, total: questionCount })}
          </Text>
          <View style={g.qCenterWrap}>
            <Text style={g.questionText}>{current.q}</Text>
          </View>
        </View>

        {/* Timer */}
        <View style={g.timerRow}>
          <Ionicons
            name="time-outline"
            size={18}
            color="#111827"
            style={{ marginRight: 8 }}
          />
          <View style={g.timerContainer}>
            <Animated.View
              style={[
                g.timerBar,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0%", "100%"],
                  }),
                  backgroundColor: barColor,
                  opacity: isLowTime && !submitted ? flashAnim : 1,
                },
              ]}
            />
          </View>
          <Animated.Text
            style={[
              g.timerText,
              {
                marginLeft: 10,
                color: barColor,
                opacity: isLowTime && !submitted ? flashAnim : 1,
              },
            ]}
          >
            {remainingTime}
          </Animated.Text>
        </View>

        {/* Options */}
        {current.options
          .map((opt, idx) => ({ opt, idx }))
          .filter(({ idx }) => idx !== eliminatedOption)
          .map(({ opt, idx }) => {
            const isSelected = selectedIndex === idx;
            const isCorrect = submitted && idx === current.correctIndex;
            const isWrong = submitted && isSelected && !isCorrect;

            const iconName = !submitted
              ? isSelected
                ? "radio-button-on"
                : "ellipse-outline"
              : isCorrect
              ? "checkmark-circle"
              : isWrong
              ? "close-circle"
              : "ellipse-outline";

            const iconColor = !submitted
              ? isSelected
                ? "#4F46E5"
                : "#9CA3AF"
              : isCorrect
              ? "#10B981"
              : isWrong
              ? "#EF4444"
              : "#9CA3AF";

            return (
              <TouchableOpacity
                key={`${opt}-${idx}`}
                style={optionStyle(idx)}
                onPress={() => !submitted && setSelectedIndex(idx)}
                disabled={submitted}
                activeOpacity={0.9}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Ionicons
                    name={iconName}
                    size={20}
                    color={iconColor}
                    style={{ marginRight: 10 }}
                  />
                  <Text style={g.optionText}>{opt}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
      </ScrollView>

      {/* Bottom actions */}
      <View style={[g.bottomBar, { paddingBottom: 14 + insets.bottom }]}>
        {submitted && (
          <View style={g.feedbackBottomWrap}>
            <Text
              style={[
                g.feedbackBottomText,
                selectedIndex == null
                  ? { color: "#DC2626" }
                  : selectedIndex === current.correctIndex
                  ? { color: "#059669" }
                  : { color: "#6B7280" },
              ]}
            >
              {feedback}
            </Text>
          </View>
        )}

        {submitted ? (
          <View style={g.actionRow}>
            <TouchableOpacity
              style={g.secondaryBtn}
              onPress={() => setShowExplanation(true)}
              activeOpacity={0.9}
            >
              <Text style={g.secondaryBtnText}>
                {t("quizGame.viewExplanation")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[g.submitButton, g.primaryGrow]}
              onPress={goNext}
              activeOpacity={0.9}
            >
              <Text style={g.submitText}>
                {index + 1 < questionCount
                  ? t("quizGame.next")
                  : t("quizGame.finish")}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[g.submitButton, selectedIndex == null && g.submitDisabled]}
            onPress={onSubmit}
            disabled={selectedIndex == null}
            activeOpacity={0.9}
          >
            <Text style={g.submitText}>{t("quizGame.submit")}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Explanation modal */}
      <Modal visible={showExplanation} transparent animationType="fade">
        <View style={g.modalOverlay}>
          <View style={g.modalBox}>
            <Text style={g.modalTitle}>
              {selectedIndex == null
                ? t("quizGame.modal.timeUp")
                : selectedIndex === current.correctIndex
                ? t("quizGame.modal.correct")
                : t("quizGame.modal.incorrect")}
            </Text>
            <Text style={g.modalExplanation}>{current.explanation}</Text>
            <TouchableOpacity onPress={goNext} style={g.modalButton}>
              <Text style={g.modalButtonText}>
                {index + 1 < questionCount
                  ? t("quizGame.next")
                  : t("quizGame.finish")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {uploading && (
        <View style={c.uploadOverlay}>
          <Text style={c.uploadText}>{t("quizGame.saving")}</Text>
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      )}
    </View>
  );
}

const g = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#F8FAFC", flexGrow: 1 },

  topSafe: { backgroundColor: "#FFFFFF" },
  topBar: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  topBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
    maxWidth: "65%",
    textAlign: "center",
  },

  questionCard: {
    position: "relative",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    height: 200,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  qNumber: {
    position: "absolute",
    top: 10,
    left: 0,
    right: 0,
    textAlign: "center",
    color: "#6B7280",
    fontWeight: "600",
    fontSize: 13,
  },
  qCenterWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 6,
  },
  questionText: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },

  timerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    paddingHorizontal: 8,
  },
  timerContainer: {
    flex: 1,
    height: 8,
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
    overflow: "hidden",
    marginRight: 10,
  },
  timerBar: { height: "100%", borderRadius: 999 },
  timerText: { fontSize: 12, fontWeight: "800" },

  option: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E5E7EB",
    borderWidth: 1,
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  optionSelected: { borderColor: "#6366F1", backgroundColor: "#EEF2FF" },
  optionCorrect: { backgroundColor: "#ECFDF5", borderColor: "#10B981" },
  optionWrong: { backgroundColor: "#FEF2F2", borderColor: "#EF4444" },
  optionText: { color: "#111827", fontSize: 15, flex: 1 },

  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "transparent",
    paddingHorizontal: 16,
  },
  submitButton: {
    backgroundColor: "#4F46E5",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  submitDisabled: { backgroundColor: "#9CA3AF" },
  submitText: { color: "#FFFFFF", fontWeight: "800", fontSize: 16 },
  actionRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  primaryGrow: { flex: 1 },
  secondaryBtn: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#4F46E5",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
  },
  secondaryBtnText: { color: "#4F46E5", fontWeight: "800", fontSize: 16 },
  feedbackBottomWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },
  feedbackBottomText: { fontSize: 18, fontWeight: "600", textAlign: "center" },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalBox: {
    width: "92%",
    maxWidth: 420,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 8,
    color: "#111827",
    textAlign: "center",
  },
  modalExplanation: {
    fontSize: 16,
    color: "#374151",
    marginBottom: 15,
    textAlign: "center",
  },
  modalButton: {
    backgroundColor: "#4F46E5",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    alignSelf: "stretch",
  },
  modalButtonText: { color: "#fff", fontWeight: "800", textAlign: "center" },
});

const c = StyleSheet.create({
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
    padding: 24,
  },
  uploadText: {
    fontSize: 16,
    color: "#374151",
    marginBottom: 12,
    fontWeight: "600",
  },
});
