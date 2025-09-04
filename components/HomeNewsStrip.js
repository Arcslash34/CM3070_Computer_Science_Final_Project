// components/HomeNewsStrip.js
import React from "react";
import { FlatList, TouchableOpacity, Text, View, StyleSheet, Platform, Alert, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { t } from "../translations/translation";
import i18n from "../translations/translation";

const { width: SCREEN_W } = Dimensions.get("window");

const ARTICLE_ITEMS = [
  { id: "st-flood", title: "Flash flood in Jurong Town Hall Road; warning issued for Dunearn Road", source: "The Straits Times", url: "https://www.straitstimes.com/singapore/risk-of-flash-floods-along-dunearn-road-avoid-road-for-the-next-hour-pub" },
  { id: "nea-haze", title: "Haze: 1-hr PM2.5 & 24-hr PSI (Live Map)", source: "NEA", url: "https://www.haze.gov.sg/" },
  { id: "nea-dengue-zika", title: "Dengue & Zika: Clusters, prevention, cases", source: "NEA", url: "https://www.nea.gov.sg/dengue-zika" },
  { id: "scdf-fire-residential", title: "Fire Safety Guidelines for Residential Estate", source: "SCDF", url: "https://www.scdf.gov.sg/home/community-and-volunteers/fire-emergency-guides/fire-safety-guidelines-for--residential-estate" },
  { id: "independent-johor-quakes", title: "Weekend quakes jolt Johor", source: "The Independent Singapore", url: "https://theindependent.sg/weekend-quakes-jolt-johor-experts-warn-peninsular-malaysia-and-singapore-not-immune-to-future-tremors/" },
];
function findDefaultUrl(id) {
  const defaultArticle = ARTICLE_ITEMS.find((item) => item.id === id);
  return defaultArticle?.url;
}
function getLocalizedArticles() {
  const items = i18n?.translations?.[i18n.locale]?.homeArticles?.items;
  if (Array.isArray(items) && items.length) {
    return items.map((item) => ({ ...item, url: item.url || findDefaultUrl(item.id) || "#" }));
  }
  return ARTICLE_ITEMS;
}

export default function HomeNewsStrip({ onOpen, lang }) {
  const listRef = React.useRef(null);
  const DATA = React.useMemo(() => getLocalizedArticles(), [lang]);
  const [idx, setIdx] = React.useState(0);
  const [mounted, setMounted] = React.useState(false);
  const CARD_W = SCREEN_W - 32;
  const SPACING = 10;

  const getItemLayout = (_d, index) => ({ length: CARD_W + SPACING, offset: (CARD_W + SPACING) * index, index });

  React.useEffect(() => { const timer = setTimeout(() => setMounted(true), 300); return () => clearTimeout(timer); }, []);
  React.useEffect(() => {
    if (!mounted) return;
    const tmr = setInterval(() => {
      setIdx((prev) => {
        const next = (prev + 1) % DATA.length;
        try { listRef.current?.scrollToIndex?.({ index: next, animated: true }); } catch {}
        return next;
      });
    }, 5000);
    return () => clearInterval(tmr);
  }, [mounted, DATA.length]);

  const onMomentumEnd = (e) => {
    const x = e.nativeEvent.contentOffset.x;
    const newIdx = Math.round(x / (CARD_W + SPACING));
    if (!Number.isNaN(newIdx)) setIdx(Math.max(0, Math.min(DATA.length - 1, newIdx)));
  };

  const handleArticlePress = (item) => {
    if (!item.url) {
      console.warn("Article URL is undefined for:", item.title);
      Alert.alert("Error", "This article is not available at the moment.");
      return;
    }
    try { new URL(item.url); onOpen(item.url); }
    catch { console.warn("Invalid URL:", item.url); Alert.alert("Error", "This article link is invalid."); }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => handleArticlePress(item)}
      style={[newsStyles.card, { width: CARD_W, marginRight: SPACING }]}
    >
      <View style={newsStyles.rowTop}>
        <Ionicons name="newspaper-outline" size={18} color="#111827" />
        <Text style={newsStyles.source}>{item.source}</Text>
      </View>
      <Text style={newsStyles.title} numberOfLines={2}>{item.title}</Text>
      <View style={newsStyles.rowBottom}>
        <Text style={newsStyles.linkText}>{t("common.article_open")}</Text>
        <Ionicons name="open-outline" size={16} color="#6366F1" />
      </View>
    </TouchableOpacity>
  );

  return (
    <FlatList
      ref={listRef}
      data={DATA}
      keyExtractor={(it) => it.id}
      renderItem={renderItem}
      horizontal
      showsHorizontalScrollIndicator={false}
      getItemLayout={getItemLayout}
      snapToInterval={CARD_W + SPACING}
      snapToAlignment="start"
      decelerationRate="fast"
      disableIntervalMomentum
      nestedScrollEnabled
      onMomentumScrollEnd={onMomentumEnd}
      contentContainerStyle={{ paddingLeft: 0, paddingRight: 16 }}
      initialScrollIndex={0}
    />
  );
}

const newsStyles = StyleSheet.create({
  card: {
    borderWidth: 1, borderColor: "#E5E7EB", backgroundColor: "#FFFFFF",
    borderRadius: 12, padding: 12,
    shadowColor: "#000", shadowOpacity: Platform.OS === "ios" ? 0.06 : 0.08,
    shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  source: { color: "#6B7280", fontWeight: "700", fontSize: 12 },
  title: { color: "#111827", fontSize: 15, fontWeight: "800", lineHeight: 20 },
  rowBottom: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  linkText: { color: "#6366F1", fontWeight: "700" },
});
