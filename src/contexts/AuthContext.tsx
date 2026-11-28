import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { VERSION_CONDITIONS } from '../lib/conditions';
import { supabase } from '../lib/supabase';
import type { Profile } from '../lib/types';
import { translateAuthError } from '../lib/authErrors';
import { setAnalyticsUser, marquerAppareilAdmin, libererAnalytics } from '../lib/analytics';

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

  // Stables (useCallback) : les pages peuvent les mettre dans leurs dépendances sans
  // provoquer de rechargements en boucle.
  const fetchProfile = useCallback(async (u: User) => {
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
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user);
    }
  }, [user, fetchProfile]);

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
  }, [fetchProfile]); // fetchProfile est stable : l'abonnement à la session n'est créé qu'une fois

  // Repère privé de dernière visite (migration 78) : sert uniquement à ne pas supprimer
  // comme « inactif » un membre qui reste connecté sans jamais se reconnecter. Une fois
  // par chargement de page ; la base ne l'enregistre qu'au plus toutes les 12 h.
  // Invisible des autres membres. Sans effet si la migration n'est pas encore appliquée.
  useEffect(() => {
    if (!user?.id) return;
    supabase.rpc('pn_marquer_visite').then(() => undefined, () => undefined);
  }, [user?.id]);

  // Relie la session analytics au membre connecté (attribution des actions).
  useEffect(() => { setAnalyticsUser(user?.id ?? null); }, [user]);

  // Un admin connecté ne compte pas dans l'audience, et son appareil non plus ensuite.
  useEffect(() => {
    if (profile?.is_admin) marquerAppareilAdmin();
    if (!loading && (!user || profile)) libererAnalytics();
  }, [profile, user, loading]);

  const signUp = async (email: string, password: string, username: string) => {
    const { data: existing } = await supabase
      .from('public_profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (existing) {
      return { error: 'Ce pseudo est déjà pris.' };
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Preuve de l'accord donné à l'inscription (âge + CGU), datée et versionnée.
        data: { username, majeur_declare: true, cgu_acceptees_le: new Date().toISOString(), cgu_version: VERSION_CONDITIONS },
      },
    });

    if (error) return { error: translateAuthError(error) };

    // Adresse déjà rattachée à un compte : pour ne pas révéler qui est inscrit,
    // Supabase répond « créé » sans envoyer de code, et renvoie un utilisateur
    // sans aucune identité. Sans ce test, on demandait un code qui ne partait
    // jamais et la personne restait bloquée devant un champ inutile.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return { error: 'Cette adresse e-mail a déjà un compte. Connectez-vous plutôt.' };
    }

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

    if (error) return { error: translateAuthError(error) };

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
