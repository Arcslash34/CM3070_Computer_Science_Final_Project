/**
 * containers/ChatbotContainer.js — View-model for the in-app chatbot
 *
 * Purpose
 * - Manage chatbot UI state (messages, input, loading, presets) and wire calls to OpenRouter.
 * - Inject a Singapore-focused system prompt and user locale/language into requests.
 * - Handle rate limits, timeouts, and missing environment variables gracefully.
 *
 * Key Behaviours
 * - Uses env vars: EXPO_PUBLIC_OPENROUTER_ENDPOINT, EXPO_PUBLIC_OPENROUTER_API_KEY.
 * - Streams disabled; uses a single POST with a 20s abort timeout.
 * - Falls back to an error assistant message when envs are missing or on network/API errors.
 * - Preset questions are localized from i18n (`chatbot.presetQuestions`).
 *
 * Exports
 * - Default React component <ChatbotContainer/> which renders <ChatbotScreen vm={...}/> .
 */

import React, { useContext, useRef, useState } from "react";
import { LanguageContext } from "../translations/language";
import { t } from "../translations/translation";

// ---------------------------------------------------------------------------
// Model & system prompt
// ---------------------------------------------------------------------------
const OPENROUTER_ENDPOINT = process.env.EXPO_PUBLIC_OPENROUTER_ENDPOINT ?? "";
const OPENROUTER_API_KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY ?? "";

// const MODEL_ID = 'deepseek/deepseek-chat-v3-0324:free';
// const MODEL_ID = 'openai/gpt-oss-20b:free';
// const MODEL_ID = "meta-llama/llama-3.3-8b-instruct:free";
const MODEL_ID = "mistralai/mistral-7b-instruct:free";

const SYSTEM_PROMPT_SG = `
You are LiveShield, a disaster-preparedness assistant for SINGAPORE.
Always prioritise Singapore-specific guidance, laws, and agencies.
If advice differs by country, give the SINGAPORE answer first.
`.trim();

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function ChatbotContainer({ navigation }) {
  const { lang } = useContext(LanguageContext);

  // UI state
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPresets, setShowPresets] = useState(true);
  const scrollViewRef = useRef();

  // Presets (localized)
  const presetRaw = t("chatbot.presetQuestions", { returnObjects: true });
  const presetQuestions = Array.isArray(presetRaw) ? presetRaw : [];

  // Send a single-turn message (no streaming)
  const sendMessage = async (text) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    const userMessage = { role: "user", content };
    const updated = [...messages, userMessage];
    setMessages(updated);
    setInput("");
    setLoading(true);

    // Missing env guard
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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

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
          temperature: 0.2,
          messages: [
            { role: "system", content: SYSTEM_PROMPT_SG },
            {
              role: "user",
              content: `User locale: Singapore. UI language: ${lang}. If safe, answer in this language.`,
            },
            ...updated,
          ],
        }),
        signal: controller.signal,
      });

      const textBody = await res.text();
      if (!res.ok) {
        let msg = "";
        try {
          const j = JSON.parse(textBody);
          msg = j?.error?.message || j?.message || j?.error || "";
        } catch {}
        if (res.status === 429) {
          msg =
            t("chatbot.rateLimited") || "Rate limited. Try again in a moment.";
        }
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
      clearTimeout(timeout);
      setLoading(false);
    }
  };

  // View-model
  const vm = {
    // strings
    t,
    lang,

    // nav
    onBack: () => navigation.goBack?.(),

    // state
    input,
    setInput,
    messages,
    loading,
    showPresets,
    setShowPresets,
    presetQuestions,

    // refs
    scrollViewRef,

    // actions
    sendMessage,
  };

  // Defer all rendering to the presentational screen
  const ChatbotScreen = require("../screens/ChatbotScreen").default;
  return <ChatbotScreen vm={vm} />;
}
