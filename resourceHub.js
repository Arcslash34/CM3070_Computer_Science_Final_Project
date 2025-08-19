// resourceHub.js
import React, { useMemo, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView,
  TouchableOpacity, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

// In a real app you can move this to a data file or Supabase.
const RESOURCES = [
  {
    id: 'cpr-adult',
    title: 'CPR (Adult)',
    category: 'Cardiac',
    icon: 'heart',
    quick: ['Check responsiveness & breathing', 'Call emergency (995 in SG)', '30 compressions + 2 breaths', 'Rate ~100–120/min, depth ~5–6 cm'],
    body: [
      'Ensure scene safety. Check responsiveness and normal breathing for ≤10 seconds.',
      'Call 995 (SG) / local emergency number. If AED is available, send someone to get it.',
      'Start chest compressions: center of chest, 100–120/min, depth ~5–6 cm, allow full recoil.',
      'Open airway, give 2 rescue breaths (1 sec each) if trained. Minimize interruptions.',
      'Attach AED as soon as it arrives and follow prompts. Continue CPR until help takes over.'
    ],
    links: [
      { label: 'Singapore Red Cross: CPR-AED', url: 'https://redcross.sg/' }
    ],
    tags: ['CPR', 'Cardiac', 'AED']
  },
  {
    id: 'choking-adult',
    title: 'Choking (Adult)',
    category: 'Airway',
    icon: 'warning',
    quick: ['Ask "Are you choking?"', '5 back blows', '5 abdominal thrusts (Heimlich)', 'Repeat 5+5 until relieved'],
    body: [
      'If the person can cough/speak, encourage coughing. If severe (no sound/air): act.',
      'Stand behind, deliver up to 5 firm back blows between shoulder blades.',
      'Then 5 abdominal thrusts (above navel, inward & upward).',
      'Alternate 5 back blows with 5 thrusts until object expelled or unresponsive.',
      'If unresponsive: call emergency and start CPR. Check mouth for object each cycle.'
    ],
    links: [{ label: 'Airway choking guide', url: 'https://www.healthhub.sg/' }],
    tags: ['Choking', 'Airway']
  },
  {
    id: 'severe-bleeding',
    title: 'Severe Bleeding',
    category: 'Trauma',
    icon: 'bandage',
    quick: ['Call emergency', 'Direct pressure', 'Dressings & bandage', 'Tourniquet (if trained/needed)'],
    body: [
      'Wear gloves if available. Expose wound, apply firm direct pressure with clean cloth.',
      'Maintain continuous pressure 10+ minutes. Add more dressings—do not remove soaked ones.',
      'If life-threatening limb bleed persists and trained, apply tourniquet 5–7 cm above wound.',
      'Treat for shock: lay person flat, keep warm, no food/drink. Monitor until help arrives.'
    ],
    links: [{ label: 'Bleeding control basics', url: 'https://www.stopthebleed.org/' }],
    tags: ['Bleeding', 'Tourniquet', 'Trauma']
  },
  {
    id: 'burns',
    title: 'Burns (Thermal)',
    category: 'Burns',
    icon: 'flame',
    quick: ['Cool 20 min with water', 'Remove tight items', 'Cover with clean non-stick', 'Do not pop blisters'],
    body: [
      'Immediately cool burn with cool running water for 20 minutes. Do not use ice.',
      'Remove jewelry and tight items before swelling.',
      'Cover with sterile non-stick dressing/clean cloth. Do not apply creams/grease.',
      'Seek medical care for large, deep, facial, hands, feet, genitals, or chemical/electrical burns.'
    ],
    links: [{ label: 'Burn first aid (HealthHub)', url: 'https://www.healthhub.sg/' }],
    tags: ['Burns']
  },
  {
    id: 'heat-stroke',
    title: 'Heat Stroke',
    category: 'Environmental',
    icon: 'sunny',
    quick: ['Call emergency', 'Move to shade', 'Aggressive cooling', 'Loosen clothing'],
    body: [
      'Signs: hot skin, confusion, collapse, possible unconsciousness. This is life-threatening.',
      'Call emergency. Move to a cool/shaded place, remove excess clothing.',
      'Cool rapidly: cold packs at neck/armpits/groin, wet skin + fan, or cold water immersion if feasible.',
      'If conscious: small sips of cool water. Monitor airway/breathing.'
    ],
    links: [{ label: 'NEA heat guides', url: 'https://www.nea.gov.sg/' }],
    tags: ['Heat', 'Environment']
  },
  {
    id: 'fracture-sprain',
    title: 'Fracture & Sprain',
    category: 'Trauma',
    icon: 'fitness',
    quick: ['Rest & immobilize', 'Ice 15–20 min', 'Compression', 'Elevate'],
    body: [
      'If severe deformity/bleeding: call emergency. Otherwise RICE: Rest, Ice, Compression, Elevation.',
      'Immobilize joint above & below. Do not straighten a deformed limb.',
      'Ice wrapped in cloth 15–20 min on/20–30 off.',
      'Seek medical assessment for significant pain, swelling, or loss of function.'
    ],
    links: [{ label: 'MSK injuries basics', url: 'https://www.healthhub.sg/' }],
    tags: ['Fracture', 'Sprain', 'RICE']
  },
];

const CATEGORIES = ['All', ...Array.from(new Set(RESOURCES.map(r => r.category)))];

// hard locks
const CHIP_WIDTH  = 112;
const CHIP_HEIGHT = 30;
const CHIP_ROW_VPAD = 6;               // top/bottom padding for the row
const CHIP_ROW_HEIGHT = CHIP_HEIGHT + CHIP_ROW_VPAD * 2; // fixed row height
const MAX_QUICK = 3;

export default function ResourceHub() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const navigation = useNavigation();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return RESOURCES.filter(r => {
      const inCategory = category === 'All' || r.category === category;
      const inText = !q || r.title.toLowerCase().includes(q) || r.tags.some(t => t.toLowerCase().includes(q));
      return inCategory && inText;
    });
  }, [query, category]);

  const openArticle = (item) => navigation.navigate('ResourceArticle', { article: item });

  return (
    <SafeAreaView style={styles.container}>
      {/* Search */}
      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color="#6B7280" />
        <TextInput
          placeholder="Search first-aid topics (e.g., CPR, burns)…"
          placeholderTextColor="#9CA3AF"
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Chips (fixed height container prevents vertical jump) */}
      <View style={styles.chipsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {CATEGORIES.map((c) => {
            const active = c === category;
            return (
              <TouchableOpacity
                key={c}
                onPress={() => setCategory(c)}
                style={[styles.chip, active && styles.chipActive]}
                activeOpacity={0.8}
              >
                <Text
                  style={[styles.chipText, active && styles.chipTextActive]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {c}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* List */}
      <ScrollView contentContainerStyle={styles.list}>
        {filtered.map(item => (
          <TouchableOpacity
            key={item.id}
            style={styles.card}
            onPress={() => openArticle(item)}
            activeOpacity={0.8}
          >
            <View style={styles.cardIcon}>
              <Ionicons name={item.icon} size={22} color="#4F46E5" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardCategory}>{item.category}</Text>
              <View style={styles.quickRow}>
                {item.quick.slice(0, MAX_QUICK).map((q, i) => (
                  <View key={i} style={styles.quickPill}>
                    <Text style={styles.quickText}>{q}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.readMoreRow}>
                <Text style={styles.readMoreText}>Read more</Text>
                <Ionicons name="chevron-forward" size={16} color="#6366F1" />
              </View>
            </View>
          </TouchableOpacity>
        ))}

        {filtered.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="information-circle" size={20} color="#9CA3AF" />
            <Text style={styles.emptyText}>No results. Try a different term.</Text>
          </View>
        )}
      </ScrollView>

      {/* Disclaimer */}
      <View style={styles.footer}>
        <Text style={styles.disclaimer}>
          This hub provides general first-aid guidance and is not a substitute for professional medical advice.
          In emergencies call your local number (e.g., 995 in Singapore).
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, backgroundColor: '#FFFFFF' },

  searchRow: {
    marginTop: 8,
    marginBottom: 4,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: Platform.select({ ios: 12, android: 8 }),
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: { flex: 1, color: '#111827' },

  // CHIPS
  chipsContainer: {
    height: CHIP_ROW_HEIGHT,          // 🔒 locks vertical position
    justifyContent: 'center',
  },
  chipsRow: {
    paddingVertical: CHIP_ROW_VPAD,
    alignItems: 'center',
    paddingRight: 4,
  },
  chip: {
    minWidth: 60,                    // optional: ensures super short text isn’t too tiny
    height: CHIP_HEIGHT,
    paddingHorizontal: 14,           // <-- replaces fixed width
    borderRadius: CHIP_HEIGHT / 2,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  chipActive: { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' },
  chipText: {
    color: '#374151',
    fontSize: 14,
    textAlign: 'center',
    maxWidth: CHIP_WIDTH - 16,
    // keep baseline stable on Android so height/position don't jitter
    includeFontPadding: false,
    textAlignVertical: 'center',
    fontWeight: Platform.select({ ios: '600', android: '700' }), // constant weight
  },
  chipTextActive: {
    color: '#4F46E5',
    // DO NOT change weight; only color changes to avoid width reflow
  },

  // LIST & CARDS
  list: { paddingBottom: 28 },
  card: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 16,
    padding: 14, flexDirection: 'row', gap: 12, marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  cardIcon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: '#EEF2FF',
    alignItems: 'center', justifyContent: 'center', marginTop: 6,
  },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  cardCategory: { fontSize: 12, color: '#6B7280', marginTop: 2 },

  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  quickPill: { backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 999 },
  quickText: { fontSize: 11, color: '#374151' },

  readMoreRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 10 },
  readMoreText: { color: '#6366F1', fontWeight: '600' },

  empty: { alignItems: 'center', gap: 8, paddingVertical: 30 },
  emptyText: { color: '#6B7280', fontSize: 13 },

  footer: { paddingVertical: 8, paddingBottom: 12 },
  disclaimer: { color: '#6B7280', fontSize: 12, textAlign: 'center' },
});