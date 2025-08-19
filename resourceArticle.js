// resourceArticle.js
import React, { useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

export default function ResourceArticle() {
  const { params } = useRoute();
  const navigation = useNavigation();
  const article = params?.article;

  useLayoutEffect(() => {
    navigation.setOptions({ headerTitle: article?.title ?? 'Guide' });
  }, [article, navigation]);

  if (!article) {
    return (
      <View style={styles.center}>
        <Text style={{ color: '#6B7280' }}>No article data.</Text>
      </View>
    );
  }

  const callEmergency = async () => {
    // Singapore: 995. You can localize via device region later.
    const number = '995';
    const url = `tel:${number}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) Linking.openURL(url);
      else Alert.alert('Unable to place a call on this device.');
    } catch {
      Alert.alert('Unable to place a call on this device.');
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 28 }}>
      {/* Title area */}
      <View style={styles.headerCard}>
        <View style={styles.iconWrap}>
          <Ionicons
            name={article.icon || 'information-circle'}
            size={24}
            color="#4F46E5"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{article.title}</Text>
          <Text style={styles.category}>{article.category}</Text>
        </View>

        {/* Quick emergency call */}
        <TouchableOpacity onPress={callEmergency} style={styles.sos}>
          <Ionicons name="call" size={16} color="#FFFFFF" />
          <Text style={styles.sosText}>995</Text>
        </TouchableOpacity>
      </View>

      {/* Quick steps */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Steps</Text>
        {article.quick.map((q, i) => (
          <View key={i} style={styles.stepRow}>
            <View style={styles.bullet}>
              <Text style={styles.bulletText}>{i + 1}</Text>
            </View>
            <Text style={styles.stepText}>{q}</Text>
          </View>
        ))}
      </View>

      {/* Full guidance */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Detailed Guidance</Text>
        {article.body.map((p, i) => (
          <Text key={i} style={styles.paragraph}>
            {p}
          </Text>
        ))}
      </View>

      {/* External links */}
      {article.links?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>References</Text>
          {article.links.map((l, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => Linking.openURL(l.url)}
              style={styles.linkRow}>
              <Ionicons name="link" size={16} color="#6366F1" />
              <Text style={styles.linkText}>{l.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Disclaimer */}
      <Text style={styles.disclaimer}>
        This guide is for general first-aid education only and does not replace
        professional medical training or advice. In emergencies, call your local
        emergency number immediately.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', paddingHorizontal: 16 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  headerCard: {
    marginTop: 14,
    marginBottom: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '800', color: '#111827' },
  category: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  sos: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  sosText: { color: '#FFFFFF', fontWeight: '700' },
  section: { marginTop: 14 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  bullet: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulletText: { color: '#4F46E5', fontWeight: '700', fontSize: 12 },
  stepText: { flex: 1, color: '#111827' },
  paragraph: { color: '#111827', lineHeight: 20, marginBottom: 8 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  linkText: { color: '#6366F1', fontWeight: '600' },
  disclaimer: {
    color: '#6B7280',
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 18,
  },
});
