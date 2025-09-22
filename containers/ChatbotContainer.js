/**
 * containers/ChatbotContainer.js — View-model for the in-app chatbot
 *
 * Purpose
 * - Manage chatbot UI state (messages, input, loading, presets) and wire calls to OpenRouter.
 * - Inject a Singapore-focused system prompt and user locale/language into requests.
 * - Handle rate limits, timeouts, and missing environment variables gracefully.
 * - Auto-failover across multiple model IDs when one is unavailable.
 *
 * Key Behaviours
 * - Uses env vars: EXPO_PUBLIC_OPENROUTER_ENDPOINT, EXPO_PUBLIC_OPENROUTER_API_KEY.
 * - Streams disabled; uses POST with timeouts.
 * - Falls back to an error assistant message when envs are missing or on network/API errors.
 * - Preset questions are localized from i18n (`chatbot.presetQuestions`).
 * - Remembers last good model in AsyncStorage to speed up future calls.
 */

import React, { useContext, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LanguageContext } from "../translations/language";
import { t } from "../translations/translation";

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------
const OPENROUTER_ENDPOINT = process.env.EXPO_PUBLIC_OPENROUTER_ENDPOINT ?? "";
const OPENROUTER_API_KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY ?? "";

// ---------------------------------------------------------------------------
// Model candidates & failover config
// ---------------------------------------------------------------------------
const MODEL_CANDIDATES = [
  "moonshotai/kimi-vl-a3b-thinking:free",
  "openai/gpt-oss-20b:free",
  "deepseek/deepseek-chat-v3-0324:free",
  "meta-llama/llama-3.3-8b-instruct:free",
  "mistralai/mistral-small-3.2-24b-instruct:free",
  "mistralai/mistral-7b-instruct:free",
];

const PER_ATTEMPT_TIMEOUT_MS = 12000;
const GLOBAL_TIMEOUT_MS = 20000;

const badModelUntil = new Map();
const BAD_COOLDOWN_MS = 3 * 60 * 1000;
const LAST_GOOD_MODEL_KEY = "chatbot.lastGoodModelId";

function isRateLimit(status) {
  return status === 429;
}
function isRetryableStatus(status) {
  return status >= 500 || status === 404 || status === 422 || status === 429;
}
function shouldSkipForCooldown(modelId) {
  const until = badModelUntil.get(modelId);
  return until && Date.now() < until;
}
function markBad(modelId, ms = BAD_COOLDOWN_MS) {
  badModelUntil.set(modelId, Date.now() + ms);
}
function withGlobalTimeout(promise, ms) {
  let t;
  const timer = new Promise((_, rej) => {
    t = setTimeout(() => rej(new Error("Global timeout exceeded")), ms);
  });
  return Promise.race([promise, timer]).finally(() => clearTimeout(t));
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT_SG = `
You are LiveShield, a disaster-preparedness assistant for SINGAPORE.
Always prioritise Singapore-specific guidance, laws, and agencies.
If advice differs by country, give the SINGAPORE answer first.
`.trim();

// ---------------------------------------------------------------------------
// Call one model
// ---------------------------------------------------------------------------
async function callOpenRouterOnce({
  model,
  endpoint,
  apiKey,
  messages,
  perAttemptTimeout = PER_ATTEMPT_TIMEOUT_MS,
}) {
  const controller = new AbortController();
  const tId = setTimeout(() => controller.abort(), perAttemptTimeout);

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages,
      }),
      signal: controller.signal,
    });

    const bodyText = await res.text();

    if (!res.ok) {
      let serverMsg = "";
      try {
        const j = JSON.parse(bodyText);
        serverMsg = j?.error?.message || j?.message || j?.error || "";
      } catch {}
      const err = new Error(serverMsg || `HTTP ${res.status}`);
      err.httpStatus = res.status;
      throw err;
    }

    let data;
    try {
      data = JSON.parse(bodyText);
    } catch {
      const err = new Error("Bad JSON from server");
      err.httpStatus = 502;
      throw err;
    }

    const aiReply = data?.choices?.[0]?.message?.content?.trim();
    if (!aiReply) {
      const err = new Error("No choices in response");
      err.httpStatus = 502;
      throw err;
    }

    return { content: aiReply, modelUsed: model };
  } finally {
    clearTimeout(tId);
  }
}

// ---------------------------------------------------------------------------
// Failover
// ---------------------------------------------------------------------------
async function tryModelsWithFailover({ endpoint, apiKey, baseMessages }) {
  let lastGood = null;
  try {
    lastGood = await AsyncStorage.getItem(LAST_GOOD_MODEL_KEY);
  } catch {}

  const uniq = new Set();
  const ordered = [
    ...(lastGood ? [lastGood] : []),
    ...MODEL_CANDIDATES,
  ].filter((m) => {
    if (uniq.has(m)) return false;
    uniq.add(m);
    return !shouldSkipForCooldown(m);
  });

  const errors = [];

  for (const model of ordered) {
    try {
      const result = await callOpenRouterOnce({
        model,
        endpoint,
        apiKey,
        messages: baseMessages,
      });
      try {
        await AsyncStorage.setItem(LAST_GOOD_MODEL_KEY, model);
      } catch {}
      return result;
    } catch (e) {
      const status = e?.httpStatus;
      if (status === 401 || status === 403) {
        e.userMessage = "Authentication failed. Check your OpenRouter API key.";
        throw e;
      }
      if (!status || isRetryableStatus(status)) {
        markBad(model, isRateLimit(status) ? 60 * 1000 : BAD_COOLDOWN_MS);
        errors.push(`[${model}] ${status || "net"}: ${e.message}`);
        continue;
      }
      e.userMessage = `Request error (${status}).`;
      throw e;
    }
  }

  const summary = errors.join("\n");
  const err = new Error("All models are currently unavailable or failing.");
  err.userMessage = summary;
  throw err;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function ChatbotContainer({ navigation }) {
  const { lang } = useContext(LanguageContext);

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPresets, setShowPresets] = useState(true);
  const scrollViewRef = useRef();

  const presetRaw = t("chatbot.presetQuestions", { returnObjects: true });
  const presetQuestions = Array.isArray(presetRaw) ? presetRaw : [];

  const sendMessage = async (text) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    const userMessage = { role: "user", content };
    const updated = [...messages, userMessage];
    setMessages(updated);
    setInput("");
    setLoading(true);

    if (!OPENROUTER_ENDPOINT || !OPENROUTER_API_KEY) {
      setMessages([
        ...updated,
        {
          role: "assistant",
          content:
            "⚠️ Missing envs:\n- EXPO_PUBLIC_OPENROUTER_ENDPOINT\n- EXPO_PUBLIC_OPENROUTER_API_KEY",
        },
      ]);
      setLoading(false);
      return;
    }

    const baseMessages = [
      { role: "system", content: SYSTEM_PROMPT_SG },
      {
        role: "user",
        content: `User locale: Singapore. UI language: ${lang}. If safe, answer in this language.`,
      },
      ...updated,
    ];

    try {
      const { content: aiReply } = await withGlobalTimeout(
        tryModelsWithFailover({
          endpoint: OPENROUTER_ENDPOINT,
          apiKey: OPENROUTER_API_KEY,
          baseMessages,
        }),
        GLOBAL_TIMEOUT_MS
      );

      setMessages([...updated, { role: "assistant", content: aiReply }]);
    } catch (err) {
      let msg =
        err?.userMessage ||
        err?.message ||
        t("chatbot.rateLimited") ||
        "Rate limited. Try again in a moment.";
      setMessages([...updated, { role: "assistant", content: `❌ ${msg}` }]);
    } finally {
      setLoading(false);
    }
  };

  const vm = {
    t,
    lang,
    onBack: () => navigation?.goBack?.(),
    input,
    setInput,
    messages,
    loading,
    showPresets,
    setShowPresets,
    presetQuestions,
    scrollViewRef,
    sendMessage,
  };

  const ChatbotScreen = require("../screens/ChatbotScreen").default;
  return <ChatbotScreen vm={vm} />;
}
