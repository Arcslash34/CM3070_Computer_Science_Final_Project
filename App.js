// App.js
import "react-native-gesture-handler";
import "react-native-reanimated";
import React, { useState, useCallback, useEffect, useContext } from "react";
import { StatusBar } from "react-native";
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import SplashView from "./SplashView";
import AuthWrapper from "./authWrapper";
import SirenContainer from "./containers/SirenContainer";
import EmergencyTapOverlay from "./components/EmergencyTapOverlay";
import { navigationRef } from "./navigation/navigationRef";
import { preloadSiren } from "./utils/sirenAudio";
import { init as initPrefs } from "./utils/appPrefs";
import { LanguageProvider, LanguageContext } from "./translations/language";
import AsyncStorage from "@react-native-async-storage/async-storage";
import FirstTimeTutorial from "./components/FirstTimeTutorial";

const Stack = createNativeStackNavigator();

/** Inner navigator – can read LanguageContext */
function AppNav({ showSplash, onDone }) {
  const { lang } = useContext(LanguageContext);

  return (
    <NavigationContainer key={lang} ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main">
          {() =>
            showSplash ? <SplashView onDone={onDone} /> : <AuthWrapper />
          }
        </Stack.Screen>
        <Stack.Screen
          name="Siren"
          component={SirenContainer}
          options={{ presentation: "fullScreenModal", animation: "fade" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [showTutorial, setShowTutorial] = useState(false);

  // null = not loaded yet; boolean once loaded
  const [tutorialSeen, setTutorialSeen] = useState(null);

  // Prepare audio/prefs and load tutorial flag
  useEffect(() => {
    preloadSiren();
    initPrefs();

    (async () => {
      const seen = await AsyncStorage.getItem("hasSeenTutorial");
      setTutorialSeen(seen === "1" || seen === "true");
    })();
  }, []);

  // When splash is dismissed AND we know the flag, decide to show tutorial
  useEffect(() => {
    if (!showSplash && tutorialSeen === false) {
      setShowTutorial(true);
    }
  }, [showSplash, tutorialSeen]);

  // Dismiss splash; tutorial decision happens in the effect above
  const handleDone = useCallback(() => {
    setShowSplash(false);
  }, []);

  // Guard siren while tutorial is up
  const goSirenFromOverlay = useCallback(() => {
    if (showTutorial) return; // ignore real trigger during tutorial
    if (navigationRef.isReady()) {
      navigationRef.navigate("Siren", { primed: true });
    }
  }, [showTutorial]);

  // Avoid UI flicker until we know whether the tutorial was seen
  if (tutorialSeen === null) return null;

  return (
    <LanguageProvider>
      <SafeAreaProvider initialWindowMetrics={initialWindowMetrics}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <StatusBar
            translucent
            backgroundColor="transparent"
            barStyle="dark-content"
          />

          <EmergencyTapOverlay onTrigger={goSirenFromOverlay}>
            <AppNav showSplash={showSplash} onDone={handleDone} />
          </EmergencyTapOverlay>

          <FirstTimeTutorial
            visible={showTutorial}
            onComplete={() => setShowTutorial(false)}
          />
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </LanguageProvider>
  );
}
