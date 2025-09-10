/**
 * components/FeatureCard.js — Small tappable feature card
 *
 * Purpose
 * - Display a rectangular card with an image and a short title.
 * - Act as a grid item to navigate to features within the app.
 *
 * Key Behaviours
 * - Pressable via TouchableOpacity with slight opacity feedback.
 * - Image fills the top; title is centered below.
 * - Two-card-per-row grid layout supported with `width: "48%"`.
 *
 * Exports
 * - Default React component <FeatureCard/>.
 */

import React from "react";
import { TouchableOpacity, Image, Text, StyleSheet } from "react-native";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function FeatureCard({ title, img, onPress }) {
  return (
    <TouchableOpacity
      style={styles.featureCard}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <Image source={img} style={styles.featureImage} />
      <Text style={styles.featureTitle} numberOfLines={1}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  featureCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  featureImage: { width: "100%", height: 90, resizeMode: "cover" },
  featureTitle: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    color: "#111827",
    fontWeight: "700",
    fontSize: 15,
    textAlign: "center",
  },
});
