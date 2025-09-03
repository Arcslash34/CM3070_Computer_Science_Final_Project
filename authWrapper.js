// authWrapper.js
import React, { useEffect, useState } from "react";
import { supabase } from "./supabase";
import AuthContainer from "./auth/AuthContainer";
import DrawerApp from "./navigation/drawerapp";

export default function AuthWrapper() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (loading) return null;

  // Just render one of these — the stack will be at the ROOT now
  return session ? <DrawerApp /> : <AuthContainer />;
}
