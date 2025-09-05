// components/CardRow.js
import React, { memo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

function CardRow({ icon, label, right, onPress, chevron }) {
  const content = (
    <View style={styles.rowInner}>
      <View style={styles.rowLeft}>
        {!!icon && <Ionicons name={icon} size={18} color="#111827" style={{ marginRight: 10 }} />}
        <Text style={styles.rowText} numberOfLines={1}>{label}</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {right}
        {chevron && <Ionicons name="chevron-forward" size={18} color="#111827" />}
      </View>
    </View>
  );
  return onPress
    ? <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.row}>{content}</TouchableOpacity>
    : <View style={styles.row}>{content}</View>;
}
export default memo(CardRow);

const styles = StyleSheet.create({
  row: { backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#e5e7eb", paddingHorizontal: 12, marginBottom: 10, height: 56, justifyContent: "center" },
  rowInner: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  rowText: { color: "#111827", fontWeight: "600", fontSize: 15, flexShrink: 1 },
});
