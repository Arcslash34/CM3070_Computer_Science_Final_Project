// HistoryScreen.js — Past results styled like QuizSet cards (trash in header)
import React, { useCallback, useLayoutEffect, useState } from "react";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "./supabase";

const CATEGORY_IMAGES = {
  flood: require("./assets/flood.jpg"),
  fire: require("./assets/fire.jpg"),
  dengue: require("./assets/dengue.jpg"),
  firstaid: require("./assets/first_aid.jpg"),
  disease: require("./assets/disease.jpg"),
  earthquake: require("./assets/earthquake.jpg"),
  daily: require("./assets/daily.jpg"),
};

function getThumbByTitle(title = "") {
  const t = String(title).toLowerCase();
  if (t.includes("flood")) return CATEGORY_IMAGES.flood;
  if (t.includes("fire")) return CATEGORY_IMAGES.fire;
  if (t.includes("dengue") || t.includes("mosquito")) return CATEGORY_IMAGES.dengue;
  if (t.includes("first") || t.includes("aid")) return CATEGORY_IMAGES.firstaid;
  if (t.includes("disease")) return CATEGORY_IMAGES.disease;
  if (t.includes("earth") || t.includes("quake")) return CATEGORY_IMAGES.earthquake;
  if (t.includes("daily")) return CATEGORY_IMAGES.daily;
  return CATEGORY_IMAGES.daily;
}

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function HistoryScreen() {
  const [results, setResults] = useState([]);
  const navigation = useNavigation();

  const loadResults = useCallback(async () => {
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;
    if (!userId) return;

    const { data, error } = await supabase
      .from("quiz_results")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (!error) setResults(data || []);
    else console.error("Failed to fetch quiz results:", error.message);
  }, []);

  const handleDeleteAll = useCallback(() => {
    Alert.alert("Confirm", "Delete all quiz results?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const { data: session } = await supabase.auth.getSession();
          const userId = session?.session?.user?.id;
          if (!userId) return;
          await supabase.from("quiz_results").delete().eq("user_id", userId);
          loadResults();
        },
      },
    ]);
  }, [loadResults]);

  // Put the trash icon in the native header; hide if no results
  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: "Past Results",
      headerTitleAlign: "center",
      headerRight: results.length
        ? () => (
            <TouchableOpacity
              onPress={handleDeleteAll}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={{ paddingHorizontal: 6 }}
            >
              <Ionicons name="trash-outline" size={22} color="#271111ff" />
            </TouchableOpacity>
          )
        : undefined,
    });
  }, [navigation, handleDeleteAll, results.length]);

  useFocusEffect(
    useCallback(() => {
      loadResults();
    }, [loadResults])
  );

  const openSummary = (quiz) => {
    navigation.navigate("ResultSummary", {
      reviewData: quiz.review_data || quiz.answers,
      quizTitle: quiz.quiz_title,
      scorePercent: quiz.score != null ? quiz.score : 0,
      xp: 0,
      userAnswers: quiz.answers,
      difficulty: quiz.difficulty,
      score: quiz.score,
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
      <ScrollView contentContainerStyle={s.container}>
        <Text style={s.pageTitle}>📚 Past Quiz Results</Text>
        <Text style={s.pageSub}>Tap any result to view your detailed review.</Text>

        <View style={{ height: 6 }} />

        {results.length === 0 ? (
          <View style={s.emptyBox}>
            <Ionicons name="alert-circle-outline" size={20} color="#9CA3AF" />
            <Text style={s.emptyText}>No past quizzes yet</Text>
            <Text style={s.emptyText2}>
              Complete a quiz and your results will appear here.
            </Text>
          </View>
        ) : (
          <>
            {results.map((r) => {
              const thumb = getThumbByTitle(r.quiz_title);
              const scoreText = r.score != null ? `${r.score}%` : "—";
              const diffText = r.difficulty ? ` • ${r.difficulty}` : "";
              return (
                <TouchableOpacity
                  key={r.id}
                  onPress={() => openSummary(r)}
                  style={s.setCard}
                  activeOpacity={0.9}
                >
                  <Image source={thumb} style={s.thumb} />
                  <View style={s.setInfo}>
                    <Text style={s.setTitle} numberOfLines={1}>
                      {r.quiz_title || "Quiz"}
                    </Text>
                    <Text style={s.setSub} numberOfLines={1}>
                      Score: {scoreText}
                      {diffText}
                    </Text>
                    <Text style={s.setMeta} numberOfLines={1}>
                      {fmtDate(r.created_at)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#111827" />
                </TouchableOpacity>
              );
            })}
          </>
        )}

        <View style={{ height: 14 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginTop: 10
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
  setTitle: { color: "#111827", fontSize: 17, fontWeight: "800" },
  setSub: { color: "#6B7280", marginTop: 2, fontWeight: "600" },
  setMeta: { color: "#9CA3AF", marginTop: 2, fontWeight: "600", fontSize: 12 },

  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    marginTop: 4,
  },
  emptyText: { marginTop: 6, color: "#111827", fontWeight: "700" },
  emptyText2: { marginTop: 4, color: "#6B7280", fontWeight: "600", textAlign: "center" },
});
