// utils/quizLoader.js
import EN from "../assets/quiz.json";
import { i18n } from "../translations/translation";
// Add more locales as you translate them:
import ZH from "../translations/zh/quiz.json";
import TA from "../translations/ta/quiz.json";
import MS from "../translations/ms/quiz.json";

/**
 * Merge a partial locale file into the base quiz by id/index.
 * Any missing translations fall back to English automatically.
 */
function mergeQuiz(base, overrides) {
  if (!overrides || !overrides.categories) return base;

  const catMap = new Map(
    (overrides.categories || []).map((c) => [String(c.id), c])
  );

  const merged = {
    ...base,
    categories: (base.categories || []).map((cat) => {
      const oCat = catMap.get(String(cat.id));
      if (!oCat) return cat;

      // Merge category-level fields
      const mergedCat = {
        ...cat,
        title: oCat.title || cat.title,
      };

      // Map sets by id for easier lookup
      const setMap = new Map((oCat.sets || []).map((s) => [String(s.id), s]));
      mergedCat.sets = (cat.sets || []).map((set) => {
        const oSet = setMap.get(String(set.id));
        if (!oSet) return set;

        const mergedSet = {
          ...set,
          title: oSet.title || set.title,
        };

        // Merge questions by index
        mergedSet.questions = (set.questions || []).map((q, idx) => {
          const oQ = (oSet.questions || [])[idx];
          if (!oQ) return q;

          return {
            ...q,
            question: oQ.question || q.question,
            options: Array.isArray(oQ.options) && oQ.options.length === (q.options || []).length
              ? oQ.options
              : q.options,
            answer: oQ.answer || q.answer,
            explanation: oQ.explanation || q.explanation,
          };
        });

        return mergedSet;
      });

      return mergedCat;
    }),
  };

  return merged;
}

export function getQuiz() {
  const locale = String(i18n.locale || "en").toLowerCase();
  if (locale.startsWith("zh")) {
    return mergeQuiz(EN, ZH);
  }
  if (locale.startsWith("ta")) {
    return mergeQuiz(EN, TA);
  }
  if (locale.startsWith("ms") || locale.startsWith("id")) {
    return mergeQuiz(EN, MS);
  }
  return EN;
}
