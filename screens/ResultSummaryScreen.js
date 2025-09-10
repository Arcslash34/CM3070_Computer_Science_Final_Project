/**
 * screens/ResultSummaryScreen.js — Quiz results summary (presentational)
 *
 * Purpose
 * - Show a celebratory header (score + XP) and per-question review.
 * - Support both list-backed (FlatList) rendering and a minimal fallback view.
 *
 * ViewModel (vm) contract
 * - i18n: t
 * - nav: goBackSmart()
 * - header: quizTitle, headline, headerScore (0–100), xp
 * - data: items [{ number, question, correctAnswer, selectedAnswer, status: "correct"|"incorrect"|"unanswered" }]
 * - flags: hasNewData (controls FlatList vs fallback)
 *
 * Key Behaviours
 * - Safe-area aware static header bar with back button.
 * - KPI cards for score and XP.
 * - Color-coded review cards (green correct, red incorrect, purple unanswered).
 *
 * UX / Accessibility
 * - Back button has a11y label; consider adding `accessibilityRole="button"` to touchables.
 * - Large, readable contrasts and generous spacing.
 *
 * Performance Notes
 * - FlatList used for potentially long reviews; header provided via ListHeaderComponent.
 *
 * Fail-safes
 * - Fallback scroll screen renders when `hasNewData` is false.
 * - Defensive defaults for i18n via `{ defaultValue: ... }`.
 */

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  Image,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SafeAreaView } from "react-native-safe-area-context";

const TROPHY_IMG = require("../assets/congrat.png");

export default function ResultSummaryScreen({ vm }) {
  const {
    t,
    goBackSmart,
    quizTitle,
    headline,
    headerScore,
    xp,
    items,
    hasNewData,
  } = vm;

  const SummaryHeader = () => (
    <>
      <SafeAreaView edges={["top", "left", "right"]} style={styles.topSafe}>
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={goBackSmart}
            style={styles.topBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel={t("common.back", { defaultValue: "Go back" })}
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

        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <MaterialIcons
              name="switch-access-shortcut-add"
              size={38}
              color="#111827"
              style={styles.kpiIcon}
            />
            <View style={styles.kpiTextCol}>
              <Text style={styles.kpiValue}>{headerScore}%</Text>
              <Text style={styles.kpiLabel}>
                {t("resultSummary.yourScore", { defaultValue: "Your Score" })}
              </Text>
            </View>
          </View>

          <View style={styles.kpiCard}>
            <MaterialIcons
              name="stars"
              size={38}
              color="#111827"
              style={styles.kpiIcon}
            />
            <View style={styles.kpiTextCol}>
              <Text style={styles.kpiValue}>{xp}</Text>
              <Text style={styles.kpiLabel}>
                {t("resultSummary.xpEarned", { defaultValue: "XP Earned" })}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionDivider} />
        <Text style={styles.sectionTitle}>
          {t("resultSummary.answerReview", { defaultValue: "Answer Review" })}
        </Text>
      </View>
    </>
  );

  const renderItem = ({ item }) => {
    let borderColor = "#10B981";
    if (item.status === "incorrect") borderColor = "#EF4444";
    else if (item.status === "unanswered") borderColor = "#7C3AED";

    return (
      <View style={[styles.card, { borderLeftColor: borderColor }]}>
        <Text style={styles.qNumber}>
          {t("resultSummary.qNumber", {
            defaultValue: "Q{{n}}",
            n: item.number,
          })}
        </Text>

        <Text style={styles.question}>{item.question}</Text>

        {item.status === "incorrect" && (
          <Text style={styles.incorrect}>
            {t("resultSummary.incorrect", { defaultValue: "Wrong Answer" })}
          </Text>
        )}
        {item.status === "unanswered" && (
          <Text style={styles.unanswered}>
            {t("resultSummary.unanswered", {
              defaultValue: "Time’s up, No Answer Selected",
            })}
          </Text>
        )}

        <Text style={styles.correct}>
          {t("resultSummary.correctAnswer", {
            defaultValue: "Correct Answer:",
          })}{" "}
          {item.correctAnswer}
        </Text>
        <Text style={styles.answer}>
          {t("resultSummary.yourAnswer", { defaultValue: "Your Answer:" })}{" "}
          {item.selectedAnswer || "—"}
        </Text>
      </View>
    );
  };

  if (hasNewData) {
    return (
      <FlatList
        data={items}
        keyExtractor={(_, idx) => String(idx)}
        renderItem={renderItem}
        contentContainerStyle={{
          paddingBottom: 20,
          backgroundColor: "#F9FAFB",
        }}
        ListHeaderComponent={<SummaryHeader />}
      />
    );
  }

  // fallback view
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <SummaryHeader />
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <Text>
          {t("resultSummary.nothingToShow", {
            defaultValue:
              "Nothing to show. (Unknown difficulty or quiz list missing.)",
          })}
        </Text>
      </View>
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
  kpiRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
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
  kpiTextCol: { alignItems: "center", justifyContent: "center" },
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
