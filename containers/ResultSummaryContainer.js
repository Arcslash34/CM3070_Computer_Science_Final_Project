// containers/ResultSummaryContainer.js
import React, { useMemo, useCallback } from "react";
import { BackHandler } from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { t, i18n } from "../translations/translation";
import { buildQuestionMap, relocalizeReviewItem } from "../utils/resultLocalization";

export default function ResultSummaryContainer() {
  const navigation = useNavigation();
  const { params = {} } = useRoute();

  const {
    reviewData,
    quizTitle = "Quiz Review",
    scorePercent = 0,
    xp = 0,
    score = 0,                 // legacy
    userAnswers = [],          // legacy
    difficulty,                // legacy
    backTo,
  } = params;

  // smart back
  const goBackSmart = useCallback(() => {
    if (backTo?.screen) {
      if (backTo.screen === "Quizzes") {
        navigation.navigate("MainTabs", { screen: "Quizzes" });
      } else {
        navigation.navigate(backTo.screen, backTo.params || {});
      }
      return;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate("MainTabs", { screen: "Quizzes" });
  }, [navigation, backTo]);

  // hardware back -> smart back
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        goBackSmart();
        return true;
      };
      BackHandler.addEventListener("hardwareBackPress", onBackPress);
      return () => BackHandler.removeEventListener("hardwareBackPress", onBackPress);
    }, [goBackSmart])
  );

  // parse incoming review data (array/string/obj.review_data)
  const parsedEN = useMemo(() => {
    if (!reviewData) return null;
    try {
      if (Array.isArray(reviewData)) return reviewData;
      if (typeof reviewData === "string") return JSON.parse(reviewData);
      if (Array.isArray(reviewData?.review_data)) return reviewData.review_data;
      if (typeof reviewData?.review_data === "string")
        return JSON.parse(reviewData.review_data);
      return null;
    } catch (e) {
      console.warn("Failed to parse reviewData:", e?.message);
      return null;
    }
  }, [reviewData]);

  // localize the saved EN rows to current UI language
  const enToLocalMap = useMemo(() => buildQuestionMap(), [i18n.locale]);
  const parsed = useMemo(() => {
    if (!Array.isArray(parsedEN)) return null;
    return parsedEN.map((row) => relocalizeReviewItem(row, enToLocalMap));
  }, [parsedEN, enToLocalMap]);

  const hasNewData = Array.isArray(parsed) && parsed.length > 0;
  const headerScore = hasNewData ? scorePercent : score;

  // headline (localized)
  const headline =
    headerScore >= 90
      ? t("resultSummary.headlineOutstanding", { defaultValue: "Outstanding!" })
      : headerScore >= 75
      ? t("resultSummary.headlineGreat", { defaultValue: "Great job!" })
      : headerScore >= 50
      ? t("resultSummary.headlineNice", { defaultValue: "Nice effort — keep going!" })
      : t("resultSummary.headlineKeepTrying", { defaultValue: "Don't give up — try again!" });

  const vm = {
    // strings/labels
    t,

    // handlers
    goBackSmart,

    // header data
    quizTitle,
    headline,
    headerScore,
    xp,

    // list data (already localized)
    items: hasNewData ? parsed : [],

    // legacy fallbacks
    hasNewData,
  };

  const ResultSummaryScreen = require("../screens/ResultSummaryScreen").default;
  return <ResultSummaryScreen vm={vm} />;
}
