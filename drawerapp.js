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
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LanguageContext, LanguageProvider } from './language';
import MainNavigator from './mainNavigator';

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
