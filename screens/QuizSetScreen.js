// screens/QuizSetScreen.js
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

function HeaderBar({ title, onBack, t }) {
  return (
    <View style={s.header}>
      <TouchableOpacity
        onPress={onBack}
        style={s.headerBtn}
        accessibilityLabel={t("quizSet.back")}
      >
        <Ionicons name="chevron-back" size={22} color="#111827" />
      </TouchableOpacity>
      <Text style={s.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={s.headerBtn} />
    </View>
  );
}

export default function QuizSetScreen({ vm }) {
  const { t, onBack, topicTitle, sets } = vm;

  return (
    <SafeAreaView style={s.safeArea} edges={["top", "left", "right"]}>
      <HeaderBar title={topicTitle} onBack={onBack} t={t} />
      <ScrollView contentContainerStyle={s.container}>
        <Text style={s.pageTitle}>{t("quizSet.chooseASet")}</Text>
        <Text style={s.pageSub}>{t("quizSet.subtitle")}</Text>

        <View style={{ height: 6 }} />

        {sets.length === 0 ? (
          <View style={s.emptyBox}>
            <Ionicons name="alert-circle-outline" size={20} color="#9CA3AF" />
            <Text style={s.emptyText}>{t("quizSet.noSets")}</Text>
          </View>
        ) : (
          sets.map((set) => (
            <SetRow key={set.id} set={set} t={t} />
          ))
        )}

        <View style={{ height: 14 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function SetRow({ set, t }) {
  // The screen remains "dumb": navigate action is encapsulated via onPress passed in
  // To keep it simple, we use a tiny indirection: attach onPress to set.start
  return (
    <TouchableOpacity
      style={s.setCard}
      activeOpacity={0.9}
      onPress={set.start ?? set.onPress /* fallback */}
    >
      <Image source={set.img} style={s.thumb} />
      <View style={s.setInfo}>
        <Text style={s.setTitle} numberOfLines={1}>
          {set.title}
        </Text>
        <Text style={s.setSub}>
          {set.questions} {t("quizSet.questions")}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#111827" />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8FAFC" },

  /* Static header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 0,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    backgroundColor: "#fff",
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontWeight: "600",
    color: "#111827",
    fontSize: 22,
  },

  container: {
    padding: 10,
    paddingHorizontal: 16,
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
  setTitle: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "800",
  },
  setSub: {
    color: "#6B7280",
    marginTop: 2,
    fontWeight: "600",
  },

  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },
  emptyText: {
    marginTop: 6,
    color: "#6B7280",
    fontWeight: "600",
  },
});
