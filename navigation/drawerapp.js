// navigation/drawerapp.js
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
