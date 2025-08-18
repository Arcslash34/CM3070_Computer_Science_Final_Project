// ResultSummary.js
import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { quizSets } from './quizzes';

export default function ResultSummary({ route }) {
  const { score = 0, userAnswers = [], difficulty } = route.params || {};
  const quizzes = (quizSets && quizSets[difficulty]) || [];

  if (!quizzes.length) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <Text>Nothing to show. (Unknown difficulty or quiz list missing.)</Text>
      </View>
    );
  }

  const getBadge = () => {
    if (score >= 30) return '🥇 Gold';
    if (score >= 20) return '🥈 Silver';
    if (score >= 10) return '🥉 Bronze';
    return '🚫 None';
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>📊 Quiz Summary</Text>
      <Text style={styles.result}>🎯 Score: {score}</Text>
      <Text style={styles.badge}>🏅 Badge: {getBadge()}</Text>

      {quizzes.map((q, idx) => {
        const userAns = userAnswers[idx];
        const isCorrect = userAns === q.correctIndex;

        return (
          <View key={idx} style={styles.block}>
            <Text style={styles.questionNum}>Question {idx + 1} of {quizzes.length}</Text>
            <Text style={styles.questionText}>{q.question}</Text>

            <View style={styles.answerContainer}>
              <Text style={[styles.answerLabel, isCorrect ? styles.correct : styles.incorrect]}>
                {isCorrect ? '✅ Correct' : '❌ Incorrect'}
              </Text>
              <Text style={styles.detailText}>
                🧠 You answered: {q.options[userAns] ?? 'No Answer'}
              </Text>
              <Text style={styles.detailText}>
                ✅ Correct answer: {q.options[q.correctIndex]}
              </Text>
              <Text style={styles.explanation}>
                💡 {q.explanation}
              </Text>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#fff',
    flexGrow: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  result: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 10,
  },
  badge: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  block: {
    marginBottom: 25,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    width: '100%',
  },
  questionNum: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  questionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
    marginBottom: 8,
  },
  answerContainer: {
    marginLeft: 10,
  },
  answerLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  correct: { color: '#2e7d32' },
  incorrect: { color: '#c62828' },
  detailText: {
    fontSize: 15,
    marginBottom: 3,
    color: '#444',
  },
  explanation: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#555',
    marginTop: 6,
  },
});
