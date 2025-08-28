// HomeArticleScreen.jsx
import React, { useLayoutEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Linking, Platform, ImageBackground } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

// tip: prefer local assets for reliability; you can mix require() and remote {uri}
const ARTICLE_ITEMS = [
  {
    id: "st-flood",
    title: "Flash flood in Jurong Town Hall Road; warning issued for Dunearn Road",
    source: "The Straits Times",
    url: "https://www.straitstimes.com/singapore/risk-of-flash-floods-along-dunearn-road-avoid-road-for-the-next-hour-pub",
    image: require("./assets/homeArticles/st.png"),
  },
  {
    id: "st-strong-winds-2024-09-17",
    title: "Strong winds recorded across Singapore on Sept 17, reaching 83.2kmh at East Coast Park",
    source: "The Straits Times",
    url: "https://www.straitstimes.com/singapore/strong-winds-recorded-across-singapore-on-sept-17-reaching-832kmh-at-east-coast-park",
    image: require("./assets/homeArticles/st.png"),
  },
  {
    id: "nea-haze",
    title: "Haze: 1-hr PM2.5 & 24-hr PSI (Live Map)",
    source: "NEA",
    url: "https://www.haze.gov.sg/",
    image: require("./assets/homeArticles/nea.png"),
  },
  {
    id: "nea-dengue-zika",
    title: "Dengue & Zika: Clusters, prevention, cases",
    source: "NEA",
    url: "https://www.nea.gov.sg/dengue-zika",
    image: require("./assets/homeArticles/nea.png"),
  },
  {
    id: "scdf-fire-residential",
    title: "Fire Safety Guidelines for Residential Estate",
    source: "SCDF",
    url: "https://www.scdf.gov.sg/home/community-and-volunteers/fire-emergency-guides/fire-safety-guidelines-for--residential-estate",
    image: require("./assets/homeArticles/scdf.png"),
  },
  {
    id: "independent-johor-quakes",
    title: "Weekend quakes jolt Johor: Experts warn Peninsular Malaysia and Singapore not immune to future tremors",
    source: "The Independent Singapore",
    url: "https://theindependent.sg/weekend-quakes-jolt-johor-experts-warn-peninsular-malaysia-and-singapore-not-immune-to-future-tremors/",
    image: require("./assets/homeArticles/theIndependent.png"),
  },
  {
    id: "shf-cpr-aed-adults",
    title: "How to Perform CPR+AED for Adults",
    source: "Singapore Heart Foundation",
    url: "https://www.myheart.org.sg/techniques/cpraed-for-adults/",
    image: require("./assets/homeArticles/shf.png"),
  },
];

export default function HomeArticleScreen() {
  const navigation = useNavigation();
  useLayoutEffect(() => navigation.setOptions?.({ headerShown: false }), [navigation]);

  const open = (url) => Linking.openURL(url);

  const renderItem = ({ item }) => (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => open(item.url)}
      style={s.card}
      accessibilityLabel={`Open article: ${item.title} from ${item.source}`}
    >
      <ImageBackground
        source={item.image}
        style={s.hero}
        imageStyle={s.heroImg}
        defaultSource={Platform.OS === "ios" ? item.image : undefined}
      >
        {/* gradient overlay bottom for title legibility */}
        <View style={s.gradient} />
        <View style={s.badge}>
          <Ionicons name="newspaper-outline" size={14} color="#111827" />
          <Text style={s.badgeText}>{item.source}</Text>
        </View>
        <Text style={s.title} numberOfLines={3}>{item.title}</Text>
      </ImageBackground>

      <View style={s.rowBottom}>
        <Text style={s.linkText}>Open article</Text>
        <Ionicons name="open-outline" size={16} color="#6366F1" />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBtn} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Articles</Text>
        <View style={s.headerBtn} />
      </View>

      <FlatList
        data={ARTICLE_ITEMS}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        contentContainerStyle={s.container}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFFFFF" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    backgroundColor: "#fff",
  },
  headerBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontWeight: "800", color: "#111827", fontSize: 18 },

  container: { padding: 16, paddingBottom: 24 },

  card: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "ios" ? 0.06 : 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  hero: { height: 180, borderRadius: 10, overflow: "hidden", marginBottom: 10, justifyContent: "flex-end" },
  heroImg: { borderRadius: 10 },
  gradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.18)",
  },

  badge: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: { color: "#111827", fontWeight: "700", fontSize: 11 },

  title: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 22,
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowRadius: 6,
    paddingHorizontal: 10,
    paddingBottom: 8,
  },

  rowBottom: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  linkText: { color: "#6366F1", fontWeight: "700" },
});
