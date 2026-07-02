import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile } from '../lib/types';

function translateAuthError(error: AuthError): string {
  const msg = error.message.toLowerCase();

  if (msg.includes('user already registered') || msg.includes('already been registered')) {
    return 'Cette adresse email est deja utilisee.';
  }
  if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
    return 'Email ou mot de passe incorrect.';
  }
  if (msg.includes('email not confirmed')) {
    return "Ton email n'a pas encore été confirmé. Vérifie ta boîte de réception.";
  }
  if (msg.includes('too many requests') || msg.includes('rate limit')) {
    return 'Trop de tentatives. Réessaie dans quelques minutes.';
  }
  if (msg.includes('password') && msg.includes('least')) {
    return 'Le mot de passe doit contenir au moins 6 caractères.';
  }
  if (msg.includes('invalid email')) {
    return "L'adresse email n'est pas valide.";
  }
  if (msg.includes('signup is disabled')) {
    return "L'inscription est temporairement désactivée.";
  }
  if (msg.includes('network') || msg.includes('fetch')) {
    return 'Erreur de connexion. Vérifie ta connexion internet.';
  }

  return error.message;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, username: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  verifyOtp: (email: string, token: string) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (u: User) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', u.id)
      .maybeSingle();

    if (data) {
      setProfile(data);
      return;
    }

    const username = u.user_metadata?.username || u.email?.split('@')[0] || 'utilisateur';
    const { data: created } = await supabase
      .from('profiles')
      .upsert({ id: u.id, username, email: u.email })
      .select('*')
      .maybeSingle();
    setProfile(created);
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        fetchProfile(s.user);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        (async () => {
          await fetchProfile(s.user);
        })();
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, username: string) => {
    const { data: existing } = await supabase
      .from('public_profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (existing) {
      return { error: 'Ce pseudo est deja pris.' };
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
      },
    });

    if (error) return { error: translateAuthError(error) };
    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: translateAuthError(error) };
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const verifyOtp = async (email: string, token: string) => {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'signup',
    });

    if (error) return { error: error.message };

    if (data.user) {
      await fetchProfile(data.user);
    }

    return { error: null };
  };

  return (
    <AuthContext.Provider
      value={{ user, session, profile, loading, signUp, signIn, signOut, verifyOtp, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
