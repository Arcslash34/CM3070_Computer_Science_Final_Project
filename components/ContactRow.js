/**
 * components/ContactRow.js — Emergency contact row component
 *
 * Purpose
 * - Display a contact with name, optional relation, and phone number.
 * - Provide inline action buttons for calling, editing, or deleting the contact.
 *
 * Key Behaviours
 * - Shows a left-side avatar circle with a person icon.
 * - Inline text: bold name, optional relation (in gray), and phone number.
 * - Right-side actions are conditional: Call (green), Edit (blue), Delete (red).
 *
 * Exports
 * - Default React component <ContactRow/>.
 */

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function ContactRow({
  name,
  relation,
  phone,
  onCall,
  onEdit,
  onDelete,
}) {
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <View style={styles.emIcon}>
          <Ionicons name="person" size={14} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: "700" }}>
            {name}
            {!!relation && (
              <Text style={{ color: "#6b7280" }}> ({relation})</Text>
            )}
          </Text>
          <Text style={{ color: "#374151" }}>{phone}</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {!!onCall && (
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: "#10b981" }]}
            onPress={onCall}
          >
            <Ionicons name="call" size={16} color="#fff" />
          </TouchableOpacity>
        )}
        {!!onEdit && (
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: "#2563eb" }]}
            onPress={onEdit}
          >
            <Ionicons name="create" size={16} color="#fff" />
          </TouchableOpacity>
        )}
        {!!onDelete && (
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: "#ef4444" }]}
            onPress={onDelete}
          >
            <Ionicons name="trash" size={16} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: "#e5e7eb",
  },
  left: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  emIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
});
