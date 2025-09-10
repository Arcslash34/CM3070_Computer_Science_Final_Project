/**
 * components/EmergencyContactsModal.js — System emergency contacts bottom sheet
 *
 * Purpose
 * - Show a localized list of official emergency contacts (SCDF, Ambulance, Police).
 * - Allow quick one-tap calling with clear color/icon differentiation.
 * - Dismiss via backdrop tap or close button.
 *
 * Key Behaviours
 * - Renders as a bottom sheet over a dimmed backdrop (modal, fade, transparent).
 * - Contact list is localized via `t()` and includes number + label.
 * - `onCall(number, name)` invoked from the call button.
 *
 * Exports
 * - Default React component <EmergencyContactsModal/>.
 */

import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { t } from "../translations/translation";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function EmergencyContactsModal({ visible, onClose, onCall }) {
  // Localized contact definitions
  const CONTACTS = [
    {
      key: "scdf",
      name: t("home.emergency.contacts.scdf.name"),
      number: "995",
      icon: "flame",
      color: "#EF4444",
    },
    {
      key: "ambulance",
      name: t("home.emergency.contacts.ambulance.name"),
      number: "1777",
      icon: "medkit",
      color: "#F59E0B",
    },
    {
      key: "police",
      name: t("home.emergency.contacts.police.name"),
      number: "999",
      icon: "shield",
      color: "#3B82F6",
    },
  ];
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      {/* Backdrop: tap to close */}
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalBackdrop} />
      </TouchableWithoutFeedback>

      {/* Bottom sheet */}
      <View style={styles.modalSheet}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{t("home.emergency.title")}</Text>
          <TouchableOpacity
            onPress={onClose}
            accessibilityLabel={t("common.close")}
          >
            <Ionicons name="close" size={20} color="#111827" />
          </TouchableOpacity>
        </View>

        {/* Contact list */}
        {CONTACTS.map((c) => (
          <View key={c.key} style={styles.contactRow}>
            <View style={styles.contactLeft}>
              <View
                style={[styles.contactIconWrap, { backgroundColor: c.color }]}
              >
                <Ionicons name={c.icon} size={16} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.contactName}>{c.name}</Text>
                <Text style={styles.contactNumber}>{c.number}</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => onCall(c.number, c.name)}
              style={styles.callBtn}
              accessibilityLabel={t("home.emergency.callA11y", {
                name: c.name,
              })}
            >
              <Ionicons name="call" size={16} color="#fff" />
              <Text style={styles.callBtnText}>{t("home.emergency.call")}</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  modalSheet: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 24,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  modalTitle: { color: "#111827", fontWeight: "700", fontSize: 16 },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  contactLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  contactIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  contactName: { color: "#111827", fontWeight: "600" },
  contactNumber: { color: "#6B7280", marginTop: 2 },
  callBtn: {
    backgroundColor: "#6C63FF",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  callBtnText: { color: "#fff", fontWeight: "700" },
});
