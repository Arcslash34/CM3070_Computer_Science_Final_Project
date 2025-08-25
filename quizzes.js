// Quizzes.js — Topic grid + Daily banner + "Past Results" link
import React, { useMemo, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList,
  TouchableOpacity, Image, ImageBackground
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

// --- Minimal topic meta (images must exist) ---
const TOPICS = [
  { id: 'flood', title: 'Flood Safety', img: require('./assets/flood_1.jpg') },
  { id: 'fire',  title: 'Fire Safety',  img: require('./assets/fire_1.jpg')  },
];

export default function QuizzesHome() {
  const navigation = useNavigation();

  const renderHeader = () => (
    <>
      {/* Daily Quiz Banner */}
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => navigation.navigate('QuizDifficulty', { topicId: 'daily', topicTitle: 'Daily Quiz', isDaily: true })}
      >
        <ImageBackground
          source={require('./assets/daily.jpg')}
          imageStyle={{ borderRadius: 16 }}
          style={styles.banner}
        >
          <View style={styles.bannerOverlay} />
          <View style={styles.bannerContent}>
            <Text style={styles.bannerTitle}>Daily Quiz</Text>
            <Text style={styles.bannerSub}>Everyday Learn &amp; Play</Text>
            <View style={styles.startBtn}>
              <Text style={styles.startBtnText}>Start Quiz</Text>
            </View>
          </View>
        </ImageBackground>
      </TouchableOpacity>

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Quiz Categories</Text>
      </View>

      {/* Past Results link (optional) */}
      <TouchableOpacity
        onPress={() => navigation.navigate('ResultScreen')}
        style={styles.resultsLink}
        activeOpacity={0.8}
      >
        <Ionicons name="book-outline" size={18} color="#4F46E5" style={{ marginRight: 6 }} />
        <Text style={styles.resultsLinkText}>View Past Results</Text>
      </TouchableOpacity>
    </>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F3F4F6' }}>
      <FlatList
        data={TOPICS}
        keyExtractor={(item) => item.id}
        numColumns={2}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.container}
        columnWrapperStyle={{ justifyContent: 'space-between' }}
        renderItem={({ item }) => (
          <View style={styles.cardWrap}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => navigation.navigate('QuizDifficulty', {
                topicId: item.id,
                topicTitle: item.title,
              })}
              style={styles.card}
            >
              <Image source={item.img} style={styles.cardImage} />
              <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#F3F4F6' },
  banner: { height: 140, borderRadius: 16, overflow: 'hidden', marginBottom: 14 },
  bannerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  bannerContent: { flex: 1, padding: 14, justifyContent: 'space-between' },
  bannerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  bannerSub: { color: '#E5E7EB', fontSize: 12 },
  startBtn: { alignSelf: 'flex-start', backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 10 },
  startBtnText: { color: '#1F2937', fontWeight: '700' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, paddingHorizontal: 2 },
  sectionTitle: { color: '#111827', fontSize: 20, fontWeight: '800' },
  resultsLink: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, marginLeft: 2 },
  resultsLinkText: { color: '#4F46E5', fontWeight: '700', fontSize: 14 },
  cardWrap: { width: '48%', marginBottom: 12 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#E5E7EB' },
  cardImage: { width: '100%', height: 90, resizeMode: 'cover' },
  cardTitle: { paddingHorizontal: 10, paddingVertical: 10, color: '#111827', fontWeight: '700' },
});
