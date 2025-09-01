// translations/translation.js
import { I18n } from "i18n-js";
import * as Localization from "expo-localization";

import enSettings from "./en/settings.json";
import zhSettings from "./zh/settings.json";
import enChatbot from "./en/chatbot.json";
import zhChatbot from "./zh/chatbot.json";
import enCertificates from "./en/certificates.json";
import zhCertificates from "./zh/certificates.json";
import enResourceHub from "./en/resourceHub.json";
import zhResourceHub from "./zh/resourceHub.json";
import enResourceArticle from "./en/resourceArticle.json";
import zhResourceArticle from "./zh/resourceArticle.json";
import enResource from "./en/resource.json";
import zhResource from "./zh/resource.json";
import enBadges from "./en/badges.json";
import zhBadges from "./zh/badges.json";
import enQuizzes from "./en/quizzes.json";
import zhQuizzes from "./zh/quizzes.json";
import enQuizSet from "./en/quizSet.json";
import zhQuizSet from "./zh/quizSet.json";
import enQuizGame from "./en/quizGame.json";
import zhQuizGame from "./zh/quizGame.json";
import enHistory from "./en/history.json";
import zhHistory from "./zh/history.json";
import enCommon from "./en/common.json";
import zhCommon from "./zh/common.json";
import enResultSummary from "./en/resultSummary.json";
import zhResultSummary from "./zh/resultSummary.json";
import enChecklist from "./en/checklist.json";
import zhChecklist from "./zh/checklist.json";
import enChecklistData from "./en/checklistData.json";
import zhChecklistData from "./zh/checklistData.json";
import enMap from "./en/map.json";
import zhMap from "./zh/map.json";
import enHomeArticles from "./en/homeArticles.json";
import zhHomeArticles from "./zh/homeArticles.json";

function arrayToDict(arr) {
  if (!Array.isArray(arr)) return arr || {};
  const out = {};
  for (const it of arr) {
    if (it && it.id) out[it.id] = it;
  }
  return out;
}

const translations = {
  en: {
    common: enCommon,
    settings: enSettings,
    chatbot: enChatbot,
    certificates: enCertificates,
    resourceHub: enResourceHub,
    resourceArticle: enResourceArticle,
    resources: arrayToDict(enResource),
    badges: enBadges,
    quizzes: enQuizzes,
    quizSet: enQuizSet,
    quizGame: enQuizGame,
    history: enHistory,
    resultSummary: enResultSummary,
    checklist: enChecklist,
    checklistData: enChecklistData,
    map: enMap,
    homeArticles: enHomeArticles,
  },
  zh: {
    common: zhCommon,
    settings: zhSettings,
    chatbot: zhChatbot,
    certificates: zhCertificates,
    resourceHub: zhResourceHub,
    resourceArticle: zhResourceArticle,
    resources: arrayToDict(zhResource),
    badges: zhBadges,
    quizzes: zhQuizzes,
    quizSet: zhQuizSet,
    quizGame: zhQuizGame,
    history: zhHistory,
    resultSummary: zhResultSummary,
    checklist: zhChecklist,
    checklistData: zhChecklistData,
    map: zhMap,
    homeArticles: zhHomeArticles,
  },
};

export const i18n = new I18n(translations);

const deviceCode = (Localization.getLocales?.()[0]?.languageCode || "en").toLowerCase();

i18n.defaultLocale = "en";
i18n.locale = translations[deviceCode] ? deviceCode : "en";
i18n.enableFallback = true;

export const t = (key, params) => i18n.t(key, params);
export const setLocale = (locale) => {
  i18n.locale = translations[locale] ? locale : "en";
};

// helper to get the localized checklist DATA object
export const getChecklistData = () =>
  i18n.translations[i18n.locale]?.checklistData ||
  i18n.translations.en.checklistData;

export default i18n;
