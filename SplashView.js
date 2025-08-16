// SplashView.js
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, StatusBar, TouchableWithoutFeedback } from 'react-native';

export default function SplashView({ onDone }) {
  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 450, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => onDone?.(), 1800);
    return () => clearTimeout(timer);
  }, [onDone, scale, opacity]);

  return (
    <TouchableWithoutFeedback onPress={() => onDone?.()} accessibilityLabel="Skip splash">
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <Animated.Image
          source={require('./assets/logo.png')}
          style={[styles.logo, { opacity, transform: [{ scale }] }]}
          resizeMode="contain"
        />
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1B182B', justifyContent: 'center', alignItems: 'center' },
  logo: { width: 180, height: 180 },
});
