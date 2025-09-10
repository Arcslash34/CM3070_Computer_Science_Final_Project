/**
 * auth/AuthContainer.js — Authentication view-model container (Supabase)
 *
 * Purpose
 * - Drive auth flows (login, sign-up, forgot password) and pass a simple VM to AuthScreen.
 * - Allow users to sign in with either email or username (username is resolved to email via profiles).
 * - Surface user-facing status/errors via a single `error` string.
 *
 * Key Behaviours
 * - Screen state toggles between "login" | "signup" | "forgot".
 * - Sign-up enforces password===confirmPassword.
 * - Password reset requires an email address (not username).
 * - Redirect URLs:
 *   • Email confirmation: https://supabase-reset-password-9j5m.vercel.app/confirm.html
 *   • Password reset:    https://supabase-reset-password-9j5m.vercel.app/reset.html
 *
 * Data Sources
 * - Supabase Auth (email/password).
 * - Supabase table `profiles` for username→email resolution.
 *
 * Exports
 * - Default React component <AuthContainer/> that renders <AuthScreen vm={...}/> with actions + state.
 */

import React, { useState, useCallback } from "react";
import { supabase } from "../supabase";
import AuthScreen from "./AuthScreen";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function AuthContainer() {
  // state
  const [screen, setScreen] = useState("login");
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  // reset transient messages
  const resetMessagesAndPassword = useCallback(() => {
    setError("");
  }, []);

  // resolve "username" -> email using profiles; if already an email, pass-through
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

  // login with email/password (email may come from username resolution)
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

  // sign up with email/password; requires matching confirmation
  const handleSignUp = async () => {
    try {
      setError("");
      if (password !== confirmPassword)
        throw new Error("Passwords don't match");
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

  // send password reset (requires an email, not a username)
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

  // view-model exposed to AuthScreen
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
