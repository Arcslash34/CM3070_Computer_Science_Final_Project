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
import { getQuiz } from "./quizLoader";
import { i18n, t, setLocale } from "./translations/translation";

import { Audio } from "expo-av";
import * as AppPrefs from "./appPrefs";
import enQuizzes from "./translations/en/quizzes.json";

const TOTAL_TIME = 30;

// ---- helpers ----
const sampleArray = (arr, n) =>
  arr
    .map((x, i) => [Math.random(), i]) // keep indices
    .sort((a, b) => a[0] - b[0])
    .slice(0, n)
    .map((x) => x[1]); // return indices instead of items

const makePermutation = (len) => {
  const idx = Array.from({ length: len }, (_, i) => i);
  // Fisher-Yates
  for (let i = len - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx;
};

const applyPerm = (arr, perm) => perm.map((pi) => arr[pi]);

const englishTitle = ({ topicId, isDaily, fallback }) => {
  if (isDaily || topicId === "daily") {
    return enQuizzes?.daily?.title || "Daily Quiz";
  }
  return enQuizzes?.categories?.[topicId]?.title || fallback || "Quiz";
};

// Load the English quiz DB without changing visible UI
function useEnglishQuizDB() {
  return useMemo(() => {
    const prev = i18n.locale;
    try {
      setLocale("en");
      return getQuiz();
    } finally {
      setLocale(prev);
    }
  }, [i18n.locale]);
}

export default function QuizGame() {
  const QUIZ_DB = useMemo(() => getQuiz(), [i18n.locale]);
  const QUIZ_DB_EN = useEnglishQuizDB();

  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { params } = useRoute();

  // route params
  const topicId = params?.topicId;
  const isDaily = !!params?.isDaily;
  const setNumber = params?.setIndex ?? 1;

  // localized titles (for on-screen UI)
  const dailyTitle =
    t("quizzes.daily.title", { defaultValue: t("quizGame.dailyTitle") }) ||
    t("quizGame.dailyTitle");
  const topicTitle =
    params?.topicTitle ??
    (isDaily ? dailyTitle : t("quizSet.quiz", { defaultValue: "Quiz" }));

  // hide native header; we'll render our own top bar
  React.useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  // state
  const [qset, setQset] = useState([]); // per-question: {q, qEn, options, optionsEn, correctIndex}
  const [index, setIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [userSelections, setUserSelections] = useState([]); // indices
  const [uploading, setUploading] = useState(false);

  // hint
  const [eliminatedOption, setEliminatedOption] = useState(null);
  const [usedHint, setUsedHint] = useState(false);

  // timer
  const [remainingTime, setRemainingTime] = useState(TOTAL_TIME);
  const progressAnim = useRef(new Animated.Value(1)).current;
  const flashAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef(null);
  const remainingRef = useRef(remainingTime);
  useEffect(() => {
    remainingRef.current = remainingTime;
  }, [remainingTime]);

  // XP feedback (per question) + cumulative XP
  const [earnedXP, setEarnedXP] = useState(0);
  const [totalXp, setTotalXp] = useState(0);
  const [xpPerQuestion, setXpPerQuestion] = useState([]); // index -> xp earned
  const [feedback, setFeedback] = useState("");

  // --- AUDIO refs ---
  const bgmRef = useRef(null);
  const sfxCorrectRef = useRef(null);
  const sfxWrongRef = useRef(null);

  // Build a parallel question set in current locale + English (with same option permutations)
  useEffect(() => {
    const cats = QUIZ_DB?.categories ?? [];
    const catsEn = QUIZ_DB_EN?.categories ?? [];
    const findCat = (db, id) => db.find((c) => c.id === id);

    const buildFromIndices = (zhList, enList, indices) => {
      const out = [];
      for (const globalIdx of indices) {
        const zh = zhList[globalIdx];
        const en = enList[globalIdx] || zh; // fallback to zh if EN missing

        const perm = makePermutation(zh.options.length);
        const options = applyPerm(zh.options, perm);
        const optionsEn = applyPerm(en.options || zh.options, perm);

        // find correct index in shuffled space
        const originalCorrectIdx = zh.options.findIndex(
          (o) => String(o) === String(zh.answer)
        );
        const correctIndex = perm.findIndex((p) => p === originalCorrectIdx);

        out.push({
          q: zh.question,
          qEn: en.question || zh.question,
          options,
          optionsEn,
          explanation: zh.explanation, // on-screen uses current locale
          correctIndex,
        });
      }
      return out;
    };

    if (isDaily) {
      // flatten both DBs to parallel arrays (same order)
      const zhAll = [];
      const enAll = [];
      cats.forEach((cat) => {
        const catEn = findCat(catsEn, cat.id);
        cat.sets.forEach((s, sIdx) => {
          const enSet = catEn?.sets?.[sIdx] || { questions: [] };
          s.questions.forEach((q, qIdx) => {
            zhAll.push(q);
            enAll.push(enSet.questions?.[qIdx] || q);
          });
        });
      });

      const pickIdx = sampleArray(zhAll, 8);
      setQset(buildFromIndices(zhAll, enAll, pickIdx));
      return;
    }

    // topic/set path
    const cat = findCat(cats, topicId) || null;
    const catEn = findCat(catsEn, topicId) || null;
    const zhQuestions =
      cat?.sets?.[Math.max(0, setNumber - 1)]?.questions || [];
    const enQuestions =
      catEn?.sets?.[Math.max(0, setNumber - 1)]?.questions || [];

    const indices = Array.from({ length: zhQuestions.length }, (_, i) => i);
    const out = [];
    for (const qi of indices) {
      const zh = zhQuestions[qi];
      const en = enQuestions[qi] || zh; // fallback
      const perm = makePermutation(zh.options.length);
      const options = applyPerm(zh.options, perm);
      const optionsEn = applyPerm(en.options || zh.options, perm);

      const originalCorrectIdx = zh.options.findIndex(
        (o) => String(o) === String(zh.answer)
      );
      const correctIndex = perm.findIndex((p) => p === originalCorrectIdx);

      out.push({
        q: zh.question,
        qEn: en.question || zh.question,
        options,
        optionsEn,
        explanation: zh.explanation,
        correctIndex,
      });
    }
    setQset(out);
  }, [QUIZ_DB, QUIZ_DB_EN, topicId, setNumber, isDaily]);

  const questionCount = qset.length;
  const current = qset[index];

  // reset per mount / when questions loaded
  useEffect(() => {
    setIndex(0);
    setSelectedIndex(null);
    setSubmitted(false);
    setShowExplanation(false);
    setEliminatedOption(null);
    setUsedHint(false);
    setUserSelections([]);
    setRemainingTime(TOTAL_TIME);
    setEarnedXP(0);
    setFeedback("");
    setTotalXp(0);
    setXpPerQuestion([]);
  }, [questionCount]);

  // --- AUDIO: preload bgm + sfx on mount, cleanup on unmount ---
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const bgm = new Audio.Sound();
        await bgm.loadAsync(require("./assets/music/quiz-bgm.mp3"));
        await bgm.setIsLoopingAsync(true);
        await bgm.setVolumeAsync(0.35);
        if (mounted) {
          bgmRef.current = bgm;
          if (AppPrefs.soundEnabled()) {
            await bgm.playAsync();
          } else {
            try {
              await bgm.pauseAsync();
            } catch {}
          }
        }

        const ok = new Audio.Sound();
        await ok.loadAsync(require("./assets/music/correct.mp3"));
        sfxCorrectRef.current = ok;

        const nope = new Audio.Sound();
        await nope.loadAsync(require("./assets/music/incorrect.mp3"));
        sfxWrongRef.current = nope;
      } catch (e) {
        console.warn("Quiz audio init error:", e);
      }
    })();

    return () => {
      mounted = false;
      (async () => {
        try {
          await sfxWrongRef.current?.unloadAsync();
          await sfxCorrectRef.current?.unloadAsync();
          await bgmRef.current?.unloadAsync();
        } catch {}
        sfxWrongRef.current = null;
        sfxCorrectRef.current = null;
        bgmRef.current = null;
      })();
    };
  }, []);

  // --- submit handler (reads remaining time from ref so it doesn't re-create per tick)
  const onSubmit = useCallback(async () => {
    if (!current || submitted) return;

    const rt = remainingRef.current;
    let xpForThisQuestion = 0;

    if (selectedIndex == null) {
      xpForThisQuestion = 0;
      setFeedback(t("quizGame.timesUp"));
    } else if (selectedIndex === current.correctIndex) {
      let xp = Math.floor((rt / TOTAL_TIME) * 100);
      if (usedHint) xp = Math.floor(xp / 2);
      xpForThisQuestion = xp;
      setFeedback(t("quizGame.plusXp", { xp }));
    } else {
      xpForThisQuestion = 0;
      setFeedback(t("quizGame.niceTry"));
    }

    setEarnedXP(xpForThisQuestion);
    setXpPerQuestion((prev) => {
      const copy = [...prev];
      copy[index] = xpForThisQuestion;
      return copy;
    });
    setTotalXp((prev) => prev + xpForThisQuestion);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    progressAnim.stopAnimation();

    try {
      if (selectedIndex == null) {
        AppPrefs.warning();
      } else if (selectedIndex === current.correctIndex) {
        AppPrefs.success();
      } else {
        AppPrefs.error();
      }

      if (AppPrefs.soundEnabled()) {
        if (selectedIndex === current.correctIndex) {
          await sfxCorrectRef.current?.replayAsync();
        } else if (selectedIndex != null) {
          await sfxWrongRef.current?.replayAsync();
        }
      }
    } catch {}

    setSubmitted(true);
    setShowExplanation(false);
  }, [current, submitted, selectedIndex, usedHint, progressAnim, index]);

  // keep a ref to latest onSubmit so timer effect doesn't depend on it
  const onSubmitRef = useRef(onSubmit);
  useEffect(() => {
    onSubmitRef.current = onSubmit;
  }, [onSubmit]);

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
    const tmr = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev <= 1) {
          clearInterval(tmr);
          if (!submitted) onSubmitRef.current?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    timerRef.current = tmr;
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
    // removed onSubmit from deps to prevent re-start each tick
  }, [index, current, submitted, progressAnim]);

  // flash timer under 10s (visual only)
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

  const barColor = progressAnim.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: ["#EF4444", "#F59E0B", "#10B981"],
  });

  const handleHint = () => {
    if (usedHint || !current) return;
    const incorrectIdx = current.options
      .map((opt, i) => i)
      .filter((i) => i !== current.correctIndex);
    const removeIdx =
      incorrectIdx[Math.floor(Math.random() * incorrectIdx.length)];
    setEliminatedOption(removeIdx);
    setUsedHint(true);
  };

  // confirm exit
  const confirmExit = useCallback(() => {
    Alert.alert(
      t("quizGame.leaveTitle"),
      t("quizGame.leaveMsg"),
      [
        { text: t("quizGame.stay"), style: "cancel" },
        {
          text: t("quizGame.leave"),
          style: "destructive",
          onPress: () => navigation.goBack(),
        },
      ],
      { cancelable: true }
    );
  }, [navigation]);

  // pause/resume BGM when screen blurs/focuses + back handler
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        confirmExit();
        return true;
      };
      BackHandler.addEventListener("hardwareBackPress", onBackPress);

      (async () => {
        try {
          if (AppPrefs.soundEnabled()) {
            await bgmRef.current?.playAsync();
          } else {
            await bgmRef.current?.pauseAsync();
          }
        } catch {}
      })();

      return () => {
        BackHandler.removeEventListener("hardwareBackPress", onBackPress);
        (async () => {
          try {
            await bgmRef.current?.pauseAsync();
          } catch {}
        })();
      };
    }, [confirmExit])
  );

  // next / finish
  const goNext = () => {
    const next = [...userSelections];
    next[index] = selectedIndex;
    setUserSelections(next);

    setShowExplanation(false);
    setSubmitted(false);
    setSelectedIndex(null);
    setEliminatedOption(null);
    setUsedHint(false);
    setEarnedXP(0);
    setFeedback("");

    if (index + 1 < questionCount) {
      setIndex(index + 1);
      return;
    }

    // finished — compute review (localized, for immediate UI)
    let correctCnt = 0;
    const reviewDataLocalized = qset.map((q, i) => {
      const sel = next[i];
      const status =
        sel == null
          ? "unanswered"
          : sel === q.correctIndex
          ? "correct"
          : "incorrect";
      if (status === "correct") correctCnt += 1;
      return {
        number: i + 1,
        question: q.q,
        status,
        correctAnswer: q.options[q.correctIndex],
        selectedAnswer: sel == null ? null : q.options[sel],
        xpEarned: xpPerQuestion[i] ?? 0,
      };
    });

    // Build EN review for saving
    const reviewDataEN = qset.map((q, i) => {
      const sel = next[i];
      const status =
        sel == null
          ? "unanswered"
          : sel === q.correctIndex
          ? "correct"
          : "incorrect";
      return {
        number: i + 1,
        question: q.qEn,
        status,
        correctAnswer: q.optionsEn[q.correctIndex],
        selectedAnswer: sel == null ? null : q.optionsEn[sel],
        xpEarned: xpPerQuestion[i] ?? 0,
      };
    });

    // Build EN answers array (strings) for the `answers` column
    const answersEN = qset.map((q, i) => {
      const sel = next[i];
      return sel == null ? null : q.optionsEn[sel];
    });

    const scorePercent = Math.round((correctCnt / questionCount) * 100);

    // UI title (localized) vs. English-only for DB
    const quizTitleLocalized = isDaily ? dailyTitle : topicTitle;
    const quizTitleEnglish = englishTitle({
      topicId: isDaily ? "daily" : topicId,
      isDaily,
      fallback: quizTitleLocalized,
    });

    const finalTotalXp = totalXp;

    (async () => {
      try {
        setUploading(true);
        const { data: userData, error: userError } =
          await supabase.auth.getUser();
        const userId = userData?.user?.id;
        if (!userError && userId) {
          const { error: insertError } = await supabase
            .from("quiz_results")
            .insert({
              user_id: userId,
              quiz_title: quizTitleEnglish, // English only
              topic_id: isDaily ? "daily" : topicId,
              score: scorePercent,
              xp: finalTotalXp,
              // Save answers as EN strings (not indices):
              answers: answersEN,
              // Review data saved in EN:
              review_data: reviewDataEN,
              // played_locale: i18n.locale, // optional
            });
          if (insertError) throw insertError;

          try {
            const { checkAndAwardBadges } = await import("./badgesLogic");
            await checkAndAwardBadges(supabase, {
              lastQuiz: {
                title: quizTitleEnglish,
                scorePercent,
                createdAt: new Date().toISOString(),
              },
            });
          } catch (badgeErr) {
            console.warn(
              "Badge awarding failed:",
              badgeErr?.message || badgeErr
            );
          }
        }
      } catch (e) {
        console.warn("Supabase save error:", e?.message || e);
        Alert.alert("Save failed", String(e?.message || e));
      } finally {
        try {
          await bgmRef.current?.stopAsync();
        } catch {}
        setUploading(false);
        navigation.navigate("ResultSummary", {
          reviewData: reviewDataLocalized, // show in current UI language
          quizTitle: quizTitleLocalized,
          scorePercent,
          xp: finalTotalXp,
          score: scorePercent,
          // Also pass EN strings to the summary view:
          userAnswers: answersEN,
          backTo: { screen: "Quizzes" },
        });
      }
    })();
  };

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
      {/* Safe-area top wrapper */}
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
        {/* Question card */}
        <View style={g.questionCard}>
          <Text style={g.qNumber}>
            {t("quizGame.qOfTotal", { n: index + 1, total: questionCount })}
          </Text>
          <View style={g.qCenterWrap}>
            <Text style={g.questionText}>{current.q}</Text>
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

      {/* Bottom fixed Submit */}
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

      {/* Centered explanation modal */}
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
