// Enrichissement IA des brouillons : 1 appel Claude par candidat →
// description fun + sous-catégorie + tags + indice gay-friendly. Passe le draft en "enriched".
//
// ⛔ GARDE-FOU CLÉ : sur la clé Anthropic FL POWER (anthropic-key-owner = "flpower"),
//    le nombre de fiches par run est plafonné DUR (FLPOWER_CAP) — impossible de lancer
//    un traitement de masse sur la clé de Fred. Le mass n'est débloqué qu'avec la clé de
//    Kevin (owner = "kevin") + --allow-mass explicite.
//
// Usage :
//   node scripts/fiches/enrich.mjs                 (3 fiches, garde-fou actif)
//   node scripts/fiches/enrich.mjs --limit 2
//   node scripts/fiches/enrich.mjs --place-id <id> (une fiche précise)
//   node scripts/fiches/enrich.mjs --dry           (n'écrit rien, affiche le rendu)
import { supa } from './lib/supa.mjs';
import { config, requireConfig } from './lib/env.mjs';
import { PN_CATEGORIES } from './lib/categories.mjs';
import { getReviews } from './reviews/index.mjs';
import { enrichWithClaude } from './lib/claude.mjs';

requireConfig(['anthropicKey', 'googlePlacesKey']);

const FLPOWER_CAP = 5; // plafond dur sur la clé de dev

function arg(name, def = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

const reqLimit = Number(arg('limit', 3));
const reviewsProvider = arg('reviews', 'google5');
const model = arg('model') || undefined; // null si absent → laisse le défaut de claude.mjs s'appliquer
const placeId = arg('place-id', null);
const dry = !!arg('dry');
const allowMass = !!arg('allow-mass');
const owner = config.anthropicKeyOwner;

// --- Garde-fou ---
let limit = reqLimit;
if (owner !== 'kevin') {
  // Clé de dev (FL POWER ou inconnue) : plafond dur, mass impossible.
  if (reqLimit > FLPOWER_CAP) {
    console.log(`⛔ Clé Anthropic = "${owner}" (dev). Plafond dur ${FLPOWER_CAP} fiches/run. Demandé ${reqLimit} → ramené à ${FLPOWER_CAP}.`);
    console.log('   Le traitement de masse nécessite la clé de Kevin (anthropic-key-owner = "kevin") + --allow-mass.');
  }
  limit = Math.min(reqLimit, FLPOWER_CAP);
  if (allowMass) console.log('   (--allow-mass ignoré sur une clé de dev.)');
} else if (reqLimit > 50 && !allowMass) {
  console.log(`⚠ Clé Kevin : ${reqLimit} fiches demandées. Ajoutez --allow-mass pour confirmer un gros volume.`);
  process.exit(1);
}

function validSubcat(category, proposed) {
  const allowed = PN_CATEGORIES[category]?.subcategories || [];
  if (allowed.includes(proposed)) return proposed;
  // tolérance accents/casse
  const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();
  const hit = allowed.find((a) => norm(a) === norm(proposed));
  return hit || allowed[0] || proposed;
}

async function run() {
  let q = supa.from('establishment_drafts').select('*').eq('status', 'pending');
  if (placeId) q = q.eq('place_id', placeId);
  else q = q.order('google_rating_count', { ascending: false, nullsFirst: false }).limit(limit);

  const { data: drafts, error } = await q;
  if (error) { console.error('Lecture drafts :', error.message); process.exit(1); }
  if (!drafts?.length) { console.log('Aucun brouillon "pending" à enrichir.'); return; }

  console.log(`Enrichissement de ${drafts.length} fiche(s) · clé "${owner}" · avis "${reviewsProvider}"${dry ? ' · DRY' : ''}\n`);

  let ok = 0, inTok = 0, outTok = 0;
  for (const d of drafts) {
    try {
      const reviewData = await getReviews(d, reviewsProvider);
      const { parsed, model: usedModel, usage } = await enrichWithClaude(d, reviewData, model);
      inTok += usage?.input_tokens || 0;
      outTok += usage?.output_tokens || 0;

      const subcategory = validSubcat(d.category, parsed.subcategory);
      const gf = parsed.gay_friendly || {};

      console.log(`• ${d.name} (${d.city})`);
      console.log(`  ${parsed.description}`);
      console.log(`  sous-cat: ${subcategory} · tags: ${(parsed.tags || []).join(', ')}`);
      console.log(`  gay-friendly: ${gf.signal || 'neutre'} (score ${gf.score ?? 0}, confiance ${gf.confidence || reviewData.confidence}, ${reviewData.total_reviews_read} avis lus)`);
      if (gf.vigilance) console.log(`  ⚠ vigilance: ${gf.vigilance}`);

      if (!dry) {
        const { error: upErr } = await supa.from('establishment_drafts').update({
          ai_description: parsed.description || '',
          ai_subcategory: subcategory,
          ai_tags: parsed.tags || [],
          gay_friendly: { ...gf, provider: reviewData.provider, total_reviews_read: reviewData.total_reviews_read },
          ai_model: usedModel,
          ai_generated_at: new Date().toISOString(),
          status: 'enriched',
        }).eq('id', d.id);
        if (upErr) throw upErr;
      }
      ok++;
      console.log('');
    } catch (e) {
      console.warn(`  ⚠ ${d.name} → ${e.message}\n`);
    }
  }

  console.log(`${dry ? '[DRY] ' : '✅ '}${ok}/${drafts.length} enrichies · tokens ~${inTok} in / ${outTok} out`);
}

run();
