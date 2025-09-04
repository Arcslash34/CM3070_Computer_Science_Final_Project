// components/FeatureCard.js
import React from "react";
import { TouchableOpacity, Image, Text, StyleSheet } from "react-native";

export default function FeatureCard({ title, img, onPress }) {
  return (
    <TouchableOpacity style={styles.featureCard} onPress={onPress} activeOpacity={0.9}>
      <Image source={img} style={styles.featureImage} />
      <Text style={styles.featureTitle} numberOfLines={1}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  featureCard: { width: "48%", backgroundColor: "#FFFFFF", borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "#E5E7EB" },
  featureImage: { width: "100%", height: 90, resizeMode: "cover" },
  featureTitle: { paddingHorizontal: 8, paddingVertical: 6, color: "#111827", fontWeight: "700", fontSize: 15, textAlign: "center" },
});
