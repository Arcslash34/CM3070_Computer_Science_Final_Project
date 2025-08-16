// authwrapper.js
import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';
import AuthScreen from './authscreen';
import DrawerApp from './drawerapp';

export default function AuthWrapper() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  if (loading) return null;

  return session ? <DrawerApp /> : <AuthScreen />;
}
