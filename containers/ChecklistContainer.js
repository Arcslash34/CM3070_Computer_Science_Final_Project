// containers/ChecklistContainer.js
import React, { useEffect, useMemo, useRef, useState, useCallback, useContext } from "react";
import { Animated, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";

import { LanguageContext } from "../translations/language";
import { t, setLocale, getChecklistData } from "../translations/translation";
import { selection, impact, success } from "../utils/appPrefs";

const STORE_KEY = "checklist:v1";
const animDur = 350;

export default function ChecklistContainer() {
  const navigation = useNavigation();
  const { lang } = useContext(LanguageContext);

  // keep i18n locale in sync with LanguageContext
  useEffect(() => { setLocale(lang); }, [lang]);

  // localized dataset
  const DATA = useMemo(() => getChecklistData(), [lang]);
  const categories = useMemo(() => DATA?.categories ?? [], [DATA]);

  const [selectedCatId, setSelectedCatId] = useState(categories[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [checked, setChecked] = useState({});
  const [showCongrats, setShowCongrats] = useState(false);

  // ensure selectedCatId stays valid after dataset switches
  useEffect(() => {
    if (!categories.length) return;
    const exists = categories.some((c) => c.id === selectedCatId);
    if (!exists) setSelectedCatId(categories[0].id);
  }, [categories, selectedCatId]);

  // load/save
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          setChecked(parsed?.checked || {});
        }
      } catch {}
    })();
  }, []);
  useEffect(() => {
    AsyncStorage.setItem(STORE_KEY, JSON.stringify({ checked })).catch(() => {});
  }, [checked]);

  // flatten + progress
  const allItemsFlat = useMemo(() => {
    return categories.flatMap((cat) =>
      (cat.subcategories || []).flatMap((sub) => sub.items || [])
    );
  }, [categories]);

  const overallTotal = allItemsFlat.length;
  const overallDone = useMemo(
    () => allItemsFlat.filter((it) => !!checked[it.id]).length,
    [allItemsFlat, checked]
  );
  const overallPercent = overallTotal ? Math.round((overallDone / overallTotal) * 100) : 0;

  const currentCategory = useMemo(
    () => categories.find((c) => c.id === selectedCatId) || null,
    [categories, selectedCatId]
  );
  const currentItemsFlat = useMemo(() => {
    if (!currentCategory) return [];
    return (currentCategory.subcategories || []).flatMap((s) => s.items || []);
  }, [currentCategory]);

  const catTotal = currentItemsFlat.length;
  const catDone = useMemo(
    () => currentItemsFlat.filter((it) => !!checked[it.id]).length,
    [currentItemsFlat, checked]
  );
  const catPercent = catTotal ? Math.round((catDone / catTotal) * 100) : 0;

  // animations (container computes; screen just renders)
  const overallAnim = useRef(new Animated.Value(0)).current;
  const categoryAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(overallAnim, { toValue: overallPercent, duration: animDur, useNativeDriver: false }).start();
  }, [overallPercent]);
  useEffect(() => {
    Animated.timing(categoryAnim, { toValue: catPercent, duration: animDur, useNativeDriver: false }).start();
  }, [catPercent]);

  const overallWidth = overallAnim.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] });
  const categoryWidth = categoryAnim.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] });

  // congrats trigger
  const prevCatRef = useRef(0);
  useEffect(() => {
    if (prevCatRef.current < 100 && catPercent === 100 && catTotal > 0) {
      setShowCongrats(true);
      success();
    }
    prevCatRef.current = catPercent;
  }, [catPercent, catTotal]);

  // handlers
  const toggle = useCallback((id) => {
    selection();
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const resetCurrentCategory = useCallback(() => {
    if (!currentCategory) return;
    impact();
    setChecked((prev) => {
      const next = { ...prev };
      for (const sub of currentCategory.subcategories || []) {
        for (const it of (sub.items || [])) {
          if (next[it.id]) delete next[it.id];
        }
      }
      return next;
    });
  }, [currentCategory]);

  const matchesQuery = useCallback((it) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const label = (it.label || it.title || "").toLowerCase();
    const desc = (it.desc || "").toLowerCase();
    return label.includes(q) || desc.includes(q);
  }, [query]);

  const subProgress = useCallback((sub) => {
    const items = sub?.items || [];
    const t = items.length;
    const d = items.filter((it) => !!checked[it.id]).length;
    const p = t ? Math.round((d / t) * 100) : 0;
    return { d, t, p };
  }, [checked]);

  const catHasMatches = useMemo(() => {
    if (!currentCategory) return false;
    if (!query.trim()) return true;
    for (const sub of currentCategory.subcategories || []) {
      if ((sub.items || []).some(matchesQuery)) return true;
    }
    return false;
  }, [currentCategory, matchesQuery, query]);

  // VM to screen
  const vm = {
    // strings
    t,

    // nav
    onBack: () => navigation.goBack(),

    // dataset + state
    categories,
    selectedCatId, setSelectedCatId,
    query, setQuery,
    checked, toggle,
    resetCurrentCategory,

    // progress
    overallPercent, catPercent,
    catDone, catTotal,
    overallWidth, categoryWidth,

    // filtering helpers
    currentCategory, matchesQuery, subProgress, catHasMatches,

    // modal
    showCongrats, setShowCongrats,

    // platform (for Lottie choice)
    platform: Platform.OS,
  };

  const ChecklistScreen = require("../screens/ChecklistScreen").default;
  return <ChecklistScreen vm={vm} />;
}
