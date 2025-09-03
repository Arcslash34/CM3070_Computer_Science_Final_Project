// containers/QuizzesContainer.js
import React, { useLayoutEffect, useMemo } from "react";
import { useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { i18n, t } from "../translations/translation";
import { getQuiz } from "../utils/quizLoader";

const CATEGORY_IMAGES = {
  flood: require("../assets/flood.jpg"),
  fire: require("../assets/fire.jpg"),
  dengue: require("../assets/dengue.jpg"),
  firstaid: require("../assets/first_aid.jpg"),
  disease: require("../assets/disease.jpg"),
  earthquake: require("../assets/earthquake.jpg"),
};
const TOPIC_ORDER = ["flood", "fire", "dengue", "firstaid", "disease", "earthquake"];

export default function QuizzesContainer() {
  const navigation = useNavigation();

  // Hide native header to match app style
  useLayoutEffect(() => {
    navigation.setOptions?.({ headerShown: false });
  }, [navigation]);

  // Load quizzes localized for current locale
  const QUIZ = useMemo(() => getQuiz(), [i18n.locale]);

  // Build localized topic list
  const topics = useMemo(() => {
    return TOPIC_ORDER.map((id) => {
      const cat = QUIZ?.categories?.find?.((c) => c.id === id);
      return {
        id,
        title: t(`quizzes.categories.${id}.title`, { defaultValue: cat?.title ?? id }),
        img: CATEGORY_IMAGES[id],
      };
    });
  }, [QUIZ, i18n.locale]);

  // Actions passed to screen
  const onOpenDaily = () =>
    navigation.navigate("QuizGame", {
      topicId: "daily",
      topicTitle: t("quizzes.daily.title"),
      isDaily: true,
    });

  const onOpenHistory = () => navigation.navigate("HistoryContainer");

  const onOpenTopic = (topic) =>
    navigation.navigate("QuizSet", {
      topicId: topic.id,
      topicTitle: topic.title, // localized
    });

  const vm = {
    t,
    topics,
    onOpenDaily,
    onOpenHistory,
    onOpenTopic,
  };

  const QuizzesScreen = require("../screens/QuizzesScreen").default;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F3F4F6" }} edges={["top", "left", "right"]}>
      <QuizzesScreen vm={vm} />
    </SafeAreaView>
  );
}
