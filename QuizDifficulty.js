// QuizDifficulty.js — separate screen so the native header back appears
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

const pointsPerDifficulty = { easy: 5, medium: 10, hard: 20 };
const durationByDifficulty = { easy: 60, medium: 45, hard: 30 };

export default function QuizDifficulty() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const topicId = params?.topicId;
  const topicTitle = params?.topicTitle ?? 'Select Difficulty';
  const isDaily = params?.isDaily;

  React.useLayoutEffect(() => {
    navigation.setOptions({ headerShown: true, title: topicTitle, headerTitleAlign: 'center' });
  }, [navigation, topicTitle]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <View style={s.levelContainer}>
        <Text style={s.selectTitle}>{topicTitle} • Select Difficulty</Text>

        {['easy','medium','hard'].map((lvl) => (
          <TouchableOpacity
            key={lvl}
            style={s.levelButton}
            onPress={() => navigation.navigate('QuizGame', { topicId, topicTitle, difficulty: lvl, isDaily })}
          >
            <View style={{ flexDirection:'row', alignItems:'center' }}>
              <Ionicons
                name={lvl === 'easy' ? 'leaf-outline' : lvl === 'medium' ? 'speedometer-outline' : 'flame-outline'}
                size={18}
                color={lvl === 'hard' ? '#DC2626' : '#4F46E5'}
                style={{ marginRight: 8 }}
              />
              <Text style={s.levelText}>{lvl.toUpperCase()}</Text>
            </View>
            <Text style={s.levelSub}>
              {durationByDifficulty[lvl]}s • {pointsPerDifficulty[lvl]} pts / correct
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  levelContainer: { flex:1, justifyContent:'flex-start', alignItems:'center', padding:20 },
  selectTitle: { fontSize:20, fontWeight:'800', marginBottom:12, color:'#111827', textAlign:'center' },
  levelButton: {
    width: 320, backgroundColor:'#FFFFFF', borderColor:'#E5E7EB', borderWidth:1,
    paddingVertical:14, paddingHorizontal:16, borderRadius:14, marginVertical:8, alignItems:'center',
    shadowColor:'#000', shadowOpacity:0.04, shadowRadius:8, shadowOffset:{ width:0, height:4 }, elevation:1,
  },
  levelText: { color:'#111827', fontSize:16, fontWeight:'800' },
  levelSub:  { color:'#6B7280', marginTop:4 },
});
