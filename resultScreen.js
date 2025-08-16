// resultScreen.js
import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { supabase } from './supabase';
import { useNavigation } from '@react-navigation/native';

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
      setResults(data);
    } else {
      console.error('Failed to fetch quiz results:', error.message);
    }
  };

  const handleDeleteAll = async () => {
    Alert.alert('Confirm', 'Delete all quiz results?', [
      { text: 'Cancel' },
      {
        text: 'Delete',
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
      score: quiz.score,
      badge: quiz.badge,
      userAnswers: quiz.answers,
      difficulty: quiz.difficulty,
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

      {results.map((r, idx) => (
        <TouchableOpacity key={r.id} onPress={() => openSummary(r)} style={styles.item}>
          <Text style={styles.titleText}>{r.quiz_title}</Text>
          <Text style={styles.meta}>
            Score: {r.score} • Difficulty: {r.difficulty} • {r.badge}
          </Text>
          <Text style={styles.date}>{new Date(r.created_at).toLocaleString()}</Text>
        </TouchableOpacity>
      ))}

      {results.length > 0 && (
        <TouchableOpacity onPress={handleDeleteAll} style={styles.deleteBtn}>
          <Text style={styles.deleteText}>🗑️ Clear All Results</Text>
        </TouchableOpacity>
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
});
