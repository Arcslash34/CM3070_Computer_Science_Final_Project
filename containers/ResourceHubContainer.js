/**
 * containers/ResourceHubContainer.js — Browse & filter emergency guides
 *
 * Purpose
 * - Load localized “Resources” (guides) from i18n and present them as a browsable hub.
 * - Provide category chips (incl. a localized “All”), free-text search, and optional A→Z sorting.
 * - Derive a dynamic header summary (count + scope or count + “matching …” when searching).
 *
 * Key Behaviours
 * - Recomputes lists whenever the UI language changes (via LanguageContext).
 * - Category accent colour is inferred from a small id→domain map (for a subtle visual cue).
 * - Navigation:
 *   • Tapping a guide → ResourceArticle (article payload passed via params).
 * - Defensive defaults: empty arrays/objects to avoid crashes if translations are incomplete.
 *
 * Exports
 * - Default React component <ResourceHubContainer/> that renders <ResourceHubScreen vm={...} />.
 */

import React, { useContext, useLayoutEffect, useMemo, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LanguageContext } from "../translations/language";
import { t } from "../translations/translation";

// Accent map used only to compute the header accent color
const CATEGORY_BY_ID = {
  flooding: "Flooding",
  "fire-safety": "Fire",
  "mosquito-dengue": "Infectious",
  "cpr-aed-adult": "Cardiac",
  "choking-adult": "Airway",
  "severe-bleeding": "Trauma",
  burns: "Burns",
  "heat-stroke": "Environmental",
  "fracture-sprain": "Trauma",
};
const CAT_ACCENTS = {
  Cardiac: { text: "#B91C1C" },
  Airway: { text: "#1D4ED8" },
  Trauma: { text: "#047857" },
  Burns: { text: "#C2410C" },
  Environmental: { text: "#0C4A6E" },
  Fire: { text: "#C2410C" },
  Infectious: { text: "#7E22CE" },
  Flooding: { text: "#0E7490" },
  default: { text: "#4338CA" },
};

export default function ResourceHubContainer() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { lang } = useContext(LanguageContext);

  // Hide native header
  useLayoutEffect(() => {
    navigation.setOptions?.({ headerShown: false });
  }, [navigation]);

  // Build resources from i18n (recompute on language change)
  const RESOURCES = useMemo(() => {
    const dict = t("resources", { returnObjects: true }) || {};
    return Object.entries(dict).map(([id, v]) => ({ id, ...v }));
  }, [lang]);

  // Localized categories (include localized "All")
  const CATEGORIES = useMemo(() => {
    const all = t("resourceHub.all");
    const uniq = Array.from(new Set(RESOURCES.map((r) => r.category)));
    return [all, ...uniq];
  }, [RESOURCES, lang]);

  // UI state
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(t("resourceHub.all"));
  const [sortAlpha, setSortAlpha] = useState(false);

  // Filter + sort
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return RESOURCES.filter((r) => {
      const inCategory =
        category === t("resourceHub.all") || r.category === category;
      const inText =
        !q ||
        r.title?.toLowerCase?.().includes(q) ||
        (r.tags?.some?.((tag) => tag?.toLowerCase?.().includes(q)) ?? false);
      return inCategory && inText;
    });
  }, [query, category, RESOURCES, lang]);

  const items = useMemo(() => {
    const arr = [...filtered];
    if (sortAlpha) arr.sort((a, b) => a.title.localeCompare(b.title));
    return arr;
  }, [filtered, sortAlpha]);

  // Header copy + accent color
  const countLabel = `${filtered.length} ${
    filtered.length === 1 ? t("resourceHub.guide") : t("resourceHub.guides")
  }`;
  const scopeLabel =
    category === t("resourceHub.all") ? t("resourceHub.allTopics") : category;
  const headerText =
    query.trim().length > 0
      ? `${countLabel} • ${t("resourceHub.matching", { q: query.trim() })}`
      : `${countLabel} • ${scopeLabel}`;

  const headerAccent = useMemo(() => {
    if (category === t("resourceHub.all")) return "#6B7280";
    const match = RESOURCES.find((r) => r.category === category);
    const key = match ? CATEGORY_BY_ID[match.id] : "default";
    return (CAT_ACCENTS[key] || CAT_ACCENTS.default).text;
  }, [category, RESOURCES, lang]);

  // Nav
  const openArticle = (item) =>
    navigation.navigate("ResourceArticle", { article: item });

  // View model for the presentational screen
  const vm = {
    // layout/i18n
    insets,
    t,

    // lists + state
    RESOURCES,
    items,
    CATEGORIES,
    category,
    setCategory,
    query,
    setQuery,
    sortAlpha,
    setSortAlpha,
    headerText,
    headerAccent,

    // actions
    openArticle,
  };

  const ResourceHubScreen = require("../screens/ResourceHubScreen").default;
  return <ResourceHubScreen vm={vm} />;
}
