/**
 * containers/QuizSetContainer.js — Build & launch quiz sets
 *
 * Purpose
 * - Prepare the list of available quiz sets for a topic, or a single “Daily” set.
 * - Provide stable titles/images via i18n and a small mapping.
 * - Navigate into the QuizGame flow with the correct params (topic, set index, etc.).
 *
 * Key Behaviours
 * - Daily mode: single set with a fixed question count (8).
 * - Topic mode: derive sets from quiz DB; attach `onPress`/`start` handlers for the screen.
 * - Titles prefer route param → i18n daily key → category title → fallback.
 *
 * Exports
 * - Default React component <QuizSetContainer/> that renders <QuizSetScreen vm={...} />.
 */

import React, { useMemo, useCallback } from "react";
import { useNavigation, useRoute } from "@react-navigation/native";
import { getQuiz } from "../utils/quizLoader";
import { i18n, t } from "../translations/translation";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const DAILY_QUESTION_COUNT = 8;

const CATEGORY_IMAGES = {
  flood: require("../assets/flood.jpg"),
  fire: require("../assets/fire.jpg"),
  dengue: require("../assets/dengue.jpg"),
  firstaid: require("../assets/first_aid.jpg"),
  disease: require("../assets/disease.jpg"),
  earthquake: require("../assets/earthquake.jpg"),
  daily: require("../assets/daily.jpg"),
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function QuizSetContainer() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const quizData = React.useMemo(() => getQuiz(), [i18n.locale]);

  // -------------------------------------------------------------------------
  // Route params / topic selection
  // -------------------------------------------------------------------------
  const topicId = params?.topicId ?? "daily";
  const topicNameParam = params?.topicTitle;
  const isDaily = !!params?.isDaily;

  const category = !isDaily
    ? quizData?.categories?.find(
        (c) => String(c.id).toLowerCase() === String(topicId).toLowerCase()
      )
    : null;

  // -------------------------------------------------------------------------
  // Title & imagery
  // -------------------------------------------------------------------------
  const topicTitle = useMemo(() => {
    if (topicNameParam) return topicNameParam;
    if (isDaily) return t("quizzes.daily.title");
    return (
      t(`quizzes.categories.${topicId}.title`, {
        defaultValue: category?.title,
      }) || t("quizSet.quiz")
    );
  }, [topicNameParam, isDaily, category?.title, topicId]);

  const topicImage = CATEGORY_IMAGES[topicId] || CATEGORY_IMAGES.daily;

  // -------------------------------------------------------------------------
  // Navigation handler injected into set items
  // -------------------------------------------------------------------------
  const startSet = useCallback(
    (set) => {
      navigation.navigate("QuizGame", {
        topicId,
        topicTitle,
        setIndex: set.index,
        isDaily,
        difficulty: "standard",
        duration: 30,
        questionCount: set.questions,
      });
    },
    [navigation, topicId, topicTitle, isDaily]
  );

  // -------------------------------------------------------------------------
  // Build list of sets exposed to the screen
  // -------------------------------------------------------------------------
  const sets = useMemo(() => {
    if (isDaily) {
      const built = {
        id: "daily-today",
        index: 1,
        title: t("quizSet.today"),
        questions: DAILY_QUESTION_COUNT,
        img: CATEGORY_IMAGES.daily,
      };
      built.onPress = () =>
        startSet({ index: 1, questions: DAILY_QUESTION_COUNT });
      built.start = built.onPress;
      return [built];
    }

    if (!category?.sets?.length) return [];

    return category.sets.map((s, i) => {
      const built = {
        id: s.id || `${topicId}-set-${i + 1}`,
        index: i + 1,
        title: s.title || `${category.title} #${i + 1}`,
        questions: Array.isArray(s.questions) ? s.questions.length : 0,
        img: topicImage,
      };
      built.onPress = () => startSet(built);
      built.start = built.onPress;
      return built;
    });
  }, [isDaily, category, topicId, topicImage, startSet]);

  // -------------------------------------------------------------------------
  // View-model
  // -------------------------------------------------------------------------
  const vm = {
    t,
    onBack: () => navigation.goBack(),
    topicTitle,
    sets,
  };

  const QuizSetScreen = require("../screens/QuizSetScreen").default;
  return <QuizSetScreen vm={vm} />;
}
