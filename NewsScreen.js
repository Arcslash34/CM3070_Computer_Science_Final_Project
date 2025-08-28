import React, { useLayoutEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking, Platform } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

// Keep in sync with Home screen list
const NEWS_ITEMS = [
  { id: "st-flood",    title: "Flash floods & road closures: What motorists should know", source: "The Straits Times", url: "https://www.google.com/search?q=site%3Astraitstimes.com+flood+Singapore" },
  { id: "today-flood", title: "Rainy season outlook & flood advisories", source: "TODAY", url: "https://www.google.com/search?q=site%3Atodayonline.com+flood+Singapore" },
  { id: "pub-press",   title: "PUB updates on drainage & flood-prone hotspots", source: "PUB",  url: "https://www.pub.gov.sg/news" },
  { id: "nea-weather", title: "NEA heavy rain / thunderstorm advisories", source: "NEA",  url: "https://www.nea.gov.sg/weather" },
  { id: "nea-dengue",  title: "Dengue clusters & prevention tips", source: "NEA",  url: "https://www.nea.gov.sg/dengue-zika/dengue/dengue-clusters" },
];

export default function NewsScreen() {
  const navigation = useNavigation();
  useLayoutEffect(() => navigation.setOptions?.({ headerShown: false }), [navigation]);

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBtn} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>News Articles</Text>
        <View style={s.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={s.container}>
        {NEWS_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.id}
            onPress={() => Linking.openURL(item.url)}
            activeOpacity={0.9}
            style={s.card}
          >
            <View style={s.rowTop}>
              <Ionicons name="newspaper-outline" size={18} color="#111827" />
              <Text style={s.source}>{item.source}</Text>
            </View>
            <Text style={s.title}>{item.title}</Text>
            <View style={s.rowBottom}>
              <Text style={s.linkText}>Open article</Text>
              <Ionicons name="open-outline" size={16} color="#6366F1" />
            </View>
          </TouchableOpacity>
        ))}

        {NEWS_ITEMS.length === 0 && (
          <View style={s.empty}>
            <Ionicons name="search" size={18} color="#9CA3AF" />
            <Text style={s.emptyText}>No news available.</Text>
          </View>
        )}
      </ScrollView>
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

  container: { padding: 16, paddingBottom: 20 },
  card: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "ios" ? 0.06 : 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  source: { color: "#6B7280", fontWeight: "700", fontSize: 12 },
  title: { color: "#111827", fontSize: 16, fontWeight: "800", lineHeight: 22 },
  rowBottom: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  linkText: { color: "#6366F1", fontWeight: "700" },
  empty: { alignItems: "center", gap: 6, paddingVertical: 40 },
  emptyText: { color: "#6B7280", fontWeight: "600" },
});
