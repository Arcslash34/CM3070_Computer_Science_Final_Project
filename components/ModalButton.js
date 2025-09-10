/**
 * components/ModalButton.js — Styled button for modal actions
 *
 * Purpose
 * - Provide a reusable button component with "primary" and "secondary" styles.
 * - Typically used in modals, dialogs, or confirmation sheets.
 *
 * Key Behaviours
 * - Variant "primary": purple background, white bold text.
 * - Variant "secondary": gray background, dark text.
 * - Accepts additional `style` and `textStyle` props to override styles.
 *
 * Exports
 * - Default React component <ModalButton text onPress variant style textStyle/>.
 */

import React from "react";
import { TouchableOpacity, Text, StyleSheet } from "react-native";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function ModalButton({
  text,
  onPress,
  variant = "primary",
  style,
  textStyle,
}) {
  const secondary = variant === "secondary";
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.btn, secondary && styles.btnSecondary, style]}
    >
      <Text
        style={[
          styles.btnText,
          secondary && styles.btnTextSecondary,
          textStyle,
        ]}
      >
        {text}
      </Text>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  btn: {
    backgroundColor: "#6366F1",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
  },
  btnSecondary: { backgroundColor: "#e5e7eb" },
  btnText: { color: "#fff", fontWeight: "700" },
  btnTextSecondary: { color: "#111827" },
});
