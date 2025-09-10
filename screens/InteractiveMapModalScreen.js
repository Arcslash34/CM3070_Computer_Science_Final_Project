/**
 * screens/InteractiveMapModalScreen.js — Full-screen environmental layers map (presentational)
 *
 * Purpose
 * - Display a full-screen interactive map (WebView) with switchable data layers (rain, PM2.5, wind, temp, humidity).
 * - Provide a simple header with localized title and a close action.
 * - Show a loading state until the WebView content reports ready.
 *
 * ViewModel / Props
 * - visible: boolean — controls modal visibility.
 * - onClose(): void — close handler for the header button / Android back.
 * - labels: { title, loading, a11yClose, layers: {...}, a11yLayer: {...} } — i18n strings.
 * - WebViewComponent: React component — injected WebView (RN or expo).
 * - webviewKey: string/number — forces reload when changed.
 * - html: string — rendered map HTML (already composed by container).
 * - ready: boolean — when false, show loader overlay instead of WebView.
 * - webviewRef: ref — passed to WebView for postMessage etc.
 * - onWVLoadStart/onWVLoadEnd: lifecycle hooks for WebView.
 * - activeLayer: "rain" | "pm25" | "wind" | "temp" | "humidity"
 * - setActiveLayer(key): void — switch active map layer.
 *
 * Key Behaviours
 * - Uses `Modal` with `presentationStyle="fullScreen"` and `statusBarTranslucent` on Android.
 * - WebView mounts only when `visible` is true; key changes trigger reloads.
 * - Bottom filter bar highlights the active layer and updates via `setActiveLayer`.
 *
 * UX / Accessibility
 * - Close button has a11y label; filter buttons have per-layer labels.
 * - Large tap targets; high-contrast active state.
 *
 * Performance Notes
 * - Avoids rendering WebView when not visible.
 * - Uses a lightweight loader overlay during initial WebView load.
 *
 * Fail-safes
 * - If `ready` is false, user sees a spinner + “loading” text.
 * - Defensive defaults: icons/text render even if some labels are missing.
 */

import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

export default function InteractiveMapModalScreen({
  visible,
  onClose,
  labels,
  WebViewComponent,
  webviewKey,
  html,
  ready,
  webviewRef,
  onWVLoadEnd,
  onWVLoadStart,
  activeLayer,
  setActiveLayer,
}) {
  // Do not mount the modal/WebView when hidden (saves resources)
  if (!visible) return null;

  return (
    // Full-screen modal; translucent status bar on Android to avoid jump
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS === "android"}
      hardwareAccelerated
      presentationStyle="fullScreen"
    >
      <SafeAreaView
        style={styles.container}
        edges={["top", "left", "right", "bottom"]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🌍 {labels.title}</Text>
          <TouchableOpacity
            onPress={onClose}
            accessibilityLabel={labels.a11yClose}
          >
            <Ionicons name="close" size={22} color="#111827" />
          </TouchableOpacity>
        </View>

        {/* Map */}
        <View style={styles.mapBox}>
          {ready ? (
            // Injected WebView instance (expo/react-native-webview); HTML provided by container
            <WebViewComponent
              ref={webviewRef}
              originWhitelist={["*"]}
              javaScriptEnabled
              domStorageEnabled
              key={webviewKey}
              source={{ html }}
              style={{ flex: 1 }}
              onLoadEnd={onWVLoadEnd}
              onLoadStart={onWVLoadStart}
            />
          ) : (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" />
              <Text style={styles.loadingText}>{labels.loading}</Text>
            </View>
          )}

          {/* Bottom filters — floating bar at bottom; safe for taps over the map */}
          <View style={styles.bottomFilters} pointerEvents="box-none">
            <View style={styles.filtersBar}>
              {[
                {
                  key: "rain",
                  label: labels.layers.rain,
                  icon: "rainy",
                  a11y: labels.a11yLayer.rain,
                },
                {
                  key: "pm25",
                  label: labels.layers.pm25,
                  icon: "leaf",
                  a11y: labels.a11yLayer.pm25,
                },
                {
                  key: "wind",
                  label: labels.layers.wind,
                  icon: "navigate",
                  a11y: labels.a11yLayer.wind,
                },
                {
                  key: "temp",
                  label: labels.layers.temp,
                  icon: "thermometer",
                  a11y: labels.a11yLayer.temp,
                },
                {
                  key: "humidity",
                  label: labels.layers.humidity,
                  icon: "water",
                  a11y: labels.a11yLayer.humidity,
                },
                // One button per layer; highlight active and announce via a11y label
              ].map(({ key, label, icon, a11y }) => {
                const active = activeLayer === key;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.filterButton,
                      active && styles.activeFilterButton,
                    ]}
                    onPress={() => setActiveLayer(key)}
                    accessibilityRole="button"
                    accessibilityLabel={a11y}
                  >
                    <Ionicons
                      name={icon}
                      size={18}
                      color={active ? "#fff" : "#374151"}
                      style={{ marginBottom: 4 }}
                    />
                    <Text
                      style={[
                        styles.filterText,
                        active && styles.activeFilterText,
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerTitle: { fontSize: 16, fontWeight: "800", color: "#111827" },
  mapBox: { flex: 1, position: "relative" },
  bottomFilters: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingBottom: 8,
  },
  filtersBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "#FFFFFFEE",
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginHorizontal: 10,
    alignSelf: "stretch",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  filterButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "#E5E7EB",
    minWidth: 58,
  },
  activeFilterButton: { backgroundColor: "#4F46E5" },
  filterText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#374151",
    letterSpacing: 0.5,
  },
  activeFilterText: { color: "#fff" },
  loadingOverlay: {
    position: "absolute",
    top: "40%",
    alignSelf: "center",
    alignItems: "center",
  },
  loadingText: { marginTop: 10, fontSize: 14, color: "#374151" },
});
