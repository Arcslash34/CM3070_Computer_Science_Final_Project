// screens/SirenScreen.js
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform, Animated, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function SirenScreen({ vm }) {
  const {
    // camera
    CameraView,
    hasCameraPerm,
    mountCam,
    torchOn,
    onCameraReady,
    onMountError,

    // state/actions
    strobing,
    onToggleStrobe,
    onStop,

    // cover
    coverVisible,
    cover,

    // web
    webReady, setWebReady,
  } = vm;

  return (
    <View style={styles.root}>
      {/* Camera FIRST (stealth) */}
      {Platform.OS !== "web" && hasCameraPerm && mountCam && (
        <CameraView
          style={styles.stealthCam}
          active
          facing="back"
          flash="off"
          enableTorch={torchOn}
          onCameraReady={onCameraReady}
          onMountError={onMountError}
        />
      )}

      {/* small screen flash fallback overlay */}
      {Platform.OS !== "web" && (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: torchOn ? "#FFFFFF" : "transparent", opacity: 0.12 },
          ]}
        />
      )}

      {/* UI card */}
      <View style={styles.card}>
        <View style={styles.header}>
          <Ionicons name="alert" size={20} color="#fff" />
          <Text style={styles.title}>Emergency Siren</Text>
        </View>

        <Text style={styles.subtitle}>
          Siren, vibration and {Platform.OS !== "web" ? "flashlight" : "screen alert"} are ACTIVE.
        </Text>

        <View style={styles.tipBanner}>
          <Text style={styles.tipText}>
            Can’t hear the siren? Increase your device volume and disable Do Not Disturb.
          </Text>
        </View>

        {Platform.OS === "web" && !webReady && (
          <TouchableOpacity
            style={[styles.btn, styles.secondary, { marginBottom: 10 }]}
            onPress={() => setWebReady(true)}
          >
            <Ionicons name="volume-high" size={16} color="#111827" />
            <Text style={styles.btnTextDark}>Play Siren</Text>
          </TouchableOpacity>
        )}

        <View style={styles.row}>
          {Platform.OS !== "web" && hasCameraPerm ? (
            <TouchableOpacity onPress={onToggleStrobe} style={[styles.btn, styles.secondary]}>
              <Ionicons name="flash" size={16} color="#9CA3AF" />
              <Text style={styles.btnTextDark}>{strobing ? "Stop Strobe" : "Strobe Flash"}</Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.btn, styles.disabled]}>
              <Ionicons name="flash" size={16} color="#9CA3AF" />
              <Text style={[styles.btnTextDark, { color: "#9CA3AF" }]}>Flash Unavailable</Text>
            </View>
          )}

          <TouchableOpacity onPress={onStop} style={[styles.btn, styles.danger]}>
            <Ionicons name="close" size={16} color="#fff" />
            <Text style={styles.btnText}>STOP</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* COVER on top */}
      {coverVisible && (
        <Modal visible transparent statusBarTranslucent animationType="none">
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFillObject, styles.coverTop, { opacity: cover }]}
          />
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#111827", alignItems: "center", justifyContent: "center", padding: 16 },
  stealthCam: {
    position: "absolute",
    transform: [{ translateX: -2000 }, { translateY: -2000 }, { scale: 0.01 }],
    width: 120, height: 120, opacity: 0.0001, backgroundColor: "transparent",
    renderToHardwareTextureAndroid: true,
  },
  coverTop: { backgroundColor: "#000", zIndex: 9999, elevation: 1 },

  card: {
    width: "100%", backgroundColor: "#1F2937", borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: "#374151",
  },
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  title: { color: "#fff", fontWeight: "800", fontSize: 18 },
  subtitle: { color: "#E5E7EB", marginBottom: 12 },
  tipBanner: { backgroundColor: "#111827", borderColor: "#374151", borderWidth: 1, borderRadius: 12, padding: 10, marginBottom: 10 },
  tipText: { color: "#E5E7EB", marginBottom: 6, fontSize: 12 },

  row: { flexDirection: "row", gap: 10 },
  btn: {
    flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center",
    justifyContent: "center", flexDirection: "row", gap: 8,
  },
  secondary: { backgroundColor: "#F3F4F6" },
  disabled: { backgroundColor: "#E5E7EB" },
  danger: { backgroundColor: "#EF4444" },
  btnText: { color: "#fff", fontWeight: "800" },
  btnTextDark: { color: "#111827", fontWeight: "800" },
});
