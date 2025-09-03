// screens/CertificatesScreen.js
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

/* ---------- Simple Header ---------- */
function HeaderBar({ title, onBack }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.headerBtn}>
        <Ionicons name="chevron-back" size={22} color="#111827" />
      </TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.headerBtn} />
    </View>
  );
}

export default function CertificatesScreen({ vm }) {
  const {
    // i18n + layout
    t, insets,

    // nav
    onBack,

    // identity
    displayName, useUsername, setUseUsername,

    // demo/progress
    demoMode, toggleDemoMode,
    faPerfectCount, FIRST_AID_REQUIRED,
    loadingProgress,

    // list + rules
    CERTS, isEligible,

    // actions
    onDownload,
  } = vm;

  const progressPct = Math.round((faPerfectCount / FIRST_AID_REQUIRED) * 100);

  return (
    <SafeAreaView style={styles.safeRoot} edges={["top", "left", "right"]}>
      <HeaderBar
        title={
          t("certificates.title") !== "certificates.title"
            ? t("certificates.title")
            : "Certificates"
        }
        onBack={onBack}
      />

      <View style={[styles.screen, { paddingBottom: insets.bottom + 12 }]}>
        {/* Demo mode */}
        <View style={styles.nameBar}>
          <Ionicons name="construct" size={18} color="#111827" style={{ marginRight: 8 }} />
          <Text style={styles.nameText}>
            {t("certificates.demoMode") !== "certificates.demoMode"
              ? t("certificates.demoMode")
              : "Demo mode"}
          </Text>
          <View style={{ flex: 1 }} />
          <Switch value={demoMode} onValueChange={toggleDemoMode} />
        </View>

        {/* Username toggle */}
        <View style={styles.nameBar}>
          <Ionicons name="person" size={18} color="#111827" style={{ marginRight: 8 }} />
          <Text style={styles.nameText}>
            {t("certificates.showUsername") !== "certificates.showUsername"
              ? t("certificates.showUsername")
              : "Show username on certificate"}
          </Text>
          <View style={{ flex: 1 }} />
          <Switch value={useUsername} onValueChange={setUseUsername} />
        </View>
        <Text style={styles.nameHint}>
          {(t("certificates.printingAs") !== "certificates.printingAs"
            ? t("certificates.printingAs")
            : "Printing as:")}{" "}
          <Text style={{ fontWeight: "800" }}>{displayName}</Text>
        </Text>

        {/* Requirement / Progress box */}
        <View style={styles.requireBox}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="medkit" size={18} color="#111827" style={{ marginRight: 8 }} />
            <Text style={styles.requireTitle}>
              {t("certificates.masteryTitle") !== "certificates.masteryTitle"
                ? t("certificates.masteryTitle")
                : "First Aid Mastery"}
            </Text>
          </View>

          {loadingProgress ? (
            <View style={styles.progressRow}>
              <ActivityIndicator size="small" />
              <Text style={[styles.requireText, { marginLeft: 8 }]}>
                {t("certificates.loading") !== "certificates.loading"
                  ? t("certificates.loading")
                  : "Loading progress…"}
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.requireText}>
                {t("certificates.perfectCount") !== "certificates.perfectCount"
                  ? t("certificates.perfectCount")
                  : "Perfect scores on First Aid 1–5:"}{" "}
                <Text style={{ fontWeight: "800" }}>
                  {faPerfectCount}/{FIRST_AID_REQUIRED}
                </Text>
              </Text>

              <View style={styles.progTrack}>
                <View style={[styles.progFill, { width: `${progressPct}%` }]} />
              </View>

              {!demoMode && faPerfectCount < FIRST_AID_REQUIRED && (
                <Text style={styles.requireHint}>
                  {t("certificates.unlockHint") !== "certificates.unlockHint"
                    ? t("certificates.unlockHint")
                    : "Complete all five with 100% to unlock certificate downloads."}
                </Text>
              )}
              {demoMode && (
                <Text style={styles.requireHint}>
                  {t("certificates.demoEnabled") !== "certificates.demoEnabled"
                    ? t("certificates.demoEnabled")
                    : "Demo mode enabled — downloads are unlocked for testing."}
                </Text>
              )}
            </>
          )}
        </View>

        {/* Disclaimer */}
        <View style={styles.disclaimer}>
          <Ionicons name="alert-circle" size={16} color="#6b7280" style={{ marginRight: 6 }} />
          <Text style={styles.disclaimerText}>
            {t("certificates.disclaimer") !== "certificates.disclaimer"
              ? t("certificates.disclaimer")
              : "This is not an official certificate. It is generated for project/demo purposes only."}
          </Text>
        </View>

        {/* Certificates list */}
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8 }}>
          {CERTS.map((c) => {
            const locked = !isEligible;
            const title = t(c.titleKey) !== c.titleKey ? t(c.titleKey) : c.fallback;

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
                        ? (t("certificates.demoUnlocked") !== "certificates.demoUnlocked"
                            ? t("certificates.demoUnlocked")
                            : "Demo unlocked")
                        : (t("certificates.completed") !== "certificates.completed"
                            ? t("certificates.completed", {
                                count: faPerfectCount,
                                total: FIRST_AID_REQUIRED,
                              })
                            : `Completed: ${faPerfectCount}/${FIRST_AID_REQUIRED}`)}
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
                    {t("certificates.pdf") !== "certificates.pdf"
                      ? t("certificates.pdf")
                      : "PDF"}
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
