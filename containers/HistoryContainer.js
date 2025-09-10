/**
 * containers/HistoryContainer.js — Quiz history view-model
 *
 * Purpose
 * - Fetch and display the current user's quiz attempt history from Supabase.
 * - Provide filtering by localized quiz title and navigate to per-quiz summaries.
 * - Allow user to delete all history with a confirmation prompt.
 *
 * Key Behaviours
 * - Loads on screen focus via useFocusEffect; latest-first ordering.
 * - i18n-aware filtering using getLocalizedTitle() against the current locale.
 * - Delete-all action scoped to the authenticated user.
 *
 * Exports
 * - Default React component <HistoryContainer/> which renders <HistoryScreen vm={...}/> .
 */

import React, { useCallback, useMemo, useState } from "react";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Alert } from "react-native";
import { supabase } from "../supabase";
import { t, i18n } from "../translations/translation";
import {
  getLocalizedTitle,
  fmtDateOnly,
  fmtTimeOnly,
} from "../utils/historyHelpers";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function HistoryContainer() {
  const navigation = useNavigation();
  const [results, setResults] = useState([]);
  const [query, setQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  // Load user's quiz results (latest first)
  const loadResults = useCallback(async () => {
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;
    if (!userId) return;
    const { data, error } = await supabase
      .from("quiz_results")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (!error) setResults(data || []);
    else console.error("Failed to fetch quiz results:", error?.message);
  }, []);

  // Refresh on focus
  useFocusEffect(
    useCallback(() => {
      loadResults();
    }, [loadResults])
  );

  // Delete all results (scoped to current user)
  const handleDeleteAll = useCallback(() => {
    Alert.alert(
      t("history.history.confirm"),
      t("history.history.deleteAllMsg"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            const { data: session } = await supabase.auth.getSession();
            const userId = session?.session?.user?.id;
            if (!userId) return;
            await supabase.from("quiz_results").delete().eq("user_id", userId);
            loadResults();
          },
        },
      ]
    );
  }, [loadResults]);

  // i18n-aware filter
  const filtered = useMemo(() => {
    if (!query.trim()) return results;
    const q = query.trim().toLowerCase();
    return results.filter((r) =>
      String(getLocalizedTitle(r) || "")
        .toLowerCase()
        .includes(q)
    );
  }, [results, query, i18n.locale]);

  // Navigate to summary
  const openSummary = (quiz) => {
    const localized = getLocalizedTitle(quiz);
    navigation.navigate("ResultSummary", {
      reviewData: quiz.review_data || quiz.answers,
      quizTitle: localized,
      scorePercent: quiz.score != null ? quiz.score : 0,
      xp: quiz.xp ?? 0,
      userAnswers: quiz.answers,
      score: quiz.score,
    });
  };

  // -------------------------------------------------------------------------
  // View-model
  // -------------------------------------------------------------------------
  const vm = {
    // strings + helpers
    t,
    i18n,
    getLocalizedTitle,
    fmtDateOnly,
    fmtTimeOnly,

    // state
    results,
    filtered,
    query,
    setQuery,
    showSearch,
    setShowSearch,

    // actions
    handleDeleteAll,
    openSummary,
  };

  const HistoryScreen = require("../screens/HistoryScreen").default;
  return <HistoryScreen vm={vm} />;
}
