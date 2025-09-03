// auth/AuthContainer.js
import React, { useState, useCallback } from "react";
import { supabase } from "../supabase";
import AuthScreen from "./AuthScreen";

export default function AuthContainer() {
  const [screen, setScreen] = useState("login");
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const resetMessagesAndPassword = useCallback(() => {
    setError("");
  }, []);

  const resolveEmailFromUsername = async (value) => {
    if (value.includes("@")) return value;
    const { data, error } = await supabase
      .from("profiles")
      .select("email")
      .eq("username", value)
      .single();
    if (error || !data) throw new Error("No account with that username.");
    return data.email;
  };

  const handleLogin = async () => {
    try {
      setError("");
      const email = await resolveEmailFromUsername(emailOrUsername);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      // AuthWrapper will switch to DrawerApp on auth state change.
    } catch (e) {
      setError(e.message);
    }
  };

  const handleSignUp = async () => {
    try {
      setError("");
      if (password !== confirmPassword) throw new Error("Passwords don't match");
      const { error } = await supabase.auth.signUp({
        email: emailOrUsername,
        password,
        options: {
          emailRedirectTo:
            "https://supabase-reset-password-9j5m.vercel.app/confirm.html",
        },
      });
      if (error) throw error;
      setError("Check your inbox to confirm your email.");
    } catch (e) {
      setError(e.message);
    }
  };

  const handleForgotPassword = async () => {
    try {
      setError("");
      if (!emailOrUsername.includes("@"))
        throw new Error("Enter your email to reset password.");
      const { error } = await supabase.auth.resetPasswordForEmail(
        emailOrUsername,
        {
          redirectTo:
            "https://supabase-reset-password-9j5m.vercel.app/reset.html",
        }
      );
      if (error) throw error;
      setError("Reset link sent to your inbox.");
    } catch (e) {
      setError(e.message);
    }
  };

  const vm = {
    // state
    screen,
    setScreen,
    emailOrUsername,
    setEmailOrUsername,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    error,

    // actions
    resetMessagesAndPassword,
    handleLogin,
    handleSignUp,
    handleForgotPassword,
  };

  return <AuthScreen vm={vm} />;
}
