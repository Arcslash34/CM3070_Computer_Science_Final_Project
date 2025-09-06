// utils/badgeCatalog.js
// Localized, icon-only catalog. Titles & groups come from i18n (t).
import { t } from "../translations/translation";

export function BADGE_CATALOG() {
  return [
    // Learning Achievements
    {
      id: "first-step",
      title: t("badges.catalog.first-step.title"),
      group: t("badges.groups.learning"),
      icon: require("../assets/badges/badge.png"),
    },
    {
      id: "quiz-explorer",
      title: t("badges.catalog.quiz-explorer.title"),
      group: t("badges.groups.learning"),
      icon: require("../assets/badges/badge1.png"),
    },
    {
      id: "quiz-expert",
      title: t("badges.catalog.quiz-expert.title"),
      group: t("badges.groups.learning"),
      icon: require("../assets/badges/badge2.png"),
    },
    {
      id: "quiz-scholar",
      title: t("badges.catalog.quiz-scholar.title"),
      group: t("badges.groups.learning"),
      icon: require("../assets/badges/badge3.png"),
    },

    // Disaster Specialist
    {
      id: "earthquake-expert",
      title: t("badges.catalog.earthquake-expert.title"),
      group: t("badges.groups.specialist"),
      icon: require("../assets/badges/badge4.png"),
    },
    {
      id: "fire-expert",
      title: t("badges.catalog.fire-expert.title"),
      group: t("badges.groups.specialist"),
      icon: require("../assets/badges/badge5.png"),
    },
    {
      id: "flood-expert",
      title: t("badges.catalog.flood-expert.title"),
      group: t("badges.groups.specialist"),
      icon: require("../assets/badges/badge6.png"),
    },
    {
      id: "firstaid-expert",
      title: t("badges.catalog.firstaid-expert.title"),
      group: t("badges.groups.specialist"),
      icon: require("../assets/badges/badge7.png"),
    },

    // Streaks
    {
      id: "streak-1",
      title: t("badges.catalog.streak-1.title"),
      group: t("badges.groups.streaks"),
      icon: require("../assets/badges/badge8.png"),
    },
    {
      id: "streak-3",
      title: t("badges.catalog.streak-3.title"),
      group: t("badges.groups.streaks"),
      icon: require("../assets/badges/badge9.png"),
    },
    {
      id: "streak-5",
      title: t("badges.catalog.streak-5.title"),
      group: t("badges.groups.streaks"),
      icon: require("../assets/badges/badge10.png"),
    },
    {
      id: "streak-7",
      title: t("badges.catalog.streak-7.title"),
      group: t("badges.groups.streaks"),
      icon: require("../assets/badges/badge11.png"),
    },
    {
      id: "streak-14",
      title: t("badges.catalog.streak-14.title"),
      group: t("badges.groups.streaks"),
      icon: require("../assets/badges/badge12.png"),
    },
    {
      id: "streak-21",
      title: t("badges.catalog.streak-21.title"),
      group: t("badges.groups.streaks"),
      icon: require("../assets/badges/badge13.png"),
    },
  ];
}
