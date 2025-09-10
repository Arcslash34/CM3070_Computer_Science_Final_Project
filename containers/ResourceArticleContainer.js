/**
 * containers/ResourceArticleContainer.js — Resource article viewer (container)
 *
 * Purpose
 * - Receive a pre-selected article via route params (from ResourceHub).
 * - Hide the native header for a cleaner, immersive reader.
 * - Provide i18n strings, safe-area insets, and a back handler to the screen.
 *
 * Key Behaviours
 * - No fetching here: article content is passed in through navigation params.
 * - Defensive defaults (empty object) to avoid crashes if params are missing.
 * - Simple container → screen split: constructs a lightweight VM.
 *
 * Exports
 * - Default React component <ResourceArticleContainer/> that renders
 *   <ResourceArticleScreen vm={...} />.
 */

import React, { useLayoutEffect } from "react";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { t } from "../translations/translation";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function ResourceArticleContainer() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const insets = useSafeAreaInsets();

  // Hide native header for this screen
  useLayoutEffect(() => {
    navigation.setOptions?.({ headerShown: false });
  }, [navigation]);

  // The article came from ResourceHub via params
  const article = params?.article ?? {};

  // -------------------------------------------------------------------------
  // View-model for the presentational screen
  // -------------------------------------------------------------------------
  const vm = {
    t,
    insets,
    article,
    onBack: () => navigation.goBack(),
  };

  const ResourceArticleScreen = require("../screens/ResourceArticleScreen").default;
  return <ResourceArticleScreen vm={vm} />;
}
