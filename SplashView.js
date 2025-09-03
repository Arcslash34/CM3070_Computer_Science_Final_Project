// SplashView.js
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, StatusBar, TouchableWithoutFeedback } from 'react-native';
import { Audio } from 'expo-av';

export default function SplashView({ onDone }) {
  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const soundRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    // Animate logo
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 450, useNativeDriver: true }),
    ]).start();

    // Load and play sound
    const playSound = async () => {
      try {
        const { sound } = await Audio.Sound.createAsync(
          require('./assets/music/intro-logo.mp3'),
          { shouldPlay: true, volume: 1.0 }
        );
        if (mounted) {
          soundRef.current = sound;
          await sound.playAsync();
        }
      } catch (err) {
        console.warn('Splash sound error', err);
      }
    };
    playSound();

    // Timer for splash duration
    const timer = setTimeout(() => onDone?.(), 4000);

    return () => {
      mounted = false;
      clearTimeout(timer);
      if (soundRef.current) {
        soundRef.current.unloadAsync(); // cleanup
      }
    };
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
