// CertificatesScreen.js
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import {
  useSafeAreaInsets,
  SafeAreaView,
} from "react-native-safe-area-context";
import { supabase } from "./supabase";

// ===== Available certificates =====
const CERTS = [
  {
    id: "cpr",
    title: "CPR Certificate",
    quizKey: "quiz:CPR:score",
    theme: "#6366F1",
  },
  {
    id: "aed",
    title: "AED Certificate",
    quizKey: "quiz:AED:score",
    theme: "#10b981",
  },
  {
    id: "bleed",
    title: "Severe Bleeding Cert",
    quizKey: "quiz:BLEED:score",
    theme: "#f59e0b",
  },
];

/* ---------- Simple Header ---------- */
function HeaderBar({ title, onBack }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={onBack}
        style={styles.headerBtn}
        accessibilityLabel="Back"
      >
        <Ionicons name="chevron-back" size={22} color="#111827" />
      </TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.headerBtn} />
    </View>
  );
}

export default function CertificatesScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();

  const [profileName, setProfileName] = useState(route?.params?.name || "");
  const [username, setUsername] = useState(route?.params?.username || "");
  const [useUsername, setUseUsername] = useState(false);

  const [scores, setScores] = useState({});
  const [demoMode, setDemoMode] = useState(false);

  // Load profile
  useEffect(() => {
    (async () => {
      try {
        if (!profileName || !username) {
          const { data: sessionRes } = await supabase.auth.getSession();
          const userId = sessionRes?.session?.user?.id;

          if (userId) {
            const { data: prof } = await supabase
              .from("profiles")
              .select("name, username")
              .eq("id", userId)
              .single();

            if (prof) {
              if (!profileName) setProfileName(prof.name || "");
              if (!username) setUsername(prof.username || "");
            }
          }

          if (!profileName) {
            const n = (await AsyncStorage.getItem("profile:name")) || "";
            if (n) setProfileName(n);
          }
          if (!username) {
            const u = (await AsyncStorage.getItem("profile:username")) || "";
            if (u) setUsername(u);
          }
        }
      } catch (e) {
        console.warn("Profile load fallback failed:", e);
      }
    })();
  }, [profileName, username]);

  // Load quiz scores
  useEffect(() => {
    (async () => {
      const result = {};
      for (const c of CERTS) {
        const raw = await AsyncStorage.getItem(c.quizKey);
        const num = raw ? Number(raw) : 0;
        result[c.quizKey] = Number.isFinite(num) ? num : 0;
      }
      setScores(result);
    })();
  }, []);

  // Restore demo mode
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem("certs:demoMode");
        if (raw === "1") setDemoMode(true);
      } catch (e) {
        console.warn("Failed to load demoMode:", e);
      }
    })();
  }, []);
  const toggleDemoMode = async (v) => {
    setDemoMode(v);
    try {
      await AsyncStorage.setItem("certs:demoMode", v ? "1" : "0");
    } catch (e) {
      console.warn("Failed to save demoMode:", e);
    }
  };

  // Which name to display
  const displayName = useMemo(() => {
    return useUsername
      ? username || profileName || "Anonymous"
      : profileName || username || "Anonymous";
  }, [useUsername, profileName, username]);

  // Eligibility
  const canDownload = (quizKey) => demoMode || (scores[quizKey] || 0) >= 100;

  const onDownload = async (cert) => {
    if (!canDownload(cert.quizKey)) {
      return Alert.alert(
        "Unavailable",
        "You need a 100% score on the respective quiz to download this certificate."
      );
    }
    try {
      const html = renderCertificateHTML({
        name: displayName,
        course: cert.title,
        accent: cert.theme,
        id: cert.id.toUpperCase(),
      });
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { dialogTitle: `Share ${cert.title}` });
    } catch (e) {
      Alert.alert("Error", e?.message || "Failed to generate certificate.");
    }
  };

  /* ------------ UI ------------ */
  return (
    <SafeAreaView style={styles.safeRoot} edges={["top", "left", "right"]}>
      <HeaderBar title="Certificates" onBack={() => navigation.goBack()} />

      <View style={[styles.screen, { paddingBottom: insets.bottom + 12 }]}>
        {/* Demo mode */}
        <View style={styles.nameBar}>
          <Ionicons
            name="construct"
            size={18}
            color="#111827"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.nameText}>Demo mode</Text>
          <View style={{ flex: 1 }} />
          <Switch value={demoMode} onValueChange={toggleDemoMode} />
        </View>

        {/* Username toggle */}
        <View style={styles.nameBar}>
          <Ionicons
            name="person"
            size={18}
            color="#111827"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.nameText}>Show username on certificate</Text>
          <View style={{ flex: 1 }} />
          <Switch value={useUsername} onValueChange={setUseUsername} />
        </View>
        <Text style={styles.nameHint}>
          Printing as: <Text style={{ fontWeight: "800" }}>{displayName}</Text>
        </Text>

        {/* Disclaimer */}
        <View style={styles.disclaimer}>
          <Ionicons
            name="alert-circle"
            size={16}
            color="#6b7280"
            style={{ marginRight: 6 }}
          />
          <Text style={styles.disclaimerText}>
            This is{" "}
            <Text style={{ fontWeight: "700" }}>
              not an official certificate
            </Text>
            . It is generated for project/demo purposes only.
          </Text>
        </View>

        {/* Certificates */}
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8 }}
        >
          {CERTS.map((c) => {
            const score = scores[c.quizKey] || 0;
            const locked = !demoMode && score < 100;

            return (
              <View
                key={c.id}
                style={[styles.card, { borderColor: "#e5e7eb" }]}
              >
                <View style={styles.cardLeft}>
                  <View style={[styles.iconWrap, { backgroundColor: c.theme }]}>
                    <Ionicons name="document-text" size={18} color="#fff" />
                  </View>
                  <View style={{ flexShrink: 1 }}>
                    <Text style={styles.cardTitle}>{c.title}</Text>
                    <Text style={styles.cardSub}>
                      Quiz score: {score}%{" "}
                      {demoMode
                        ? "• Demo unlocked"
                        : score >= 100
                        ? "✓ Eligible"
                        : "(100% required)"}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[
                    styles.downloadBtn,
                    locked && { backgroundColor: "#cbd5e1" },
                  ]}
                  onPress={() => onDownload(c)}
                  disabled={locked}
                  activeOpacity={locked ? 1 : 0.85}
                >
                  <Ionicons name="download" size={16} color="#fff" />
                  <Text style={styles.downloadText}>PDF</Text>
                </TouchableOpacity>
              </View>
            );
          })}
          <View style={{ height: 20 }} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

/* ---------- PDF Renderer ---------- */
function renderCertificateHTML({ name, course, accent = "#6366F1", id }) {
  const now = new Date().toLocaleDateString();
  const certId = `${id}-${Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase()}`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${course}</title>
  <style>
    @page { size: A4 landscape; margin: 28px; }

    html, body { height: 100%; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;
      color: #0f172a;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fff;
    }

    .wrap {
      width: 88%;
      border: 2px solid ${accent};
      border-radius: 14px;
      padding: 32px 36px;
      position: relative;
      box-sizing: border-box;
    }

    .watermark {
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
      font-size: 72px; color: rgba(15,23,42,0.06); transform: rotate(-18deg);
      letter-spacing: 4px; font-weight: 800; pointer-events: none;
    }

    .title    { text-align: center; font-size: 28px; font-weight: 800; margin: 0; }
    .subtitle { text-align: center; font-size: 13px; color: #334155; margin-top: 6px; }
    .name     { margin-top: 42px; font-size: 26px; font-weight: 800; text-align: center; }
    .course   { text-align: center; margin-top: 22px; font-size: 16px; color: #334155; }
    .badge { display: inline-block; padding: 6px 12px; border-radius: 999px;
             background: ${accent}; color: #fff; font-weight: 700; font-size: 12px; }
    .divider { height: 2px; background: ${accent}; width: 84%; margin: 28px auto; border-radius: 2px; }
    .infoRow {
      display: flex;
      justify-content: space-between;
      margin-top: 40px;
      font-size: 13px;
      color: #334155;
      font-weight: 600;
    }
    .note { margin-top: 18px; font-size: 11px; color: #6b7280; line-height: 1.4; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="watermark">DEMO ONLY</div>

    <h1 class="title">Certificate of Completion</h1>
    <div class="subtitle">Generated by LifeShield • Project Demo</div>

    <div class="name">${name}</div>
    <div class="course">has successfully completed the <span class="badge">${course}</span></div>

    <div class="divider"></div>

    <div class="infoRow">
      <div>Date of Issue: ${now}</div>
      <div>Certificate ID: ${certId}</div>
    </div>

    <div class="note">
      Disclaimer: This PDF is <strong>not an official certificate</strong>. It is produced solely for demonstration / project purposes.
      Any resemblance to a real credential is coincidental.
    </div>
  </div>
</body>
</html>`;
}

/* ---------- Styles ---------- */
const styles = StyleSheet.create({
  safeRoot: { flex: 1, backgroundColor: "#f8fafc" },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: Platform.OS === "android" ? 6 : 8,
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

  screen: { flex: 1, backgroundColor: "#f8fafc" },
  nameBar: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 12,
    height: 52,
    flexDirection: "row",
    alignItems: "center",
  },
  nameText: { fontWeight: "700", color: "#111827" },
  nameHint: { marginHorizontal: 16, marginTop: 6, color: "#374151" },
  disclaimer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  disclaimerText: { color: "#4b5563", flex: 1 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  cardLeft: { flexDirection: "row", alignItems: "center", flex: 1, gap: 10 },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { fontSize: 15, fontWeight: "800", color: "#111827" },
  cardSub: { color: "#6b7280", marginTop: 2 },
  downloadBtn: {
    backgroundColor: "#111827",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  downloadText: { color: "#fff", fontWeight: "700" },
});
