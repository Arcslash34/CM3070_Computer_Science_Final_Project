/**
 * navigation/drawerapp.js — Drawer shell & shared header logo
 *
 * Purpose
 * - Provide the app’s top-level navigator entry (<DrawerApp/>) which renders
 *   the main navigation tree.
 * - Expose a small reusable <LogoHeader/> component for use in a navigation
 *   header’s `headerLeft` (e.g. `headerLeft: () => <LogoHeader />`).
 *
 * Key Behaviours
 * - Stateless; purely presentational.
 * - Uses a 30×30 logo image with `contain` resize to fit various headers.
 *
 * Inputs / Props
 * - None (both components are self-contained and do not accept props).
 *
 * Exports
 * - Named: LogoHeader
 * - Default: DrawerApp
 */

import React from "react";
import { View, Image, StyleSheet } from "react-native";
import MainNavigator from "./mainNavigator";

export function LogoHeader() {
  return (
    <View style={styles.headerLeftLogoContainer}>
      <Image
        source={require("../assets/logo1.png")}
        style={styles.headerLogo}
        resizeMode="contain"
      />
    </View>
  );
}

export default function DrawerApp() {
  return <MainNavigator />;
}

const styles = StyleSheet.create({
  headerLeftLogoContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 15,
  },
  headerLogo: {
    width: 30,
    height: 30,
    marginLeft: 6,
  },
});
