// Quizzes.js — Topic grid + Daily banner + "Past Results" link
import React, { useLayoutEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ImageBackground,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import Logo1 from "./assets/logo1.png";

// Load quiz categories from JSON
const QUIZ = require("./assets/quiz.json");

// Static image mapping (RN requires static require paths)
const CATEGORY_IMAGES = {
  flood: require("./assets/flood.jpg"),
  fire: require("./assets/fire.jpg"),
  dengue: require("./assets/dengue.jpg"),
  firstaid: require("./assets/first_aid.jpg"),
  disease: require("./assets/disease.jpg"),
  earthquake: require("./assets/earthquake.jpg"),
};

// Keep a stable order for display
const TOPIC_ORDER = [
  "flood",
  "fire",
  "dengue",
  "firstaid",
  "disease",
  "earthquake",
];

// Build topics from JSON + image map
const TOPICS = TOPIC_ORDER.map((id) => {
  const cat = QUIZ.categories.find((c) => c.id === id);
  return {
    id,
    title: cat?.title ?? id,
    img: CATEGORY_IMAGES[id],
  };
});

export default function QuizzesHome() {
  const navigation = useNavigation();

  // Hide native header (match other screens)
  useLayoutEffect(() => {
    navigation.setOptions?.({ headerShown: false });
  }, [navigation]);

  const renderHeader = () => (
    <>
      {/* Daily Quiz Banner */}
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() =>
          navigation.navigate("QuizGame", {
            topicId: "daily",
            topicTitle: "Daily Quiz",
            isDaily: true,
          })
        }
      >
        <ImageBackground
          source={require("./assets/daily.jpg")}
          imageStyle={{ borderRadius: 16 }}
          style={styles.banner}
        >
          <View style={styles.bannerOverlay} />
          <View style={styles.bannerContent}>
            <Text style={styles.bannerTitle}>Daily Quiz</Text>
            <Text style={styles.bannerSub}>Everyday Learn &amp; Play</Text>
            <View style={styles.startBtn}>
              <Text style={styles.startBtnText}>Start Quiz</Text>
            </View>
          </View>
        </ImageBackground>
      </TouchableOpacity>

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Quiz Categories</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate("HistoryScreen")}
          style={styles.resultsPill}
          activeOpacity={0.85}
        >
          <Ionicons name="book-outline" size={16} color="#4F46E5" />
          <Text style={styles.resultsPillText}>Past Results</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: "#F3F4F6" }}
      edges={["top", "left", "right"]}
    >
      {/* Brand + description (top-left) */}
      <View style={{ paddingTop: 8, paddingHorizontal: 16, paddingBottom: 6 }}>
        <View style={styles.brandRow}>
          <Image source={Logo1} style={styles.brandLogo} />
          <Text style={styles.brandTitle}>Quizzes</Text>
        </View>
        <View style={styles.descCard}>
          <Ionicons
            name="rocket"
            size={36}
            color="#4F46E5"
            style={{ marginRight: 4 }}
          />
          <Text style={styles.descText}>
            Build disaster-ready instincts with quick, fun quizzes. Try the
            Daily Quiz or pick a category below!
          </Text>
        </View>
      </View>

      <FlatList
        data={TOPICS}
        keyExtractor={(item) => item.id}
        numColumns={2}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.container}
        columnWrapperStyle={{ justifyContent: "space-between" }}
        renderItem={({ item }) => (
          <View style={styles.cardWrap}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() =>
                navigation.navigate("QuizSet", {
                  topicId: item.id,
                  topicTitle: item.title,
                })
              }
              style={styles.card}
            >
              <Image source={item.img} style={styles.cardImage} />
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.title}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#F3F4F6" },

  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 2,
    marginTop: 4,
    marginBottom: 6,
  },
  brandLogo: {
    width: 30,
    height: 30,
    borderRadius: 6,
    resizeMode: "contain",
    backgroundColor: "#EEF2FF",
  },
  brandTitle: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 0.2,
  },

  descCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#EEF2FF",
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },
  descText: {
    color: "#374151",
    fontSize: 14,
    lineHeight: 18,
    flex: 1,
    fontWeight: "500",
  },

  banner: {
    height: 140,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 14,
    marginTop: -6,
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  bannerContent: { flex: 1, padding: 15 },
  bannerTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
    paddingBottom: 8,
  },
  bannerSub: {
    color: "#ffffffff",
    fontWeight: "500",
    fontSize: 15,
    paddingBottom: 10,
  },
  startBtn: {
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 22,
    paddingVertical: 8,
    borderRadius: 10,
  },
  startBtnText: { color: "#1F2937", fontWeight: "800", fontSize: 16 },

  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionTitle: { color: "#111827", fontSize: 20, fontWeight: "800" },
  resultsPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#EEF2FF",
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },
  resultsPillText: { color: "#4F46E5", fontWeight: "700", fontSize: 12 },

  cardWrap: { width: "48%", marginBottom: 12 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardImage: { width: "100%", height: 90, resizeMode: "cover" },
  cardTitle: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    color: "#111827",
    fontWeight: "700",
    fontSize: 15,
    textAlign: "center",
  },
});
