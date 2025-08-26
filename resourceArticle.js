// resourceArticle.js
import React, { useLayoutEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Image,
  Modal,
  Dimensions,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  GestureHandlerRootView,
  PinchGestureHandler,
  TapGestureHandler,
} from "react-native-gesture-handler";
import Animated, {
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Map imageKey (from resource.json) -> local asset
const IMAGE_MAP = {
  flood: require("./assets/resource/flood.jpg"),
  fire: require("./assets/resource/learntousefireextinguisher.jpg"),
  mosquito: require("./assets/resource/mosquito.jpg"),
  cpr: require("./assets/resource/cpr.jpg"),
  choking: require("./assets/resource/choking.jpg"),
  bleeding: require("./assets/resource/bleeding.jpg"),
  burns: require("./assets/resource/burn.jpg"),
  heatstroke: require("./assets/resource/heatstroke.jpg"),
  fracture: require("./assets/resource/fracture.jpg"),
};

// --- NEW: normalize sections from multiple possible JSON shapes
function arrayFromAny(val) {
  if (Array.isArray(val)) return val;
  return [];
}
function pickPoints(sec) {
  // Return the first candidate that is an array with at least 1 item
  const candidates = [
    sec.points,
    sec.bullets,
    sec.items,
    sec.list,
    sec.content,
  ];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0) return c;
  }
  return [];
}

function normalizeSections(article) {
  // 1) sections as an array of section objects
  if (Array.isArray(article?.sections)) {
    return article.sections
      .map((sec) => ({
        title: sec.title || "",
        points: pickPoints(sec).map(String),
      }))
      .filter((s) => s.title || (s.points && s.points.length));
  }

  // 2) sections as an object: { "Title": [ ... ] }
  if (article?.sections && typeof article.sections === "object") {
    return Object.entries(article.sections).map(([title, list]) => ({
      title,
      points: Array.isArray(list) ? list.map(String) : [],
    }));
  }

  // 3) legacy: body as an object of arrays
  if (
    article?.body &&
    typeof article.body === "object" &&
    !Array.isArray(article.body)
  ) {
    return Object.entries(article.body).map(([title, list]) => ({
      title,
      points: Array.isArray(list) ? list.map(String) : [],
    }));
  }

  return [];
}

export default function ResourceArticle() {
  const { params } = useRoute();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const article = params?.article ?? {};

  const [zoomVisible, setZoomVisible] = useState(false);

  const scale = useSharedValue(1);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);
  const doubleTapRef = React.useRef();

  const pinchHandler = useAnimatedGestureHandler({
    onActive: (event) => {
      scale.value = event.scale;
      focalX.value = event.focalX;
      focalY.value = event.focalY;
    },
  });

  const doubleTapHandler = useAnimatedGestureHandler({
    onActive: (event) => {
      if (scale.value > 1) {
        scale.value = withTiming(1);
      } else {
        scale.value = withTiming(2);
        focalX.value = event.x;
        focalY.value = event.y;
      }
    },
  });

  const animatedStyle = useAnimatedStyle(() => {
    const originX = focalX.value - width / 2;
    const originY = focalY.value - height / 2;
    return {
      transform: [
        { translateX: originX * (1 - scale.value) },
        { translateY: originY * (1 - scale.value) },
        { scale: scale.value },
      ],
    };
  });

  useLayoutEffect(() => {
    // No native header — we overlay a back button on the image
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  // Prefer new schema: imageKey -> IMAGE_MAP; fall back to old article.image
  const imageSource =
    (article?.imageKey && IMAGE_MAP[article.imageKey]) ||
    article?.image ||
    null;
  const imageUri = imageSource
    ? Image.resolveAssetSource(imageSource).uri
    : null;

  // --- NEW: compute normalized sections & flags
  const normalizedSections = useMemo(
    () => normalizeSections(article),
    [article]
  );

  const hasQuick = Array.isArray(article?.quick) && article.quick.length > 0;
  const hasSections = normalizedSections.length > 0;
  const hasLegacyBody = Array.isArray(article?.body) && article.body.length > 0;
  const hasTags = Array.isArray(article?.tags) && article.tags.length > 0;

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 28 }}
      >
        {/* TOP IMAGE with overlayed back button */}
        {imageUri && (
          <View style={styles.heroWrap}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setZoomVisible(true)}
            >
              <Image
                source={imageSource}
                style={styles.heroImage}
                resizeMode="cover"
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={[styles.backFab, { top: (insets.top || 0) + 8 }]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={24} color="#111827" />
            </TouchableOpacity>
          </View>
        )}

        {/* TITLE */}
        <View style={styles.headerTextBlock}>
          <Text style={styles.title}>{article?.title || "Guide"}</Text>
        </View>

        {/* TAGS (horizontal pills) */}
        {hasTags && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tagsRow}
          >
            {article.tags.map((t, i) => (
              <View key={`${t}-${i}`} style={styles.tagPill}>
                <Ionicons name="pricetag" size={12} color="#4F46E5" />
                <Text style={styles.tagText}>{t}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* QUICK STEPS (up to 5) */}
        {hasQuick && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Steps</Text>
            {article.quick.slice(0, 5).map((q, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={styles.bullet}>
                  <Text style={styles.bulletText}>{i + 1}</Text>
                </View>
                <Text style={styles.stepText}>{q}</Text>
              </View>
            ))}
          </View>
        )}

        {/* DIVIDER after quick steps */}
        {hasQuick && <View style={styles.divider} />}

        {/* DETAILED GUIDANCE — sections (normalized) */}
        {hasSections && (
          <View style={styles.section}>
            {normalizedSections.map((sec, sIdx) => {
              const isLast = sIdx === normalizedSections.length - 1;
              return (
                <View key={sIdx} style={{ marginBottom: 12 }}>
                  {sec.title ? (
                    <Text style={styles.subheading}>{sec.title}</Text>
                  ) : null}

                  {(sec.points || []).map((pt, pIdx) => (
                    <View key={pIdx} style={styles.pointRow}>
                      <Ionicons
                        name="ellipse"
                        size={6}
                        color="#4F46E5"
                        style={{ marginTop: 7, marginRight: 8 }}
                      />
                      <Text style={styles.pointText}>{pt}</Text>
                    </View>
                  ))}

                  {/* Divider between sections */}
                  {!isLast && <View style={styles.divider} />}
                </View>
              );
            })}
          </View>
        )}

        {/* Legacy fallback if an older item appears */}
        {!hasSections && hasLegacyBody && (
          <View style={styles.section}>
            <Text style={styles.subheading}>Details</Text>
            {article.body.map((p, i) => (
              <Text key={i} style={styles.paragraph}>
                {p}
              </Text>
            ))}
          </View>
        )}

        {/* REFERENCES (last section) */}
        {Array.isArray(article?.links) && article.links.length > 0 && (
          <View style={[styles.section, { marginTop: 8 }]}>
            <Text style={styles.sectionTitle}>References</Text>
            {article.links.map((l, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => Linking.openURL(l.url)}
                style={styles.linkRow}
              >
                <Ionicons name="link" size={16} color="#6366F1" />
                <Text style={styles.linkText}>{l.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.infoBox}>
          <Ionicons
            name="information-circle"
            size={18}
            color="#4F46E5"
            style={styles.infoIcon}
          />
          <Text style={styles.infoText}>
            This guide is for general first-aid education only and does not
            replace professional medical training or advice. In emergencies,
            call the local emergency number immediately.
          </Text>
        </View>
      </ScrollView>

      {/* FULLSCREEN ZOOM MODAL */}
      {imageUri && (
        <Modal visible={zoomVisible} animationType="fade" transparent>
          <GestureHandlerRootView style={styles.modalBackground}>
            <TapGestureHandler
              onGestureEvent={doubleTapHandler}
              numberOfTaps={2}
              ref={doubleTapRef}
            >
              <Animated.View style={styles.zoomContainer}>
                <PinchGestureHandler onGestureEvent={pinchHandler}>
                  <Animated.Image
                    source={{ uri: imageUri }}
                    style={[styles.zoomedImage, animatedStyle]}
                    resizeMode="contain"
                  />
                </PinchGestureHandler>
              </Animated.View>
            </TapGestureHandler>
            <TouchableOpacity
              onPress={() => setZoomVisible(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </GestureHandlerRootView>
        </Modal>
      )}
    </>
  );
}

const { width, height } = Dimensions.get("window");

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },

  /* HERO IMAGE + back overlay */
  heroWrap: {
    position: "relative",
    width: "100%",
    height: width * 0.56, // ~16:9
    backgroundColor: "#F3F4F6",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  backFab: {
    position: "absolute",
    left: 12,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.5)",
  },

  /* Title + tags */
  headerTextBlock: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  title: { fontSize: 20, fontWeight: "800", color: "#111827" },

  tagsRow: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 2,
  },
  tagPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#EEF2FF",
    borderColor: "#C7D2FE",
    borderWidth: 1,
    borderRadius: 999,
    marginHorizontal: 4,
  },
  tagText: { color: "#4F46E5", fontWeight: "700", fontSize: 12 },

  /* Sections */
  section: { paddingHorizontal: 16, marginTop: 14 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
  },

  // Quick steps
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  bullet: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  bulletText: { color: "#4F46E5", fontWeight: "700", fontSize: 12 },
  stepText: { flex: 1, color: "#111827" },

  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginHorizontal: 16,
    marginTop: 10,
  },

  subheading: {
    fontSize: 15,
    fontWeight: "800",
    color: "#374151",
    marginBottom: 6,
  },
  pointRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  pointText: { flex: 1, color: "#111827", lineHeight: 20 },

  // Legacy body
  paragraph: { color: "#111827", lineHeight: 20, marginBottom: 8 },

  // Links
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
  },
  linkText: { color: "#6366F1", fontWeight: "600" },

  // Disclaimer
  disclaimer: {
    color: "#6B7280",
    fontSize: 12,
    textAlign: "center",
    paddingVertical: 18,
    paddingHorizontal: 16,
  },

  // Zoom modal
  modalBackground: {
    flex: 1,
    backgroundColor: "#000000DD",
    justifyContent: "center",
    alignItems: "center",
  },
  zoomContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  zoomedImage: { width, height },
  closeButton: {
    position: "absolute",
    top: Platform.select({ ios: 50, android: 40 }),
    right: 20,
    backgroundColor: "#00000099",
    padding: 8,
    borderRadius: 20,
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginTop: 10,
  },
  // Info/disc
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 16,
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
  },
  infoIcon: {
    marginTop: 2,
  },
  infoText: {
    flex: 1,
    color: "#374151",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "left",
  },
});
