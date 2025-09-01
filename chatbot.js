// chatbot.js
import React, { useState, useRef, useContext } from "react";
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
import { useNavigation } from "@react-navigation/native";
import { LanguageContext } from "./translations/language";
import { t } from "./translations/translation";

// ===== Env + model =====
const OPENROUTER_ENDPOINT = process.env.EXPO_PUBLIC_OPENROUTER_ENDPOINT ?? "";
const OPENROUTER_API_KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY ?? "";

// const MODEL_ID = 'deepseek/deepseek-chat-v3-0324:free';
// const MODEL_ID = 'openai/gpt-oss-20b:free';
// const MODEL_ID = "meta-llama/llama-3.3-8b-instruct:free";
const MODEL_ID = "mistralai/mistral-7b-instruct:free";

if (__DEV__) {
  console.log("[OpenRouter] endpoint:", OPENROUTER_ENDPOINT || "(missing)");
  console.log("[OpenRouter] apiKey present?", Boolean(OPENROUTER_API_KEY));
}

// ===== Strong Singapore-first system prompt =====
const SYSTEM_PROMPT_SG = `
You are LiveShield, a disaster-preparedness assistant for SINGAPORE.
Always prioritise Singapore-specific guidance, laws, and agencies.
If advice differs by country, give the SINGAPORE answer first.
`.trim();

function HeaderBar({ title, onBack }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={onBack}
        style={styles.headerBtn}
        accessibilityLabel={
          (t("chatbot.back") !== "chatbot.back" && t("chatbot.back")) || "Back"
        }
      >
        <Ionicons name="chevron-back" size={22} color="#111827" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.headerBtn} />
    </View>
  );
}

export default function ChatbotScreen() {
  const navigation = useNavigation();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPresets, setShowPresets] = useState(true);
  const scrollViewRef = useRef();
  const { lang } = useContext(LanguageContext);

  // Preset questions pulled from i18n (expects an array under "chatbot.presetQuestions")
  const presetQuestions =
    t("chatbot.presetQuestions", { returnObjects: true }) || [];

  const sendMessage = async (text = input) => {
    if (!text.trim() || loading) return;

    const userMessage = { role: "user", content: text.trim() };
    const updated = [...messages, userMessage];
    setMessages(updated);
    setInput("");
    setLoading(true);

    // Guard: missing envs
    if (!OPENROUTER_ENDPOINT || !OPENROUTER_API_KEY) {
      setMessages([
        ...updated,
        {
          role: "assistant",
          content:
            "⚠️ Missing envs:\n- EXPO_PUBLIC_OPENROUTER_ENDPOINT\n- EXPO_PUBLIC_OPENROUTER_API_KEY\n\nRun `expo start -c` after updating .env.",
        },
      ]);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(OPENROUTER_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          model: MODEL_ID,
          temperature: 0.2, // steadier, more factual
          messages: [
            { role: "system", content: SYSTEM_PROMPT_SG },
            {
              role: "user",
              content: `User locale: Singapore. UI language: ${lang}. If safe, answer in this language.`,
            },
            ...updated,
          ],
        }),
      });

      // Read as text first so we can surface server errors nicely
      const textBody = await res.text();
      if (!res.ok) {
        let msg = "";
        try {
          const j = JSON.parse(textBody);
          msg = j?.error?.message || j?.message || j?.error || "";
        } catch {}
        throw new Error(msg || `HTTP ${res.status} ${textBody.slice(0, 200)}`);
      }

      let data;
      try {
        data = JSON.parse(textBody);
      } catch {
        throw new Error(`Bad JSON from server: ${textBody.slice(0, 200)}`);
      }

      const aiReply = data?.choices?.[0]?.message?.content?.trim();
      if (!aiReply) throw new Error("No choices in response.");

      setMessages([...updated, { role: "assistant", content: aiReply }]);
    } catch (err) {
      setMessages([
        ...updated,
        { role: "assistant", content: `❌ ${err.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.root}>
        <HeaderBar
          title={
            (t("chatbot.title") !== "chatbot.title" && t("chatbot.title")) ||
            "Chatbot"
          }
          onBack={() => navigation.goBack()}
        />

        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.chatContainer}
            ref={scrollViewRef}
            onContentSizeChange={() =>
              scrollViewRef.current?.scrollToEnd({ animated: true })
            }
          >
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

          <TouchableOpacity
            onPress={() => setShowPresets(!showPresets)}
            style={styles.toggleButton}
          >
            <Text style={styles.toggleText}>
              {showPresets
                ? (t("chatbot.hideSuggestions") !==
                    "chatbot.hideSuggestions" &&
                    t("chatbot.hideSuggestions")) ||
                  "⬇️ Hide Suggestions"
                : (t("chatbot.showSuggestions") !==
                    "chatbot.showSuggestions" &&
                    t("chatbot.showSuggestions")) ||
                  "⬆️ Show Suggestions"}
            </Text>
          </TouchableOpacity>

          {showPresets && (
            <View style={styles.quickRow}>
              {presetQuestions.map((q, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.quickBtn}
                  onPress={() => sendMessage(q)}
                >
                  <Text style={styles.quickText}>{q}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Composer with outside send button */}
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

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },
  root: { flex: 1, backgroundColor: "#fff" },

  // Static header (no native header animation)
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 0, // SafeAreaView handles top inset
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
