// utils/resultLocalization.js
import { getQuiz } from "./quizLoader";
import { i18n, setLocale } from "../translations/translation";

/** Load EN quiz DB without changing visible UI locale */
export function getEnglishQuizDB() {
  const prev = i18n.locale;
  try {
    setLocale("en");
    return getQuiz();
  } finally {
    setLocale(prev);
  }
}

/** Build a map from EN question -> { enOptions, localQuestion, localOptions } */
export function buildQuestionMap() {
  const DB_LOCAL = getQuiz();
  const DB_EN = getEnglishQuizDB();

  const map = new Map();
  const catsLocal = DB_LOCAL?.categories || [];
  const catsEn = DB_EN?.categories || [];

  for (const catEn of catsEn) {
    const catLocal = catsLocal.find((c) => c.id === catEn.id);
    if (!catLocal) continue;

    const setsEn = catEn.sets || [];
    const setsLocal = catLocal.sets || [];

    setsEn.forEach((setEn, sIdx) => {
      const setLocal = setsLocal[sIdx];
      if (!setLocal) return;

      const qEnList = setEn.questions || [];
      const qLocalList = setLocal.questions || [];

      qEnList.forEach((qEn, qIdx) => {
        const qLocal = qLocalList[qIdx];
        if (!qEn || !qLocal) return;

        const enQuestion = String(qEn.question || "");
        const enOptions = Array.isArray(qEn.options) ? qEn.options : [];
        const localQuestion = String(qLocal.question || enQuestion);
        const localOptions = Array.isArray(qLocal.options) ? qLocal.options : enOptions;

        if (enQuestion) {
          map.set(enQuestion, { enOptions, localQuestion, localOptions });
        }
      });
    });
  }
  return map;
}

/** Re-localize a single review row (saved in EN) into current locale */
export function relocalizeReviewItem(item, enToLocalMap) {
  if (!item || !item.question) return item;

  const entry = enToLocalMap.get(String(item.question));
  if (!entry) return item;

  const { enOptions, localQuestion, localOptions } = entry;

  const findIndexIn = (val, list) =>
    list.findIndex((opt) => String(opt) === String(val));

  const correctIdx =
    item.correctAnswer != null ? findIndexIn(item.correctAnswer, enOptions) : -1;
  const selectedIdx =
    item.selectedAnswer != null ? findIndexIn(item.selectedAnswer, enOptions) : -1;

  const localizedCorrect =
    correctIdx >= 0 && localOptions[correctIdx] != null
      ? localOptions[correctIdx]
      : item.correctAnswer;

  const localizedSelected =
    selectedIdx >= 0 && localOptions[selectedIdx] != null
      ? localOptions[selectedIdx]
      : item.selectedAnswer;

  return {
    ...item,
    question: localQuestion,
    correctAnswer: localizedCorrect,
    selectedAnswer: localizedSelected,
  };
}
