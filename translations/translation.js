// translations/translation.js
import { I18n } from "i18n-js";
import * as Localization from "expo-localization";

import enSettings from "./en/settings.json";
import zhSettings from "./zh/settings.json";
import msSettings from "./ms/settings.json";
import taSettings from "./ta/settings.json";
import enChatbot from "./en/chatbot.json";
import zhChatbot from "./zh/chatbot.json";
import msChatbot from "./ms/chatbot.json";
import taChatbot from "./ta/chatbot.json";
import enCertificates from "./en/certificates.json";
import zhCertificates from "./zh/certificates.json";
import msCertificates from "./ms/certificates.json";
import taCertificates from "./ta/certificates.json";
import enResourceHub from "./en/resourceHub.json";
import zhResourceHub from "./zh/resourceHub.json";
import msResourceHub from "./ms/resourceHub.json";
import taResourceHub from "./ta/resourceHub.json";
import enResourceArticle from "./en/resourceArticle.json";
import zhResourceArticle from "./zh/resourceArticle.json";
import msResourceArticle from "./ms/resourceArticle.json";
import taResourceArticle from "./ta/resourceArticle.json";
import enResource from "./en/resource.json";
import zhResource from "./zh/resource.json";
import msResource from "./ms/resource.json";
import taResource from "./ta/resource.json";
import enBadges from "./en/badges.json";
import zhBadges from "./zh/badges.json";
import msBadges from "./ms/badges.json";
import taBadges from "./ta/badges.json";
import enQuizzes from "./en/quizzes.json";
import zhQuizzes from "./zh/quizzes.json";
import msQuizzes from "./ms/quizzes.json";
import taQuizzes from "./ta/quizzes.json";
import enQuizSet from "./en/quizSet.json";
import zhQuizSet from "./zh/quizSet.json";
import msQuizSet from "./ms/quizSet.json";
import taQuizSet from "./ta/quizSet.json";
import enQuizGame from "./en/quizGame.json";
import zhQuizGame from "./zh/quizGame.json";
import msQuizGame from "./ms/quizGame.json";
import taQuizGame from "./ta/quizGame.json";
import enHistory from "./en/history.json";
import zhHistory from "./zh/history.json";
import msHistory from "./ms/history.json";
import taHistory from "./ta/history.json";
import enCommon from "./en/common.json";
import zhCommon from "./zh/common.json";
import msCommon from "./ms/common.json";
import taCommon from "./ta/common.json";
import enResultSummary from "./en/resultSummary.json";
import zhResultSummary from "./zh/resultSummary.json";
import msResultSummary from "./ms/resultSummary.json";
import taResultSummary from "./ta/resultSummary.json";
import enChecklist from "./en/checklist.json";
import zhChecklist from "./zh/checklist.json";
import msChecklist from "./ms/checklist.json";
import taChecklist from "./ta/checklist.json";
import enChecklistData from "./en/checklistData.json";
import zhChecklistData from "./zh/checklistData.json";
import msChecklistData from "./ms/checklistData.json";
import taChecklistData from "./ta/checklistData.json";
import enMap from "./en/map.json";
import zhMap from "./zh/map.json";
import msMap from "./ms/map.json";
import taMap from "./ta/map.json";
import enHomeArticles from "./en/homeArticles.json";
import zhHomeArticles from "./zh/homeArticles.json";
import msHomeArticles from "./ms/homeArticles.json";
import taHomeArticles from "./ta/homeArticles.json";

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
    ...enCommon,
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
    ...zhCommon,
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
  ms: {
    ...msCommon,
    settings: msSettings,
    chatbot: msChatbot,
    certificates: msCertificates,
    resourceHub: msResourceHub,
    resourceArticle: msResourceArticle,
    resources: arrayToDict(msResource),
    badges: msBadges,
    quizzes: msQuizzes,
    quizSet: msQuizSet,
    quizGame: msQuizGame,
    history: msHistory,
    resultSummary: msResultSummary,
    checklist: msChecklist,
    checklistData: msChecklistData,
    map: msMap,
    homeArticles: msHomeArticles,
  },
  ta: {
    ...taCommon,
    settings: taSettings,
    chatbot: taChatbot,
    certificates: taCertificates,
    resourceHub: taResourceHub,
    resourceArticle: taResourceArticle,
    resources: arrayToDict(taResource),
    badges: taBadges,
    quizzes: taQuizzes,
    quizSet: taQuizSet,
    quizGame: taQuizGame,
    history: taHistory,
    resultSummary: taResultSummary,
    checklist: taChecklist,
    checklistData: taChecklistData,
    map: taMap,
    homeArticles: taHomeArticles,
  },
};

export const i18n = new I18n(translations);

const deviceCode = (Localization.getLocales?.()[0]?.languageCode || "en").toLowerCase();

i18n.defaultLocale = "en";
i18n.locale = translations[deviceCode] ? deviceCode : "en";
i18n.fallbacks = true;
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
