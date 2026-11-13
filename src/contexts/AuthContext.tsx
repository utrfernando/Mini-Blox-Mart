import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured, type Profile } from '../lib/supabase';

interface AuthContextType {
  user: Profile | null;
  authUserId: string | null;
  loading: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  /** resolves true when the new account is already signed in (email confirmation off) */
  signUp: (email: string, password: string, fullName: string, phone?: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Profile | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  // true while we're fetching the profile of a user who just signed in
  const [profileLoading, setProfileLoading] = useState(false);
  const loading = initializing || profileLoading;

  const fetchProfile = useCallback(async (uid: string) => {
    setProfileLoading(true);
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).single();
      setUser(error || !data ? null : (data as Profile));
    } finally { setProfileLoading(false); }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (authUserId) await fetchProfile(authUserId);
  }, [authUserId, fetchProfile]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setInitializing(false);
      return;
    }
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setAuthUserId(session?.user?.id ?? null);
      if (session?.user) fetchProfile(session.user.id);
      setInitializing(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      const uid = session?.user?.id ?? null;
      setAuthUserId(uid);
      // no await here (supabase-js can deadlock if we call it back inside this handler)
      if (uid) { setProfileLoading(true); fetchProfile(uid); }
      else setUser(null);
      setInitializing(false);
    });

    return () => { mounted = false; subscription.unsubscribe(); };
  }, [fetchProfile]);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    // Wait for the profile so the page we navigate to already knows who is signed in.
    // (Before this, the first sign-in bounced back to /login because the profile hadn't loaded yet.)
    if (data.user) { setAuthUserId(data.user.id); await fetchProfile(data.user.id); }
  };

  const signUp = async (email: string, password: string, fullName: string, phone?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, phone: phone || '' } },
    });
    if (error) throw error;
    if (data.session && data.user) { setAuthUserId(data.user.id); await fetchProfile(data.user.id); return true; }
    return false;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setAuthUserId(null);
  };

  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, authUserId, loading, configured: isSupabaseConfigured, signIn, signUp, signOut, refreshProfile, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};
