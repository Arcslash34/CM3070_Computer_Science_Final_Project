// badges.js
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

/* ----------------------------------------------------------------
   Dummy data — replace with your DB values (earned + points)
---------------------------------------------------------------- */
const RAW_BADGES = [
  // Learning Achievements
  { id: 'first-step',       title: 'First Step',        group: 'Learning Achievements', earned: true  },
  { id: 'quiz-explorer',    title: 'Quiz Explorer',     group: 'Learning Achievements', earned: true  },
  { id: 'knowledge-builder',title: 'Knowledge Builder', group: 'Learning Achievements', earned: true  },
  { id: 'disaster-scholar', title: 'Disaster Scholar',  group: 'Learning Achievements', earned: true  },

  // Disaster Specialist
  { id: 'earthquake-expert',title: 'Earthquake Expert', group: 'Disaster Specialist',   earned: true  },
  { id: 'fire-expert',      title: 'Fire Expert',       group: 'Disaster Specialist',   earned: true  },
  { id: 'flood-fighter',    title: 'Flood Fighter',     group: 'Disaster Specialist',   earned: true  },
  { id: 'tsunami-survivor', title: 'Tsunami Survivor',  group: 'Disaster Specialist',   earned: false },
  { id: 'flood-tactician',  title: 'Flood Tactician',   group: 'Disaster Specialist',   earned: true  },

  // Consistency / Streaks
  { id: 'streak-1',  title: '1-Day Streak',   group: 'Consistency / Streaks', earned: true  },
  { id: 'streak-3',  title: '3-Day Streak',   group: 'Consistency / Streaks', earned: true  },
  { id: 'streak-5',  title: '5-Day Streak',   group: 'Consistency / Streaks', earned: true  },
  { id: 'streak-7',  title: '7-Day Streak',   group: 'Consistency / Streaks', earned: true  },
  { id: 'streak-14', title: '14-Day Streak',  group: 'Consistency / Streaks', earned: true  },
  { id: 'streak-21', title: '21-Day Streak',  group: 'Consistency / Streaks', earned: true  },

  // First Aid Heroes
  { id: 'cpr-hero',        title: 'CPR Hero',             group: 'First Aid Heroes', earned: true  },
  { id: 'bleeding-master', title: 'Bleeding Controller',  group: 'First Aid Heroes', earned: true  },
  { id: 'fracture-fixer',  title: 'Fracture Fixer',       group: 'First Aid Heroes', earned: true  },
];

const TOTAL_BADGES = 50;     // replace with your total count
const CURRENT_POINTS = 80;   // replace with profile points

export default function BadgesScreen() {
  // JS version (no TS generic here)
  const [tab, setTab] = useState('all'); // 'all' | 'unlocked' | 'locked'

  // filter per tab
  const list = useMemo(() => {
    if (tab === 'unlocked') return RAW_BADGES.filter(b => b.earned);
    if (tab === 'locked')   return RAW_BADGES.filter(b => !b.earned);
    return RAW_BADGES;
  }, [tab]);

  // group for section headings
  const sections = useMemo(() => {
    const m = new Map();
    for (const b of list) {
      if (!m.has(b.group)) m.set(b.group, []);
      m.get(b.group).push(b);
    }
    return Array.from(m.entries()).map(([title, items]) => ({ title, items }));
  }, [list]);

  const earnedCount = RAW_BADGES.filter(b => b.earned).length;

  return (
    <ScrollView contentContainerStyle={s.container}>
      {/* Hero header */}
      <LinearGradient
        colors={['#8B5CF6', '#6D28D9']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.hero}
      >
        <View style={s.heroTopRow}>
          <Text style={s.heroTitle}>My Badges</Text>
          <Ionicons name="medal-outline" size={22} color="#F5F3FF" />
        </View>

        <View style={s.heroStatsRow}>
          <StatPill icon="ribbon"   value={`${earnedCount}/${TOTAL_BADGES}`} label="Badges" />
          <StatPill icon="sparkles" value={`${CURRENT_POINTS}`}           label="Points" />
        </View>

        <View style={s.tabs}>
          <TabButton text="All"       active={tab === 'all'}      onPress={() => setTab('all')} />
          <TabButton text="Unlocked"  active={tab === 'unlocked'} onPress={() => setTab('unlocked')} />
          <TabButton text="Locked"    active={tab === 'locked'}   onPress={() => setTab('locked')} />
        </View>
      </LinearGradient>

      {/* Sections */}
      <View style={s.contentPad}>
        {sections.map(sec => (
          <View key={sec.title} style={{ marginBottom: 18 }}>
            <Text style={s.sectionTitle}>{sec.title}</Text>
            <View style={s.grid}>
              {sec.items.map(b => (
                <BadgeCard key={b.id} title={b.title} earned={b.earned} />
              ))}
            </View>
          </View>
        ))}

        {list.length === 0 && (
          <View style={s.empty}>
            <Ionicons name="star-outline" size={20} color="#9CA3AF" />
            <Text style={s.emptyText}>
              {tab === 'unlocked' ? 'No badges unlocked yet.' : 'All badges are unlocked 🎉'}
            </Text>
          </View>
        )}
      </View>

      <View style={{ height: 10 }} />
    </ScrollView>
  );
}

/* ---------------- small components ---------------- */

function StatPill({ icon, value, label }) {
  return (
    <View style={s.statPill}>
      <Ionicons name={icon} size={16} color="#EDE9FE" />
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function TabButton({ text, active, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={[s.tabBtn, active && s.tabBtnActive]}
    >
      <Text style={[s.tabText, active && s.tabTextActive]}>{text}</Text>
    </TouchableOpacity>
  );
}

function BadgeCard({ title, earned }) {
  return (
    <TouchableOpacity activeOpacity={0.92} style={[s.card, !earned && s.cardLocked]}>
      {/* medal */}
      <View style={s.medalWrap}>
        <View style={[s.medalCircle, !earned && { opacity: 0.35 }]}>
          <View style={s.medalInner}>
            <Ionicons name="star" size={18} color="#F59E0B" />
          </View>
        </View>
        {/* ribbons */}
        <View style={[s.ribbon, { left: 8 }]} />
        <View style={[s.ribbon, { right: 8 }]} />
      </View>

      {/* title */}
      <Text style={s.cardTitle} numberOfLines={1}>{title}</Text>

      {/* pill */}
      <View style={[s.pill, earned ? null : s.pillLocked]}>
        <Text style={[s.pillText, earned ? null : s.pillTextLocked]}>
          {earned ? 'Completed' : 'Locked'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

/* ---------------- styles ---------------- */

const CARD_W = 96;

const s = StyleSheet.create({
  container: { backgroundColor: '#FFFFFF', flexGrow: 1 },

  /** hero */
  hero: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  heroStatsRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 10,
  },
  statPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(255,255,255,0.25)',
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  statValue: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  statLabel: { color: '#EDE9FE', fontWeight: '600' },

  tabs: {
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    padding: 4,
    flexDirection: 'row',
    gap: 6,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: 'center',
  },
  tabBtnActive: { backgroundColor: '#FFFFFF' },
  tabText: { color: '#EDE9FE', fontWeight: '700' },
  tabTextActive: { color: '#6D28D9' },

  /** content */
  contentPad: { paddingHorizontal: 16, paddingTop: 14 },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 10,
    marginTop: 6,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },

  /** badge card */
  card: {
    width: CARD_W,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: Platform.OS === 'ios' ? 0.06 : 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardLocked: { backgroundColor: '#FAFAFA' },

  medalWrap: { alignItems: 'center', justifyContent: 'center' },
  medalCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#FDE68A',
    borderWidth: 1, borderColor: '#F59E0B',
    alignItems: 'center', justifyContent: 'center',
  },
  medalInner: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#FFF7ED',
    alignItems: 'center', justifyContent: 'center',
  },
  ribbon: {
    position: 'absolute',
    bottom: -6,
    width: 10, height: 12,
    backgroundColor: '#93C5FD',
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },

  cardTitle: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },

  /** pill */
  pill: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#EDE9FE',
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  pillText: { fontSize: 10, fontWeight: '700', color: '#6D28D9' },
  pillLocked: { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' },
  pillTextLocked: { color: '#6B7280' },

  /** empty */
  empty: { alignItems: 'center', gap: 6, paddingVertical: 40 },
  emptyText: { color: '#6B7280', fontWeight: '600' },
});
