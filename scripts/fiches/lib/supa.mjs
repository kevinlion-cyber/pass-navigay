// Client Supabase service_role pour le pipeline de fiches (bypass RLS, écriture serveur).
import { createClient } from '@supabase/supabase-js';
import { config, requireConfig } from './env.mjs';

requireConfig(['supabaseUrl', 'supabaseServiceRole']);

export const supa = createClient(config.supabaseUrl, config.supabaseServiceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});
