// QuizGame.js — gameplay (moved from your quizzes.js), saves to Supabase then navigates to ResultSummary
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal,
  ActivityIndicator, Alert, Animated, Easing, SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from './supabase';

/* ---------------- quiz bank (same as your file) ---------------- */
const flood_easy = [
  { question: 'What should you do first during a flash flood?', options: ['Evacuate immediately', 'Take a selfie', 'Call your neighbor'], correctIndex: 0, explanation: 'Evacuating immediately helps you avoid rising waters.' },
  { question: 'Which area should be avoided?', options: ['Low-lying areas', 'High ground', 'Evacuation center'], correctIndex: 0, explanation: 'Low-lying areas flood quickly and are dangerous.' },
  { question: 'Who should you follow for updates during a flood?', options: ['Influencers', 'Official govt sources', 'Friends chat'], correctIndex: 1, explanation: 'Official sources are verified and timely.' },
  { question: 'Water rising around your car — what now?', options: ['Stay in the car', 'Drive faster', 'Leave car, go higher ground'], correctIndex: 2, explanation: 'Get to higher ground quickly and safely.' },
  { question: 'What belongs in a basic flood kit?', options: ['Board games', 'Flashlight, food, water', 'Sunglasses'], correctIndex: 1, explanation: 'Essentials help you ride out disruptions.' },
];
const flood_medium = [
  { question: 'Minimum emergency supply duration is…', options: ['1 day', '3 days', '7 days'], correctIndex: 1, explanation: '3 days is a common baseline recommendation.' },
  { question: 'Which belongs in a flood kit?', options: ['Toothbrush', 'Flashlight + batteries', 'Passport only'], correctIndex: 1, explanation: 'Outages? You’ll need light.' },
  { question: 'Why bottled water?', options: ['Clean wounds', 'Tap may be unsafe', 'Tastes better'], correctIndex: 1, explanation: 'Floods may contaminate supplies.' },
  { question: 'When to turn off electricity?', options: ['When water enters home', 'Only in blackout', 'After full flood'], correctIndex: 0, explanation: 'Prevents electrocution risk.' },
  { question: 'Check weather alerts…', options: ['Once/month', 'When it rains', 'Regularly & in heavy rain'], correctIndex: 2, explanation: 'Stay proactive and updated.' },
];
const flood_hard = [
  { question: 'Best time to evacuate on flood warnings?', options: ['Before flooding starts', 'After water rises', 'At night'], correctIndex: 0, explanation: 'Leave early to reduce risk.' },
  { question: 'Flash floods mainly caused by…', options: ['Sudden intense rainfall', 'Sunny days', 'Wind'], correctIndex: 0, explanation: 'Sudden cloudbursts overwhelm drainage.' },
  { question: 'Trapped in a building?', options: ['Go to roof, signal for help', 'Wait in basement', 'Open windows wide'], correctIndex: 0, explanation: 'Roof increases safety & visibility.' },
  { question: 'Walking in floodwater risk?', options: ['Just wet clothes', 'Debris & open manholes', 'Sunburn'], correctIndex: 1, explanation: 'Water hides hazards.' },
  { question: 'Avoid elevators during floods because…', options: ['They’re slow', 'They may trap you', 'They use electricity'], correctIndex: 1, explanation: 'Elevators can fail and trap occupants.' },
];

const fire_easy = [
  { question: 'First action if you discover a fire?', options: ['Call emergency & alert others', 'Hide quietly', 'Open all windows'], correctIndex: 0, explanation: 'Raise alarm and call emergency services immediately.' },
  { question: 'Which is TRUE for evacuation?', options: ['Use lifts', 'Use stairs', 'Wait on the floor'], correctIndex: 1, explanation: 'Never use lifts during a fire.' },
  { question: 'If trapped in a room, you should…', options: ['Block smoke gaps', 'Break door', 'Jump out'], correctIndex: 0, explanation: 'Block smoke at door gap and call for help.' },
  { question: 'P.A.S.S. stands for…', options: ['Push Aim Stop Spray', 'Pull Aim Squeeze Sweep', 'Press Aim Shoot Sweep'], correctIndex: 1, explanation: 'Pull, Aim, Squeeze, Sweep is the extinguisher method.' },
  { question: 'Extinguisher for electrical fires?', options: ['Water', 'CO₂/Dry Powder', 'Foam only'], correctIndex: 1, explanation: 'Use CO₂ or Dry Powder for electrical fires.' },
];
const fire_medium = [
  { question: 'Safe to attempt extinguishing when…', options: ['Fire is small & escape route clear', 'Any fire size', 'Thick smoke fills stairwell'], correctIndex: 0, explanation: 'Only try small fires with a clear exit.' },
  { question: 'Before evacuating, if safe you should…', options: ['Turn off gas mains', 'Open doors to vent', 'Pack valuables'], correctIndex: 0, explanation: 'Turning off gas may reduce fuel to the fire.' },
  { question: 'Smoke detectors should be placed in…', options: ['Bedrooms/hallways', 'Kitchen only', 'Bathroom only'], correctIndex: 0, explanation: 'Bedrooms & hallways improve early warning.' },
  { question: 'Stairwell fills with smoke while descending…', options: ['Keep going down', 'Return and shelter in safe room', 'Use the lift quickly'], correctIndex: 1, explanation: 'Shelter in place if egress becomes unsafe.' },
  { question: 'Best prevention while cooking:', options: ['Leave pan unattended on low heat', 'Never leave cooking unattended', 'Disable smoke detector'], correctIndex: 1, explanation: 'Unattended cooking is a leading fire cause.' },
];
const fire_hard = [
  { question: 'Dry powder (ABC) works on…', options: ['A only (wood/paper)', 'A, B & C (solids, liquids, electrical)', 'C only (electrical)'], correctIndex: 1, explanation: 'ABC covers common classes including electrical.' },
  { question: 'During evacuation you should…', options: ['Re-enter to collect items', 'Stop work, take light belongings, exit', 'Hide to avoid panic'], correctIndex: 1, explanation: 'Prioritise life safety and leave quickly.' },
  { question: 'High-rise fire: lifts are for…', options: ['Public evacuation', 'Firefighting only', 'Pets only'], correctIndex: 1, explanation: 'Fire lifts are reserved for firefighters.' },
  { question: 'Small oil pan fire at home, best first step:', options: ['Splash water', 'Turn off heat, cover with lid', 'Carry pan outside'], correctIndex: 1, explanation: 'Starve the fire of oxygen; never add water to oil.' },
  { question: 'If clothing catches fire:', options: ['Run fast', 'Stop, Drop, Roll', 'Fan the flames'], correctIndex: 1, explanation: 'Stop, Drop, Roll smothers the flames.' },
];

const quizBank = {
  flood: { easy: flood_easy, medium: flood_medium, hard: flood_hard },
  fire:  { easy: fire_easy,  medium: fire_medium,  hard: fire_hard  },
};

const pointsPerDifficulty = { easy: 5, medium: 10, hard: 20 };
const durationByDifficulty = { easy: 60, medium: 45, hard: 30 };
const getBadge = (score) => (score >= 30 ? '🥇 Gold' : score >= 20 ? '🥈 Silver' : score >= 10 ? '🥉 Bronze' : '🚫 None');

const getAllQuestionsFlat = () => {
  const flat = [];
  Object.entries(quizBank).forEach(([topicKey, diffs]) => {
    Object.entries(diffs).forEach(([diffKey, arr]) => {
      arr.forEach((q) => flat.push({ ...q, _topic: topicKey, _difficulty: diffKey }));
    });
  });
  return flat;
};
const sampleArray = (arr, n) =>
  arr.map((x) => [Math.random(), x]).sort((a, b) => a[0] - b[0]).slice(0, n).map((x) => x[1]);

export default function QuizGame() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const topicId = params?.topicId;
  const topicTitle = params?.topicTitle ?? 'Quiz';
  const difficulty = params?.difficulty;
  const isDaily = params?.isDaily;

  const [dailyQuestions, setDailyQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState(0);
  const [earnedXP, setEarnedXP] = useState(0);
  const [totalXP, setTotalXP] = useState(0);
  const [userAnswers, setUserAnswers] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [eliminatedOption, setEliminatedOption] = useState(null);
  const [usedHint, setUsedHint] = useState(false);
  const [remainingTime, setRemainingTime] = useState(60);
  const progressAnim = useRef(new Animated.Value(1)).current;
  const flashAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef(null);
  const quizStartRef = useRef(null);

  React.useLayoutEffect(() => {
    navigation.setOptions({ headerShown: true, title: topicTitle, headerTitleAlign: 'center' });
  }, [navigation, topicTitle]);

  // Build daily set if needed
  useEffect(() => {
    if (isDaily) {
      const flat = getAllQuestionsFlat();
      const pick = sampleArray(flat, 8);
      setDailyQuestions(pick.map(({ question, options, correctIndex, explanation }) => ({
        question, options, correctIndex, explanation,
      })));
    }
  }, [isDaily]);

  // derived quizzes & current
  const quizzes = useMemo(() => {
    if (isDaily) return dailyQuestions;
    return quizBank[topicId]?.[difficulty] || [];
  }, [isDaily, dailyQuestions, topicId, difficulty]);

  const current = useMemo(() => quizzes[index], [quizzes, index]);
  const totalTime = durationByDifficulty[difficulty] ?? 60;

  // reset when mount
  useEffect(() => {
    quizStartRef.current = Date.now();
    setIndex(0); setSelected(null); setSubmitted(false); setShowExplanation(false);
    setScore(0); setTotalXP(0); setEarnedXP(0); setEliminatedOption(null); setUsedHint(false);
    setRemainingTime(totalTime); setUserAnswers([]); setUploading(false);
  }, [totalTime]);

  // timer + progress
  useEffect(() => {
    if (!current) return;
    progressAnim.setValue(1);
    Animated.timing(progressAnim, { toValue: 0, duration: totalTime * 1000, easing: Easing.linear, useNativeDriver: false }).start();

    setRemainingTime(totalTime);
    const t = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev <= 1) {
          clearInterval(t);
          if (!submitted) onSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    timerRef.current = t;
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  }, [index, current, totalTime, progressAnim, submitted, onSubmit]);

  // flashing under 10s
  const isFlashing = remainingTime <= 10 && !submitted;
  useEffect(() => {
    if (!isFlashing) { flashAnim.setValue(1); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(flashAnim, { toValue: 0.2, duration: 300, useNativeDriver: false }),
      Animated.timing(flashAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
    ]));
    loop.start(); return () => loop.stop();
  }, [isFlashing, flashAnim]);

  // hint
  const handleHint = () => {
    if (usedHint || !current) return;
    const incorrect = current.options.map((opt, i) => ({ opt, i })).filter(o => o.i !== current.correctIndex);
    const remove = incorrect[Math.floor(Math.random() * incorrect.length)];
    setEliminatedOption(remove.opt); setUsedHint(true);
  };

  // submit
  const onSubmit = useCallback(() => {
    if (!current || submitted) return;
    const correct = selected === current.correctIndex;
    const gained = selected == null ? 0 : correct ? Math.floor((remainingTime / totalTime) * 100) : 0;
    const finalGained = usedHint ? Math.floor(gained / 2) : gained;

    setSubmitted(true);
    setEarnedXP(finalGained);
    setTotalXP((x) => x + finalGained);
    if (selected != null && correct) setScore((s) => s + pointsPerDifficulty[difficulty]);
    setShowExplanation(true);
  }, [current, submitted, selected, remainingTime, totalTime, usedHint, difficulty]);

  // next/finish
  const goNext = () => {
    const nextAnswers = [...userAnswers]; nextAnswers[index] = selected; setUserAnswers(nextAnswers);
    setShowExplanation(false); setSubmitted(false); setSelected(null); setEliminatedOption(null); setUsedHint(false);

    if (index + 1 < quizzes.length) { setIndex(index + 1); return; }

    // finish
    const totalQuestions = quizzes.length;
    const finalAnswers = [...nextAnswers];
    const badge = getBadge(score);

    let correctCnt = 0;
    const reviewData = quizzes.map((q, i) => {
      const selectedIndex = finalAnswers[i];
      let status = 'unanswered';
      if (selectedIndex != null) {
        if (selectedIndex === q.correctIndex) { status = 'correct'; correctCnt += 1; }
        else { status = 'incorrect'; }
      }
      return {
        number: i + 1,
        question: q.question,
        status,
        correctAnswer: q.options[q.correctIndex],
        selectedAnswer: selectedIndex != null ? q.options[selectedIndex] : null,
      };
    });

    const xpEarned = totalXP;
    const categoryTitle = isDaily ? 'Daily Quiz' : topicTitle;

    (async () => {
      try {
        setUploading(true);
        const { data: userData, error: userError } = await supabase.auth.getUser();
        const userId = userData?.user?.id;
        if (!userError && userId) {
          await supabase.from('profiles').update({ quiz_score: score, quiz_badge: badge }).eq('id', userId);
          await supabase.from('quiz_results').insert({
            user_id: userId,
            quiz_title: categoryTitle,
            difficulty,
            score,
            badge,
            answers: finalAnswers,
            review_data: reviewData,
          });
        }
      } catch (e) {
        console.error('❌ Supabase save error:', e?.message || e);
      } finally {
        setUploading(false);
        navigation.navigate('ResultSummary', {
          reviewData,
          quizTitle: categoryTitle,
          scorePercent: Math.round((correctCnt / totalQuestions) * 100),
          xp: xpEarned,
          // legacy
          score,
          userAnswers: finalAnswers,
          difficulty,
        });
      }
    })();
  };

  const barColor = progressAnim.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: ['#EF4444', '#F59E0B', '#10B981'],
  });

  if (!current) {
    return (
      <View style={c.uploadOverlay}>
        <Text style={c.uploadText}>Loading…</Text>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  const optionStyle = (idx) => {
    if (!submitted) return selected === idx ? [g.option, g.optionSelected] : g.option;
    if (idx === current.correctIndex) return [g.option, g.optionCorrect];
    if (selected === idx && idx !== current.correctIndex) return [g.option, g.optionWrong];
    return g.option;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <ScrollView contentContainerStyle={g.container}>
        {/* Header row inside the screen (hint + counter). Back is native header */}
        <View style={g.header}>
          <View style={g.counterPill}>
            <Ionicons name="help-circle-outline" size={14} color="#4F46E5" />
            <Text style={g.counterText}>{index + 1}/{quizzes.length}</Text>
          </View>
          <TouchableOpacity onPress={handleHint} disabled={usedHint} style={{ opacity: usedHint ? 0.4 : 1 }}>
            <Ionicons name="bulb-outline" size={22} color="#4F46E5" />
          </TouchableOpacity>
        </View>

        <View style={g.questionCard}>
          <Text style={g.questionText}>{current.question}</Text>
        </View>

        {/* Timer */}
        <View style={g.timerRow}>
          <View style={g.timerContainer}>
            <Animated.View
              style={[
                g.timerBar,
                {
                  width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                  backgroundColor: barColor,
                  opacity: isFlashing ? flashAnim : 1,
                },
              ]}
            />
          </View>
          <Animated.View style={g.timeBadge}>
            <Ionicons name="time-outline" size={14} color="#111827" />
            <Animated.Text style={[g.timerText, { color: barColor, opacity: isFlashing ? flashAnim : 1 }]}>
              {remainingTime}s
            </Animated.Text>
          </Animated.View>
        </View>

        {/* Options */}
        {current.options.map((opt, idx) => {
          if (opt === eliminatedOption) return null;
          const isSelected = selected === idx;
          const isCorrect = submitted && idx === current.correctIndex;
          const isWrong = submitted && isSelected && !isCorrect;

          const iconName = !submitted ? (isSelected ? 'radio-button-on' : 'ellipse-outline')
            : isCorrect ? 'checkmark-circle' : isWrong ? 'close-circle' : 'ellipse-outline';
          const iconColor = !submitted ? (isSelected ? '#4F46E5' : '#9CA3AF')
            : isCorrect ? '#10B981' : isWrong ? '#EF4444' : '#9CA3AF';

          return (
            <TouchableOpacity
              key={idx}
              style={optionStyle(idx)}
              onPress={() => !submitted && setSelected(idx)}
              disabled={submitted}
              activeOpacity={0.9}
            >
              <View style={{ flexDirection:'row', alignItems:'center' }}>
                <Ionicons name={iconName} size={20} color={iconColor} style={{ marginRight: 10 }} />
                <Text style={g.optionText}>{String.fromCharCode(65 + idx)}. {opt}</Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* XP + Submit */}
        <View style={{ marginTop: 8, alignItems: 'center' }}>
          {submitted
            ? <Text style={[g.xpText, { color: earnedXP > 0 ? '#059669' : '#DC2626' }]}>
                {earnedXP > 0 ? `+${earnedXP} XP` : 'No XP earned'}{usedHint && earnedXP > 0 ? ' (halved by hint)' : ''}
              </Text>
            : <Text style={g.totalXPText}>Total XP: {totalXP}</Text>
          }
        </View>

        <TouchableOpacity
          style={[g.submitButton, !selected && !submitted ? g.submitDisabled : null]}
          onPress={onSubmit}
          disabled={submitted || selected === null}
          activeOpacity={0.9}
        >
          <Text style={g.submitText}>{submitted ? 'Submitted' : 'Submit'}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Explanation modal */}
      <Modal visible={showExplanation} transparent animationType="fade">
        <View style={g.modalOverlay}>
          <View style={g.modalBox}>
            <Text style={g.modalTitle}>
              {selected === current.correctIndex ? '✅ Correct' : selected === null ? '⏰ Time Up' : '❌ Incorrect'}
            </Text>
            <Text style={g.modalExplanation}>{current.explanation}</Text>
            <TouchableOpacity onPress={goNext} style={g.modalButton}>
              <Text style={g.modalButtonText}>{index + 1 < quizzes.length ? 'Next Question' : 'Finish'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {uploading && (
        <View style={c.uploadOverlay}>
          <Text style={c.uploadText}>Saving results…</Text>
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      )}
    </SafeAreaView>
  );
}

const g = StyleSheet.create({
  container: { padding:16, backgroundColor:'#F8FAFC', flexGrow:1 },
  header: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:12 },
  counterPill: {
    flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:10, paddingVertical:6,
    backgroundColor:'#EEF2FF', borderRadius:999, borderWidth:1, borderColor:'#C7D2FE',
  },
  counterText: { color:'#1F2937', fontWeight:'700', fontSize:12 },
  questionCard: {
    backgroundColor:'#FFFFFF', borderRadius:14, padding:18, marginBottom:12,
    borderWidth:1, borderColor:'#E5E7EB', shadowColor:'#000', shadowOpacity:0.04, shadowRadius:8,
    shadowOffset:{ width:0, height:4 }, elevation:1,
  },
  questionText: { color:'#111827', fontSize:18, fontWeight:'700', textAlign:'center' },
  timerRow: {
    flexDirection:'row', alignItems:'center', marginBottom:14, padding:6,
    borderWidth:1, borderColor:'#E5E7EB', borderRadius:999, backgroundColor:'#FFFFFF',
  },
  timerContainer: { flex:1, height:10, backgroundColor:'#F3F4F6', borderRadius:999, overflow:'hidden', marginRight:10 },
  timerBar: { height:'100%', borderRadius:999 },
  timeBadge: {
    flexDirection:'row', alignItems:'center', gap:6, backgroundColor:'#F3F4F6', borderRadius:999,
    paddingHorizontal:10, paddingVertical:4, borderWidth:1, borderColor:'#E5E7EB',
  },
  timerText: { fontSize:12, fontWeight:'800' },
  option: {
    backgroundColor:'#FFFFFF', borderColor:'#E5E7EB', borderWidth:1, padding:14, borderRadius:12, marginBottom:10,
    shadowColor:'#000', shadowOpacity:0.03, shadowRadius:6, shadowOffset:{ width:0, height:3 }, elevation:1,
  },
  optionSelected: { borderColor:'#6366F1', backgroundColor:'#EEF2FF' },
  optionCorrect: { backgroundColor:'#ECFDF5', borderColor:'#10B981' },
  optionWrong: { backgroundColor:'#FEF2F2', borderColor:'#EF4444' },
  optionText: { color:'#111827', fontSize:15, flex:1 },
  xpText: { fontSize:16, fontWeight:'700' },
  totalXPText: { fontSize:14, color:'#6B7280' },
  submitButton: {
    marginTop:12, backgroundColor:'#4F46E5', paddingVertical:14, borderRadius:12, alignItems:'center',
    shadowColor:'#000', shadowOpacity:0.06, shadowRadius:10, shadowOffset:{ width:0, height:6 }, elevation:2,
  },
  submitDisabled: { backgroundColor:'#9CA3AF' },
  submitText: { color:'#FFFFFF', fontWeight:'800', fontSize:16 },
  modalOverlay: { flex:1, backgroundColor:'rgba(0,0,0,0.25)', justifyContent:'center', alignItems:'center', padding:24 },
  modalBox: { width:'100%', backgroundColor:'#FFFFFF', borderRadius:16, padding:18, borderWidth:1, borderColor:'#E5E7EB' },
  modalTitle: { fontSize:18, fontWeight:'800', marginBottom:8, color:'#111827' },
  modalExplanation: { fontSize:15, color:'#374151', marginBottom:14 },
  modalButton: { backgroundColor:'#4F46E5', paddingVertical:12, borderRadius:10, alignItems:'center' },
  modalButtonText: { color:'#fff', fontWeight:'800' },
});

const c = StyleSheet.create({
  uploadOverlay: { ...StyleSheet.absoluteFillObject, alignItems:'center', justifyContent:'center', backgroundColor:'rgba(255,255,255,0.92)', padding:24 },
  uploadText: { fontSize:16, color:'#374151', marginBottom:12, fontWeight:'600' },
});
