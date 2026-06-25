import { Outlet, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import Header from './Header';
import BottomNav from './BottomNav';

export default function AppLayout() {
  const { user, loading } = useAuth();
  // null = pas encore chargé. Par défaut (aucun réglage en base) : inscription obligatoire.
  const [requireSignup, setRequireSignup] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', 'require_signup').maybeSingle()
      .then(({ data }) => setRequireSignup(data ? data.value === 'true' : true));
  }, []);

  if (loading || requireSignup === null) {
    return <div className="min-h-screen bg-light-bg dark:bg-dark-bg" />;
  }

  // Inscription obligatoire : on bloque l'accès au contenu sans compte.
  if (requireSignup && !user) {
    return <Navigate to="/auth/register" replace />;
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-14 pb-16 md:pb-0">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
