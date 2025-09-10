/**
 * components/CardRow.js — Reusable row/card component
 *
 * Purpose
 * - Display a row with an optional icon, label, right-side element, and optional chevron.
 * - Support pressable (TouchableOpacity) or static (View) usage.
 * - Used in settings lists, menus, and dashboards for consistent row styling.
 *
 * Key Behaviours
 * - If `onPress` is provided, wraps the row in a TouchableOpacity with activeOpacity feedback.
 * - If `chevron` is true, displays a right-facing chevron icon.
 * - Optional `right` prop allows passing custom trailing content (e.g., switch, badge, value).
 *
 * Exports
 * - Default memoized React component <CardRow/>.
 */

import React, { memo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
function CardRow({ icon, label, right, onPress, chevron }) {
  const content = (
    <View style={styles.rowInner}>
      <View style={styles.rowLeft}>
        {!!icon && (
          <Ionicons
            name={icon}
            size={18}
            color="#111827"
            style={{ marginRight: 10 }}
          />
        )}
        <Text style={styles.rowText} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {right}
        {chevron && (
          <Ionicons name="chevron-forward" size={18} color="#111827" />
        )}
      </View>
    </View>
  );
  return onPress ? (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.row}>
      {content}
    </TouchableOpacity>
  ) : (
    <View style={styles.row}>{content}</View>
  );
}
export default memo(CardRow);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  row: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 12,
    marginBottom: 10,
    height: 56,
    justifyContent: "center",
  },
  rowInner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  rowText: { color: "#111827", fontWeight: "600", fontSize: 15, flexShrink: 1 },
});
