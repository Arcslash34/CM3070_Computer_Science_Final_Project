// mainNavigator.js — add new stack screens (and keep your tabs incl. Badges/Resource/Settings)
import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";

import HomeScreen from "./homePage";
import QuizzesHome from "./quizzes"; // NEW
import QuizSet from "./QuizSet"; // NEW
import QuizGame from "./QuizGame"; // NEW
import HistoryScreen from "./HistoryScreen";
import ResultSummary from "./resultSummary";
import { LogoHeader } from "./drawerapp";
import Settings from "./settings";
import ResourceHub from "./resourceHub";
import ResourceArticle from "./resourceArticle";
import CertificatesScreen from "./CertificatesScreen";
import BadgesScreen from "./badges";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          const icons = {
            Home: "home",
            Quizzes: "game-controller",
            Badges: "ribbon",
            Resource: "medkit",
            Settings: "settings",
          };
          return (
            <Ionicons
              name={icons[route.name] || "apps"}
              size={size}
              color={color}
            />
          );
        },
        tabBarActiveTintColor: "#6366F1",
        tabBarInactiveTintColor: "gray",
        headerTitleAlign: "center",
        headerLeft: () => <LogoHeader />,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Quizzes" component={QuizzesHome} />
      <Tab.Screen name="Badges" component={BadgesScreen} />
      <Tab.Screen
        name="Resource"
        component={ResourceHub}
        options={{ headerTitle: "Resource Hub" }}
      />
      <Tab.Screen name="Settings" component={Settings} />
    </Tab.Navigator>
  );
}

export default function MainNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={TabNavigator} />
      {/* Quiz flow screens with native headers */}
      <Stack.Screen
        name="QuizSet"
        component={QuizSet}
        options={{ headerShown: true }}
      />
      <Stack.Screen
        name="QuizGame"
        component={QuizGame}
        options={{ headerShown: true }}
      />

      {/* Results screens */}
      <Stack.Screen name="ResultSummary" component={ResultSummary} />
      <Stack.Screen
        name="HistoryScreen"
        component={HistoryScreen}
        options={{
          headerShown: true,
          headerTitle: "Past Results",
          headerTitleAlign: "center",
        }}
      />

      {/* Resource detail + others */}
      <Stack.Screen
        name="ResourceArticle"
        component={ResourceArticle}
        options={{
          headerShown: true,
          headerTitleAlign: "center",
          headerTitle: "Guide",
        }}
      />
      <Stack.Screen
        name="Certificates"
        component={CertificatesScreen}
        options={{
          headerShown: true,
          headerTitle: "Certificates",
          headerTitleAlign: "center",
        }}
      />
    </Stack.Navigator>
  );
}
