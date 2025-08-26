// QuizSet.js — choose a quiz set (no difficulty levels)
import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context"; // 👈 use the context version

// Load quiz data from JSON
import quizData from "./assets/quiz.json";

// How many questions your Daily Quiz shows (matches QuizGame's daily sample: 8)
const DAILY_QUESTION_COUNT = 8;

// Map topic id -> image require(...)
const CATEGORY_IMAGES = {
  flood: require("./assets/flood.jpg"),
  fire: require("./assets/fire.jpg"),
  dengue: require("./assets/dengue.jpg"),
  firstaid: require("./assets/first_aid.jpg"),
  disease: require("./assets/disease.jpg"),
  earthquake: require("./assets/earthquake.jpg"),
  daily: require("./assets/daily.jpg"),
};

function HeaderBar({ title, onBack }) {
  return (
    <View style={s.header}>
      <TouchableOpacity
        onPress={onBack}
        style={s.headerBtn}
        accessibilityLabel="Back"
      >
        <Ionicons name="chevron-back" size={22} color="#111827" />
      </TouchableOpacity>
      <Text style={s.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={s.headerBtn} />
    </View>
  );
}

export default function QuizSet() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const topicId = params?.topicId ?? "daily";
  const topicNameParam = params?.topicTitle;
  const isDaily = !!params?.isDaily;

  // find the category from JSON (except for daily)
  const category =
    !isDaily &&
    quizData?.categories?.find(
      (c) => String(c.id).toLowerCase() === String(topicId).toLowerCase()
    );

  const topicTitle = useMemo(() => {
    if (topicNameParam) return topicNameParam;
    if (isDaily) return "Daily Quiz";
    return category?.title || "Quiz";
  }, [topicNameParam, isDaily, category?.title]);

  const topicImage = CATEGORY_IMAGES[topicId] || CATEGORY_IMAGES.daily;

  // Build sets from JSON (or a single Daily card)
  const sets = useMemo(() => {
    if (isDaily) {
      return [
        {
          id: "daily-today",
          index: 1,
          title: "Today’s Quiz",
          questions: DAILY_QUESTION_COUNT,
          img: CATEGORY_IMAGES.daily,
        },
      ];
    }

    if (!category?.sets?.length) return [];

    return category.sets.map((s, i) => ({
      id: s.id || `${topicId}-set-${i + 1}`,
      index: i + 1,
      title: s.title || `${category.title} #${i + 1}`,
      questions: Array.isArray(s.questions) ? s.questions.length : 0,
      img: topicImage,
    }));
  }, [isDaily, category, topicId, topicImage]);

  const startSet = (set) => {
    navigation.navigate("QuizGame", {
      topicId,
      topicTitle,
      setIndex: set.index,
      isDaily,
      difficulty: "standard",
      duration: 30,
      questionCount: set.questions,
    });
  };

  return (
    <SafeAreaView style={s.safeArea} edges={["top", "left", "right"]}>
      <HeaderBar title={topicTitle} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={s.container}>
        <Text style={s.pageTitle}>Choose a set</Text>
        <Text style={s.pageSub}>
          Pick any set to begin. Questions are the same difficulty, 30s per
          question.
        </Text>

        <View style={{ height: 6 }} />

        {sets.length === 0 ? (
          <View style={s.emptyBox}>
            <Ionicons name="alert-circle-outline" size={20} color="#9CA3AF" />
            <Text style={s.emptyText}>
              No sets available for this category.
            </Text>
          </View>
        ) : (
          sets.map((set) => (
            <TouchableOpacity
              key={set.id}
              style={s.setCard}
              activeOpacity={0.9}
              onPress={() => startSet(set)}
            >
              <Image source={set.img} style={s.thumb} />
              <View style={s.setInfo}>
                <Text style={s.setTitle} numberOfLines={1}>
                  {set.title}
                </Text>
                <Text style={s.setSub}>{set.questions} Questions</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#111827" />
            </TouchableOpacity>
          ))
        )}

        <View style={{ height: 14 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8FAFC" },

  /* Static header (prevents native header slide-left animation) */
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 0, // SafeAreaView handles top inset
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    backgroundColor: "#fff",
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontWeight: "600",
    color: "#111827",
    fontSize: 22,
  },

  container: {
    padding: 10,
    paddingHorizontal: 16,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
  },
  pageSub: {
    color: "#6B7280",
    fontWeight: "500",
    textAlign: "center",
    marginBottom: 8,
  },

  setCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 10,
    resizeMode: "cover",
  },
  setInfo: { flex: 1 },
  setTitle: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "800",
  },
  setSub: {
    color: "#6B7280",
    marginTop: 2,
    fontWeight: "600",
  },

  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },
  emptyText: {
    marginTop: 6,
    color: "#6B7280",
    fontWeight: "600",
  },
});
