// MainNavigator.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import HomeScreen from './homePage';
import QuizzesScreen from './quizzes';
import resultScreen from './resultScreen';
import ResultSummary from './resultSummary';
import { LogoHeader } from './drawerapp';
import Settings from './settings';
import Checklist from './checklist';
import ResourceHub from './resourceHub';
import ResourceArticle from './resourceArticle';
import CertificatesScreen from './CertificatesScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName;
          switch (route.name) {
            case 'Home': iconName = 'home'; break;
            case 'Quizzes': iconName = 'game-controller'; break;
            case 'Result': iconName = 'stats-chart'; break;
            case 'Assistant': iconName = 'chatbubbles'; break;
            case 'Resource': iconName = 'medkit'; break;
            case 'Settings': iconName = 'settings'; break;
            default: iconName = 'apps';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#6366F1',
        tabBarInactiveTintColor: 'gray',
        headerTitleAlign: 'center',
        headerLeft: () => <LogoHeader />,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Quizzes" component={QuizzesScreen} />
      <Tab.Screen name="Result" component={resultScreen} />
      <Tab.Screen
        name="Resource"
        component={ResourceHub}
        options={{ headerTitle: 'Resource Hub' }}
      />
      <Tab.Screen name="Settings" component={Settings} />
    </Tab.Navigator>
  );
}

export default function MainNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={TabNavigator} />
      <Stack.Screen
        name="ResultSummary"
        component={ResultSummary}
        options={{ headerShown: true, headerTitle: 'Quiz Summary', headerTitleAlign: 'center' }}
      />
      <Stack.Screen
        name="Checklist"
        component={Checklist}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ResourceArticle"
        component={ResourceArticle}
        options={{
          headerShown: true,
          headerTitleAlign: 'center',
          headerTitle: 'Guide',
        }}
      />
      <Stack.Screen
        name="Certificates"
        component={CertificatesScreen}
        options={{
          headerShown: true,
          headerTitle: 'Certificates',
          headerTitleAlign: 'center',
        }}
      />
    </Stack.Navigator>
  );
}
