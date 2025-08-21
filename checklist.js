// checklist.js
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';   // 👈 import haptics
import congratsAnim from './assets/lottie/congrats.json';

const LottieWeb = Platform.OS === 'web' ? require('lottie-react').default : null;

const STORE_KEY = 'checklist:v1';

const DEFAULT_ITEMS = [
  { id: 'water',        title: 'Water',                      note: '3L per person per day (3 days)' },
  { id: 'food',         title: 'Non-perishable food',        note: 'Canned food, energy bars' },
  { id: 'aid',          title: 'First-aid kit + medicine',   note: 'Personal meds + bandages' },
  { id: 'flash',        title: 'Flashlight + batteries',     note: 'Extra batteries or rechargeable' },
  { id: 'power',        title: 'Power bank',                 note: 'Solar/hand-crank if possible' },
  { id: 'docs',         title: 'Important documents',        note: 'IDs, passport copies' },
  { id: 'cash',         title: 'Cash',                       note: 'Small bills' },
  { id: 'tool',         title: 'Multi-tool / Swiss knife' },
  { id: 'whistle',      title: 'Emergency whistle' },
  { id: 'radio',        title: 'Radio',                      note: 'Battery or hand-crank' },
  { id: 'clothes',      title: 'Clothes + sturdy shoes',     note: 'Raincoat if possible' },
  { id: 'blanket',      title: 'Blanket / sleeping bag' },
  { id: 'hygiene',      title: 'Hygiene items',              note: 'Masks, gloves, sanitizer, sanitary products' },
];

export default function Checklist() {
  const navigation = useNavigation();

  const [items, setItems] = useState(DEFAULT_ITEMS);
  const [checked, setChecked] = useState({});
  const [showCongrats, setShowCongrats] = useState(false);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const prevPercentRef = useRef(0);

  // Load from storage
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORE_KEY);
        if (raw) {
          const { checked: savedChecked = {}, items: savedItems = DEFAULT_ITEMS } = JSON.parse(raw);
          setItems(savedItems);
          setChecked(savedChecked);
        }
      } catch (err) {
        console.log('Failed to load checklist:', err);
      }
    })();
  }, []);

  // Save when changed
  useEffect(() => {
    AsyncStorage.setItem(STORE_KEY, JSON.stringify({ items, checked })).catch(() => {});
  }, [items, checked]);

  const total = items.length;
  const done = useMemo(() => Object.values(checked).filter(Boolean).length, [checked]);
  const percent = total ? Math.round((done / total) * 100) : 0;

  // Animate progress bar
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: percent,
      duration: 350,
      useNativeDriver: false,
    }).start();
  }, [percent, progressAnim]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  // Fire congrats animation when crossing to 100%
  useEffect(() => {
    if (prevPercentRef.current < 100 && percent === 100) {
      setShowCongrats(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); // 🎉 strong success haptic
    }
    prevPercentRef.current = percent;
  }, [percent]);

  const toggle = useCallback((id) => {
    Haptics.selectionAsync(); // 👈 light tap haptic
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const resetAll = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); // 👈 medium haptic
    setChecked({});
  }, []);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => { Haptics.selectionAsync(); navigation.goBack(); }}
          style={styles.headerBtn}
          accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Disaster Preparedness Checklist</Text>
        <TouchableOpacity
          onPress={resetAll}
          style={styles.headerBtn}
          accessibilityLabel="Reset">
          <Ionicons name="refresh" size={20} color="#6C63FF" />
        </TouchableOpacity>
      </View>

      {/* Progress */}
      <View style={styles.progressWrap}>
        <Text style={styles.progressText}>{percent}%</Text>
        <View style={styles.progressBar}>
          <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
        </View>
      </View>

      {/* List */}
      <ScrollView contentContainerStyle={styles.content}>
        {items.map((it) => {
          const isOn = !!checked[it.id];
          return (
            <Pressable
              key={it.id}
              style={({ pressed }) => [
                styles.row,
                pressed && { transform: [{ scale: 0.98 }], opacity: 0.95 },
              ]}
              onPress={() => toggle(it.id)}
              android_ripple={{ color: '#E5E7EB' }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isOn }}>
              <View style={[styles.check, isOn && styles.checkOn]}>
                <Ionicons
                  name={isOn ? 'checkmark' : 'ellipse-outline'}
                  size={18}
                  color={isOn ? '#fff' : '#9CA3AF'}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemTitle, isOn && styles.itemTitleOn]}>{it.title}</Text>
                {!!it.note && <Text style={styles.itemNote}>{it.note}</Text>}
              </View>
            </Pressable>
          );
        })}
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Congrats animation */}
      <Modal
        visible={showCongrats}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCongrats(false)}>
        <View style={styles.congratsBackdrop}>
          <View style={styles.congratsCard}>
            <Text style={styles.congratsTitle}>All set! 🎉</Text>
            <Text style={styles.congratsSub}>You’ve completed your emergency kit checklist.</Text>
            <View style={{ height: 160, width: 220, alignSelf: 'center' }}>
              {Platform.OS === 'web'
                ? (
                  <LottieWeb
                    animationData={congratsAnim}
                    autoplay
                    loop={false}
                    style={{ height: 160, width: 220 }}
                  />
                )
                : (
                  <LottieView
                    source={congratsAnim}
                    autoPlay
                    loop={false}
                    onAnimationFinish={() => setTimeout(() => setShowCongrats(false), 900)}
                    style={{ height: 160, width: 220 }}
                  />
                )}
            </View>
            <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setShowCongrats(false); }} style={styles.closeCongrats}>
              <Text style={styles.closeCongratsText}>Nice!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ---------------- styles ---------------- */
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'android' ? 6 : 0,
    paddingBottom: 10,
  },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '800',
    color: '#111827',
    fontSize: 16,
  },

  progressWrap: { paddingHorizontal: 16, marginBottom: 6 },
  progressText: { color: '#6B7280', fontWeight: '700', marginBottom: 6 },
  progressBar: {
    height: 10,
    backgroundColor: '#EEF2FF',
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6C63FF',
    borderRadius: 999,
  },

  content: { paddingHorizontal: 12, paddingTop: 8 },
  row: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 10,
  },
  check: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: '#10B981' },

  itemTitle: { color: '#111827', fontWeight: '700' },
  itemTitleOn: { color: '#047857', fontWeight: '700' },
  itemNote: { color: '#6B7280', marginTop: 2 },

  congratsBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  congratsCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    alignSelf: 'center',
  },
  congratsTitle: { textAlign: 'center', fontWeight: '800', fontSize: 18, color: '#111827' },
  congratsSub: { textAlign: 'center', color: '#374151', marginTop: 6, marginBottom: 8 },
  closeCongrats: {
    alignSelf: 'center',
    backgroundColor: '#6C63FF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 6,
  },
  closeCongratsText: { color: '#fff', fontWeight: '700' },
});
