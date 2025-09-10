/**
 * screens/BadgesScreen.js — Dynamic badges catalog + user progress (Supabase)
 *
 * Purpose
 * - Present a responsive, localized grid of achievement badges.
 * - Show which badges are earned vs. locked and how close the user is to each.
 * - Surface overall points (sum of XP from quiz_results) and earned/total badges.
 * - Let users preview a completed badge and share it.
 *
 * Data Sources
 * - Catalog (static, localized at runtime): BADGE_CATALOG_FN()
 * - Earned badges: Supabase table `user_disaster_badges` (badge_id rows per user)
 * - Points: Sum of `xp` in Supabase table `quiz_results` for the user
 * - Progress math: `getProgressSummary()` + `computeBadgeProgress()` from badgesLogic
 * - Auto-award on open: `checkAndAwardBadges()` (e.g., count-based badges)
 *
 * Key Behaviours
 * - On mount:
 *   • Attempts to auto-award any newly satisfied badges.
 *   • Loads user total points (XP), owned badges, and per-badge progress.
 * - Tabs: filter catalog to All / Unlocked / Locked (keeps grouping).
 * - Layout: responsive card width via measured grid width + `pickCols()`.
 * - Modal: only opens for earned badges; includes “Share” action.
 * - i18n: re-renders on language change (titles, labels, grouping names).
 *
 * UX / Accessibility
 * - Uses high-contrast progress indicators and concise labels.
 * - Taps on locked badges are ignored (no accidental empty modals).
 * - Share flow uses platform share sheet with localized copy.
 *
 * Performance Notes
 * - Uses `useMemo` to avoid repeated recomputation of lists/sections.
 * - Avoids layout thrash by measuring grid width once per section layout.
 * - Separates catalog from owned/progress state to minimize re-renders.
 *
 * Fail-safes
 * - Network/Supabase errors are caught and logged; UI falls back gracefully
 *   (0 points, empty owned set, empty progress map).
 */

import React, {
  useMemo,
  useState,
  useLayoutEffect,
  useEffect,
  useContext,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Image,
  StatusBar,
  ActivityIndicator,
  Modal,
  Alert,
  Share,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { supabase } from "../supabase";

import { BADGE_CATALOG as BADGE_CATALOG_FN } from "../utils/badgeCatalog";
import {
  checkAndAwardBadges,
  getProgressSummary,
  computeBadgeProgress,
} from "../utils/badgesLogic";
import { t } from "../translations/translation";
import { LanguageContext } from "../translations/language";

/** spacing between cards horizontally & vertically */
const GRID_GAP = 12;

/** choose a sensible column count from the available grid width */
function pickCols(w) {
  if (w >= 820) return 5; // big tablets
  if (w >= 640) return 4; // small tablets / big phones landscape
  return 3; // default phones
}

export default function BadgesScreen() {
  const navigation = useNavigation();
  useLayoutEffect(() => {
    navigation.setOptions?.({ headerShown: false });
  }, [navigation]);

  // re-render catalog strings when language changes
  const { lang } = useContext(LanguageContext);

  // UI state
  const [tab, setTab] = useState("all"); // 'all' | 'unlocked' | 'locked'

  // points + earned badges
  const [points, setPoints] = useState(0);
  const [loadingPts, setLoadingPts] = useState(true);

  const [ownedSet, setOwnedSet] = useState(new Set()); // Set<badge_id>
  const [loadingOwned, setLoadingOwned] = useState(true);

  const [progressMap, setProgressMap] = useState({}); // { [badgeId]: { value, goal } }

  // Modal for completed badge
  const [showBadgeModal, setShowBadgeModal] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState(null); // { id, title, icon, group }

  // ---- load everything on open (award, points, owned, progress) ----
  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      try {
        await checkAndAwardBadges(supabase); // count-based achievements
      } catch (e) {
        console.warn("award-on-open failed:", e?.message || e);
      }

      // points
      try {
        setLoadingPts(true);
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData?.session?.user?.id;
        if (userId) {
          const { data, error } = await supabase
            .from("quiz_results")
            .select("xp")
            .eq("user_id", userId);
          if (error) throw error;
          const total = (data || []).reduce((a, r) => a + (r?.xp || 0), 0);
          if (!cancelled) setPoints(total);
        } else {
          if (!cancelled) setPoints(0);
        }
      } catch (e) {
        console.warn("points load:", e?.message || e);
        if (!cancelled) setPoints(0);
      } finally {
        if (!cancelled) setLoadingPts(false);
      }

      // owned
      try {
        setLoadingOwned(true);
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData?.session?.user?.id;
        if (!userId) {
          if (!cancelled) setOwnedSet(new Set());
        } else {
          const { data, error } = await supabase
            .from("user_disaster_badges")
            .select("badge_id")
            .eq("user_id", userId);
          if (error) throw error;
          if (!cancelled)
            setOwnedSet(new Set((data || []).map((r) => r.badge_id)));
        }
      } catch (e) {
        console.warn("owned load:", e?.message || e);
        if (!cancelled) setOwnedSet(new Set());
      } finally {
        if (!cancelled) setLoadingOwned(false);
      }

      // progress
      try {
        const summary = await getProgressSummary(supabase);
        const map = {};
        (BADGE_CATALOG_FN() || []).forEach((b) => {
          map[b.id] = computeBadgeProgress(b.id, summary);
        });
        if (!cancelled) setProgressMap(map);
      } catch (e) {
        console.warn("progress load:", e?.message || e);
        if (!cancelled) setProgressMap({});
      }
    }

    loadAll();
    return () => {
      cancelled = true;
    };
  }, []);

  // ----- build display list from catalog + owned set -----
  const catalog = useMemo(() => BADGE_CATALOG_FN(), [lang]);
  const allBadges = useMemo(
    () => (catalog || []).map((b) => ({ ...b, earned: ownedSet.has(b.id) })),
    [catalog, ownedSet]
  );

  const list = useMemo(() => {
    if (tab === "unlocked") return allBadges.filter((b) => b.earned);
    if (tab === "locked") return allBadges.filter((b) => !b.earned);
    return allBadges;
  }, [tab, allBadges]);

  // group by "group" (already localized in catalog)
  const sections = useMemo(() => {
    const m = new Map();
    for (const b of list) {
      const key =
        b.group || t("badges.groups.other", { defaultValue: "Other" });
      if (!m.has(key)) m.set(key, []);
      m.get(key).push(b);
    }
    return Array.from(m.entries()).map(([title, items]) => ({ title, items }));
  }, [list]);

  const earnedCount = allBadges.filter((b) => b.earned).length;
  const TOTAL_BADGES = (catalog || []).length || 0;

  // open modal only for completed badges
  const handleBadgePress = (badge) => {
    if (!badge?.earned) return;
    setSelectedBadge(badge);
    setShowBadgeModal(true);
  };

  const shareBadge = async () => {
    if (!selectedBadge) return;
    try {
      const shareText =
        t("badges.shareText", {
          title: selectedBadge.title,
          defaultValue: `I just earned the "${selectedBadge.title}" badge in LifeShield! 🏅 #LifeShield`,
        }) ||
        `I just earned the "${selectedBadge.title}" badge in LifeShield! 🏅 #LifeShield`;
      await Share.share({ message: shareText });
    } catch (e) {
      Alert.alert(
        t("badges.shareFailedTitle", { defaultValue: "Share failed" }),
        e?.message ||
          t("badges.shareFailedBody", {
            defaultValue: "Unable to open share sheet.",
          })
      );
    }
  };

  // ------- Dynamic grid sizing (fixes extra space on the right) -------
  const [gridW, setGridW] = useState(0);
  const cols = useMemo(() => (gridW ? pickCols(gridW) : 3), [gridW]);
  const cardW = useMemo(() => {
    if (!gridW || !cols) return 96; // fallback
    const totalGaps = GRID_GAP * (cols - 1);
    return Math.floor((gridW - totalGaps) / cols);
  }, [gridW, cols]);

  return (
    <SafeAreaView
      style={styles.safe}
      edges={["top", "left", "right", "bottom"]}
    >
      <StatusBar barStyle="light-content" backgroundColor={"#000"} />
      <ScrollView contentContainerStyle={styles.container}>
        {/* Hero header */}
        <LinearGradient
          colors={["#60A5FA", "#2563EB"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.brandRow}>
            <Image
              source={require("../assets/logo3.png")}
              style={styles.brandLogo}
            />
            <Text style={styles.brandTitle}>{t("badges.title")}</Text>
          </View>

          <View style={styles.heroStatsRow}>
            <StatPill
              icon="ribbon-outline"
              value={
                loadingOwned ? (
                  <ActivityIndicator size="small" color="#E0F2FE" />
                ) : (
                  `${earnedCount}/${TOTAL_BADGES}`
                )
              }
              label={t("badges.totalBadges")}
            />
            <StatPill
              icon="star-outline"
              value={
                loadingPts ? (
                  <ActivityIndicator size="small" color="#E0F2FE" />
                ) : (
                  String(points)
                )
              }
              label={t("badges.pointsEarned")}
            />
          </View>

          <View style={styles.tabs}>
            <TabButton
              text={t("badges.tabs.all")}
              active={tab === "all"}
              onPress={() => setTab("all")}
            />
            <TabButton
              text={t("badges.tabs.unlocked")}
              active={tab === "unlocked"}
              onPress={() => setTab("unlocked")}
            />
            <TabButton
              text={t("badges.tabs.locked")}
              active={tab === "locked"}
              onPress={() => setTab("locked")}
            />
          </View>
        </LinearGradient>

        {/* Sections */}
        <View style={styles.contentPad}>
          {sections.map((sec) => (
            <View key={sec.title} style={{ marginBottom: 8 }}>
              <Text style={styles.sectionTitle}>{sec.title}</Text>

              {/* Measure the grid width once it's laid out */}
              <View
                style={styles.grid}
                onLayout={(e) => setGridW(e.nativeEvent.layout.width)}
              >
                {sec.items.map((b) => (
                  <BadgeCard
                    key={b.id}
                    title={b.title}
                    icon={b.icon}
                    earned={b.earned}
                    progress={progressMap[b.id]}
                    onPress={() => handleBadgePress(b)}
                    cardW={cardW}
                  />
                ))}
              </View>
            </View>
          ))}

          {/* Empty state for a given tab */}
          {!loadingOwned && list.length === 0 && (
            <View style={styles.empty}>
              <Ionicons name="star-outline" size={20} color="#9CA3AF" />
              <Text style={styles.emptyText}>
                {tab === "unlocked"
                  ? t("badges.empty.unlocked")
                  : t("badges.empty.locked")}
              </Text>
            </View>
          )}
        </View>

        <View style={{ height: 10 }} />
      </ScrollView>

      {/* Completed Badge Modal */}
      <Modal
        visible={showBadgeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBadgeModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPressOut={() => setShowBadgeModal(false)} // close on outside tap
        >
          <View style={styles.modalCard}>
            {selectedBadge?.icon ? (
              <Image
                source={selectedBadge.icon}
                style={styles.modalBadgeImage}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.modalBadgeFallback}>
                <Ionicons name="ribbon" size={36} color="#F59E0B" />
              </View>
            )}
            <Text style={styles.modalTitle}>
              {selectedBadge?.title || t("badges.modal.fallbackTitle")}
            </Text>
            {selectedBadge?.group ? (
              <Text style={styles.modalSub}>{selectedBadge.group}</Text>
            ) : null}
            <View style={styles.modalDivider} />

            <Text style={styles.modalBody}>{t("badges.modal.body")}</Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={shareBadge}
                style={[styles.modalBtn, styles.modalBtnPrimary]}
                activeOpacity={0.9}
              >
                <Ionicons name="share-social" size={16} color="#fff" />
                <Text style={styles.modalBtnTextPrimary}>
                  {t("badges.modal.shareCta")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowBadgeModal(false)}
                style={[styles.modalBtn, styles.modalBtnGhost]}
                activeOpacity={0.9}
              >
                <Text style={styles.modalBtnTextGhost}>
                  {t("badges.modal.close")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

/* ---------------- small components ---------------- */

function StatPill({ icon, value, label }) {
  const safeIcon =
    typeof icon === "string" && icon.length ? icon : "star-outline";
  return (
    <View style={styles.statPill}>
      <View style={styles.statIconWrap}>
        <Ionicons name={safeIcon} size={34} color="#E0F2FE" />
      </View>

      <View style={styles.statTextCol}>
        {typeof value === "string" || typeof value === "number" ? (
          <>
            <Text style={styles.statValue} numberOfLines={1}>
              {value}
            </Text>
            <Text style={styles.statLabel} numberOfLines={1}>
              {label}
            </Text>
          </>
        ) : (
          <>
            <View style={{ minHeight: 24, justifyContent: "center" }}>
              {value}
            </View>
            <Text style={styles.statLabel} numberOfLines={1}>
              {label}
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

function TabButton({ text, active, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={[styles.tabBtn, active && styles.tabBtnActive]}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>
        {text}
      </Text>
    </TouchableOpacity>
  );
}

function BadgeCard({ title, icon, earned, progress, onPress, cardW }) {
  const hasIcon = !!icon;
  const val = Math.max(0, Number(progress?.value || 0));
  const goal = Math.max(1, Number(progress?.goal || 1));
  const pct = Math.max(0, Math.min(100, Math.round((val / goal) * 100)));

  const pressHandler = earned ? onPress : undefined;
  const activeOpacity = earned ? 0.92 : 1;

  return (
    <TouchableOpacity
      activeOpacity={activeOpacity}
      style={[
        styles.card,
        !earned && styles.cardLocked,
        { width: cardW, maxWidth: cardW },
      ]}
      onPress={pressHandler}
    >
      <View style={styles.medalWrap}>
        {hasIcon ? (
          <Image
            source={icon}
            style={[styles.badgeImage, !earned && { opacity: 0.35 }]}
            resizeMode="contain"
          />
        ) : (
          <>
            <View style={[styles.medalCircle, !earned && { opacity: 0.35 }]}>
              <View style={styles.medalInner}>
                <Ionicons name="star" size={18} color="#F59E0B" />
              </View>
            </View>
            <View style={[styles.ribbon, { left: 8 }]} />
            <View style={[styles.ribbon, { right: 8 }]} />
          </>
        )}
      </View>

      <Text style={styles.cardTitle} numberOfLines={1}>
        {title}
      </Text>

      {earned ? (
        <View style={styles.pill}>
          <Text style={styles.pillText}>{t("badges.completed")}</Text>
        </View>
      ) : (
        <View style={{ width: "100%", marginTop: 6 }}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct}%` }]} />
          </View>
          <Text style={styles.progressLabel}>
            {val}/{goal}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

/* ---------------- styles ---------------- */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFFFFF" },
  container: { backgroundColor: "#FFFFFF", flexGrow: 1 },

  hero: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  brandLogo: { width: 30, height: 30, borderRadius: 6, resizeMode: "contain" },
  brandTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0.2,
  },

  heroStatsRow: { marginTop: 10, flexDirection: "row", gap: 10 },

  statPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 10,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderColor: "rgba(255,255,255,0.25)",
    borderWidth: 1,
    paddingVertical: 6,
    borderRadius: 14,
  },
  statIconWrap: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  statTextCol: { minWidth: 0, alignItems: "center", justifyContent: "center" },
  statValue: { color: "#FFFFFF", fontWeight: "600", fontSize: 20 },
  statLabel: { color: "#E0F2FE", fontWeight: "600", fontSize: 13 },

  tabs: {
    marginTop: 12,
    marginBottom: 5,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 999,
    padding: 4,
    flexDirection: "row",
    gap: 6,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: "center",
  },
  tabBtnActive: { backgroundColor: "#FFFFFF" },
  tabText: { color: "#E0F2FE", fontWeight: "700" },
  tabTextActive: { color: "#2563EB" },

  contentPad: { paddingHorizontal: 16, marginTop: 4 },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 10,
    marginTop: 6,
    textAlign: "center",
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: GRID_GAP,
    columnGap: GRID_GAP,
  },

  card: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "ios" ? 0.06 : 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardLocked: { backgroundColor: "#FAFAFA" },

  medalWrap: { alignItems: "center", justifyContent: "center" },
  badgeImage: { width: 44, height: 44 },
  medalCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FDE68A",
    borderWidth: 1,
    borderColor: "#F59E0B",
    alignItems: "center",
    justifyContent: "center",
  },
  medalInner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FFF7ED",
    alignItems: "center",
    justifyContent: "center",
  },
  ribbon: {
    position: "absolute",
    bottom: -6,
    width: 10,
    height: 12,
    backgroundColor: "#93C5FD",
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },

  cardTitle: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },

  pill: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#DBEAFE",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  pillText: { fontSize: 10, fontWeight: "700", color: "#2563EB" },

  progressTrack: {
    width: "100%",
    height: 6,
    borderRadius: 999,
    backgroundColor: "#E5E7EB",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#10B981",
  },
  progressLabel: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: "700",
    color: "#065F46",
    textAlign: "center",
  },

  empty: { alignItems: "center", gap: 6, paddingVertical: 40 },
  emptyText: { color: "#6B7280", fontWeight: "600" },

  /* -------- Modal styles -------- */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "92%",
    maxWidth: 420,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
  },
  modalBadgeImage: { width: 160, height: 95 },
  modalBadgeFallback: {
    width: 96,
    height: 96,
    borderRadius: 20,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#F59E0B",
    alignItems: "center",
    justifyContent: "center",
  },
  modalBody: {
    fontSize: 14,
    color: "#374151",
    textAlign: "center",
    paddingHorizontal: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    marginTop: 8,
    textAlign: "center",
  },
  modalSub: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
    textAlign: "center",
  },
  modalDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    alignSelf: "stretch",
    marginVertical: 12,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
    alignSelf: "stretch",
  },
  modalBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  modalBtnPrimary: { backgroundColor: "#2563EB" },
  modalBtnTextPrimary: { color: "#fff", fontWeight: "800" },
  modalBtnGhost: {
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  modalBtnTextGhost: { color: "#111827", fontWeight: "800" },
});
