// auth/AuthScreen.js
import React from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

/* --------------------------- Small subviews --------------------------- */

function LoginView({
  emailOrUsername,
  setEmailOrUsername,
  password,
  setPassword,
  error,
  handleLogin,
  setScreen,
  resetMessagesAndPassword,
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Login</Text>

      <View style={styles.inputContainer}>
        <Ionicons name="person" size={20} color="#888" style={styles.icon} />
        <TextInput
          placeholder="Email or Username"
          placeholderTextColor="#666"
          style={styles.input}
          value={emailOrUsername}
          onChangeText={setEmailOrUsername}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="username"
          returnKeyType="next"
        />
      </View>

      <View style={styles.inputContainer}>
        <Ionicons name="lock-closed" size={20} color="#888" style={styles.icon} />
        <TextInput
          placeholder="Password"
          placeholderTextColor="#666"
          style={styles.input}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          textContentType="password"
          autoCapitalize="none"
          returnKeyType="done"
        />
      </View>

      <TouchableOpacity
        onPress={() => {
          resetMessagesAndPassword();
          setScreen("forgot");
        }}
      >
        <Text style={styles.forgot}>Forgot Password?</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.submitButton} onPress={handleLogin}>
        <Ionicons name="arrow-forward" size={24} color="#fff" />
      </TouchableOpacity>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        onPress={() => {
          resetMessagesAndPassword();
          setScreen("signup");
        }}
      >
        <Text style={styles.switch}>New User? Create Account</Text>
      </TouchableOpacity>
    </View>
  );
}

function SignupView({
  emailOrUsername,
  setEmailOrUsername,
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  error,
  handleSignUp,
  setScreen,
  resetMessagesAndPassword,
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Create Account</Text>

      <View style={styles.inputContainer}>
        <Ionicons name="mail" size={20} color="#888" style={styles.icon} />
        <TextInput
          placeholder="Email"
          style={styles.input}
          value={emailOrUsername}
          onChangeText={setEmailOrUsername}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="next"
        />
      </View>

      <View style={styles.inputContainer}>
        <Ionicons name="lock-closed" size={20} color="#888" style={styles.icon} />
        <TextInput
          placeholder="Password"
          style={styles.input}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          textContentType="newPassword"
          autoCapitalize="none"
          returnKeyType="next"
        />
      </View>

      <View style={styles.inputContainer}>
        <Ionicons name="lock-closed" size={20} color="#888" style={styles.icon} />
        <TextInput
          placeholder="Confirm Password"
          style={styles.input}
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          textContentType="newPassword"
          autoCapitalize="none"
          returnKeyType="done"
        />
      </View>

      <TouchableOpacity style={styles.submitButton} onPress={handleSignUp}>
        <Ionicons name="arrow-forward" size={24} color="#fff" />
      </TouchableOpacity>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        onPress={() => {
          resetMessagesAndPassword();
          setScreen("login");
        }}
      >
        <Text style={styles.switch}>Already a member? Login</Text>
      </TouchableOpacity>
    </View>
  );
}

function ForgotView({
  emailOrUsername,
  setEmailOrUsername,
  error,
  handleForgotPassword,
  setScreen,
  resetMessagesAndPassword,
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Reset Password</Text>

      <View style={styles.inputContainer}>
        <Ionicons name="mail" size={20} color="#888" style={styles.icon} />
        <TextInput
          placeholder="Email"
          style={styles.input}
          value={emailOrUsername}
          onChangeText={setEmailOrUsername}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="done"
        />
      </View>

      <TouchableOpacity style={styles.submitButton} onPress={handleForgotPassword}>
        <Ionicons name="arrow-forward" size={24} color="#fff" />
      </TouchableOpacity>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        onPress={() => {
          resetMessagesAndPassword();
          setScreen("login");
        }}
      >
        <Text style={styles.switch}>Back to Login</Text>
      </TouchableOpacity>
    </View>
  );
}

/* --------------------------------- Screen --------------------------------- */

export default function AuthScreen({ vm }) {
  const {
    screen,
    setScreen,
    emailOrUsername,
    setEmailOrUsername,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    error,
    handleLogin,
    handleSignUp,
    handleForgotPassword,
    resetMessagesAndPassword,
  } = vm;

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <LinearGradient colors={["#EEF2FF", "#C7D2FE"]} style={styles.fill}>
        <KeyboardAvoidingView
          style={styles.fill}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
        >
          <ScrollView
            style={styles.fill}
            contentContainerStyle={[styles.scrollContent, { justifyContent: "center" }]}
            keyboardShouldPersistTaps="always"
          >
            {screen === "login" && (
              <LoginView
                emailOrUsername={emailOrUsername}
                setEmailOrUsername={setEmailOrUsername}
                password={password}
                setPassword={setPassword}
                error={error}
                handleLogin={handleLogin}
                setScreen={setScreen}
                resetMessagesAndPassword={resetMessagesAndPassword}
              />
            )}

            {screen === "signup" && (
              <SignupView
                emailOrUsername={emailOrUsername}
                setEmailOrUsername={setEmailOrUsername}
                password={password}
                setPassword={setPassword}
                confirmPassword={confirmPassword}
                setConfirmPassword={setConfirmPassword}
                error={error}
                handleSignUp={handleSignUp}
                setScreen={setScreen}
                resetMessagesAndPassword={resetMessagesAndPassword}
              />
            )}

            {screen === "forgot" && (
              <ForgotView
                emailOrUsername={emailOrUsername}
                setEmailOrUsername={setEmailOrUsername}
                error={error}
                handleForgotPassword={handleForgotPassword}
                setScreen={setScreen}
                resetMessagesAndPassword={resetMessagesAndPassword}
              />
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
}

/* --------------------------------- Styles --------------------------------- */

const styles = StyleSheet.create({
  fill: { flex: 1, width: "100%" },
  scrollContent: { flexGrow: 1, padding: 20, alignItems: "center" },
  card: {
    width: "100%",
    padding: 20,
    borderRadius: 20,
    backgroundColor: "#fff",
    elevation: 4,
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
    textAlign: "center",
    fontWeight: "600",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: "#ccc",
    marginBottom: 20,
    width: "100%",
    paddingVertical: 8,
  },
  input: { flex: 1, height: 40, fontSize: 16, paddingHorizontal: 8 },
  icon: { marginRight: 10, width: 24, textAlign: "center" },
  submitButton: {
    backgroundColor: "#6366F1",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 50,
    marginVertical: 8,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  submitText: { color: "#fff", fontWeight: "700" },
  error: { color: "red", textAlign: "center", marginVertical: 10, paddingHorizontal: 20 },
  success: { color: "green", textAlign: "center", marginVertical: 10, paddingHorizontal: 20 },
  switch: { textAlign: "center", marginTop: 10, color: "#6c63ff" },
  forgot: { textAlign: "right", color: "#6c63ff", marginBottom: 10 },
});
