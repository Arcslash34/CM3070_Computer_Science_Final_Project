// components/CenterModal.js
import React from "react";
import { Modal, Pressable, View, StyleSheet } from "react-native";

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
