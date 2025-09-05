// components/SectionTitle.js
import React from "react";
import { View, Text, StyleSheet } from "react-native";

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
