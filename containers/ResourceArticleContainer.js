// containers/ResourceArticleContainer.js
import React, { useLayoutEffect } from "react";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { t } from "../translations/translation";

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

  const vm = {
    t,
    insets,
    article,
    onBack: () => navigation.goBack(),
  };

  const ResourceArticleScreen = require("../screens/ResourceArticleScreen").default;
  return <ResourceArticleScreen vm={vm} />;
}
