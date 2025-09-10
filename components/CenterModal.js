/**
 * components/CenterModal.js — Centered modal component
 *
 * Purpose
 * - Display a modal dialog centered on the screen with a dimmed backdrop.
 * - Wrap arbitrary children content inside a styled card container.
 * - Dismiss modal when the backdrop is pressed or when `onRequestClose` is triggered.
 *
 * Key Behaviours
 * - `visible` controls whether the modal is shown.
 * - `onClose` is called when backdrop is pressed or system close request occurs.
 * - Uses React Native `Modal` with `fade` animation and transparent background.
 * - Card has a max width of 380px and centers itself in the viewport.
 *
 * Exports
 * - Default React component <CenterModal/>.
 */

import React from "react";
import { Modal, Pressable, View, StyleSheet } from "react-native";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function CenterModal({ visible, onClose, children, cardStyle }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={[styles.card]} onStartShouldSetResponder={() => true}>
          {children}
        </View>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 16,
  },
});
