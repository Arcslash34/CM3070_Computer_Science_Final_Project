// screens/InteractiveMapModalScreen.js
import React from "react";
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform,
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
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS === "android"}
      hardwareAccelerated
      presentationStyle="fullScreen"
    >
      <SafeAreaView style={styles.container} edges={["top", "left", "right", "bottom"]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🌍 {labels.title}</Text>
          <TouchableOpacity onPress={onClose} accessibilityLabel={labels.a11yClose}>
            <Ionicons name="close" size={22} color="#111827" />
          </TouchableOpacity>
        </View>

        {/* Map */}
        <View style={styles.mapBox}>
          {ready ? (
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

          {/* Bottom filters */}
          <View style={styles.bottomFilters} pointerEvents="box-none">
            <View style={styles.filtersBar}>
              {[
                { key: "rain", label: labels.layers.rain, icon: "rainy", a11y: labels.a11yLayer.rain },
                { key: "pm25", label: labels.layers.pm25, icon: "leaf", a11y: labels.a11yLayer.pm25 },
                { key: "wind", label: labels.layers.wind, icon: "navigate", a11y: labels.a11yLayer.wind },
                { key: "temp", label: labels.layers.temp, icon: "thermometer", a11y: labels.a11yLayer.temp },
                { key: "humidity", label: labels.layers.humidity, icon: "water", a11y: labels.a11yLayer.humidity },
              ].map(({ key, label, icon, a11y }) => {
                const active = activeLayer === key;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.filterButton, active && styles.activeFilterButton]}
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
                    <Text style={[styles.filterText, active && styles.activeFilterText]}>
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
    flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16,
    paddingVertical: 10, backgroundColor: "#F3F4F6", alignItems: "center",
    borderBottomWidth: 1, borderBottomColor: "#E5E7EB",
  },
  headerTitle: { fontSize: 16, fontWeight: "800", color: "#111827" },
  mapBox: { flex: 1, position: "relative" },
  bottomFilters: { position: "absolute", left: 0, right: 0, bottom: 0, paddingBottom: 8 },
  filtersBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-around",
    backgroundColor: "#FFFFFFEE", borderRadius: 16, paddingVertical: 8, paddingHorizontal: 10,
    marginHorizontal: 10, alignSelf: "stretch", shadowColor: "#000", shadowOpacity: 0.12,
    shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  filterButton: {
    alignItems: "center", justifyContent: "center", paddingVertical: 8, paddingHorizontal: 10,
    borderRadius: 12, backgroundColor: "#E5E7EB", minWidth: 58,
  },
  activeFilterButton: { backgroundColor: "#4F46E5" },
  filterText: { fontSize: 11, fontWeight: "800", color: "#374151", letterSpacing: 0.5 },
  activeFilterText: { color: "#fff" },
  loadingOverlay: { position: "absolute", top: "40%", alignSelf: "center", alignItems: "center" },
  loadingText: { marginTop: 10, fontSize: 14, color: "#374151" },
});
