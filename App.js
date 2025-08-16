// App.js
import React, { useState, useCallback } from 'react';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { StatusBar } from 'react-native';
import { LanguageProvider } from './language';
import AuthWrapper from './authWrapper';
import SplashView from './SplashView';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const handleDone = useCallback(() => setShowSplash(false), []);

  return (
    <LanguageProvider>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        {/* Android: keep the status bar translucent so the modal lays out correctly */}
        <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
        {showSplash ? <SplashView onDone={handleDone} /> : <AuthWrapper />}
      </SafeAreaProvider>
    </LanguageProvider>
  );
}
