/**
 * components/SectionTitle.js — Section header with optional right-side action
 *
 * Purpose
 * - Display a bold section heading, typically above a list or card group.
 * - Allow an optional `right` element (e.g. button, link) on the same row.
 *
 * Key Behaviours
 * - Accepts `children` as the section title text.
 * - Accepts `right` React node to render on the right side.
 * - `containerStyle` and `textStyle` props allow style overrides.
 *
 * Exports
 * - Default React component <SectionTitle children right containerStyle textStyle/>.
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function SectionTitle({
  children,
  right,
  containerStyle,
  textStyle,
}) {
  return (
    <View style={[styles.row, containerStyle]}>
      <Text style={[styles.title, textStyle]}>{children}</Text>
      {right ?? null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  row: {
    marginTop: 16,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { color: "#111827", fontWeight: "800", fontSize: 18 },
});
