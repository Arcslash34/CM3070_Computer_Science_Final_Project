// HistoryScreen.js — Score above Date icon, XP (with star) above Time icon (no SafeAreaView)
import React, { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Image,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
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

const ICONS = {
  date: require("./assets/date.png"),
  time: require("./assets/time.png"),
  xp: require("./assets/xp.png"),
};

const ICON = { size: 14, gap: 6 };

function getThumbByTitle(title = "") {
  const t = String(title).toLowerCase();
  if (t.includes("flood")) return CATEGORY_IMAGES.flood;
  if (t.includes("fire")) return CATEGORY_IMAGES.fire;
  if (t.includes("dengue") || t.includes("mosquito"))
    return CATEGORY_IMAGES.dengue;
  if (t.includes("first") || t.includes("aid")) return CATEGORY_IMAGES.firstaid;
  if (t.includes("disease")) return CATEGORY_IMAGES.disease;
  if (t.includes("earth") || t.includes("quake"))
    return CATEGORY_IMAGES.earthquake;
  if (t.includes("daily")) return CATEGORY_IMAGES.daily;
  return CATEGORY_IMAGES.daily;
}

const fmtDateOnly = (iso) => {
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return "—";
  }
};
const fmtTimeOnly = (iso) => {
  try {
    return new Date(iso).toLocaleTimeString();
  } catch {
    return "—";
  }
};

function StatRow({ src, text, tint = "#6B7280" }) {
  return (
    <View style={styles.statRow}>
      <Image
        source={src}
        resizeMode="contain"
        style={{
          width: ICON.size,
          height: ICON.size,
          tintColor: tint,
          marginRight: ICON.gap,
        }}
      />
      <Text style={[styles.statText, { color: tint }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

export default function HistoryScreen() {
  const navigation = useNavigation();
  const [results, setResults] = useState([]);
  const [query, setQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

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
    else console.error("Failed to fetch quiz results:", error?.message);
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

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: "Quiz History",
      headerTitleAlign: "center",
      headerRight: () => (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {results.length > 0 && (
            <TouchableOpacity
              onPress={() => setShowSearch((v) => !v)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={{ paddingHorizontal: 6 }}
            >
              <Ionicons name="search-outline" size={22} color="#111827" />
            </TouchableOpacity>
          )}
          {results.length > 0 && (
            <TouchableOpacity
              onPress={handleDeleteAll}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={{ paddingHorizontal: 6 }}
            >
              <Ionicons name="trash-outline" size={22} color="#111827" />
            </TouchableOpacity>
          )}
        </View>
      ),
    });
  }, [navigation, handleDeleteAll, results.length]);

  useFocusEffect(
    useCallback(() => {
      loadResults();
    }, [loadResults])
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return results;
    const q = query.trim().toLowerCase();
    return results.filter((r) =>
      String(r.quiz_title || "")
        .toLowerCase()
        .includes(q)
    );
  }, [results, query]);

  const openSummary = (quiz) => {
    navigation.navigate("ResultSummary", {
      reviewData: quiz.review_data || quiz.answers,
      quizTitle: quiz.quiz_title,
      scorePercent: quiz.score != null ? quiz.score : 0,
      xp: quiz.xp ?? 0,
      userAnswers: quiz.answers,
      score: quiz.score,
    });
  };

  const renderItem = ({ item, index }) => {
    const thumb = getThumbByTitle(item.quiz_title);
    const title = `#${index + 1} ${item.quiz_title || "Quiz"}`;
    const scoreText = item.score != null ? `${item.score}%` : "—";
    const xpVal = Number.isFinite(item.xp) ? item.xp : 0;

    return (
      <TouchableOpacity
        onPress={() => openSummary(item)}
        activeOpacity={0.9}
        style={styles.card}
      >
        <Image source={thumb} style={styles.thumb} />
        <View style={styles.cardBody}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>

          {/* 2 columns: left = Score + Date, right = XP + Time */}
          <View style={styles.twoCol}>
            {/* Left column: Score over Date (align with calendar icon) */}
            <View style={styles.col}>
              <Text style={styles.scoreText} numberOfLines={1}>
                Score: {scoreText}
              </Text>
              <StatRow src={ICONS.date} text={fmtDateOnly(item.created_at)} />
            </View>

            {/* Right column: XP (with star) over Time (align with clock icon) */}
            <View style={styles.col}>
              <View style={styles.xpRow}>
                <Image
                  source={ICONS.xp}
                  resizeMode="contain"
                  style={{
                    width: ICON.size,
                    height: ICON.size,
                    tintColor: "#111827",
                    marginRight: ICON.gap,
                  }}
                />
                <Text style={styles.scoreText} numberOfLines={1}>
                  {xpVal} XP
                </Text>
              </View>
              <StatRow src={ICONS.time} text={fmtTimeOnly(item.created_at)} />
            </View>
          </View>
        </View>

        <Ionicons name="chevron-forward" size={18} color="#111827" />
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F7FB" }}>
      <View style={styles.container}>
        {showSearch && (
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={18} color="#6B7280" />
            <TextInput
              placeholder="Search quizzes…"
              placeholderTextColor="#9CA3AF"
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
            />
            {!!query && (
              <TouchableOpacity onPress={() => setQuery("")}>
                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {filtered.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="alert-circle-outline" size={20} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>No quiz history yet</Text>
            <Text style={styles.emptyText}>Finish a quiz to see it here.</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 16 }}
          />
        )}
      </View>
    </View>
  );
}

const CARD_RADIUS = 16;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 10,
    backgroundColor: "#F5F7FB",
  },

  /** search */
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    color: "#111827",
    fontSize: 14,
    paddingVertical: 0,
  },

  /** list card */
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 12,
    resizeMode: "cover",
  },
  cardBody: { flex: 1 },
  title: { color: "#111827", fontSize: 16, fontWeight: "800" },

  /** two-column grid under the title */
  twoCol: {
    marginTop: 6,
    flexDirection: "row",
    columnGap: 14,
  },
  col: {
    flex: 1,
  },

  /** text rows */
  scoreText: { color: "#374151", fontWeight: "700" },
  xpRow: { flexDirection: "row", alignItems: "center" },

  /** stat rows (icon + text) */
  statRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  statText: { fontWeight: "700", fontSize: 13 },

  /** empty state */
  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#E5E7EB",
    borderWidth: 1,
    borderRadius: CARD_RADIUS,
    paddingVertical: 28,
    marginTop: 12,
  },
  emptyTitle: {
    color: "#111827",
    fontWeight: "800",
    marginTop: 6,
    fontSize: 16,
  },
  emptyText: { color: "#6B7280", fontWeight: "600", marginTop: 2 },
});
