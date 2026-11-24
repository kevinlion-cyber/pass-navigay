import { supabase } from './supabase';

// Adresses du proxy photos Google « fiches-photo », réservé aux admins (M3).
// Les balises <img> ne peuvent pas envoyer d'en-tête : le jeton de connexion de
// l'admin est donc ajouté à l'adresse, et tenu à jour à chaque renouvellement.
const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fiches-photo`;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

let token = '';
supabase.auth.getSession().then(({ data }) => { token = data.session?.access_token ?? ''; });
supabase.auth.onAuthStateChange((_event, session) => { token = session?.access_token ?? ''; });

export function fichesPhotoUrl(params: Record<string, string | number>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) q.set(k, String(v));
  q.set('apikey', ANON);
  if (token) q.set('token', token);
  return `${BASE}?${q.toString()}`;
}
