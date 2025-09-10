/**
 * screens/ChatbotScreen.js — Presentational chat UI (OpenRouter-backed bot)
 *
 * Purpose
 * - Render a simple, localized chat interface for the LiveShield assistant.
 * - Show message history, typing state, and quick-prompt presets.
 * - Provide a composer with send/submit handling and loading/disabled states.
 *
 * Data Sources
 * - ViewModel (vm) props from ChatbotContainer:
 *   • messages: [{ role: "user" | "assistant", content }]
 *   • input, setInput, loading
 *   • presetQuestions, showPresets, setShowPresets
 *   • sendMessage(), scrollViewRef
 * - i18n via `t(...)` for all labels/placeholders.
 *
 * Key Behaviours
 * - Auto-scroll to latest message on content size change.
 * - Toggleable preset suggestions; tapping one sends it immediately.
 * - Composer disables while loading; Enter/Return triggers send.
 * - Header with back navigation and localized title.
 *
 * UX / Accessibility
 * - Clear user/assistant bubbles with contrasting backgrounds.
 * - Loading row shows a typing indicator label.
 * - Send button has accessible label and proper hitSlop.
 *
 * Performance Notes
 * - Pure presentational: no network calls here; relies on container.
 * - Lightweight message rendering; minimal styling/shadows.
 *
 * Fail-safes
 * - Falls back to sensible English strings if translation keys are missing.
 * - Guards against empty input and double-sends while loading.
 */

import React from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

/* ---------- Header ---------- */
function HeaderBar({ title, onBack }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.headerBtn}>
        <Ionicons name="chevron-back" size={22} color="#111827" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.headerBtn} />
    </View>
  );
}

/* ---------- Main Screen ---------- */
export default function ChatbotScreen({ vm }) {
  const {
    t,
    onBack,
    input,
    setInput,
    messages,
    loading,
    showPresets,
    setShowPresets,
    presetQuestions,
    scrollViewRef,
    sendMessage,
  } = vm;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.root}>
        {/* Top bar */}
        <HeaderBar
          title={
            t("chatbot.title") !== "chatbot.title"
              ? t("chatbot.title")
              : "Chatbot"
          }
          onBack={onBack}
        />

        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {/* Chat history */}
          <ScrollView
            contentContainerStyle={styles.chatContainer}
            ref={scrollViewRef}
            onContentSizeChange={() =>
              scrollViewRef.current?.scrollToEnd({ animated: true })
            }
          >
            {/* Messages */}
            {messages.map((msg, idx) => (
              <View
                key={idx}
                style={[
                  styles.message,
                  msg.role === "user" ? styles.user : styles.ai,
                ]}
              >
                <Text>{msg.content}</Text>
              </View>
            ))}
            {/* Typing indicator */}
            {loading && (
              <View style={[styles.message, styles.ai]}>
                <Text>
                  🤖{" "}
                  {(t("chatbot.typing") !== "chatbot.typing" &&
                    t("chatbot.typing")) ||
                    "Bot is typing..."}
                </Text>
              </View>
            )}
          </ScrollView>
          {/* Suggestions toggle */}
          <TouchableOpacity
            onPress={() => setShowPresets(!showPresets)}
            style={styles.toggleButton}
          >
            <Text style={styles.toggleText}>
              {showPresets
                ? (t("chatbot.hideSuggestions") !== "chatbot.hideSuggestions" &&
                    t("chatbot.hideSuggestions")) ||
                  "⬇️ Hide Suggestions"
                : (t("chatbot.showSuggestions") !== "chatbot.showSuggestions" &&
                    t("chatbot.showSuggestions")) ||
                  "⬆️ Show Suggestions"}
            </Text>
          </TouchableOpacity>

          {/* Quick preset suggestions */}
          {showPresets && (
            <View style={styles.quickRow}>
              {presetQuestions.map((q, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.quickBtn}
                  onPress={() => {
                    setShowPresets(false);
                    sendMessage(q);
                  }}
                >
                  <Text style={styles.quickText}>{q}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Composer (input + send) */}
          <View style={styles.composerRow}>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                placeholder={
                  (t("chatbot.askQuestion") !== "chatbot.askQuestion" &&
                    t("chatbot.askQuestion")) ||
                  "Type your question here..."
                }
                value={input}
                onChangeText={setInput}
                editable={!loading}
                returnKeyType="send"
                onSubmitEditing={() =>
                  !loading && input.trim() && sendMessage()
                }
              />
            </View>
            <TouchableOpacity
              onPress={() => sendMessage()}
              disabled={loading || !input.trim()}
              accessibilityLabel={
                (t("chatbot.sendMessage") !== "chatbot.sendMessage" &&
                  t("chatbot.sendMessage")) ||
                "Send message"
              }
              activeOpacity={0.7}
              style={[
                styles.sendBtnOutside,
                (loading || !input.trim()) && styles.sendBtnDisabled,
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="send" size={18} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

/* ---------- Styles ---------- */
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },
  root: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 0,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    backgroundColor: "#fff",
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontWeight: "600",
    color: "#111827",
    fontSize: 22,
  },
  container: { flex: 1, padding: 10 },
  chatContainer: { paddingBottom: 20, paddingTop: 10 },
  message: {
    padding: 10,
    marginVertical: 5,
    borderRadius: 12,
    maxWidth: "80%",
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  user: { alignSelf: "flex-end", backgroundColor: "#D0F0FD" },
  ai: { alignSelf: "flex-start", backgroundColor: "#F0EAD6" },
  quickRow: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 10,
  },
  quickBtn: {
    backgroundColor: "#d0e8f2",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginVertical: 4,
    maxWidth: "90%",
  },
  quickText: { fontSize: 14, textAlign: "center" },
  toggleButton: {
    alignSelf: "center",
    marginVertical: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#eee",
    borderRadius: 20,
  },
  toggleText: { fontSize: 12, color: "#333" },
  composerRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  inputWrap: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 20,
    backgroundColor: "#f9f9f9",
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 10 : 6,
  },
  input: { minHeight: 20, paddingVertical: 6, paddingHorizontal: 0 },
  sendBtnOutside: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#6C63FF",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  sendBtnDisabled: { opacity: 0.5 },
});
