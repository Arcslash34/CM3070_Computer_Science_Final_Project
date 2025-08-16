// drawerapp.js
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LanguageContext, LanguageProvider } from './language';
import translations from './translations';
import MainNavigator from './mainNavigator';
import QuizLevels from './quizzes';

export function LogoHeader() {
  return (
    <View style={styles.headerLeftLogoContainer}>
      <Image
        source={require('./assets/logo1.png')} 
        style={styles.headerLogo}
        resizeMode="contain"
      />
    </View>
  );
}

// SETTINGS SCREEN
export function SettingsScreen() {
  const { lang, setLang } = React.useContext(LanguageContext);
  const t = (key) => translations[lang][key] || key;

  return (
    <View style={styles.settingsContainer}>
      <Text style={styles.settingsTitle}>🌐 {t('language')}:</Text>
      <View style={styles.buttonGroup}>
        <TouchableOpacity style={styles.langButton} onPress={() => setLang('en')}>
          <Text style={styles.langButtonText}>ENGLISH</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.langButton} onPress={() => setLang('zh')}>
          <Text style={styles.langButtonText}>中文</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.settingsFooter}>⚙️ {t('emergencyInstructions')}</Text>
    </View>
  );
}

// QUIZZES SCREEN
function QuizzesScreen() {
  return <QuizLevels />;
}

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <LanguageProvider>
      <SafeAreaProvider>
        <NavigationContainer>
          <MainNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </LanguageProvider>
  );
}

const styles = StyleSheet.create({
  settingsContainer: {
    flex: 1,
    backgroundColor: '#f4f6f8',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  settingsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  buttonGroup: {
    width: '100%',
    marginBottom: 20,
  },
  langButton: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 10,
    marginVertical: 6,
    alignItems: 'center',
  },
  langButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  settingsFooter: {
    marginTop: 20,
    fontSize: 16,
    color: '#333',
  },
  headerLeftLogoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 15,
  },
  headerLogo: {
    width: 30,
    height: 30,
    marginLeft: 6,
  },
});
