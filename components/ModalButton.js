// components/ModalButton.js
import React from "react";
import { TouchableOpacity, Text, StyleSheet } from "react-native";

export default function ModalButton({ text, onPress, variant = "primary", style, textStyle }) {
  const secondary = variant === "secondary";
  return (
    <TouchableOpacity onPress={onPress} style={[styles.btn, secondary && styles.btnSecondary, style]}>
      <Text style={[styles.btnText, secondary && styles.btnTextSecondary, textStyle]}>{text}</Text>
    </TouchableOpacity>
  );
}
const styles = StyleSheet.create({
  btn: { backgroundColor: "#6366F1", paddingVertical: 12, borderRadius: 12, alignItems: "center", marginTop: 10 },
  btnSecondary: { backgroundColor: "#e5e7eb" },
  btnText: { color: "#fff", fontWeight: "700" },
  btnTextSecondary: { color: "#111827" },
});
