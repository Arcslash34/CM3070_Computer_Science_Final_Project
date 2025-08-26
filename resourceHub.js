// resourceHub.js
import React, { useMemo, useState, useLayoutEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  StatusBar,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import RESOURCES from "./assets/resource.json";

const CATEGORIES = [
  "All",
  ...Array.from(new Set(RESOURCES.map((r) => r.category))),
];

// visual accents per category
const CAT_ACCENTS = {
  Cardiac: { bg: "#FDF2F2", text: "#B91C1C", stripe: "#FCA5A5" },
  Airway: { bg: "#EFF6FF", text: "#1D4ED8", stripe: "#93C5FD" },
  Trauma: { bg: "#ECFDF5", text: "#047857", stripe: "#A7F3D0" },
  Burns: { bg: "#FFF7ED", text: "#C2410C", stripe: "#FED7AA" },
  Environmental: { bg: "#F0F9FF", text: "#0C4A6E", stripe: "#A5F3FC" },
  Fire: { bg: "#FEF3F2", text: "#C2410C", stripe: "#FDBA74" },
  Infectious: { bg: "#FDF4FF", text: "#7E22CE", stripe: "#E9D5FF" },
  Flooding: { bg: "#ECFEFF", text: "#0E7490", stripe: "#A5F3FC" },
  default: { bg: "#EEF2FF", text: "#4338CA", stripe: "#C7D2FE" },
};

const CHIP_WIDTH = 112;
const CHIP_HEIGHT = 32;
const CHIP_ROW_VPAD = 6;
const CHIP_ROW_HEIGHT = CHIP_HEIGHT + CHIP_ROW_VPAD * 2;
const MAX_QUICK = 3;

export default function ResourceHub() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [sortAlpha, setSortAlpha] = useState(false);
  const navigation = useNavigation();

  // Hide native header for this screen
  useLayoutEffect(() => {
    navigation.setOptions?.({ headerShown: false });
  }, [navigation]);

  // Filter
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return RESOURCES.filter((r) => {
      const inCategory = category === "All" || r.category === category;
      const inText =
        !q ||
        r.title.toLowerCase().includes(q) ||
        (r.tags?.some?.((t) => t.toLowerCase().includes(q)) ?? false);
      return inCategory && inText;
    });
  }, [query, category]);

  // Sort
  const items = useMemo(() => {
    const arr = [...filtered];
    if (sortAlpha) arr.sort((a, b) => a.title.localeCompare(b.title));
    return arr;
  }, [filtered, sortAlpha]);

  const hasQuery = query.trim().length > 0;
  const countLabel = `${filtered.length} ${
    filtered.length === 1 ? "Guide" : "Guides"
  }`;
  const scopeLabel = category === "All" ? "All topics" : category;
  const headerText = hasQuery
    ? `${countLabel} • matching “${query.trim()}”`
    : `${countLabel} • ${scopeLabel}`;
  const headerAccent =
    category === "All"
      ? "#6B7280"
      : (CAT_ACCENTS[category] || CAT_ACCENTS.default).text;

  const openArticle = (item) =>
    navigation.navigate("ResourceArticle", { article: item });

  return (
    <SafeAreaView
      style={styles.container}
      edges={["top", "left", "right", "bottom"]}
    >
      {Platform.OS === "android" && (
        <StatusBar
          translucent={false}
          backgroundColor="transparent"
          barStyle="dark-content"
        />
      )}

      {/* Brand row */}
      <View style={styles.brandRow}>
        <Image
          source={require("./assets/logo1.png")}
          style={styles.brandLogoImg}
        />
        <Text style={styles.brandTitle}>Resource Hub</Text>
      </View>

      {/* Search + Sort */}
      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color="#6B7280" />
        <TextInput
          placeholder="Search first-aid guides…"
          placeholderTextColor="#9CA3AF"
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity
            onPress={() => setQuery("")}
            accessibilityLabel="Clear search"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close-circle" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => setSortAlpha((s) => !s)}
          style={styles.sortBtn}
          accessibilityLabel={
            sortAlpha ? "Sorted A to Z (tap to restore)" : "Sort A to Z"
          }
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name={sortAlpha ? "swap-vertical" : "swap-vertical-outline"}
            size={18}
            color={sortAlpha ? "#4F46E5" : "#6B7280"}
          />
        </TouchableOpacity>
      </View>

      {/* Chips */}
      <View style={styles.chipsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {CATEGORIES.map((c) => {
            const active = c === category;
            return (
              <TouchableOpacity
                key={c}
                onPress={() => setCategory(c)}
                style={[styles.chip, active && styles.chipActive]}
                activeOpacity={0.85}
              >
                <Text
                  style={[styles.chipText, active && styles.chipTextActive]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {c}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Content list */}
      <ScrollView
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.listHeader}>
          <Text style={[styles.resultText, { color: headerAccent }]}>
            {headerText}
          </Text>
          <Text style={styles.disclaimerInline}>
            This hub provides general first-aid guidance and is not a substitute
            for professional medical advice. In emergencies call your local
            number (e.g., 995 in Singapore).
          </Text>
        </View>

        {/* Cards */}
        {items.map((item) => {
          const accent = CAT_ACCENTS[item.category] || CAT_ACCENTS.default;
          const extraCount = Math.max(0, (item.quick?.length || 0) - MAX_QUICK);
          const ionName = item.icon || "information-circle";
          return (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.card,
                { shadowOpacity: Platform.OS === "ios" ? 0.08 : 0.12 },
              ]}
              onPress={() => openArticle(item)}
              activeOpacity={0.9}
            >
              {/* Left accent stripe */}
              <View
                style={[
                  styles.accentStripe,
                  { backgroundColor: accent.stripe },
                ]}
              />

              {/* Content */}
              <View style={styles.cardContent}>
                {/* Header row */}
                <View style={styles.headerRow}>
                  <View style={styles.titleWrap}>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <View
                      style={[styles.catPill, { backgroundColor: accent.bg }]}
                    >
                      <Ionicons name="pricetag" size={12} color={accent.text} />
                      <Text
                        style={[styles.catPillText, { color: accent.text }]}
                      >
                        {item.category}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.iconSlot}>
                    <View
                      style={[styles.iconWrap, { backgroundColor: accent.bg }]}
                    >
                      <Ionicons name={ionName} size={28} color={accent.text} />
                    </View>
                  </View>
                </View>

                {/* Quick tips checklist */}
                <View style={styles.quickList}>
                  {(item.quick || []).slice(0, MAX_QUICK).map((q, i) => (
                    <View key={i} style={styles.quickItem}>
                      <Ionicons
                        name="checkmark-circle"
                        size={14}
                        color={accent.text}
                        style={{ marginTop: 1 }}
                      />
                      <Text style={styles.quickItemText} numberOfLines={2}>
                        {q}
                      </Text>
                    </View>
                  ))}
                  {extraCount > 0 && (
                    <View
                      style={[styles.morePill, { backgroundColor: accent.bg }]}
                    >
                      <Text
                        style={[styles.morePillText, { color: accent.text }]}
                      >
                        +{extraCount} more
                      </Text>
                    </View>
                  )}
                </View>

                {/* Read more */}
                <View style={styles.readMoreRow}>
                  <Text style={[styles.readMoreText, { color: accent.text }]}>
                    Read more
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={accent.text}
                  />
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

        {items.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="search" size={20} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>No results</Text>
            <Text style={styles.emptyText}>
              Try a broader term like “CPR”, “burns”, or “sprain”.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------------- styles ---------------- */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
    paddingTop: 8,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
    marginTop: 4,
    paddingHorizontal: 2,
  },
  brandLogoImg: {
    width: 30,
    height: 30,
    borderRadius: 6,
    resizeMode: "contain",
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: 0.2,
  },
  searchRow: {
    marginBottom: 2,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: Platform.select({ ios: 6, android: 4 }),
    minHeight: 30,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: { flex: 1, color: "#111827", fontSize: 13 },
  sortBtn: { marginLeft: 2 },
  chipsContainer: { height: CHIP_ROW_HEIGHT, justifyContent: "center" },
  chipsRow: {
    paddingVertical: CHIP_ROW_VPAD,
    alignItems: "center",
    paddingRight: 4,
  },
  chip: {
    minWidth: 68,
    height: CHIP_HEIGHT,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    marginRight: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: { backgroundColor: "#EEF2FF", borderColor: "#C7D2FE" },
  chipText: {
    color: "#374151",
    fontSize: 14,
    textAlign: "center",
    maxWidth: CHIP_WIDTH - 16,
    includeFontPadding: false,
    textAlignVertical: "center",
    fontWeight: Platform.select({ ios: "600", android: "700" }),
  },
  chipTextActive: { color: "#4F46E5" },
  list: { paddingBottom: 8 },
  listHeader: { paddingHorizontal: 2, marginTop: 4, marginBottom: 10 },
  resultText: { color: "#6B7280", fontSize: 18, fontWeight: "600" },
  disclaimerInline: {
    color: "#6B7280",
    fontSize: 13,
    lineHeight: 16,
    marginTop: 4,
  },
  card: {
    position: "relative",
    flexDirection: "row",
    gap: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    padding: 14,
    paddingLeft: 20,
    marginBottom: 14,
    shadowColor: "#000",
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  accentStripe: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 10,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
  },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 17, fontWeight: "800", color: "#111827" },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  titleWrap: { flex: 8, paddingRight: 8 },
  iconSlot: { flex: 2, alignItems: "flex-end", justifyContent: "center" },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-end",
  },
  catPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 6,
  },
  catPillText: { fontSize: 12, fontWeight: "700" },
  quickList: { marginTop: 8, gap: 6 },
  quickItem: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  quickItemText: { color: "#374151", fontSize: 13, lineHeight: 18, flex: 1 },
  morePill: {
    alignSelf: "flex-start",
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 2,
  },
  morePillText: { fontSize: 12, fontWeight: "700", color: "#4B5563" },
  readMoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 10,
  },
  readMoreText: { color: "#6366F1", fontWeight: "700" },
  empty: { alignItems: "center", gap: 6, paddingVertical: 40 },
  emptyTitle: { color: "#111827", fontWeight: "800", fontSize: 16 },
  emptyText: {
    color: "#6B7280",
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 20,
  },
});
