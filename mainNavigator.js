// mainNavigator.js — i18n-enabled tabs and headers
import React, { useContext } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";

// Screens
import HomeScreen from "./homePage";
import QuizzesHome from "./quizzes";
import QuizSet from "./QuizSet";
import QuizGame from "./QuizGame";
import HistoryScreen from "./HistoryScreen";
import ResultSummary from "./resultSummary";
import { LogoHeader } from "./drawerapp";
import SettingsContainer from "./containers/SettingsContainer";
import ResourceHub from "./resourceHub";
import ResourceArticle from "./resourceArticle";
import CertificatesScreen from "./CertificatesScreen";
import BadgesScreen from "./badges";
import Checklist from "./checklist";
import ChatbotScreen from "./chatbot";
import Articles from "./HomeArticleScreen";

// i18n
import { LanguageContext } from "./translations/language";
import { t } from "./translations/translation";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TabNavigator() {
  const { lang } = useContext(LanguageContext); // re-render on language change

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
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarLabel: t("nav.home"), title: t("nav.home") }}
      />
      <Tab.Screen
        name="Quizzes"
        component={QuizzesHome}
        options={{ tabBarLabel: t("nav.quizzes"), title: t("nav.quizzes") }}
      />
      <Tab.Screen
        name="Badges"
        component={BadgesScreen}
        options={{ tabBarLabel: t("nav.badges"), title: t("nav.badges") }}
      />
      <Tab.Screen
        name="Resource"
        component={ResourceHub}
        options={{
          // Use your existing section title from resourceHub.json if you prefer:
          // title: t("resourceHub.title"),
          // or keep a generic nav label:
          title: t("resourceHub.title"),
          tabBarLabel: t("nav.resource"),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsContainer}
        options={{ tabBarLabel: t("nav.settings"), title: t("nav.settings") }}
      />
    </Tab.Navigator>
  );
}

export default function MainNavigator() {
  const { lang } = useContext(LanguageContext); // ensure headers update on language change

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={TabNavigator} />

      {/* Chatbot */}
      <Stack.Screen
        name="Chatbot"
        component={ChatbotScreen}
        options={{ headerShown: false }}
      />

      {/* Quiz flow */}
      <Stack.Screen
        name="QuizSet"
        component={QuizSet}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="QuizGame"
        component={QuizGame}
        options={{ headerShown: true, title: t("nav.quizzes") }}
      />

      {/* Results / History */}
      <Stack.Screen name="ResultSummary" component={ResultSummary} />
      <Stack.Screen
        name="HistoryScreen"
        component={HistoryScreen}
        options={{
          headerShown: true,
          headerTitle: t("nav.pastResults"),
          headerTitleAlign: "center",
        }}
      />

      {/* Resource detail, Checklist, Certificates */}
      <Stack.Screen
        name="ResourceArticle"
        component={ResourceArticle}
        options={{
          headerShown: true,
          headerTitleAlign: "center",
          // If you have a dedicated title key for the article screen, use it.
          // Using generic "Guide" from common.nav for now:
          headerTitle: t("nav.guide"),
        }}
      />
      <Stack.Screen name="Checklist" component={Checklist} />
      <Stack.Screen
        name="Certificates"
        component={CertificatesScreen}
        options={{ headerShown: false }}
      />

      {/* Articles list */}
      <Stack.Screen
        name="Articles"
        component={Articles}
        options={{
          headerShown: true,
          headerTitle: t("homeArticles.title"), // from translations/*/homeArticles.json
          headerTitleAlign: "center",
        }}
      />
    </Stack.Navigator>
  );
}
