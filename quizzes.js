// quizzes.js
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

export const quizSets = {
  easy: [
    {
      question: 'What should you do first during a flash flood?',
      options: ['Evacuate immediately', 'Take a selfie', 'Call your neighbor'],
      correctIndex: 0,
      explanation: 'Evacuating immediately helps you avoid dangerous rising waters.'
    },
    {
      question: 'Which area should be avoided?',
      options: ['Low-lying areas', 'High ground', 'Evacuation center'],
      correctIndex: 0,
      explanation: 'Low-lying areas flood quickly and are dangerous.'
    },
    {
      question: 'Who should you follow for updates during a flood?',
      options: ['Social media influencers', 'Official government sources', 'Friends group chat'],
      correctIndex: 1,
      explanation: 'Government sources provide reliable and verified information.'
    },
    {
      question: 'What should you do if you see water rising around your car?',
      options: ['Stay in the car', 'Drive faster', 'Abandon the car and move to higher ground'],
      correctIndex: 2,
      explanation: 'It’s safer to leave the car and reach higher ground quickly.'
    },
    {
      question: 'What should you pack in a basic flood emergency kit?',
      options: ['Board games', 'Flashlight, food, water', 'Sunglasses'],
      correctIndex: 1,
      explanation: 'Essential items like flashlight, food, and water help you survive emergencies.'
    }
  ],
  medium: [
    {
      question: 'What is the minimum emergency supply duration?',
      options: ['1 day', '3 days', '7 days'],
      correctIndex: 1,
      explanation: '3 days is recommended for basic survival during disasters.'
    },
    {
      question: 'Which of these belongs in a flood kit?',
      options: ['Toothbrush', 'Flashlight and batteries', 'Passport only'],
      correctIndex: 1,
      explanation: 'Flashlight and batteries help during power outages.'
    },
    {
      question: 'Why is bottled water important in emergencies?',
      options: ['For cleaning wounds', 'Safe drinking water may be unavailable', 'It tastes better'],
      correctIndex: 1,
      explanation: 'Tap water may be contaminated during floods.'
    },
    {
      question: 'When should you turn off electricity during a flood?',
      options: ['When water enters your home', 'Only if it’s a power outage', 'After it floods completely'],
      correctIndex: 0,
      explanation: 'Turning off electricity prevents electrocution.'
    },
    {
      question: 'How often should you check for weather alerts in flood-prone areas?',
      options: ['Once a month', 'When it rains', 'Regularly and during heavy rain'],
      correctIndex: 2,
      explanation: 'Frequent checks help you act early and stay informed.'
    }
  ],
  hard: [
    {
      question: 'Best time to evacuate during flood warnings?',
      options: ['Before flooding starts', 'After water rises', 'At night'],
      correctIndex: 0,
      explanation: 'Evacuating early reduces risk and gives more time to plan.'
    },
    {
      question: 'What is flash flood mainly caused by?',
      options: ['Sudden rainfall', 'Sunny weather', 'Windy conditions'],
      correctIndex: 0,
      explanation: 'Flash floods occur due to sudden, intense rainfall.'
    },
    {
      question: 'What should you do if trapped in a building during a flood?',
      options: ['Go to the roof and signal for help', 'Wait in the basement', 'Open windows wide'],
      correctIndex: 0,
      explanation: 'The roof provides safety and visibility for rescuers.'
    },
    {
      question: 'What is a major danger of walking through floodwater?',
      options: ['Getting wet', 'Debris and open manholes', 'Sunburn'],
      correctIndex: 1,
      explanation: 'Floodwater may conceal dangerous debris and open drains.'
    },
    {
      question: 'Why should you avoid using elevators during floods?',
      options: ['They are slow', 'They may malfunction and trap you', 'They use electricity'],
      correctIndex: 1,
      explanation: 'Elevators can fail during floods and trap occupants.'
    }
  ],
};

const pointsPerDifficulty = {
  easy: 5,
  medium: 10,
  hard: 20,
};

export default function Quiz() {
  const navigation = useNavigation();
  const [difficulty, setDifficulty] = useState(null);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState(0);
  const [userAnswers, setUserAnswers] = useState([]);
  const [uploading, setUploading] = useState(false);

  if (!difficulty) {
    return (
      <View style={styles.levelContainer}>
        <Text style={styles.selectTitle}>🎮 Select Difficulty</Text>
        {['easy', 'medium', 'hard'].map((level) => (
          <TouchableOpacity
            key={level}
            style={styles.levelButton}
            onPress={() => setDifficulty(level)}
          >
            <Text style={styles.levelText}>{level.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  const quizzes = quizSets[difficulty];
  const current = quizzes[index];

  const handleSelect = (idx) => {
    setSelected(idx);
    setUserAnswers([...userAnswers, idx]);
    if (idx === current.correctIndex) {
      setScore(score + pointsPerDifficulty[difficulty]);
    }
    setShowExplanation(true);
  };

  const next = async () => {
    setShowExplanation(false);

    setTimeout(async () => {
      const finalAnswers = [...userAnswers];
      finalAnswers[index] = selected;

      const correct = selected === current.correctIndex;
      const newScore = score + (correct ? pointsPerDifficulty[difficulty] : 0);
      setScore(newScore);

      // ✅ Move to next question if available
      if (index + 1 < quizzes.length) {
        setIndex(index + 1);
        setSelected(null);
        return;
      }

      const badge = getBadge(newScore);
      setUploading(true);

      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user?.id) {
          console.error('User not authenticated:', userError?.message);
          return;
        }

        await supabase
          .from('profiles')
          .update({
            quiz_score: newScore,
            quiz_badge: badge,
          })
          .eq('id', userData.user.id);

        await supabase.from('quiz_results').insert({
          user_id: userData.user.id,
          quiz_title: `Disaster Quiz`,
          difficulty,
          score: newScore,
          badge,
          answers: finalAnswers,
        });

        navigation.navigate('Result', {
          score: newScore,
          userAnswers: finalAnswers,
          quizzes,
        });

        // ✅ Reset after completion
        setIndex(0);
        setScore(0);
        setUserAnswers([]);
        setDifficulty(null);
      } catch (err) {
        console.error('❌ Supabase save error:', err.message);
      } finally {
        setUploading(false);
      }
    }, 300);
  };

  const getBadge = (score) => {
    if (score >= 30) return '🥇 Gold';
    if (score >= 20) return '🥈 Silver';
    if (score >= 10) return '🥉 Bronze';
    return '🚫 None';
  };

  if (uploading) {
    return (
      <View style={styles.uploadOverlay}>
        <Text style={styles.uploadText}>Saving Results...</Text>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.questionBox}>
        <Text style={styles.questionText}>{current.question}</Text>
      </View>
      {current.options.map((opt, idx) => (
        <TouchableOpacity
          key={idx}
          style={[styles.option, selected === idx && styles.selectedOption]}
          onPress={() => handleSelect(idx)}
          disabled={selected !== null}
        >
          <Text style={styles.optionText}>{String.fromCharCode(65 + idx)}. {opt}</Text>
        </TouchableOpacity>
      ))}
      <Modal visible={showExplanation} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              {selected === current.correctIndex ? '✅ Correct Answer' : '❌ Incorrect Answer'}
            </Text>
            <Text style={styles.modalExplanation}>{current.explanation}</Text>
            <TouchableOpacity onPress={next} style={styles.modalButton}>
              <Text style={styles.modalButtonText}>Next</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  levelContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fafafa',
  },
  selectTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 30,
  },
  levelButton: {
    padding: 15,
    backgroundColor: '#1976D2',
    borderRadius: 10,
    marginVertical: 10,
    width: 200,
    alignItems: 'center',
  },
  levelText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  container: {
    padding: 20,
    backgroundColor: '#fcfbf9',
    flexGrow: 1,
    justifyContent: 'center',
  },
  questionBox: {
    backgroundColor: '#e0e0e0',
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  questionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  option: {
    backgroundColor: '#f9f9f9',
    borderColor: '#ddd',
    borderWidth: 1,
    padding: 14,
    borderRadius: 10,
    marginBottom: 12,
  },
  selectedOption: {
    backgroundColor: '#c8e6c9',
    borderColor: '#66bb6a',
  },
  optionText: {
    fontSize: 15,
    color: '#444',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  modalBox: {
    width: '80%',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
  },
  modalExplanation: {
    fontSize: 15,
    color: '#555',
    marginBottom: 20,
  },
  modalButton: {
    backgroundColor: '#66bb6a',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
