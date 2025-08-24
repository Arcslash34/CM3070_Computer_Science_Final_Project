// resourceHub.js
import React, { useMemo, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView,
  TouchableOpacity, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

/* ---------------- data ---------------- */
const RESOURCES = [
  {
    id: 'flooding',
    title: 'Flooding (Heavy Rain & Flash Floods)',
    category: 'Flooding',
    icon: 'rainy',
    quick: [
      'F.L.A.S.H.: Follow • Look • Avoid • Share • Help',
      'Subscribe alerts (myENV, @pubfloodalerts)',
      'Avoid floodwater; move to higher ground',
      'Don’t drive into flooded roads',
      'Turn off mains before evacuating'
    ],
    body: [
      // Awareness & alerts
      'Stay Flood-Wise: Enable “Heavy Rain”, “Drain Water Level” and “Flash Flood Alerts” in the myENV app. Follow PUB Flood Alerts on Telegram (@pubfloodalerts) or X (@PUBsingapore).',

      // F.L.A.S.H. mnemonic
      'F.L.A.S.H.: Follow PUB flood alerts • Look out for flood-prone or waterlogged areas • Avoid walking/driving through floodwater • Share PUB updates • Help others where safe.',

      // Role-based tips
      'Pedestrians — Avoid water deeper than your ankles. Use a stick or umbrella to check for open drains and unstable ground. Keep to higher ground and stay away from canals and large drains.',
      'Motorists — Do not enter water above kerb height or when road markings are not visible. If passage is unavoidable and safe, drive slowly and steadily, one vehicle at a time, keeping revs up. If the car stalls, do not restart. Switch on hazard lights and move to higher ground.',
      'Homeowners — Keep compound drains choke-free and maintain flood barriers. Move essential items to upper levels. If evacuating, switch off the main electrical supply and disconnect appliances. Never touch switches if wet or standing in water.',
      'Business / Building Owners — Maintain on-site drainage and deploy flood barriers early. Prepare a flood plan covering access, stock relocation and electrical isolation.',

      // Devices offered via PUB
      'Flood protection options: Inflatable Flood Bag (self-inflates on contact with water) and Portable Flood Barrier (modular, self-anchoring). Enquire via 1800-CALL-PUB (1800-2255-782).',

      // After
      'After water recedes: Watch for hidden damage and contamination. Avoid moving water and beware of slippery debris, open covers or eroded ground. Re-enter only when authorities or qualified persons confirm it is safe.'
    ],
    image: require('./assets/resource/flood.jpg'), // replace/remove if you don’t have this asset
    links: [
      { label: 'PUB: Flood Safety Tips (brochure PDF)', url: 'http://pub.gov.sg/-/media/PUB/Flood-Resilience/Documents/Flood-Safety-Tips-Brochure.pdf' },
      { label: 'PUB: Get Flood-Wise (alerts, tips, quiz)', url: 'https://go.gov.sg/be-flood-ready' }
    ],
    tags: [
      'Flood', 'Flash flood', 'Heavy rain',
      'F.L.A.S.H.', 'PUB', 'myENV', 'Drain water level',
      'Pedestrian', 'Motorist', 'Homeowner', 'Business'
    ]
  },
  {
    id: 'fire-safety',
    title: 'Fire Safety & What To Do in a Fire',
    category: 'Fire',
    icon: 'flame',
    quick: [
      'Call 995 (SCDF) immediately',
      'Don’t use lifts; use stairs to evacuate',
      'If trapped: enter safe room, block smoke, call for help',
      'Know how to use a fire extinguisher: P.A.S.S.',
    ],
    body: [
      // If you discover a fire
      'Stay calm. Shout for help and call 995 for SCDF. Alert others and evacuate quickly.',
      'Close doors and windows of the fire room (if safe) to slow spread. Turn off gas mains if accessible.',
      'Never use lifts. Always use stairs and head downwards. If smoke fills stairwell, stay put in a safe room.',
      
      // If trapped
      'Enter a room with a window facing the road. Shut the door but don’t lock it. Block smoke entry at the bottom gap using wet towels, blankets or rugs.',
      'Call 995, state your exact location, what is on fire, and how many people are trapped. If no phone, shout for help from the window. Do not climb or jump.',
      
      // Extinguishers
      'Know the P.A.S.S. method: Pull pin • Aim at base • Squeeze handle • Sweep side-to-side. Only attempt if fire is small and escape route is clear.',
      'Dry Powder (ABC) extinguishers work on Class A (wood/paper), B (flammable liquids), and C (electrical) fires. Avoid use on delicate electronics (messy residue).',
      
      // Prevention
      'Switch off appliances when not in use. Do not overload sockets or leave devices charging overnight.',
      'Install smoke detectors in bedrooms and hallways. Keep exits, corridors, and hose reels clear at all times.',
      'Store flammables properly. Never leave cooking unattended. Extinguish cigarette butts fully before disposal.',
      'Keep a 1-kg dry powder extinguisher in the bedroom, and consider a smoke escape mask for extra protection.',
      
      // Evacuation
      'During evacuation: stop all work, switch off electricals, take only light belongings, do not re-enter until authorities give the all-clear.'
    ],
    image: require('./assets/resource/learntousefireextinguisher.jpg'),
    links: [
      { label: 'HealthXchange: Fire Safety Tips', url: 'https://www.healthxchange.sg/explore/health-safety/fire-safety-tips-what-to-do-fire' },
      { label: 'NUS Fire Safety Training (PDF)', url: 'https://inetapps.nus.edu.sg/osh/portal/training/training-materials/fs/ivle-courseware.pdf' },
      { label: 'SCDF: Fire Safety at Home', url: 'https://www.scdf.gov.sg/docs/default-source/media-room-(publications)/posters--leaflets--booklets/leaflets/fire-safety-at-home-(eng).jpg?sfvrsn=7119fa48_1' },
    { label: 'SCDF: Learn to Use Fire Extinguisher', url: 'https://www.scdf.gov.sg/docs/default-source/media-room-(publications)/posters--leaflets--booklets/poster/learntousefireextinguisher_en-amp-ch.jpg?sfvrsn=4f43ea1c_1' },
    { label: 'SCDF: Fire in High-Rise Building', url: 'https://www.scdf.gov.sg/docs/default-source/media-room-(publications)/posters--leaflets--booklets/poster/super_high_rise_fire.jpg?sfvrsn=6d149605_1' }
    ],
    tags: [
      'Fire', 'SCDF', 'Fire extinguisher', 'High-rise', 'Smoke', 
      'Prevention', 'Evacuation', 'Singapore'
    ]
  },
  {
    id: 'mosquito-dengue',
    title: 'Mosquito & Dengue: Symptoms and Prevention',
    category: 'Infectious',
    icon: 'bug',
    quick: [
      'Know symptoms: fever, aches, rash, nausea',
      'Prevent bites: S-A-W — Spray, Apply repellent, Wear long sleeves',
      'Stop breeding: B-L-O-C-K stagnant water',
    ],
    body: [
      'Common dengue symptoms: sudden fever (2–7 days), headache (behind the eyes), muscle/joint pain, rash, nausea/vomiting, and mild bleeding (nose/gum). Seek medical care if symptoms worsen.',
      'Protect yourself with S-A-W: Spray insecticide in dark corners, Apply mosquito repellent regularly, Wear long sleeves and pants.',
      'Prevent breeding with B-L-O-C-K: Break up hardened soil • Lift and empty flowerpot plates • Overturn pails • Change water in vases • Keep gutters clear.',
      'Even small amounts of clean stagnant water (size of a 20¢ coin) can breed mosquitoes.',
    ],
    image: require('./assets/resource/mosquito.png'),
    links: [
      { label: 'gov.sg: Dengue — Symptoms & Protection', url: 'https://www.gov.sg/explainers/dengue-know-the-symptoms-and-how-to-protect-yourself' },
      { label: 'Clean & Green SG: Dengue Prevention (B-L-O-C-K & S-A-W)', url: 'https://www.cgs.gov.sg/blockdengue/home/' }
    ],
    tags: ['Dengue', 'Mosquito', 'S-A-W', 'B-L-O-C-K', 'Repellent', 'Singapore']
  },
  {
    id: 'cpr-aed-adult',
    title: 'CPR + AED (Adult)',
    category: 'Cardiac',
    icon: 'heart',
    quick: [
      'DRS ABC: Danger • Response • Shout 995 • AED • Breathing',
      'Start CPR: 100–120/min, depth ~5–6 cm, full recoil',
      'Use AED ASAP; follow voice prompts'
    ],
    body: [
      'Check for danger; approach only if safe. Tap shoulders and ask if they’re okay.',
      'Shout for help. Call 995 (speaker on). Use myResponder to share location & find nearby AEDs.',
      'Not breathing/abnormal? Begin chest compressions in the center of the chest at 100–120/min, depth ~5–6 cm. Allow full recoil; minimize pauses.',
      'When an AED arrives: ensure a dry, safe surface. Turn it on and follow prompts.',
      'Bare and dry the chest; remove patches; shave if needed. Place pads: one upper right chest below collarbone, one lower left below nipple (offset 4 fingers from pacemaker if present).',
      '“Analyzing”: hands off—loudly say “Stay clear.” If shock advised, ensure no contact and press shock. Resume CPR immediately after. If no shock, resume CPR.',
      'Continue cycles of CPR and AED prompts until the person breathes normally/wakes or paramedics take over.'
    ],
    image: require('./assets/resource/cpr.jpg'),
    links: [
      { label: 'SG Heart Foundation: CPR+AED for Adults', url: 'https://www.myheart.org.sg/techniques/cpraed-for-adults/' }
    ],
    tags: ['CPR', 'AED', 'Cardiac', 'myResponder', 'Singapore']
  },
  {
    id: 'choking-adult',
    title: 'Choking (Adult)',
    category: 'Airway',
    icon: 'warning',
    quick: [
      'Universal sign: hand on throat',
      'If can cough/speak → encourage coughing',
      'If severe: 5 back blows',
      '5 abdominal thrusts (Heimlich)',
      'Alternate 5+5 until relieved or unresponsive'
    ],
    body: [
      'Look for signs: unable to talk, weak/ineffective cough, bluish lips/skin, loss of consciousness.',
      'If able to cough strongly, encourage coughing. If severe obstruction, act immediately.',
      'Stand just behind & to the side. Support chest, bend casualty forward. Deliver up to 5 firm back blows between shoulder blades.',
      'If unsuccessful, perform 5 abdominal thrusts (Heimlich): stand behind, fist just above navel, grasp with other hand, thrust inward & upward.',
      'Alternate 5 back blows and 5 thrusts until object expelled or person becomes unresponsive.',
      'Special cases: For pregnant or obese, perform chest thrusts (hands higher, at breastbone). For self-choking, press your own fist inward/upward against hard surface.',
      'If casualty becomes unresponsive: call 995 immediately. Begin CPR with chest compressions. Check mouth between cycles for visible object (remove only if you can see it).'
    ],
    image: require('./assets/resource/choking.jpg'),
    links: [
      { label: 'First Aid Training SG: Choking (Step by Step)', url: 'https://www.firstaidtraining.com.sg/choking-first-aid-step-by-step' }
    ],
    tags: ['Choking', 'Airway', 'Heimlich', 'Back blows', 'Singapore']
  },
  {
    id: 'severe-bleeding',
    title: 'Severe Bleeding',
    category: 'Trauma',
    icon: 'bandage',
    quick: [
      'Call emergency (995 in SG)',
      'Apply firm direct pressure',
      'Add dressings, bandage firmly',
      'Tourniquet if trained & needed',
      'Treat for shock'
    ],
    body: [
      'External bleeding: Wear gloves if available. Expose wound and apply firm direct pressure with a clean pad/cloth.',
      'Maintain continuous pressure for ≥10 minutes. Do not remove soaked dressings—add more on top and bandage firmly.',
      'If blood leaks through, add extra pads. If uncontrolled, replace with a fresh bulky pad and reapply pressure.',
      'For life-threatening limb bleeding, if trained, apply a tourniquet 5–7 cm above the wound (not over a joint). Note time of application.',
      'If an object is embedded: DO NOT remove. Pad around it and bandage to stabilize without pressing directly on it.',
      'Internal bleeding suspected (pale, weak, abdominal/chest injury): Call 995 immediately. Lay casualty flat, loosen clothing, keep warm, monitor vital signs.',
      'Treat for shock: lay flat if possible, elevate legs unless injured, keep warm, reassure, no food/drink. Monitor until help arrives.'
    ],
    image: require('./assets/resource/bleeding.jpg'),
    links: [
      { label: 'Stop the Bleed (Global)', url: 'https://www.stopthebleed.org/' },
      { label: 'Singapore First Aid Training Centre: Bleeding Control', url: 'https://www.firstaidtraining.com.sg/wait-is-that-blood' }
    ],
    tags: ['Bleeding', 'Trauma', 'Tourniquet', 'First Aid', 'Singapore']
  },
  {
    id: 'burns',
    title: 'Burns (Thermal)',
    category: 'Burns',
    icon: 'flame',
    quick: [
      'Cool burn with running water 20 min',
      'Remove jewelry/tight items',
      'Cover with clean non-stick dressing',
      'Do NOT pop blisters or apply creams'
    ],
    body: [
      'Immediately cool the burn under cool running water for at least 20 minutes. Do not use ice, iced water, butter, toothpaste, or grease.',
      'Remove jewelry and tight clothing before swelling starts. If clothing is stuck to the wound, cut around it—do not pull off.',
      'Cover with sterile non-adhesive dressing, cling film, or clean cloth. Avoid tissue or paper that may stick.',
      'Provide pain relief if safe (e.g. paracetamol for children).',
      'Seek urgent medical care if: burn is large (> hand size), deep/white/charred, involves face, hands, feet, genitals, joints, airway, chemical or electrical burns, or if child/elderly.',
      'Monitor for shock (pale, weak, faint). Keep warm, no food or drink.'
    ],
    image: require('./assets/resource/burn.jpg'),
    links: [
      { label: 'MOH: Mild Burns & Scalds (2025)', url: 'https://www.moh.gov.sg/seeking-healthcare/getting-medical-help/conditions/mild-burns-and-scalds' },
      { label: 'KKH: Burn First Aid (Children, 2024)', url: 'https://www.kkh.com.sg/publication/patient-care/critical-to-perform-first-aid-immediately-after-sustaining-a-burn' }
    ],
    tags: ['Burns', 'Scalds', 'Children', 'First Aid', 'Singapore']
  },
  {
    id: 'heat-stroke',
    title: 'Heat Stroke',
    category: 'Environmental',
    icon: 'sunny',
    quick: [
      'Call emergency',
      'Move to shade/cool area',
      'Cool rapidly (water/ice packs)',
      'Loosen/remove clothing'
    ],
    body: [
      'Heat stroke is life-threatening. Signs include very high body temperature, hot dry skin, confusion, collapse, or unconsciousness.',
      'Call emergency immediately. Move the person to a cool/shaded place.',
      'Remove excess clothing. Cool rapidly with cold packs (neck, armpits, groin), wet the skin + fan, or immerse in cold water if possible.',
      'If conscious: give small sips of cool water. Monitor airway, breathing, and circulation until help arrives.',
      'At-risk groups include elderly, children, those with chronic illnesses, or doing strenuous activity in heat.'
    ],
    image: require('./assets/resource/heatstroke.jpg'),
    links: [
      { label: 'HealthXchange (SingHealth): Heat Stroke – Types & Symptoms', url: 'https://www.healthxchange.sg/how-to-manage/fluid-electrolytes/heat-stroke-types-symptoms' },
      { label: 'NUHS+: Staying Safe in Hot Weather (2023)', url: 'https://nuhsplus.edu.sg/article/why-it-s-important-to-keep-your-cool-in-singapore-s-hot-weather' }
    ],
    tags: ['Heat', 'Environment', 'Emergency', 'First Aid', 'Singapore']
  },
  {
    id: 'fracture-sprain',
    title: 'Fracture & Sprain',
    category: 'Trauma',
    icon: 'fitness',
    quick: ['Protect & rest', 'Ice 15–20 min', 'Compression', 'Elevate'],
    body: [
      'If severe deformity, open wound, or heavy trauma: call emergency immediately.',
      'First aid: P.R.I.C.E. – Protect, Rest, Ice (15–20 min wrapped in cloth), Compress with elastic bandage, Elevate above heart.',
      'Do not attempt to straighten a deformed limb. Immobilize joint above & below if fracture suspected.',
      'Seek medical help if severe pain, swelling, numbness, inability to move or bear weight, or if symptoms don’t improve after 2–3 days.'
    ],
    image: require('./assets/resource/fracture.jpg'),
    links: [
      { label: 'HealthHub SG – Strains & Sprains (MOH/WHC/KTPH)', url: 'https://www.healthhub.sg/a-z/diseases-and-conditions/strains-and-sprains' }
    ],
    tags: ['Fracture', 'Sprain', 'PRICE', 'Trauma']
  },
];

const CATEGORIES = ['All', ...Array.from(new Set(RESOURCES.map(r => r.category)))];

// visual accents per category
const CAT_ACCENTS = {
  Cardiac:   { bg: '#FDF2F2', text: '#B91C1C', stripe: '#FCA5A5' },
  Airway:    { bg: '#EFF6FF', text: '#1D4ED8', stripe: '#93C5FD' },
  Trauma:    { bg: '#ECFDF5', text: '#047857', stripe: '#A7F3D0' },
  Burns:     { bg: '#FFF7ED', text: '#C2410C', stripe: '#FED7AA' },
  Environmental: { bg: '#F0F9FF', text: '#0C4A6E', stripe: '#A5F3FC' },
  default:   { bg: '#EEF2FF', text: '#4338CA', stripe: '#C7D2FE' },
};

// layout constants
const CHIP_WIDTH  = 112;
const CHIP_HEIGHT = 32;
const CHIP_ROW_VPAD = 6;
const CHIP_ROW_HEIGHT = CHIP_HEIGHT + CHIP_ROW_VPAD * 2;
const MAX_QUICK = 3;

/* ---------------- component ---------------- */
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
    <SafeAreaView style={styles.container} edges={['left','right','bottom']}>
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
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close-circle" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Chips */}
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
                activeOpacity={0.85}
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

      {/* Subtitle / count */}
      <View style={styles.resultRow}>
        <Text style={styles.resultText}>
          {filtered.length} {filtered.length === 1 ? 'topic' : 'topics'}
        </Text>
      </View>

      {/* List */}
      <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        {filtered.map(item => {
          const accent = CAT_ACCENTS[item.category] || CAT_ACCENTS.default;
          const extraCount = Math.max(0, item.quick.length - MAX_QUICK);
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.card, { shadowOpacity: Platform.OS === 'ios' ? 0.08 : 0.12 }]}
              onPress={() => openArticle(item)}
              activeOpacity={0.9}
            >
              {/* Left accent stripe */}
              <View style={[styles.accentStripe, { backgroundColor: accent.stripe }]} />

              {/* Icon bubble */}
              <View style={[styles.cardIcon, { backgroundColor: accent.bg }]}>
                <Ionicons name={item.icon} size={22} color={accent.text} />
              </View>

              {/* Content */}
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>

                {/* Category pill */}
                <View style={[styles.catPill, { backgroundColor: accent.bg }]}>
                  <Ionicons name="pricetag" size={12} color={accent.text} />
                  <Text style={[styles.catPillText, { color: accent.text }]}>{item.category}</Text>
                </View>

                {/* Quick tips checklist */}
                <View style={styles.quickList}>
                  {item.quick.slice(0, MAX_QUICK).map((q, i) => (
                    <View key={i} style={styles.quickItem}>
                      <Ionicons name="checkmark-circle" size={14} color="#10B981" style={{ marginTop: 1 }} />
                      <Text style={styles.quickItemText} numberOfLines={2}>{q}</Text>
                    </View>
                  ))}
                  {extraCount > 0 && (
                    <View style={styles.morePill}>
                      <Text style={styles.morePillText}>+{extraCount} more</Text>
                    </View>
                  )}
                </View>

                {/* Read more */}
                <View style={styles.readMoreRow}>
                  <Text style={styles.readMoreText}>Read more</Text>
                  <Ionicons name="chevron-forward" size={16} color="#6366F1" />
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

        {filtered.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="search" size={20} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>No results</Text>
            <Text style={styles.emptyText}>Try a broader term like “CPR”, “burns”, or “sprain”.</Text>
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

/* ---------------- styles ---------------- */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    paddingTop: 8,
  },

  /* Search */
  searchRow: {
    marginTop: 0,
    marginBottom: 6,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: Platform.select({ ios: 8, android: 6 }),
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: { flex: 1, color: '#111827', fontSize: 12 },

  /* Chips */
  chipsContainer: {
    height: CHIP_ROW_HEIGHT,
    justifyContent: 'center',
    marginBottom: 4,
  },
  chipsRow: {
    paddingVertical: CHIP_ROW_VPAD,
    alignItems: 'center',
    paddingRight: 4,
  },
  chip: {
    minWidth: 68,
    height: CHIP_HEIGHT,
    paddingHorizontal: 14,
    borderRadius: CHIP_HEIGHT / 2,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' },
  chipText: {
    color: '#374151',
    fontSize: 14,
    textAlign: 'center',
    maxWidth: CHIP_WIDTH - 16,
    includeFontPadding: false,
    textAlignVertical: 'center',
    fontWeight: Platform.select({ ios: '600', android: '700' }),
  },
  chipTextActive: { color: '#4F46E5' },

  /* Result count */
  resultRow: { marginTop: 4, marginBottom: 10, paddingHorizontal: 2 },
  resultText: { color: '#6B7280', fontSize: 12, fontWeight: '600' },

  /* List & Cards */
  list: { paddingBottom: 28 },

  card: {
    position: 'relative',
    flexDirection: 'row',
    gap: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    padding: 14,
    marginBottom: 14,
    // soft shadow
    shadowColor: '#000',
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  accentStripe: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    width: 4,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },

  cardIcon: {
    width: 44, height: 44,
    borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 2,
  },

  cardContent: { flex: 1 },
  cardTitle: { fontSize: 17, fontWeight: '800', color: '#111827' },

  catPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 999,
    marginTop: 6,
  },
  catPillText: { fontSize: 12, fontWeight: '700' },

  quickList: { marginTop: 8, gap: 6 },
  quickItem: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  quickItemText: { color: '#374151', fontSize: 13, lineHeight: 18, flex: 1 },

  morePill: {
    alignSelf: 'flex-start',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 999,
    marginTop: 2,
  },
  morePillText: { fontSize: 12, fontWeight: '700', color: '#4B5563' },

  readMoreRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  readMoreText: { color: '#6366F1', fontWeight: '700' },

  /* Empty */
  empty: { alignItems: 'center', gap: 6, paddingVertical: 40 },
  emptyTitle: { color: '#111827', fontWeight: '800', fontSize: 16 },
  emptyText: { color: '#6B7280', fontSize: 13, textAlign: 'center', paddingHorizontal: 20 },

  /* Footer */
  footer: { paddingVertical: 6, paddingBottom: 12 },
  disclaimer: { color: '#6B7280', fontSize: 12, textAlign: 'center' },
});
