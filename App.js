// App.js
import 'react-native-gesture-handler';
import 'react-native-reanimated';
import React, { useState, useCallback, useEffect } from 'react';
import { StatusBar, Button } from 'react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LanguageProvider } from './language';
import SplashView from './SplashView';
import AuthWrapper from './authWrapper';
import SirenScreen from './SirenScreen';
import EmergencyTapOverlay from './EmergencyTapOverlay';
import { navigationRef } from './navigationRef';
import { preloadSiren } from './sirenAudio';
import { init as initPrefs } from './appPrefs';
const Stack = createNativeStackNavigator();
export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const handleDone = useCallback(() => setShowSplash(false), []);
  const goSirenFromOverlay = useCallback(() => {
    if (navigationRef.isReady()) {
      navigationRef.navigate('Siren', { primed: true });
    }
  }, []);
  useEffect(() => {
    preloadSiren();
    initPrefs(); // load toggles + configure notif handler/channel
  }, []);
  return (
    <LanguageProvider>
      <SafeAreaProvider initialWindowMetrics={initialWindowMetrics}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
          {/* Wrap the whole app so typing is not blocked */}
          <EmergencyTapOverlay onTrigger={goSirenFromOverlay}>
            <NavigationContainer ref={navigationRef}>
              <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name="Main">
                  {() =>
                    showSplash ? (
                      <SplashView onDone={handleDone} />
                    ) : (
                      <>
                        <AuthWrapper />
                      </>
                    )
                  }
                </Stack.Screen>
                <Stack.Screen
                  name="Siren"
                  component={SirenScreen}
                  options={{ presentation: 'fullScreenModal', animation: 'fade' }}
                />
              </Stack.Navigator>
            </NavigationContainer>
          </EmergencyTapOverlay>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </LanguageProvider>
  );
}