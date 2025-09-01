// App.js
import 'react-native-gesture-handler';
import 'react-native-reanimated';
import React, { useState, useCallback, useEffect, useContext } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SplashView from './SplashView';
import AuthWrapper from './authWrapper';
import SirenScreen from './SirenScreen';
import EmergencyTapOverlay from './EmergencyTapOverlay';
import { navigationRef } from './navigationRef';
import { preloadSiren } from './sirenAudio';
import { init as initPrefs } from './appPrefs';
import { LanguageProvider, LanguageContext } from './translations/language';

const Stack = createNativeStackNavigator();

/** Inner navigator – can read LanguageContext */
function AppNav({ showSplash, onDone, onSiren }) {
  const { lang } = useContext(LanguageContext); // <- current language

  return (
    <NavigationContainer key={lang} ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main">
          {() =>
            showSplash ? (
              <SplashView onDone={onDone} />
            ) : (
              <AuthWrapper />
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
  );
}

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
    initPrefs();
  }, []);

  return (
    <LanguageProvider>
      <SafeAreaProvider initialWindowMetrics={initialWindowMetrics}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
          <EmergencyTapOverlay onTrigger={goSirenFromOverlay}>
            <AppNav showSplash={showSplash} onDone={handleDone} onSiren={goSirenFromOverlay} />
          </EmergencyTapOverlay>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </LanguageProvider>
  );
}
