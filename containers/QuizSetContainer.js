// containers/QuizSetContainer.js
import React, { useMemo, useCallback } from "react";
import { useNavigation, useRoute } from "@react-navigation/native";
import { getQuiz } from "../utils/quizLoader";
import { i18n, t } from "../translations/translation";

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

export default function QuizSetContainer() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const quizData = React.useMemo(() => getQuiz(), [i18n.locale]);

  const topicId = params?.topicId ?? "daily";
  const topicNameParam = params?.topicTitle;
  const isDaily = !!params?.isDaily;

  const category = !isDaily
    ? quizData?.categories?.find(
        (c) => String(c.id).toLowerCase() === String(topicId).toLowerCase()
      )
    : null;

  // Title priority: param → daily key → category title → fallback
  const topicTitle = useMemo(() => {
    if (topicNameParam) return topicNameParam;
    if (isDaily) return t("quizzes.daily.title");
    return (
      t(`quizzes.categories.${topicId}.title`, { defaultValue: category?.title }) ||
      t("quizSet.quiz")
    );
  }, [topicNameParam, isDaily, category?.title, topicId]);

  const topicImage = CATEGORY_IMAGES[topicId] || CATEGORY_IMAGES.daily;

  // define startSet BEFORE sets memo so we can attach handlers
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

  // Build sets list and attach onPress/start for the screen to call
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
      built.start = built.onPress; // screen fallback
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
      // attach handler so the presentational screen can stay dumb
      built.onPress = () => startSet(built);
      built.start = built.onPress; // screen fallback
      return built;
    });
  }, [isDaily, category, topicId, topicImage, startSet]);

  const vm = {
    t,
    onBack: () => navigation.goBack(),
    topicTitle,
    sets,
  };

  const QuizSetScreen = require("../screens/QuizSetScreen").default;
  return <QuizSetScreen vm={vm} />;
}
