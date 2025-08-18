// quizzes.js
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from './supabase';

/* -------------------------------------------------------------------
   Hardcoded quiz sets (exported so ResultSummary can import them)
------------------------------------------------------------------- */
export const quizSets = {
  easy: [
    {
      question: 'What should you do first during a flash flood?',
      options: ['Evacuate immediately', 'Take a selfie', 'Call your neighbor'],
      correctIndex: 0,
      explanation: 'Evacuating immediately helps you avoid dangerous rising waters.',
    },
    {
      question: 'Which area should be avoided?',
      options: ['Low-lying areas', 'High ground', 'Evacuation center'],
      correctIndex: 0,
      explanation: 'Low-lying areas flood quickly and are dangerous.',
    },
    {
      question: 'Who should you follow for updates during a flood?',
      options: ['Social media influencers', 'Official government sources', 'Friends group chat'],
      correctIndex: 1,
      explanation: 'Government sources provide reliable and verified information.',
    },
    {
      question: 'What should you do if you see water rising around your car?',
      options: ['Stay in the car', 'Drive faster', 'Abandon the car and move to higher ground'],
      correctIndex: 2,
      explanation: 'It’s safer to leave the car and reach higher ground quickly.',
    },
    {
      question: 'What should you pack in a basic flood emergency kit?',
      options: ['Board games', 'Flashlight, food, water', 'Sunglasses'],
      correctIndex: 1,
      explanation: 'Essential items like flashlight, food, and water help you survive emergencies.',
    },
  ],
  medium: [
    {
      question: 'What is the minimum emergency supply duration?',
      options: ['1 day', '3 days', '7 days'],
      correctIndex: 1,
      explanation: '3 days is recommended for basic survival during disasters.',
    },
    {
      question: 'Which of these belongs in a flood kit?',
      options: ['Toothbrush', 'Flashlight and batteries', 'Passport only'],
      correctIndex: 1,
      explanation: 'Flashlight and batteries help during power outages.',
    },
    {
      question: 'Why is bottled water important in emergencies?',
      options: ['For cleaning wounds', 'Safe drinking water may be unavailable', 'It tastes better'],
      correctIndex: 1,
      explanation: 'Tap water may be contaminated during floods.',
    },
    {
      question: 'When should you turn off electricity during a flood?',
      options: ['When water enters your home', 'Only if it’s a power outage', 'After it floods completely'],
      correctIndex: 0,
      explanation: 'Turning off electricity prevents electrocution.',
    },
    {
      question: 'How often should you check for weather alerts in flood-prone areas?',
      options: ['Once a month', 'When it rains', 'Regularly and during heavy rain'],
      correctIndex: 2,
      explanation: 'Frequent checks help you act early and stay informed.',
    },
  ],
  hard: [
    {
      question: 'Best time to evacuate during flood warnings?',
      options: ['Before flooding starts', 'After water rises', 'At night'],
      correctIndex: 0,
      explanation: 'Evacuating early reduces risk and gives more time to plan.',
    },
    {
      question: 'What is flash flood mainly caused by?',
      options: ['Sudden rainfall', 'Sunny weather', 'Windy conditions'],
      correctIndex: 0,
      explanation: 'Flash floods occur due to sudden, intense rainfall.',
    },
    {
      question: 'What should you do if trapped in a building during a flood?',
      options: ['Go to the roof and signal for help', 'Wait in the basement', 'Open windows wide'],
      correctIndex: 0,
      explanation: 'The roof provides safety and visibility for rescuers.',
    },
    {
      question: 'What is a major danger of walking through floodwater?',
      options: ['Getting wet', 'Debris and open manholes', 'Sunburn'],
      correctIndex: 1,
      explanation: 'Floodwater may conceal dangerous debris and open drains.',
    },
    {
      question: 'Why should you avoid using elevators during floods?',
      options: ['They are slow', 'They may malfunction and trap you', 'They use electricity'],
      correctIndex: 1,
      explanation: 'Elevators can fail during floods and trap occupants.',
    },
  ],
};

const pointsPerDifficulty = { easy: 5, medium: 10, hard: 20 };
const durationByDifficulty = { easy: 60, medium: 45, hard: 30 };

const getBadge = (score) => {
  if (score >= 30) return '🥇 Gold';
  if (score >= 20) return '🥈 Silver';
  if (score >= 10) return '🥉 Bronze';
  return '🚫 None';
};

/* -------------------------------------------------------------------
   Screen (single-file)
------------------------------------------------------------------- */
export default function Quiz() {
  const navigation = useNavigation();

  // Step 1: choose difficulty
  const [difficulty, setDifficulty] = useState(null);

  // Gameplay state
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  const [score, setScore] = useState(0);
  const [earnedXP, setEarnedXP] = useState(0);
  const [totalXP, setTotalXP] = useState(0);

  const [userAnswers, setUserAnswers] = useState([]); // record answers
  const [uploading, setUploading] = useState(false);  // saving overlay

  const [eliminatedOption, setEliminatedOption] = useState(null);
  const [usedHint, setUsedHint] = useState(false);

  const [remainingTime, setRemainingTime] = useState(60);
  const progressAnim = useRef(new Animated.Value(1)).current;
  const flashAnim = useRef(new Animated.Value(1)).current;

  // Derived
  const quizzes = useMemo(() => (difficulty ? quizSets[difficulty] : []), [difficulty]);
  const current = useMemo(() => quizzes[index], [quizzes, index]);
  const totalTime = useMemo(
    () => (difficulty ? durationByDifficulty[difficulty] : 60),
    [difficulty]
  );

  // Reset when difficulty chosen
  useEffect(() => {
    if (!difficulty) return;
    setIndex(0);
    setSelected(null);
    setSubmitted(false);
    setShowExplanation(false);
    setScore(0);
    setTotalXP(0);
    setEarnedXP(0);
    setEliminatedOption(null);
    setUsedHint(false);
    setRemainingTime(durationByDifficulty[difficulty]);
    setUserAnswers([]);
    setUploading(false);
  }, [difficulty]);

  // Timer + progress bar
  useEffect(() => {
    if (!difficulty || !current) return;

    progressAnim.setValue(1);
    Animated.timing(progressAnim, {
      toValue: 0,
      duration: totalTime * 1000,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();

    setRemainingTime(totalTime);
    const t = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev <= 1) {
          clearInterval(t);
          if (!submitted) onSubmit(true); // auto-submit time-up
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, difficulty]);

  // Flash when <= 10s
  const isFlashing = remainingTime <= 10 && !submitted;
  useEffect(() => {
    if (!isFlashing) {
      flashAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(flashAnim, { toValue: 0.2, duration: 300, useNativeDriver: true }),
        Animated.timing(flashAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isFlashing, flashAnim]);

  // Hint: remove one incorrect option
  const handleHint = () => {
    if (usedHint || !current) return;
    const incorrect = current.options
      .map((opt, i) => ({ opt, i }))
      .filter((o) => o.i !== current.correctIndex);
    const remove = incorrect[Math.floor(Math.random() * incorrect.length)];
    setEliminatedOption(remove.opt);
    setUsedHint(true);
  };

  // Submit logic
  const onSubmit = () => {
    if (!current || submitted) return;

    const correct = selected === current.correctIndex;
    const gained =
      selected == null
        ? 0
        : correct
        ? Math.floor((remainingTime / totalTime) * 100)
        : 0;
    const finalGained = usedHint ? Math.floor(gained / 2) : gained;

    setSubmitted(true);
    setEarnedXP(finalGained);
    setTotalXP((x) => x + finalGained);

    if (selected != null && correct) {
      setScore((s) => s + pointsPerDifficulty[difficulty]);
    }

    setShowExplanation(true);
  };

  // Next question or finish
  const goNext = () => {
    // record current question's answer (may be null if time-up)
    const nextAnswers = [...userAnswers];
    nextAnswers[index] = selected;
    setUserAnswers(nextAnswers);

    setShowExplanation(false);
    setSubmitted(false);
    setSelected(null);
    setEliminatedOption(null);
    setUsedHint(false);

    if (index + 1 < quizzes.length) {
      setIndex(index + 1);
      return;
    }

    // ----- FINISH: compute + save -----
    const totalQuestions = quizzes.length;
    const maxPossible = pointsPerDifficulty[difficulty] * totalQuestions;
    const finalAnswers = [...nextAnswers]; // ensure last answer included
    const badge = getBadge(score);

    (async () => {
      try {
        setUploading(true);

        const { data: userData, error: userError } = await supabase.auth.getUser();
        const userId = userData?.user?.id;

        if (userError || !userId) {
          console.warn('Not authenticated; skipping Supabase save.', userError?.message);
        } else {
          // Optional: keep a summary on profiles (ignore if you don’t have these cols)
          await supabase
            .from('profiles')
            .update({ quiz_score: score, quiz_badge: badge })
            .eq('id', userId);

          // Save to quiz_results (matches your schema)
          const { error: insertErr } = await supabase.from('quiz_results').insert({
            user_id: userId,
            quiz_title: 'Disaster Quiz',
            difficulty,
            score,
            badge,
            answers: finalAnswers, // jsonb array of indices
          });
          if (insertErr) console.error('Insert error:', insertErr.message);
        }
      } catch (e) {
        console.error('❌ Supabase save error:', e?.message || e);
      } finally {
        setUploading(false);

        // Go to results list (where you open a summary item)
        navigation.navigate('Result', {
          score,
          maxScore: maxPossible,
          xp: totalXP,
          difficulty,
          totalQuestions,
        });

        // Reset to difficulty selection for next time
        setDifficulty(null);
      }
    })();
  };

  // Leave confirmation while in quiz
  useEffect(() => {
    if (!difficulty) return;
    const unsub = navigation.addListener('beforeRemove', (e) => {
      if (!difficulty) return; // not in a running quiz
      e.preventDefault();
      Alert.alert('Exit Quiz?', 'Your progress will be lost.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Exit', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
      ]);
    });
    return () => unsub();
  }, [navigation, difficulty]);

  // LIGHT MODE colors
  const barColor = progressAnim.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: ['#EF4444', '#F59E0B', '#10B981'], // red → amber → green
  });

  /* -------------------------------------------------------------
     Difficulty selection screen
  ------------------------------------------------------------- */
  if (!difficulty) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFAFA' }}>
        <View style={styles.levelContainer}>
          <Text style={styles.selectTitle}>🎯 Select Difficulty</Text>
          {['easy', 'medium', 'hard'].map((lvl) => (
            <TouchableOpacity key={lvl} style={styles.levelButton} onPress={() => setDifficulty(lvl)}>
              <Text style={styles.levelText}>{lvl.toUpperCase()}</Text>
              <Text style={styles.levelSub}>
                {durationByDifficulty[lvl]}s • {pointsPerDifficulty[lvl]} pts per correct
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  if (!current) {
    return (
      <View style={styles.uploadOverlay}>
        <Text style={styles.uploadText}>Loading...</Text>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  // Option styling based on state
  const getOptionStyle = (idx) => {
    if (!submitted) {
      return selected === idx ? [styles.option, styles.optionSelected] : styles.option;
    }
    if (idx === current.correctIndex) {
      return [styles.option, styles.optionCorrect];
    }
    if (selected === idx && idx !== current.correctIndex) {
      return [styles.option, styles.optionWrong];
    }
    return styles.option;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header: back, progress, hint */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
        <Text style={styles.headerText}>
            {index + 1}/{quizzes.length}
          </Text>
          <TouchableOpacity onPress={handleHint} disabled={usedHint} style={{ opacity: usedHint ? 0.4 : 1 }}>
            <Ionicons name="bulb-outline" size={22} color="#6C63FF" />
          </TouchableOpacity>
        </View>

        {/* Question */}
        <View style={styles.questionBox}>
          <Text style={styles.questionText}>{current.question}</Text>
        </View>

        {/* Timer */}
        <View style={styles.timerRow}>
          <View style={styles.timerContainer}>
            <Animated.View
              style={[
                styles.timerBar,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                  backgroundColor: barColor,
                  opacity: isFlashing ? flashAnim : 1,
                },
              ]}
            />
          </View>
          <Animated.Text
            style={[
              styles.timerText,
              { color: barColor, opacity: isFlashing ? flashAnim : 1 },
            ]}
          >
            {remainingTime}s
          </Animated.Text>
        </View>

        {/* Options */}
        {current.options.map((opt, idx) => {
          if (opt === eliminatedOption) return null; // hidden by hint
          return (
            <TouchableOpacity
              key={idx}
              style={getOptionStyle(idx)}
              onPress={() => !submitted && setSelected(idx)}
              disabled={submitted}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons
                  name={
                    !submitted
                      ? selected === idx
                        ? 'radio-button-on'
                        : 'ellipse-outline'
                      : idx === current.correctIndex
                      ? 'checkmark-circle'
                      : selected === idx
                      ? 'close-circle'
                      : 'ellipse-outline'
                  }
                  size={20}
                  color={
                    !submitted
                      ? selected === idx
                        ? '#6C63FF'
                        : '#9CA3AF'
                      : idx === current.correctIndex
                      ? '#10B981'
                      : selected === idx
                      ? '#EF4444'
                      : '#9CA3AF'
                  }
                />
                <Text style={styles.optionText}>
                  {String.fromCharCode(65 + idx)}. {opt}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Footer: XP + Submit */}
        <View style={{ marginTop: 10, alignItems: 'center' }}>
          {submitted ? (
            <Text style={[styles.xpText, { color: earnedXP > 0 ? '#059669' : '#DC2626' }]}>
              {earnedXP > 0 ? `+${earnedXP} XP` : 'No XP earned'}
              {usedHint && earnedXP > 0 ? ' (halved by hint)' : ''}
            </Text>
          ) : (
            <Text style={styles.totalXPText}>Total XP: {totalXP}</Text>
          )}
        </View>

        <TouchableOpacity
          style={[styles.submitButton, !selected && !submitted ? styles.submitDisabled : null]}
          onPress={onSubmit}
          disabled={submitted || selected === null}
          activeOpacity={0.9}
        >
          <Text style={styles.submitText}>{submitted ? 'Submitted' : 'Submit'}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Explanation Modal */}
      <Modal visible={showExplanation} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              {selected === current.correctIndex ? '✅ Correct' : selected === null ? '⏰ Time Up' : '❌ Incorrect'}
            </Text>
            <Text style={styles.modalExplanation}>{current.explanation}</Text>
            <TouchableOpacity onPress={goNext} style={styles.modalButton}>
              <Text style={styles.modalButtonText}>
                {index + 1 < quizzes.length ? 'Next Question' : 'Finish'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Saving overlay */}
      {uploading && (
        <View style={styles.uploadOverlay}>
          <Text style={styles.uploadText}>Saving results...</Text>
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      )}
    </SafeAreaView>
  );
}

/* -------------------------------------------------------------------
   Styles (LIGHT MODE)
------------------------------------------------------------------- */
const styles = StyleSheet.create({
  levelContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    padding: 20,
  },
  selectTitle: { fontSize: 22, fontWeight: '800', marginBottom: 20, color: '#111827' },
  levelButton: {
    width: 260,
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginVertical: 8,
    alignItems: 'center',
  },
  levelText: { color: '#111827', fontSize: 16, fontWeight: '800' },
  levelSub: { color: '#6B7280', marginTop: 4 },

  container: { padding: 16, backgroundColor: '#FFFFFF', flexGrow: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerText: { color: '#111827', fontSize: 16, fontWeight: '600' },

  questionBox: {
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  questionText: { color: '#111827', fontSize: 18, fontWeight: '700', textAlign: 'center' },

  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    padding: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 999,
  },
  timerContainer: {
    flex: 1,
    height: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 999,
    overflow: 'hidden',
    marginRight: 10,
  },
  timerBar: { height: '100%', borderRadius: 999 },
  timerText: { fontSize: 14, fontWeight: '800' },

  option: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderWidth: 1,
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  optionSelected: {
    borderColor: '#6C63FF',
    backgroundColor: '#EEF2FF',
  },
  optionCorrect: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  optionWrong: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
  },
  optionText: { color: '#111827', fontSize: 15 },

  submitButton: {
    marginTop: 12,
    backgroundColor: '#6C63FF',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitDisabled: { backgroundColor: '#9CA3AF' },
  submitText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },

  xpText: { fontSize: 16, fontWeight: '700' },
  totalXPText: { fontSize: 14, color: '#6B7280' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBox: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8, color: '#111827' },
  modalExplanation: { fontSize: 15, color: '#374151', marginBottom: 14 },
  modalButton: {
    backgroundColor: '#6C63FF',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalButtonText: { color: '#fff', fontWeight: '800' },

  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    padding: 24,
  },
  uploadText: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 12,
    fontWeight: '600',
  },
});
