import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList } from 'react-native';

export default function ResultSummary({ route }) {
  const {
    reviewData,
    quizTitle = 'Quiz Review',
    scorePercent = 0,
    xp = 0,
    // legacy
    score = 0,
    userAnswers = [],
    difficulty,
  } = route.params || {};

  const parsed = useMemo(() => {
    if (!reviewData) return null;
    try {
      if (Array.isArray(reviewData)) return reviewData;
      if (typeof reviewData === 'string') return JSON.parse(reviewData);
      if (Array.isArray(reviewData?.review_data)) return reviewData.review_data;
      if (typeof reviewData?.review_data === 'string') return JSON.parse(reviewData.review_data);
      return null;
    } catch (e) {
      console.warn('Failed to parse reviewData:', e?.message);
      return null;
    }
  }, [reviewData]);

  // If you still want legacy fallback, keep your old quizSets mapping here if needed.
  const legacyQuizzes = useMemo(() => {
    if (parsed) return [];
    // const qs = (quizSets && quizSets[difficulty]) || [];
    const qs = []; // <- keep or restore your quizSets lookup
    return qs;
  }, [parsed]);

  const hasNewData = Array.isArray(parsed) && parsed.length > 0;
  const headerScore = hasNewData ? scorePercent : score;

  const renderNewItem = ({ item }) => {
    let borderColor = '#10B981';
    if (item.status === 'incorrect') borderColor = '#EF4444';
    else if (item.status === 'unanswered') borderColor = '#7C3AED';

    return (
      <View style={[styles.card, { borderLeftColor: borderColor }]}>
        <Text style={styles.qNumber}>Q{item.number}</Text>
        <Text style={styles.question}>{item.question}</Text>

        {item.status === 'incorrect' && <Text style={styles.incorrect}>Wrong Answer</Text>}
        {item.status === 'unanswered' && <Text style={styles.unanswered}>Time’s up, No Answer Selected</Text>}

        <Text style={styles.correct}>Correct Answer: {item.correctAnswer}</Text>
        <Text style={styles.answer}>Your Answer: {item.selectedAnswer || '—'}</Text>
      </View>
    );
  };

  // ---- NEW: avoid FlatList inside ScrollView ----
  if (hasNewData) {
    return (
      <FlatList
        data={parsed}
        keyExtractor={(_, idx) => String(idx)}
        renderItem={renderNewItem}
        contentContainerStyle={{ paddingBottom: 20, backgroundColor: '#F9FAFB' }}
        ListHeaderComponent={
          <View style={{ paddingTop: 12, paddingHorizontal: 16 }}>
            <Text style={styles.category}>{quizTitle}</Text>
            <Text style={styles.subheader}>Score: {headerScore}% | XP: {xp}</Text>
          </View>
        }
      />
    );
  }

  // Legacy path: use ONLY a ScrollView (no FlatList inside)
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.category}>{quizTitle}</Text>
      <Text style={styles.subheader}>Score: {headerScore}% | XP: {xp}</Text>

      {!legacyQuizzes.length ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <Text>Nothing to show. (Unknown difficulty or quiz list missing.)</Text>
        </View>
      ) : (
        <>
          {legacyQuizzes.map((q, idx) => {
            const userAns = userAnswers[idx];
            const isCorrect = userAns === q.correctIndex;

            return (
              <View key={idx} style={styles.legacyBlock}>
                <Text style={styles.questionNum}>Question {idx + 1} of {legacyQuizzes.length}</Text>
                <Text style={styles.questionLegacy}>{q.question}</Text>

                <View style={styles.answerContainer}>
                  <Text style={[styles.answerLabel, isCorrect ? styles.legacyCorrect : styles.legacyIncorrect]}>
                    {isCorrect ? '✅ Correct' : '❌ Incorrect'}
                  </Text>
                  <Text style={styles.detailText}>🧠 You answered: {q.options[userAns] ?? 'No Answer'}</Text>
                  <Text style={styles.detailText}>✅ Correct answer: {q.options[q.correctIndex]}</Text>
                  <Text style={styles.explanation}>💡 {q.explanation}</Text>
                </View>
              </View>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 16, backgroundColor: '#F9FAFB', flexGrow: 1 },
  category: { color: '#374151', fontSize: 20, paddingHorizontal: 16, marginTop: 12, fontWeight: '600' },
  subheader: { color: '#6B7280', fontSize: 14, marginBottom: 10, paddingHorizontal: 16 },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    marginBottom: 14,
    padding: 14,
    borderLeftWidth: 5,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    marginHorizontal: 16,
  },
  qNumber: { color: '#6B7280', fontWeight: 'bold', marginBottom: 4 },
  question: { color: '#111827', marginBottom: 6, fontWeight: '600' },
  correct: { color: '#059669', fontWeight: 'bold' },
  answer: { color: '#374151', marginTop: 4 },
  incorrect: { color: '#DC2626', fontWeight: 'bold' },
  unanswered: { color: '#7C3AED', fontWeight: 'bold' },

  legacyBlock: {
    marginBottom: 25,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginHorizontal: 16,
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
  },
  questionNum: { fontSize: 14, color: '#6B7280', marginBottom: 4 },
  questionLegacy: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 8 },
  answerContainer: { marginLeft: 6 },
  answerLabel: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  legacyCorrect: { color: '#059669' },
  legacyIncorrect: { color: '#DC2626' },
  detailText: { fontSize: 15, marginBottom: 3, color: '#374151' },
  explanation: { fontSize: 14, fontStyle: 'italic', color: '#6B7280', marginTop: 6 },
});
