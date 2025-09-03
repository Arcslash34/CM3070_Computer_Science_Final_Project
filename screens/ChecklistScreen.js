// screens/ChecklistScreen.js
import React from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Pressable,
  Animated, Modal, Platform, TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import LottieView from "lottie-react-native";
import congratsAnim from "../assets/lottie/congrats.json";

const LottieWeb = Platform.OS === "web" ? require("lottie-react").default : null;

export default function ChecklistScreen({ vm }) {
  const {
    // strings
    t,
    // nav
    onBack,
    // data/state
    categories,
    selectedCatId, setSelectedCatId,
    query, setQuery,
    checked, toggle,
    resetCurrentCategory,
    // progress
    overallPercent, catPercent,
    catDone, catTotal,
    overallWidth, categoryWidth,
    // helpers
    currentCategory, matchesQuery, subProgress, catHasMatches,
    // modal
    showCongrats, setShowCongrats,
    // platform
    platform,
  } = vm;

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.headerBtn} accessibilityLabel={t("common.back")}>
          <Ionicons name="chevron-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("checklist.title")}</Text>
        <TouchableOpacity
          onPress={resetCurrentCategory}
          style={styles.headerBtn}
          accessibilityLabel={t("checklist.resetCategory.a11y")}
        >
          <Ionicons name="refresh" size={20} color="#6C63FF" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color="#6B7280" style={{ marginRight: 8 }} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t("checklist.search.placeholder")}
          placeholderTextColor="#9CA3AF"
          style={styles.searchInput}
          returnKeyType="search"
        />
        {!!query && (
          <TouchableOpacity onPress={() => setQuery("")} accessibilityLabel={t("checklist.search.clear")}>
            <Ionicons name="close-circle" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Category pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
        {categories.map((cat) => {
          const active = cat.id === selectedCatId;
          return (
            <TouchableOpacity
              key={cat.id}
              onPress={() => setSelectedCatId(cat.id)}
              style={[styles.catPill, active && styles.catPillActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Ionicons
                name={cat.icon || "pricetag"}
                size={14}
                color={active ? "#fff" : "#4F46E5"}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.catPillText, active && styles.catPillTextActive]}>{cat.title}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Category Progress */}
      <View style={[styles.progressWrap, { paddingTop: 4 }]}>
        <View style={styles.progressTopRow}>
          <Text style={styles.progressLabelLeft}>{t("checklist.categoryProgress")}</Text>
          <Text style={styles.progressRight}>
            {catPercent}% • {catDone}/{catTotal} {t("checklist.items")}
          </Text>
        </View>
        <View style={styles.progressBar}>
          <Animated.View style={[styles.progressFill, { width: categoryWidth }]} />
        </View>
      </View>

      {/* Content */}
      <ScrollView contentContainerStyle={styles.content}>
        {!currentCategory && (
          <Text style={{ color: "#6B7280", textAlign: "center", marginTop: 12 }}>
            {t("checklist.noCategorySelected")}
          </Text>
        )}

        {currentCategory?.subcategories?.map((sub) => {
          const { d, t: total, p } = subProgress(sub);
          const items = (sub.items || []).filter(matchesQuery);
          if (!items.length && query.trim()) return null;

          return (
            <View key={sub.id} style={styles.subBlock}>
              <View style={styles.subHeader}>
                <Text style={styles.subTitle}>{sub.title}</Text>
                <Text style={styles.subMeta}>{d}/{total}</Text>
              </View>
              <View style={styles.subProgressBar}>
                <View style={[styles.subProgressFill, { width: `${p}%` }]} />
              </View>

              {items.map((it) => {
                const isOn = !!checked[it.id];
                return (
                  <Pressable
                    key={it.id}
                    style={({ pressed }) => [styles.row, pressed && { transform: [{ scale: 0.98 }], opacity: 0.95 }]}
                    onPress={() => toggle(it.id)}
                    android_ripple={{ color: "#E5E7EB" }}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isOn }}
                  >
                    <View style={[styles.check, isOn && styles.checkOn]}>
                      <Ionicons
                        name={isOn ? "checkmark" : "ellipse-outline"}
                        size={18}
                        color={isOn ? "#fff" : "#9CA3AF"}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.itemTitle, isOn && styles.itemTitleOn]}>
                        {it.label || it.title}
                      </Text>
                      {!!it.desc && <Text style={styles.itemNote}>{it.desc}</Text>}
                      {!!it.critical && (
                        <View style={styles.badgeCrit}>
                          <Text style={styles.badgeCritText}>{t("checklist.badge.critical")}</Text>
                        </View>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          );
        })}

        {/* Empty-search result state */}
        {currentCategory && query.trim() && !catHasMatches && (
          <Text style={{ color: "#6B7280", textAlign: "center", marginTop: 10 }}>
            {t("checklist.search.noMatches", { query })}
          </Text>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Congrats modal */}
      <Modal visible={showCongrats} transparent animationType="fade" onRequestClose={() => setShowCongrats(false)}>
        <View style={styles.congratsBackdrop}>
          <View style={styles.congratsCard}>
            <Text style={styles.congratsTitle}>{t("checklist.congrats.title")}</Text>
            <Text style={styles.congratsSub}>
              {t("checklist.congrats.subtitle", { category: currentCategory?.title ?? "" })}
            </Text>
            <View style={{ height: 160, width: 220, alignSelf: "center" }}>
              {platform === "web" ? (
                <LottieWeb animationData={congratsAnim} autoplay loop={false} style={{ height: 160, width: 220 }} />
              ) : (
                <LottieView
                  source={congratsAnim}
                  autoPlay
                  loop={false}
                  onAnimationFinish={() => setTimeout(() => setShowCongrats(false), 900)}
                  style={{ height: 160, width: 220 }}
                />
              )}
            </View>
            <TouchableOpacity onPress={() => setShowCongrats(false)} style={styles.closeCongrats}>
              <Text style={styles.closeCongratsText}>{t("checklist.congrats.cta")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ---- styles (copied from your file, unchanged) ---- */
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFFFFF" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: Platform.OS === "android" ? 6 : 0,
    paddingBottom: 10,
  },
  headerBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontWeight: "800", color: "#111827", fontSize: 16 },

  progressWrap: { paddingHorizontal: 16, marginBottom: 8 },
  progressTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  progressLabelLeft: { color: "#111827", fontWeight: "800" },
  progressRight: { color: "#6B7280", fontWeight: "700" },
  progressBar: {
    height: 10, backgroundColor: "#EEF2FF", borderRadius: 999, overflow: "hidden",
    borderWidth: 1, borderColor: "#E5E7EB",
  },
  progressFill: { height: "100%", backgroundColor: "#6C63FF", borderRadius: 999 },

  searchWrap: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 16, marginBottom: 10, backgroundColor: "#F3F4F6",
    borderColor: "#E5E7EB", borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12,
  },
  searchInput: { flex: 1, color: "#111827", fontSize: 14, paddingVertical: 0 },

  catRow: { paddingHorizontal: 12, marginBottom: 20 },
  catPill: {
    height: 40, flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10,
    borderWidth: 1, borderColor: "#C7D2FE", backgroundColor: "#EEF2FF", marginRight: 8,
  },
  catPillActive: { backgroundColor: "#4F46E5", borderColor: "#4338CA" },
  catPillText: { color: "#4F46E5", fontWeight: "700", fontSize: 12 },
  catPillTextActive: { color: "#ffffff" },

  content: { paddingHorizontal: 12, paddingTop: 8 },

  subBlock: { marginBottom: 14 },
  subHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 4, marginBottom: 6,
  },
  subTitle: { color: "#111827", fontWeight: "800", fontSize: 14 },
  subMeta: { color: "#6B7280", fontWeight: "700" },

  subProgressBar: {
    height: 6, backgroundColor: "#F3F4F6", borderRadius: 999, overflow: "hidden",
    borderWidth: 1, borderColor: "#E5E7EB", marginBottom: 8,
  },
  subProgressFill: { height: "100%", backgroundColor: "#9CA3AF", borderRadius: 999 },

  row: {
    flexDirection: "row", gap: 12, alignItems: "flex-start",
    paddingVertical: 12, paddingHorizontal: 10, backgroundColor: "#FFFFFF",
    borderRadius: 12, borderWidth: 1, borderColor: "#E5E7EB", marginBottom: 10,
  },
  check: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  checkOn: { backgroundColor: "#10B981" },

  itemTitle: { color: "#111827", fontWeight: "700" },
  itemTitleOn: { color: "#047857", fontWeight: "700" },
  itemNote: { color: "#6B7280", marginTop: 2 },

  badgeCrit: {
    alignSelf: "flex-start", backgroundColor: "#FEE2E2", borderColor: "#FCA5A5", borderWidth: 1,
    borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, marginTop: 6,
  },
  badgeCritText: { color: "#B91C1C", fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },

  congratsBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center", padding: 16 },
  congratsCard: {
    width: "100%", maxWidth: 360, backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#E5E7EB", padding: 16,
  },
  congratsTitle: { textAlign: "center", fontWeight: "800", fontSize: 18, color: "#111827" },
  congratsSub: { textAlign: "center", color: "#374151", marginTop: 6, marginBottom: 8 },
  closeCongrats: { alignSelf: "center", backgroundColor: "#6C63FF", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, marginTop: 6 },
  closeCongratsText: { color: "#fff", fontWeight: "700" },
});
