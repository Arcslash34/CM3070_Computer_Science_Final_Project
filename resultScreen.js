// resultScreen.js
import React, { useCallback, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { supabase } from './supabase';

export default function ResultScreen() {
  const [results, setResults] = useState([]);
  const navigation = useNavigation();

  const loadResults = async () => {
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;
    if (!userId) return;

    const { data, error } = await supabase
      .from('quiz_results')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (!error) {
      setResults(data || []);
    } else {
      console.error('Failed to fetch quiz results:', error.message);
    }
  };

  const handleDeleteAll = async () => {
    Alert.alert('Confirm', 'Delete all quiz results?', [
      { text: 'Cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { data: session } = await supabase.auth.getSession();
          const userId = session?.session?.user?.id;
          if (!userId) return;
          await supabase.from('quiz_results').delete().eq('user_id', userId);
          loadResults();
        },
      },
    ]);
  };

  const openSummary = (quiz) => {
    navigation.navigate('ResultSummary', {
      reviewData: quiz.review_data || quiz.answers, // prefer review_data; fallback to legacy indices
      quizTitle: quiz.quiz_title,
      scorePercent: quiz.score != null ? quiz.score : 0, // or compute if you stored percentage elsewhere
      xp: 0, // pass XP if/when you store it per attempt
      // legacy props (only used if review_data is missing and you still rely on old view)
      userAnswers: quiz.answers,
      difficulty: quiz.difficulty,
      score: quiz.score,
    });
  };

  useFocusEffect(
    useCallback(() => {
      loadResults();
    }, [])
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>📚 Past Quiz Results</Text>

      {results.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyBig}>No past quizzes yet</Text>
          <Text style={styles.emptySmall}>
            Complete a quiz and your results will appear here.
          </Text>
        </View>
      ) : (
        <>
          {results.map((r) => (
            <TouchableOpacity
              key={r.id}
              onPress={() => openSummary(r)}
              style={styles.item}
            >
              <Text style={styles.titleText}>{r.quiz_title}</Text>
              <Text style={styles.meta}>
                Score: {r.score} • Difficulty: {r.difficulty} • {r.badge}
              </Text>
              <Text style={styles.date}>
                {new Date(r.created_at).toLocaleString()}
              </Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity onPress={handleDeleteAll} style={styles.deleteBtn}>
            <Text style={styles.deleteText}>🗑️ Clear All Results</Text>
          </TouchableOpacity>
        </>
      )}
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
  },
  item: {
    width: '100%',
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#f1f1f1',
    marginBottom: 15,
  },
  titleText: {
    fontSize: 16,
    fontWeight: '600',
  },
  meta: {
    color: '#444',
    fontSize: 14,
    marginTop: 4,
  },
  date: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  deleteBtn: {
    marginTop: 20,
    backgroundColor: '#e53935',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
  },
  deleteText: {
    color: '#fff',
    fontWeight: '600',
  },
  emptyBox: {
    width: '100%',
    backgroundColor: '#f9f9f9',
    borderColor: '#e5e7eb',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 30,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 40,
  },
  emptyBig: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  emptySmall: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
});
