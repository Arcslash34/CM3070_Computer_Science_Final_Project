// QuizGame.js
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  ActivityIndicator,
  Animated,
  Easing,
  Alert,
  BackHandler,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  useNavigation,
  useRoute,
  useFocusEffect,
} from "@react-navigation/native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { supabase } from "./supabase";
import QUIZ_DB from "./assets/quiz.json";

const TOTAL_TIME = 30;

// helper to pick N random items (no mutate)
const sampleArray = (arr, n) =>
  arr
    .map((x) => [Math.random(), x])
    .sort((a, b) => a[0] - b[0])
    .slice(0, n)
    .map((x) => x[1]);

// shuffle options per question
const shuffle = (arr) =>
  arr
    .map((v) => ({ k: Math.random(), v }))
    .sort((a, b) => a.k - b.k)
    .map((o) => o.v);

export default function QuizGame() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { params } = useRoute();

  // route params
  const topicId = params?.topicId; // e.g., 'flood' | 'fire' | 'dengue' | 'first_aid' | 'disease' | 'earthquake' | 'daily'
  const topicTitle = params?.topicTitle ?? "Quiz";
  const isDaily = !!params?.isDaily;
  const setNumber = params?.setIndex ?? 1; // 1-based index for chosen set

  // hide native header; we'll render our own top bar
  React.useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  // state
  const [questions, setQuestions] = useState([]); // [{question, options, answer, explanation}]
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [userAnswers, setUserAnswers] = useState([]);
  const [uploading, setUploading] = useState(false);

  // hint
  const [eliminatedOption, setEliminatedOption] = useState(null);
  const [usedHint, setUsedHint] = useState(false);

  // timer
  const [remainingTime, setRemainingTime] = useState(TOTAL_TIME);
  const progressAnim = useRef(new Animated.Value(1)).current;
  const flashAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef(null);

  // XP feedback (per question) + cumulative XP
  const [earnedXP, setEarnedXP] = useState(0);
  const [totalXp, setTotalXp] = useState(0);
  const [xpPerQuestion, setXpPerQuestion] = useState([]); // index -> xp earned
  const [feedback, setFeedback] = useState("");

  // build questions from quiz.json (and shuffle options)
  useEffect(() => {
    const cats = QUIZ_DB?.categories ?? [];
    const byId = (id) => cats.find((c) => c.id === id);

    if (isDaily) {
      // flatten all questions across all sets for a mixed daily
      const allQs = [];
      cats.forEach((cat) =>
        cat.sets.forEach((s) => s.questions.forEach((q) => allQs.push(q)))
      );
      const picked = sampleArray(allQs, 8).map((q) => ({
        ...q,
        options: shuffle([...q.options]),
      }));
      setQuestions(picked);
      return;
    }

    const category = byId(topicId) || null;
    const chosen = (
      category?.sets?.[Math.max(0, setNumber - 1)]?.questions || []
    ).map((q) => ({ ...q, options: shuffle([...q.options]) }));
    setQuestions(chosen);
  }, [topicId, setNumber, isDaily]);

  const current = useMemo(() => questions[index], [questions, index]);
  const questionCount = questions.length;

  // reset per mount / when questions loaded
  useEffect(() => {
    setIndex(0);
    setSelected(null);
    setSubmitted(false);
    setShowExplanation(false);
    setEliminatedOption(null);
    setUsedHint(false);
    setUserAnswers([]);
    setRemainingTime(TOTAL_TIME);
    setEarnedXP(0);
    setFeedback("");
    setTotalXp(0);            // reset cumulative XP
    setXpPerQuestion([]);     // reset per-question XP
  }, [questionCount]);

  // timer + progress bar
  useEffect(() => {
    if (!current || submitted) return;

    // reset progress anim
    progressAnim.setValue(1);
    Animated.timing(progressAnim, {
      toValue: 0,
      duration: TOTAL_TIME * 1000,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();

    setRemainingTime(TOTAL_TIME);
    const t = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev <= 1) {
          clearInterval(t);
          if (!submitted) onSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    timerRef.current = t;
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, current, submitted, onSubmit, progressAnim]);

  // flash timer under 10s
  const isFlashing = remainingTime <= 10 && !submitted;
  useEffect(() => {
    if (!isFlashing) {
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
  }, [isFlashing, flashAnim]);

  // UI helpers
  const barColor = progressAnim.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: ["#EF4444", "#F59E0B", "#10B981"],
  });

  const handleHint = () => {
    if (usedHint || !current) return;
    const incorrect = current.options.filter((opt) => opt !== current.answer);
    const remove = incorrect[Math.floor(Math.random() * incorrect.length)];
    setEliminatedOption(remove);
    setUsedHint(true);
  };

  // confirm exit
  const confirmExit = useCallback(() => {
    Alert.alert(
      "Leave quiz?",
      "Your current progress will not be saved.",
      [
        { text: "Stay", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: () => navigation.goBack(),
        },
      ],
      { cancelable: true }
    );
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        confirmExit();
        return true; // prevent default back
      };
      BackHandler.addEventListener("hardwareBackPress", onBackPress);
      return () =>
        BackHandler.removeEventListener("hardwareBackPress", onBackPress);
    }, [confirmExit])
  );

  // submit one question
  const onSubmit = useCallback(() => {
    if (!current || submitted) return;

    let xpForThisQuestion = 0;

    // compute feedback / XP (matches on-screen XP)
    if (selected == null) {
      xpForThisQuestion = 0;
      setFeedback("Time’s up!");
    } else if (selected === current.answer) {
      let xp = Math.floor((remainingTime / TOTAL_TIME) * 100);
      if (usedHint) xp = Math.floor(xp / 2);
      xpForThisQuestion = xp;
      setFeedback(`+${xp} XP`);
    } else {
      xpForThisQuestion = 0;
      setFeedback("Nice try — keep going!");
    }

    // persist the per-question XP + cumulative XP
    setEarnedXP(xpForThisQuestion);
    setXpPerQuestion((prev) => {
      const copy = [...prev];
      copy[index] = xpForThisQuestion;
      return copy;
    });
    setTotalXp((prev) => prev + xpForThisQuestion);

    // stop countdown now that the question is submitted
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    progressAnim.stopAnimation();

    setSubmitted(true);
    setShowExplanation(false); // ⬅️ don't auto-open modal
  }, [current, submitted, selected, remainingTime, usedHint, progressAnim, index]);

  // next / finish
  const goNext = () => {
    const nextAnswers = [...userAnswers];
    nextAnswers[index] = selected;
    setUserAnswers(nextAnswers);

    setShowExplanation(false);
    setSubmitted(false);
    setSelected(null);
    setEliminatedOption(null);
    setUsedHint(false);
    setEarnedXP(0);
    setFeedback("");

    if (index + 1 < questionCount) {
      setIndex(index + 1);
      return;
    }

    // finished — compute review + save
    let correctCnt = 0;
    const reviewData = questions.map((q, i) => {
      const sel = nextAnswers[i];
      const status =
        sel == null ? "unanswered" : sel === q.answer ? "correct" : "incorrect";
      if (status === "correct") correctCnt += 1;
      return {
        number: i + 1,
        question: q.question,
        status,
        correctAnswer: q.answer,
        selectedAnswer: sel ?? null,
        xpEarned: xpPerQuestion[i] ?? 0, // include per-question XP for later display
      };
    });

    const scorePercent = Math.round((correctCnt / questionCount) * 100);
    const quizTitle = isDaily ? "Daily Quiz" : topicTitle;
    const finalTotalXp = totalXp; // already accumulated from onSubmit()

    (async () => {
      try {
        setUploading(true);
        const { data: userData, error: userError } =
          await supabase.auth.getUser();
        const userId = userData?.user?.id;
        if (!userError && userId) {
          const { error: insertError } = await supabase.from("quiz_results").insert({
            user_id: userId,
            quiz_title: quizTitle,
            score: scorePercent,
            xp: finalTotalXp,
            answers: nextAnswers,
            review_data: reviewData,
          });
          if (insertError) throw insertError;

         // After saving the result, evaluate and award badges
         try {
           const { checkAndAwardBadges, getBadgeMeta } = await import("./badgesLogic");
           const res = await checkAndAwardBadges(supabase, {
             lastQuiz: {
               title: quizTitle,
               scorePercent,
               createdAt: new Date().toISOString(),
             },
           });
           // OPTIONAL: quick toast/alert for the first newly unlocked badge
           if (res.newlyAwarded?.length) {
             const first = getBadgeMeta(res.newlyAwarded[0]);
             // Example UX: uncomment if you want an alert
             // Alert.alert("Badge Unlocked!", first.title || res.newlyAwarded[0]);
           }
         } catch (badgeErr) {
           console.warn("Badge awarding failed:", badgeErr?.message || badgeErr);
         }
        }
      } catch (e) {
        console.warn("Supabase save error:", e?.message || e);
        Alert.alert("Save failed", String(e?.message || e));
      } finally {
        setUploading(false);
        navigation.navigate("ResultSummary", {
          reviewData,
          quizTitle,
          scorePercent,
          xp: finalTotalXp,
          score: scorePercent,
          userAnswers: nextAnswers,
          backTo: { screen: "Quizzes" },
        });
      }
    })();
  };

  if (!current) {
    return (
      <View style={c.uploadOverlay}>
        <Text style={c.uploadText}>Loading…</Text>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  const optionStyle = (opt) => {
    if (!submitted)
      return selected === opt ? [g.option, g.optionSelected] : g.option;
    if (opt === current.answer) return [g.option, g.optionCorrect];
    if (selected === opt && opt !== current.answer)
      return [g.option, g.optionWrong];
    return g.option;
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
      {/* Safe-area top wrapper */}
      <SafeAreaView edges={["top", "left", "right"]} style={g.topSafe}>
        <View style={g.topBar}>
          <TouchableOpacity
            onPress={confirmExit}
            accessibilityLabel="Go back"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={g.topBtn}
          >
            <Ionicons name="chevron-back" size={22} color="#111827" />
          </TouchableOpacity>

          <Text style={g.topTitle} numberOfLines={1}>
            {isDaily ? "Daily Quiz" : topicTitle}
          </Text>

          <TouchableOpacity
            onPress={handleHint}
            disabled={usedHint}
            accessibilityLabel="Use a hint"
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
          { paddingBottom: 160 + insets.bottom }, // room for feedback + button
        ]}
      >
        {/* Question card */}
        <View style={g.questionCard}>
          <Text style={g.qNumber}>
            Question {index + 1} of {questionCount}
          </Text>
          <View style={g.qCenterWrap}>
            <Text style={g.questionText}>{current.question}</Text>
          </View>
        </View>

        {/* Timer row: icon | bar | number */}
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
                  opacity: remainingTime <= 10 && !submitted ? flashAnim : 1,
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
                opacity: remainingTime <= 10 && !submitted ? flashAnim : 1,
              },
            ]}
          >
            {remainingTime}
          </Animated.Text>
        </View>

        {/* Options (no A/B/C/D labels) */}
        {current.options
          .filter((opt) => opt !== eliminatedOption)
          .map((opt, idx) => {
            const isSelected = selected === opt;
            const isCorrect = submitted && opt === current.answer;
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
                style={optionStyle(opt)}
                onPress={() => !submitted && setSelected(opt)}
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

      {/* Bottom fixed Submit */}
      <View style={[g.bottomBar, { paddingBottom: 14 + insets.bottom }]}>
        {submitted && (
          <View style={g.feedbackBottomWrap}>
            <Text
              style={[
                g.feedbackBottomText,
                selected == null
                  ? { color: "#DC2626" } // time up
                  : selected === current.answer
                  ? { color: "#059669" } // correct
                  : { color: "#6B7280" }, // incorrect
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
              <Text style={g.secondaryBtnText}>View Explanation</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[g.submitButton, g.primaryGrow]}
              onPress={goNext}
              activeOpacity={0.9}
            >
              <Text style={g.submitText}>
                {index + 1 < questionCount ? "Next Question" : "Finish"}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[g.submitButton, selected == null && g.submitDisabled]}
            onPress={onSubmit}
            disabled={selected == null}
            activeOpacity={0.9}
          >
            <Text style={g.submitText}>Submit</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Centered explanation modal */}
      <Modal visible={showExplanation} transparent animationType="fade">
        <View style={g.modalOverlay}>
          <View style={g.modalBox}>
            <Text style={g.modalTitle}>
              {selected == null
                ? "⌛ Time Up ⌛"
                : selected === current.answer
                ? "🥳 Correct 🥳"
                : "😓 Incorrect 😓"}
            </Text>
            <Text style={g.modalExplanation}>{current.explanation}</Text>
            <TouchableOpacity onPress={goNext} style={g.modalButton}>
              <Text style={g.modalButtonText}>
                {index + 1 < questionCount ? "Next Question" : "Finish"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {uploading && (
        <View style={c.uploadOverlay}>
          <Text style={c.uploadText}>Saving results…</Text>
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
  actionRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
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
  secondaryBtnText: {
    color: "#4F46E5",
    fontWeight: "800",
    fontSize: 16,
  },
  feedbackBottomWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },
  feedbackBottomText: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },

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
