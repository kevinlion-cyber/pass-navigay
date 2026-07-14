// Chargement centralisé de la config du moteur de fiches (Module 1).
// Lit les secrets locaux gitignorés (.secrets/) + l'URL Supabase (.env.local).
// En prod (Edge Function) ces mêmes valeurs viendront des variables d'environnement.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function readSecret(name) {
  const p = path.join(ROOT, '.secrets', name);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8').trim() : '';
}

function readEnvLocal(key) {
  const p = path.join(ROOT, '.env.local');
  if (!fs.existsSync(p)) return '';
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && m[1] === key) return m[2].replace(/^["']|["']$/g, '').trim();
  }
  return '';
}

export const config = {
  supabaseUrl: process.env.SUPABASE_URL || readEnvLocal('VITE_SUPABASE_URL'),
  supabaseServiceRole: process.env.SUPABASE_SERVICE_ROLE_KEY || readSecret('supabase-service-role'),
  googlePlacesKey: process.env.GOOGLE_PLACES_API_KEY || readSecret('google-places-key'),
  anthropicKey: process.env.ANTHROPIC_API_KEY || readSecret('anthropic-key'),
  // Propriétaire de la clé Anthropic : 'kevin' débloque le traitement de masse ;
  // 'flpower' (défaut) = clé de dev, cap strict imposé par enrich.mjs.
  anthropicKeyOwner: (process.env.ANTHROPIC_KEY_OWNER || readSecret('anthropic-key-owner') || 'flpower').toLowerCase(),
  // DataForSEO : optionnel. Absent = signal gay-friendly sur les 5 avis Google seulement.
  dataForSeoLogin: process.env.DATAFORSEO_LOGIN || readSecret('dataforseo-login'),
  dataForSeoPassword: process.env.DATAFORSEO_PASSWORD || readSecret('dataforseo-password'),
};

export function requireConfig(keys) {
  const missing = keys.filter((k) => !config[k]);
  if (missing.length) {
    console.error('Config manquante :', missing.join(', '));
    process.exit(1);
  }
}
