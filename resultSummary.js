// ResultSummary.js
import React, { useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  Image,
  TouchableOpacity,
  BackHandler, // ⬅️ add
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useNavigation, useFocusEffect } from "@react-navigation/native"; // ⬅️ useFocusEffect
import { SafeAreaView } from "react-native-safe-area-context";

const TROPHY_IMG = require("./assets/congrat.png");

export default function ResultSummary({ route }) {
  const navigation = useNavigation();

  const {
    reviewData,
    quizTitle = "Quiz Review",
    scorePercent = 0,
    xp = 0,
    // legacy
    score = 0,
    userAnswers = [],
    difficulty,
    backTo,
  } = route.params || {};

  const goBackSmart = useCallback(() => {
    // If caller provided a target, honor it
    if (backTo?.screen) {
      // Special case: Quizzes tab lives inside MainTabs
      if (backTo.screen === "Quizzes") {
        navigation.navigate("MainTabs", { screen: "Quizzes" });
      } else {
        navigation.navigate(backTo.screen, backTo.params || {});
      }
      return;
    }

    // Default: send user to the Quizzes tab inside MainTabs
    navigation.navigate("MainTabs", { screen: "Quizzes" });
  }, [navigation, backTo]);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        goBackSmart();
        return true;
      };
      BackHandler.addEventListener("hardwareBackPress", onBackPress);
      return () =>
        BackHandler.removeEventListener("hardwareBackPress", onBackPress);
    }, [goBackSmart])
  );

  const parsed = useMemo(() => {
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

  const legacyQuizzes = useMemo(() => {
    if (parsed) return [];
    return [];
  }, [parsed]);

  const hasNewData = Array.isArray(parsed) && parsed.length > 0;
  const headerScore = hasNewData ? scorePercent : score;

  const headline =
    headerScore >= 90
      ? "Outstanding!"
      : headerScore >= 75
      ? "Great job!"
      : headerScore >= 50
      ? "Nice effort — keep going!"
      : "Don't give up — try again!";

  const renderNewItem = ({ item }) => {
    let borderColor = "#10B981";
    if (item.status === "incorrect") borderColor = "#EF4444";
    else if (item.status === "unanswered") borderColor = "#7C3AED";

    return (
      <View style={[styles.card, { borderLeftColor: borderColor }]}>
        <Text style={styles.qNumber}>Q{item.number}</Text>
        <Text style={styles.question}>{item.question}</Text>

        {item.status === "incorrect" && (
          <Text style={styles.incorrect}>Wrong Answer</Text>
        )}
        {item.status === "unanswered" && (
          <Text style={styles.unanswered}>Time’s up, No Answer Selected</Text>
        )}

        <Text style={styles.correct}>Correct Answer: {item.correctAnswer}</Text>
        <Text style={styles.answer}>
          Your Answer: {item.selectedAnswer || "—"}
        </Text>
      </View>
    );
  };

  const SummaryHeader = () => (
    <>
      <SafeAreaView edges={["top", "left", "right"]} style={styles.topSafe}>
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={goBackSmart}
            style={styles.topBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={24} color="#111827" />
          </TouchableOpacity>

          <Text style={styles.topTitle} numberOfLines={1}>
            {quizTitle}
          </Text>

          <View style={styles.topBtn} />
        </View>
      </SafeAreaView>

      <View style={styles.heroWrap}>
        <Image source={TROPHY_IMG} style={styles.trophy} />
        <Text style={styles.headline}>{headline}</Text>

        {/* KPI row (icon left, value/label right; both centered) */}
        <View style={styles.kpiRow}>
          {/* Score */}
          <View style={styles.kpiCard}>
            <MaterialIcons
              name="switch-access-shortcut-add"
              size={38}
              color="#111827"
              style={styles.kpiIcon}
            />
            <View style={styles.kpiTextCol}>
              <Text style={styles.kpiValue}>{headerScore}%</Text>
              <Text style={styles.kpiLabel}>Your Score</Text>
            </View>
          </View>

          {/* XP */}
          <View style={styles.kpiCard}>
            <MaterialIcons
              name="stars"
              size={38}
              color="#111827"
              style={styles.kpiIcon}
            />
            <View style={styles.kpiTextCol}>
              <Text style={styles.kpiValue}>{xp}</Text>
              <Text style={styles.kpiLabel}>XP Earned</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionDivider} />
        <Text style={styles.sectionTitle}>Answer Review</Text>
      </View>
    </>
  );

  if (hasNewData) {
    return (
      <FlatList
        data={parsed}
        keyExtractor={(_, idx) => String(idx)}
        renderItem={renderNewItem}
        contentContainerStyle={{
          paddingBottom: 20,
          backgroundColor: "#F9FAFB",
        }}
        ListHeaderComponent={<SummaryHeader />}
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <SummaryHeader />
      {!legacyQuizzes.length ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <Text>
            Nothing to show. (Unknown difficulty or quiz list missing.)
          </Text>
        </View>
      ) : (
        <></>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 16, backgroundColor: "#F9FAFB", flexGrow: 1 },
  topSafe: { backgroundColor: "#FFFFFF" },
  topBar: {
    height: 50,
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
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    maxWidth: "70%",
    textAlign: "center",
  },
  heroWrap: { paddingHorizontal: 16, paddingTop: 14 },
  trophy: {
    alignSelf: "center",
    width: 240,
    height: 240,
    resizeMode: "contain",
    marginBottom: 6,
  },
  headline: {
    textAlign: "center",
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 15,
  },
  kpiRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  kpiCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingVertical: 8,
    paddingHorizontal: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  kpiIcon: { marginRight: 12 },
  kpiTextCol: {
    alignItems: "center",
    justifyContent: "center",
  },
  kpiValue: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  kpiLabel: { color: "#6B7280", fontSize: 13, textAlign: "center" },
  sectionDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginTop: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 10,
    textAlign: "center",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    marginBottom: 14,
    padding: 14,
    borderLeftWidth: 5,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    marginHorizontal: 16,
  },
  qNumber: { color: "#6B7280", fontWeight: "bold", marginBottom: 4 },
  question: { color: "#111827", marginBottom: 6, fontWeight: "600" },
  correct: { color: "#059669", fontWeight: "bold" },
  answer: { color: "#374151", marginTop: 4 },
  incorrect: { color: "#DC2626", fontWeight: "bold" },
  unanswered: { color: "#7C3AED", fontWeight: "bold" },
});
