// utils/historyHelpers.js
import { t, i18n } from "../translations/translation";

export const fmtDateOnly = (iso) => {
  try {
    return new Intl.DateTimeFormat(i18n.locale || undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
};

export const fmtTimeOnly = (iso) => {
  try {
    return new Intl.DateTimeFormat(i18n.locale || undefined, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
};

/** Localize title + preserve original set number from saved quiz_title */
export function getLocalizedTitle(item) {
  const topicId = item?.topic_id;
  const saved = String(item?.quiz_title || "");

  // Pull trailing set number from "Flood #1" / "Flood 1" / "Flood Set 1"
  const m = saved.match(/(?:#|\bset\s*)?(\d+)\b/i);
  const setNum = m ? m[1] : null;

  const base =
    topicId === "daily"
      ? t("quizzes.daily.title")
      : topicId
      ? t(`quizzes.categories.${topicId}.title`, { defaultValue: saved })
      : saved;

  return setNum ? `${base} #${setNum}` : base;
}
