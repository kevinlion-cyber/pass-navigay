// Helpers partagés pour l'authentification des Edge Functions.
// Vérifie le JWT Supabase de l'appelant et expose un client service-role.
import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2.57.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// CORS permissif : la sécurité de ces endpoints repose sur la vérification du
// JWT (getAuthenticatedUser), pas sur le CORS. Évite tout blocage navigateur
// selon l'origine servie (custom domain vs sous-domaine Netlify).
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Client service-role (bypass RLS) pour les lectures/écritures serveur de confiance.
export function serviceClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

// Vérifie le JWT présent dans l'en-tête Authorization et renvoie l'utilisateur,
// ou null si absent/invalide.
export async function getAuthenticatedUser(req: Request): Promise<User | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}
