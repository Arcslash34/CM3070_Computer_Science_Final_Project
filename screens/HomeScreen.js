// screens/HomeScreen.js
import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  StyleSheet,
  RefreshControl,
  Alert,
  Linking,
  Image,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import InteractiveMapModal from "../containers/InteractiveMapModalContainer";
import { t } from "../translations/translation";

// extracted components
import RiskAlertCard from "../components/RiskAlertCard";
import EmergencyContactsModal from "../components/EmergencyContactsModal";
import LeafletMiniMap from "../components/LeafletMiniMap";
import HStatCard from "../components/HStatCard";
import FeatureCard from "../components/FeatureCard";
import HomeNewsStrip from "../components/HomeNewsStrip";

/* ---------- hero sizing ---------- */
const HERO_SRC = require("../assets/home.jpg");
const HERO_DIM = Image.resolveAssetSource(HERO_SRC);
const HERO_ASPECT = HERO_DIM.height / HERO_DIM.width;
const { width: SCREEN_W } = Dimensions.get("window");
const HERO_HEIGHT = Math.round(SCREEN_W * HERO_ASPECT);

/* ===================== SCREEN ===================== */
export default function HomeScreen({ vm }) {
  const {
    navigation,
    lang,
    mapExpanded,
    setMapExpanded,
    emergencyOpen,
    setEmergencyOpen,
    coords,
    envDatasets,
    rainNearest,
    pm25Nearest,
    tempNearest,
    humidityNearest,
    windNearest,
    nearestAreaName,
    uiRiskLevel,
    areaAdvisoryActive,
    mockDisasterOn,
    mockLocationOn,
    updatedAt,
    locDeniedBanner,
    onEnableLocationPress,
    onRefresh,
    refreshing,
  } = vm;

  const formattedUpdated = updatedAt
    ? new Date(updatedAt).toLocaleTimeString()
    : "--:--";

  const riskBanner = (() => {
    if (mockDisasterOn && (mockLocationOn || areaAdvisoryActive)) {
      return (
        <RiskAlertCard
          variant="red"
          title={t("common.alert_flash_flood")}
          whenISO={updatedAt || new Date().toISOString()}
          areasText="Taman Jurong, Lakeside"
        />
      );
    }
    if (coords && uiRiskLevel) {
      const locName = rainNearest?.name || nearestAreaName || "your location";
      if (uiRiskLevel === "High") {
        return (
          <RiskAlertCard
            variant="red"
            title="Flash Flood Warning"
            whenISO={updatedAt}
            areasText={locName}
          />
        );
      }
      if (uiRiskLevel === "Moderate") {
        return (
          <RiskAlertCard
            variant="orange"
            title={t("common.alert_moderate_flood")}
            whenISO={updatedAt}
            areasText={locName}
          />
        );
      }
      return (
        <RiskAlertCard
          variant="green"
          title={t("common.alert_none")}
          whenISO={updatedAt}
        />
      );
    }
    return null;
  })();

  const onOpenArticle = (url) => Linking.openURL(url);
  const onCallConfirm = (num, name) => {
    Alert.alert(
      t("home.emergency.callConfirmTitle", { number: num }),
      t("home.emergency.callConfirmBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("home.emergency.call"),
          style: "destructive",
          onPress: () => Linking.openURL(`tel:${num}`),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* HERO */}
        <View style={styles.heroWrap}>
          <Image source={HERO_SRC} style={styles.heroImg} />
        </View>
        <View style={styles.heroText}>
          <Text style={styles.heroTitle}>{t("common.hero_title")}</Text>
          <Text style={styles.heroDesc}>{t("common.hero_desc")}</Text>
        </View>

        {/* LIVE MAP */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>
            {t("common.section_live_map")}
          </Text>
        </View>
        <View style={styles.mapShell}>
          {coords ? (
            <TouchableOpacity
              onPress={() => setMapExpanded(true)}
              activeOpacity={0.9}
            >
              <LeafletMiniMap lat={coords.latitude} lng={coords.longitude} />
            </TouchableOpacity>
          ) : (
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#6B7280" }}>{t("common.locating")}</Text>
            </View>
          )}
        </View>

        {/* Risk / Warning card */}
        {riskBanner}

        {/* Location banner */}
        {locDeniedBanner && (
          <View
            style={[
              styles.banner,
              { borderLeftColor: "#3B82F6", marginTop: 8 },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>
                {t("common.banner_loc_perm_denied")}
              </Text>
              <Text style={styles.bannerBody}>
                {t("common.banner_loc_body")}
              </Text>
              <TouchableOpacity
                onPress={onEnableLocationPress}
                style={styles.enableBtn}
              >
                <Text style={styles.enableBtnText}>
                  {t("common.banner_enable_location")}
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={() => {
                /* hide only in container if needed */
              }}
              accessibilityLabel="Dismiss alert"
            >
              <Ionicons name="close" size={18} color="#111827" />
            </TouchableOpacity>
          </View>
        )}

        {/* News */}
        <View style={[styles.sectionRow, { marginTop: 12 }]}>
          <Text style={styles.sectionTitle}>
            {t("common.section_articles")}
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate("Articles")}
            activeOpacity={0.8}
          >
            <Text style={styles.viewAll}>{t("common.section_view_all")}</Text>
          </TouchableOpacity>
        </View>
        <HomeNewsStrip onOpen={onOpenArticle} lang={lang} />

        {/* Local conditions */}
        <Text style={[styles.sectionTitle, { marginTop: 16, marginBottom: 8 }]}>
          {t("common.section_local_conditions")}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statsRow}
        >
          <HStatCard
            icon="rainy"
            label={t("common.stat_rainfall")}
            value={
              rainNearest?.rainfall != null ? `${rainNearest.rainfall} mm` : "—"
            }
            sub={rainNearest?.name || t("common.stat_nearest_station")}
          />
          <HStatCard
            icon="leaf"
            label={t("common.stat_pm25")}
            value={
              pm25Nearest?.value != null ? `${pm25Nearest.value} µg/m³` : "—"
            }
            sub={pm25Nearest?.name || t("common.stat_nearest_region")}
          />
          <HStatCard
            icon="thermometer"
            label={t("common.stat_temp")}
            value={
              tempNearest?.value != null ? `${tempNearest?.value} °C` : "—"
            }
            sub={tempNearest?.name || t("common.stat_nearest_station")}
          />
          <HStatCard
            icon="water"
            label={t("common.stat_humidity")}
            value={
              humidityNearest?.value != null ? `${humidityNearest.value}%` : "—"
            }
            sub={humidityNearest?.name || t("common.stat_nearest_station")}
          />
          <HStatCard
            icon="navigate"
            label={t("common.stat_wind")}
            value={windNearest?.speed != null ? `${windNearest.speed} kn` : "—"}
            sub={
              windNearest?.direction != null
                ? `Dir ${windNearest.direction}°`
                : windNearest?.name || t("common.stat_nearest")
            }
          />
        </ScrollView>

        {/* Features */}
        <Text
          style={[styles.sectionTitle, { marginTop: 16, marginBottom: 10 }]}
        >
          {t("common.section_emergency_prep")}
        </Text>
        <View style={styles.featuresGrid}>
          <FeatureCard
            title={t("common.feature_resource_hub")}
            img={require("../assets/resource.jpg")}
            onPress={() => navigation.navigate("Resource")}
          />
          <FeatureCard
            title={t("common.feature_checklist")}
            img={require("../assets/checklist.jpg")}
            onPress={() => navigation.navigate("Checklist")}
          />
          <FeatureCard
            title={t("common.feature_quiz_game")}
            img={require("../assets/quiz.jpg")}
            onPress={() => navigation.navigate("Quizzes")}
          />
          <FeatureCard
            title={t("common.feature_emergency_contact")}
            img={require("../assets/emergency.jpg")}
            onPress={() => vm.setEmergencyOpen(true)}
          />
        </View>

        <View style={{ height: 10 }} />
      </ScrollView>

      {/* Chatbot FAB */}
      <TouchableOpacity
        style={styles.chatBubble}
        activeOpacity={0.9}
        onPress={() => navigation.navigate("Chatbot")}
        accessibilityLabel="Open chatbot"
      >
        <Ionicons name="chatbubbles" size={20} color="#fff" />
      </TouchableOpacity>

      {/* Emergency contacts modal */}
      <EmergencyContactsModal
        visible={emergencyOpen}
        onClose={() => setEmergencyOpen(false)}
        onCall={onCallConfirm}
      />

      {/* Interactive map modal */}
      <InteractiveMapModal
        visible={mapExpanded}
        onClose={() => setMapExpanded(false)}
        userCoords={coords}
        datasets={envDatasets}
      />
    </SafeAreaView>
  );
}

/* ===================== styles ===================== */
const newsStyles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "ios" ? 0.06 : 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  source: { color: "#6B7280", fontWeight: "700", fontSize: 12 },
  title: { color: "#111827", fontSize: 15, fontWeight: "800", lineHeight: 20 },
  rowBottom: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  linkText: { color: "#6366F1", fontWeight: "700" },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFFFFF" },
  container: { padding: 16 },

  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#EEF2FF",
    borderLeftWidth: 4,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderColor: "#C7D2FE",
    marginBottom: 12,
  },
  bannerTitle: { color: "#111827", fontWeight: "700", marginBottom: 2 },
  bannerBody: { color: "#374151" },
  enableBtn: {
    alignSelf: "flex-start",
    marginTop: 8,
    backgroundColor: "#6C63FF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  enableBtnText: { color: "#fff", fontWeight: "700" },

  alertCard: {
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 8,
    marginBottom: 8,
  },
  alertRed: { backgroundColor: "#ef4444" },
  alertOrange: { backgroundColor: "#f59e0b" },
  alertGreen: { backgroundColor: "#d1fae5" },
  alertTitle: { fontSize: 16, fontWeight: "800", letterSpacing: 0.5 },
  alertTitleBig: { fontSize: 18, letterSpacing: 0.4 },
  alertMeta: { marginTop: 4, fontSize: 13, fontWeight: "600" },
  alertSpaced: { letterSpacing: 0.4 },
  alertTextLight: { color: "#fff" },
  alertTextDark: { color: "#111827" },

  heroWrap: { overflow: "hidden", marginTop: -16, marginHorizontal: -16 },
  heroImg: { width: "100%", height: HERO_HEIGHT, resizeMode: "contain" },
  heroText: { marginTop: 12 },
  heroTitle: { fontSize: 20, fontWeight: "800", color: "#111827" },
  heroDesc: { color: "#6B7280", marginTop: 6 },

  sectionRow: {
    marginTop: 16,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: { color: "#111827", fontWeight: "800", fontSize: 18 },
  viewAll: { color: "#6366F1", fontWeight: "800" },

  mapShell: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
    backgroundColor: "#F3F4F6",
  },
  mapShellInner: { height: 220, width: "100%" },
  updatedBelow: {
    color: "#6B7280",
    fontSize: 12,
    marginTop: 6,
    alignSelf: "flex-end",
  },

  statsRow: { gap: 10, paddingRight: 4 },
  hStatCard: {
    width: 110,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
  },
  hStatLabelCentered: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 8,
  },
  hStatValueCentered: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "800",
    marginTop: 4,
  },
  hStatSubCentered: {
    color: "#6B7280",
    fontSize: 12,
    marginTop: 4,
    alignSelf: "center",
    maxWidth: "100%",
  },

  featuresGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
  },
  featureCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  featureImage: { width: "100%", height: 90, resizeMode: "cover" },
  featureTitle: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    color: "#111827",
    fontWeight: "700",
    fontSize: 15,
    textAlign: "center",
  },

  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  modalSheet: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 24,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  modalTitle: { color: "#111827", fontWeight: "700", fontSize: 16 },

  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  contactLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  contactIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  contactName: { color: "#111827", fontWeight: "600" },
  contactNumber: { color: "#6B7280", marginTop: 2 },
  callBtn: {
    backgroundColor: "#6C63FF",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  callBtnText: { color: "#fff", fontWeight: "700" },

  chatBubble: {
    position: "absolute",
    right: 16,
    bottom: 24,
    backgroundColor: "#6C63FF",
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    zIndex: 30,
  },
});
