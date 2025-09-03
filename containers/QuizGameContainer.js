// containers/QuizGameContainer.js
import React, {
  useEffect, useMemo, useRef, useState, useCallback
} from "react";
import { Alert, BackHandler, Animated, Easing } from "react-native";
import {
  useNavigation, useRoute, useFocusEffect
} from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Audio } from "expo-av";

import { supabase } from "../supabase";
import { getQuiz } from "../utils/quizLoader";
import { i18n, t, setLocale } from "../translations/translation";
import * as AppPrefs from "../utils/appPrefs";
import enQuizzes from "../translations/en/quizzes.json";

// ----- constants -----
const TOTAL_TIME = 30;

// ---- helpers (same as before) ----
const sampleArray = (arr, n) =>
  arr
    .map((x, i) => [Math.random(), i])
    .sort((a, b) => a[0] - b[0])
    .slice(0, n)
    .map((x) => x[1]);

const makePermutation = (len) => {
  const idx = Array.from({ length: len }, (_, i) => i);
  for (let i = len - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx;
};
const applyPerm = (arr, perm) => perm.map((pi) => arr[pi]);

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

export default function QuizGameContainer() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { params } = useRoute();

  // route params
  const topicId = params?.topicId;
  const isDaily = !!params?.isDaily;
  const setNumber = params?.setIndex ?? 1;

  // i18n titles (UI)
  const dailyTitle =
    t("quizzes.daily.title", { defaultValue: t("quizGame.dailyTitle") }) ||
    t("quizGame.dailyTitle");
  const topicTitle =
    params?.topicTitle ??
    (isDaily ? dailyTitle : t("quizSet.quiz", { defaultValue: "Quiz" }));

  // hide native header
  React.useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  // DBs
  const QUIZ_DB = useMemo(() => getQuiz(), [i18n.locale]);
  const QUIZ_DB_EN = useEnglishQuizDB();

  // state (logic only)
  const [qset, setQset] = useState([]); // {q, qEn, options, optionsEn, correctIndex, explanation}
  const [index, setIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [userSelections, setUserSelections] = useState([]);
  const [uploading, setUploading] = useState(false);

  const [eliminatedOption, setEliminatedOption] = useState(null);
  const [usedHint, setUsedHint] = useState(false);

  // timer
  const [remainingTime, setRemainingTime] = useState(TOTAL_TIME);
  const progressAnim = useRef(new Animated.Value(1)).current;
  const flashAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef(null);
  const remainingRef = useRef(remainingTime);
  useEffect(() => { remainingRef.current = remainingTime; }, [remainingTime]);

  // XP
  const [earnedXP, setEarnedXP] = useState(0);
  const [totalXp, setTotalXp] = useState(0);
  const [xpPerQuestion, setXpPerQuestion] = useState([]);
  const [feedback, setFeedback] = useState("");

  // audio
  const bgmRef = useRef(null);
  const sfxCorrectRef = useRef(null);
  const sfxWrongRef = useRef(null);

  // build question set (same logic as your file)
  useEffect(() => {
    const cats = QUIZ_DB?.categories ?? [];
    const catsEn = QUIZ_DB_EN?.categories ?? [];
    const findCat = (db, id) => db.find((c) => c.id === id);

    const buildFromIndices = (zhList, enList, indices) => {
      const out = [];
      for (const globalIdx of indices) {
        const zh = zhList[globalIdx];
        const en = enList[globalIdx] || zh;

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
      return out;
    };

    if (isDaily) {
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

    const cat = findCat(cats, topicId) || null;
    const catEn = findCat(catsEn, topicId) || null;
    const zhQuestions = cat?.sets?.[Math.max(0, setNumber - 1)]?.questions || [];
    const enQuestions = catEn?.sets?.[Math.max(0, setNumber - 1)]?.questions || [];

    const indices = Array.from({ length: zhQuestions.length }, (_, i) => i);
    const out = [];
    for (const qi of indices) {
      const zh = zhQuestions[qi];
      const en = enQuestions[qi] || zh;
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

  // reset when questionCount changes
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

  // audio init/cleanup
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const bgm = new Audio.Sound();
        await bgm.loadAsync(require("../assets/music/quiz-bgm.mp3"));
        await bgm.setIsLoopingAsync(true);
        await bgm.setVolumeAsync(0.35);
        if (mounted) {
          bgmRef.current = bgm;
          if (AppPrefs.soundEnabled()) await bgm.playAsync();
          else await bgm.pauseAsync().catch(() => {});
        }

        const ok = new Audio.Sound();
        await ok.loadAsync(require("../assets/music/correct.mp3"));
        sfxCorrectRef.current = ok;

        const nope = new Audio.Sound();
        await nope.loadAsync(require("../assets/music/incorrect.mp3"));
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

  // submit
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
      if (selectedIndex == null) AppPrefs.warning();
      else if (selectedIndex === current.correctIndex) AppPrefs.success();
      else AppPrefs.error();

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
  }, [current, submitted, selectedIndex, usedHint, index]);

  // keep latest submit ref for timer
  const onSubmitRef = useRef(onSubmit);
  useEffect(() => { onSubmitRef.current = onSubmit; }, [onSubmit]);

  // timer effect
  useEffect(() => {
    if (!current || submitted) return;

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
  }, [index, current, submitted, progressAnim]);

  // flashing opacity control lives in screen; we expose flags
  const isLowTime = remainingTime <= 10 && !submitted;

  const barColor = progressAnim.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: ["#EF4444", "#F59E0B", "#10B981"],
  });

  const handleHint = () => {
    if (usedHint || !current) return;
    const incorrectIdx = current.options.map((_, i) => i).filter((i) => i !== current.correctIndex);
    const removeIdx = incorrectIdx[Math.floor(Math.random() * incorrectIdx.length)];
    setEliminatedOption(removeIdx);
    setUsedHint(true);
  };

  const confirmExit = useCallback(() => {
    Alert.alert(
      t("quizGame.leaveTitle"),
      t("quizGame.leaveMsg"),
      [
        { text: t("quizGame.stay"), style: "cancel" },
        { text: t("quizGame.leave"), style: "destructive", onPress: () => navigation.goBack() },
      ],
      { cancelable: true }
    );
  }, [navigation]);

  // pause/resume BGM + back handler
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => { confirmExit(); return true; };
      BackHandler.addEventListener("hardwareBackPress", onBackPress);

      (async () => {
        try {
          if (AppPrefs.soundEnabled()) await bgmRef.current?.playAsync();
          else await bgmRef.current?.pauseAsync();
        } catch {}
      })();

      return () => {
        BackHandler.removeEventListener("hardwareBackPress", onBackPress);
        (async () => { try { await bgmRef.current?.pauseAsync(); } catch {} })();
      };
    }, [confirmExit])
  );

  // next / finish (includes Supabase)
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

    // finished
    let correctCnt = 0;
    const reviewDataLocalized = qset.map((q, i) => {
      const sel = next[i];
      const status = sel == null ? "unanswered" : sel === q.correctIndex ? "correct" : "incorrect";
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

    const reviewDataEN = qset.map((q, i) => {
      const sel = next[i];
      const status = sel == null ? "unanswered" : sel === q.correctIndex ? "correct" : "incorrect";
      return {
        number: i + 1,
        question: q.qEn,
        status,
        correctAnswer: q.optionsEn[q.correctIndex],
        selectedAnswer: sel == null ? null : q.optionsEn[sel],
        xpEarned: xpPerQuestion[i] ?? 0,
      };
    });

    const answersEN = qset.map((q, i) => {
      const sel = next[i];
      return sel == null ? null : q.optionsEn[sel];
    });

    const scorePercent = Math.round((correctCnt / questionCount) * 100);

    // Localized title (for UI)
    const quizTitleLocalized = isDaily ? dailyTitle : topicTitle;

    // Stable EN title to store in DB
    const catEnTitle = isDaily
      ? (enQuizzes?.daily?.title || "Daily Quiz")
      : (
          QUIZ_DB_EN?.categories?.find(c => c.id === topicId)?.title
          || String(topicTitle || topicId)
        );

    let setEnTitle = catEnTitle;
    if (!isDaily) {
      const catEn = QUIZ_DB_EN?.categories?.find(c => c.id === topicId);
      const setEn = catEn?.sets?.[Math.max(0, setNumber - 1)];
      setEnTitle = setEn?.title || `${catEnTitle} #${setNumber}`;
    }

    const quizTitleEnglish = isDaily ? catEnTitle : setEnTitle;

    const finalTotalXp = totalXp;

    (async () => {
      try {
        setUploading(true);
        const { data: userData, error: userError } = await supabase.auth.getUser();
        const userId = userData?.user?.id;
        if (!userError && userId) {
          const { error: insertError } = await supabase
          .from("quiz_results")
          .insert({
            user_id: userId,
            quiz_title: quizTitleEnglish,
            topic_id: isDaily ? "daily" : topicId,
            score: scorePercent,
            xp: finalTotalXp,
            answers: answersEN,
            review_data: reviewDataEN,
          });
          if (insertError) throw insertError;

          try {
            const { checkAndAwardBadges } = await import("../utils/badgesLogic");
            await checkAndAwardBadges(supabase, {
              lastQuiz: {
                title: quizTitleEnglish,
                scorePercent,
                createdAt: new Date().toISOString(),
              },
            });
          } catch (badgeErr) {
            console.warn("Badge awarding failed:", badgeErr?.message || badgeErr);
          }
        }
      } catch (e) {
        console.warn("Supabase save error:", e?.message || e);
        Alert.alert("Save failed", String(e?.message || e));
      } finally {
        try { await bgmRef.current?.stopAsync(); } catch {}
        setUploading(false);
        navigation.navigate("ResultSummary", {
          reviewData: reviewDataLocalized,
          quizTitle: quizTitleLocalized,
          scorePercent,
          xp: finalTotalXp,
          score: scorePercent,
          userAnswers: answersEN,
          backTo: { screen: "Quizzes" },
        });
      }
    })();
  };

  // expose VM to the screen
  const vm = {
    // i18n + layout
    t, insets,
    isDaily, dailyTitle, topicTitle,

    // question data
    current, questionCount, index,

    // selection/submission
    selectedIndex, setSelectedIndex,
    submitted, onSubmit,

    // hint
    eliminatedOption, usedHint, handleHint,

    // timer + anims
    remainingTime, progressAnim, flashAnim, isLowTime, barColor,

    // feedback + explanation
    feedback, showExplanation, setShowExplanation,

    // navigation / actions
    confirmExit, goNext,

    // save state
    uploading,
  };

  const QuizGameScreen = require("../screens/QuizGameScreen").default;
  return <QuizGameScreen vm={vm} />;
}
