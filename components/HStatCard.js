/**
 * components/HStatCard.js — Compact horizontal statistic card
 *
 * Purpose
 * - Display a key statistic with an icon, label, main value, and optional subtext.
 * - Useful for showing small KPIs or environmental readings in a dashboard strip.
 *
 * Key Behaviours
 * - Icon is centered at the top (Ionicons).
 * - Label and value are stacked vertically, with optional subtext below.
 * - Fixed width (110px) for easy horizontal alignment in lists/rows.
 *
 * Exports
 * - Default React component <HStatCard icon label value sub/>.
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function HStatCard({ icon, label, value, sub }) {
  return (
    <View style={styles.hStatCard}>
      <Ionicons
        name={icon}
        size={36}
        color="#4F46E5"
        style={{ alignSelf: "center" }}
      />
      <Text style={styles.hStatLabelCentered}>{label}</Text>
      <Text style={styles.hStatValueCentered}>{value}</Text>
      {!!sub && (
        <Text style={styles.hStatSubCentered} numberOfLines={1}>
          {sub}
        </Text>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
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
});
