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
import { t, i18n } from "./translations/translation";

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

/** Thumbnail strictly from topic_id (fallback to 'daily') */
function getThumb({ topic_id }) {
  if (topic_id && CATEGORY_IMAGES[topic_id]) return CATEGORY_IMAGES[topic_id];
  return CATEGORY_IMAGES.daily;
}

const fmtDateOnly = (iso) => {
  try {
    return new Intl.DateTimeFormat(i18n.locale || undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
};
const fmtTimeOnly = (iso) => {
  try {
    return new Intl.DateTimeFormat(i18n.locale || undefined, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
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

/** Map a saved row to a localized, user-visible title */
function getLocalizedTitle(item) {
  const topicId = item?.topic_id;
  const saved = String(item?.quiz_title || "");

  // Grab trailing set number in formats like: "Flood #1", "Flood 1", "Flood Set 1"
  const m = saved.match(/(?:#|\bset\s*)?(\d+)\b/i);
  const setNum = m ? m[1] : null;

  const base =
    topicId === "daily"
      ? t("quizzes.daily.title")
      : topicId
      ? t(`quizzes.categories.${topicId}.title`, { defaultValue: saved })
      : saved;

  return setNum ? `${base} #${setNum}` : base;
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
    Alert.alert(
      t("history.history.confirm"),
      t("history.history.deleteAllMsg"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            const { data: session } = await supabase.auth.getSession();
            const userId = session?.session?.user?.id;
            if (!userId) return;
            await supabase.from("quiz_results").delete().eq("user_id", userId);
            loadResults();
          },
        },
      ]
    );
  }, [loadResults]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: t("history.history.title"),
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
  }, [navigation, handleDeleteAll, results.length, i18n.locale]);

  useFocusEffect(
    useCallback(() => {
      loadResults();
    }, [loadResults])
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return results;
    const q = query.trim().toLowerCase();
    // Search against the LOCALIZED title so search makes sense in the current UI language
    return results.filter((r) =>
      String(getLocalizedTitle(r) || "").toLowerCase().includes(q)
    );
  }, [results, query, i18n.locale]);

  const openSummary = (quiz) => {
    // Pass a localized title into the summary screen
    const localized = getLocalizedTitle(quiz);
    navigation.navigate("ResultSummary", {
      reviewData: quiz.review_data || quiz.answers,
      quizTitle: localized,
      scorePercent: quiz.score != null ? quiz.score : 0,
      xp: quiz.xp ?? 0,
      userAnswers: quiz.answers,
      score: quiz.score,
    });
  };

  const renderItem = ({ item, index }) => {
    const thumb = getThumb({
      topic_id: item.topic_id,
    });

    // LOCALIZED title for display
    const localizedTitle = getLocalizedTitle(item);
    const title = `#${index + 1} ${localizedTitle}`;

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
                {t("history.history.scoreLabel")}: {scoreText}
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
              placeholder={t("history.history.searchPlaceholder")}
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
            <Text style={styles.emptyTitle}>
              {t("history.history.emptyTitle")}
            </Text>
            <Text style={styles.emptyText}>
              {t("history.history.emptyText")}
            </Text>
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
