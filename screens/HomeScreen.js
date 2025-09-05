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
import SectionTitle from "../components/SectionTitle";
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
        <SectionTitle>{t("common.section_live_map")}</SectionTitle>
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
                /* container can hide this if needed */
              }}
              accessibilityLabel="Dismiss alert"
            >
              <Ionicons name="close" size={18} color="#111827" />
            </TouchableOpacity>
          </View>
        )}

        {/* News */}
        <SectionTitle
          right={
            <TouchableOpacity
              onPress={() => navigation.navigate("Articles")}
              activeOpacity={0.8}
            >
              <Text style={styles.viewAll}>{t("common.section_view_all")}</Text>
            </TouchableOpacity>
          }
        >
          {t("common.section_articles")}
        </SectionTitle>
        <HomeNewsStrip onOpen={onOpenArticle} lang={lang} />

        {/* Local conditions */}
        <SectionTitle>{t("common.section_local_conditions")}</SectionTitle>
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
        <SectionTitle>{t("common.section_emergency_prep")}</SectionTitle>
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

  heroWrap: { overflow: "hidden", marginTop: -16, marginHorizontal: -16 },
  heroImg: { width: "100%", height: HERO_HEIGHT, resizeMode: "contain" },
  heroText: { marginTop: 12 },
  heroTitle: { fontSize: 20, fontWeight: "800", color: "#111827" },
  heroDesc: { color: "#6B7280", marginTop: 6 },

  viewAll: { color: "#6366F1", fontWeight: "800" },

  mapShell: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
    backgroundColor: "#F3F4F6",
  },

  statsRow: { gap: 10, paddingRight: 4 },

  featuresGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
  },

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
