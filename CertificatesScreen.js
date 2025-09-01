// CertificatesScreen.js
import React, { useEffect, useMemo, useState, useCallback, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "./supabase";
import { LanguageContext } from "./translations/language";
import { t } from "./translations/translation";

// ===== Available certificates (visual only; unlocking is gated by First Aid progress) =====
const CERTS = [
  { id: "cpr",   titleKey: "certificates.items.cpr",   fallback: "CPR Certificate",            theme: "#6366F1" },
  { id: "aed",   titleKey: "certificates.items.aed",   fallback: "AED Certificate",            theme: "#10b981" },
  { id: "bleed", titleKey: "certificates.items.bleed", fallback: "Severe Bleeding Certificate", theme: "#f59e0b" },
];

// How many First Aid sets must be perfect
const FIRST_AID_REQUIRED = 5;

/* ---------- Simple Header ---------- */
function HeaderBar({ title, onBack }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={onBack}
        style={styles.headerBtn}
        accessibilityLabel={(t("common.back") !== "common.back" && t("common.back")) || "Back"}
      >
        <Ionicons name="chevron-back" size={22} color="#111827" />
      </TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
      <View style={styles.headerBtn} />
    </View>
  );
}

export default function CertificatesScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { lang } = useContext(LanguageContext);

  const [profileName, setProfileName] = useState(route?.params?.name || "");
  const [username, setUsername]   = useState(route?.params?.username || "");
  const [useUsername, setUseUsername] = useState(false);

  // Demo mode bypass
  const [demoMode, setDemoMode] = useState(false);

  // First Aid progress (0..5) + loading state
  const [faPerfectCount, setFaPerfectCount] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(true);

  // Load display name (same logic as before)
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

  // Restore demo mode from storage
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

  // Fetch First Aid progress from Supabase (count of #1..#5 with score === 100)
  const loadFirstAidProgress = useCallback(async () => {
    setLoadingProgress(true);
    try {
      const { data: sessionRes } = await supabase.auth.getSession();
      const userId = sessionRes?.session?.user?.id;
      if (!userId) {
        setFaPerfectCount(0);
        return;
      }

      // Pull all First Aid quiz rows for this user with perfect score
      const { data, error } = await supabase
        .from("quiz_results")
        .select("quiz_title, score")
        .eq("user_id", userId)
        .eq("score", 100);

      if (error) throw error;

      // Identify distinct First Aid set indices (#1..#5) with perfect 100
      const got = new Set();
      (data || []).forEach((r) => {
        const title = String(r.quiz_title || "").toLowerCase();
        // Titles are like "First Aid #1", "First Aid #2", etc.
        if (title.includes("first") && title.includes("aid")) {
          const m = title.match(/#\s*(\d+)/); // capture the number after '#'
          if (m) {
            const n = parseInt(m[1], 10);
            if (Number.isFinite(n) && n >= 1 && n <= FIRST_AID_REQUIRED) {
              got.add(n);
            }
          }
        }
      });

      setFaPerfectCount(Math.min(got.size, FIRST_AID_REQUIRED));
    } catch (e) {
      console.warn("First Aid progress load failed:", e?.message || e);
      setFaPerfectCount(0);
    } finally {
      setLoadingProgress(false);
    }
  }, []);

  useEffect(() => {
    loadFirstAidProgress();
  }, [loadFirstAidProgress]);

  // Which name to display
  const displayName = useMemo(() => {
    return useUsername
      ? username || profileName || ((t("certificates.anonymous") !== "certificates.anonymous" && t("certificates.anonymous")) || "Anonymous")
      : profileName || username || ((t("certificates.anonymous") !== "certificates.anonymous" && t("certificates.anonymous")) || "Anonymous");
  }, [useUsername, profileName, username]);

  // Eligibility: demo mode bypasses, otherwise need 5/5
  const isEligible = demoMode || faPerfectCount >= FIRST_AID_REQUIRED;

  const onDownload = async (cert) => {
    if (!isEligible) {
      return Alert.alert(
        (t("certificates.unavailableTitle") !== "certificates.unavailableTitle" && t("certificates.unavailableTitle")) || "Unavailable",
        (t("certificates.unavailableBody") !== "certificates.unavailableBody" && t("certificates.unavailableBody")) ||
          "You must score 100% on all five First Aid quizzes (#1–#5) to download this certificate."
      );
    }
    try {
      const courseTitle =
        (t(cert.titleKey) !== cert.titleKey && t(cert.titleKey)) || cert.fallback;

      const html = renderCertificateHTML({
        name: displayName,
        course: courseTitle,
        accent: cert.theme,
        id: cert.id.toUpperCase(),
      });
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, {
        dialogTitle:
          (t("certificates.shareTitle") !== "certificates.shareTitle" && t("certificates.shareTitle", { title: courseTitle })) ||
          `Share ${courseTitle}`,
      });
    } catch (e) {
      Alert.alert(
        (t("common.error") !== "common.error" && t("common.error")) || "Error",
        e?.message ||
          (t("certificates.generateFail") !== "certificates.generateFail" && t("certificates.generateFail")) ||
          "Failed to generate certificate."
      );
    }
  };

  const progressPct = Math.round((faPerfectCount / FIRST_AID_REQUIRED) * 100);

  /* ------------ UI ------------ */
  return (
    <SafeAreaView style={styles.safeRoot} edges={["top", "left", "right"]}>
      <HeaderBar
        title={(t("certificates.title") !== "certificates.title" && t("certificates.title")) || "Certificates"}
        onBack={() => navigation.goBack()}
      />

      <View style={[styles.screen, { paddingBottom: insets.bottom + 12 }]}>
        {/* Demo mode */}
        <View style={styles.nameBar}>
          <Ionicons name="construct" size={18} color="#111827" style={{ marginRight: 8 }} />
          <Text style={styles.nameText}>
            {(t("certificates.demoMode") !== "certificates.demoMode" && t("certificates.demoMode")) || "Demo mode"}
          </Text>
          <View style={{ flex: 1 }} />
          <Switch value={demoMode} onValueChange={toggleDemoMode} />
        </View>

        {/* Username toggle */}
        <View style={styles.nameBar}>
          <Ionicons name="person" size={18} color="#111827" style={{ marginRight: 8 }} />
          <Text style={styles.nameText}>
            {(t("certificates.showUsername") !== "certificates.showUsername" && t("certificates.showUsername")) ||
              "Show username on certificate"}
          </Text>
          <View style={{ flex: 1 }} />
          <Switch value={useUsername} onValueChange={setUseUsername} />
        </View>
        <Text style={styles.nameHint}>
          {(t("certificates.printingAs") !== "certificates.printingAs" && t("certificates.printingAs")) || "Printing as:"}{" "}
          <Text style={{ fontWeight: "800" }}>{displayName}</Text>
        </Text>

        {/* Requirement / Progress box */}
        <View style={styles.requireBox}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="medkit" size={18} color="#111827" style={{ marginRight: 8 }} />
            <Text style={styles.requireTitle}>
              {(t("certificates.masteryTitle") !== "certificates.masteryTitle" && t("certificates.masteryTitle")) ||
                "First Aid Mastery"}
            </Text>
          </View>

          {loadingProgress ? (
            <View style={styles.progressRow}>
              <ActivityIndicator size="small" />
              <Text style={[styles.requireText, { marginLeft: 8 }]}>
                {(t("certificates.loading") !== "certificates.loading" && t("certificates.loading")) || "Loading progress…"}
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.requireText}>
                {(t("certificates.perfectCount") !== "certificates.perfectCount" && t("certificates.perfectCount")) ||
                  "Perfect scores on First Aid 1–5:"}{" "}
                <Text style={{ fontWeight: "800" }}>
                  {faPerfectCount}/{FIRST_AID_REQUIRED}
                </Text>
              </Text>

              <View style={styles.progTrack}>
                <View style={[styles.progFill, { width: `${progressPct}%` }]} />
              </View>

              {!demoMode && faPerfectCount < FIRST_AID_REQUIRED && (
                <Text style={styles.requireHint}>
                  {(t("certificates.unlockHint") !== "certificates.unlockHint" && t("certificates.unlockHint")) ||
                    "Complete all five with 100% to unlock certificate downloads."}
                </Text>
              )}
              {demoMode && (
                <Text style={styles.requireHint}>
                  {(t("certificates.demoEnabled") !== "certificates.demoEnabled" && t("certificates.demoEnabled")) ||
                    "Demo mode enabled — downloads are unlocked for testing."}
                </Text>
              )}
            </>
          )}
        </View>

        {/* Disclaimer */}
        <View style={styles.disclaimer}>
          <Ionicons name="alert-circle" size={16} color="#6b7280" style={{ marginRight: 6 }} />
          <Text style={styles.disclaimerText}>
            {(t("certificates.disclaimer") !== "certificates.disclaimer" && t("certificates.disclaimer")) ||
              "This is not an official certificate. It is generated for project/demo purposes only."}
          </Text>
        </View>

        {/* Certificates list */}
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8 }}>
          {CERTS.map((c) => {
            const locked = !isEligible;
            const title =
              (t(c.titleKey) !== c.titleKey && t(c.titleKey)) || c.fallback;

            return (
              <View key={c.id} style={[styles.card, { borderColor: "#e5e7eb" }]}>
                <View style={styles.cardLeft}>
                  <View style={[styles.iconWrap, { backgroundColor: c.theme }]}>
                    <Ionicons name="document-text" size={18} color="#fff" />
                  </View>
                  <View style={{ flexShrink: 1 }}>
                    <Text style={styles.cardTitle}>{title}</Text>
                    <Text style={styles.cardSub}>
                      {demoMode
                        ? (t("certificates.demoUnlocked") !== "certificates.demoUnlocked" && t("certificates.demoUnlocked")) || "Demo unlocked"
                        : ((t("certificates.completed") !== "certificates.completed" && t("certificates.completed", { count: faPerfectCount, total: FIRST_AID_REQUIRED })) ||
                          `Completed: ${faPerfectCount}/${FIRST_AID_REQUIRED}`)}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.downloadBtn, locked && { backgroundColor: "#cbd5e1" }]}
                  onPress={() => onDownload(c)}
                  disabled={locked}
                  activeOpacity={locked ? 1 : 0.85}
                >
                  <Ionicons name="download" size={16} color="#fff" />
                  <Text style={styles.downloadText}>
                    {(t("certificates.pdf") !== "certificates.pdf" && t("certificates.pdf")) || "PDF"}
                  </Text>
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
  const certId = `${id}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

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
      color: #0f172a; display: flex; align-items: center; justify-content: center; background: #fff;
    }
    .wrap { width: 88%; border: 2px solid ${accent}; border-radius: 14px; padding: 32px 36px; position: relative; box-sizing: border-box; }
    .watermark { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
      font-size: 72px; color: rgba(15,23,42,0.06); transform: rotate(-18deg); letter-spacing: 4px; font-weight: 800; pointer-events: none; }
    .title { text-align: center; font-size: 28px; font-weight: 800; margin: 0; }
    .subtitle { text-align: center; font-size: 13px; color: #334155; margin-top: 6px; }
    .name { margin-top: 42px; font-size: 26px; font-weight: 800; text-align: center; }
    .course { text-align: center; margin-top: 22px; font-size: 16px; color: #334155; }
    .badge { display: inline-block; padding: 6px 12px; border-radius: 999px; background: ${accent}; color: #fff; font-weight: 700; font-size: 12px; }
    .divider { height: 2px; background: ${accent}; width: 84%; margin: 28px auto; border-radius: 2px; }
    .infoRow { display: flex; justify-content: space-between; margin-top: 40px; font-size: 13px; color: #334155; font-weight: 600; }
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
  headerBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontWeight: "600", color: "#111827", fontSize: 22 },

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

  /* Requirement / progress */
  requireBox: {
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  requireTitle: { fontWeight: "800", color: "#111827" },
  requireText: { color: "#374151", fontWeight: "600" },
  requireHint: { color: "#6b7280", marginTop: 2 },
  progressRow: { flexDirection: "row", alignItems: "center" },
  progTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#e5e7eb",
    overflow: "hidden",
  },
  progFill: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#10b981",
  },

  /* Disclaimer */
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

  /* Cards */
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

  /* Download button */
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
