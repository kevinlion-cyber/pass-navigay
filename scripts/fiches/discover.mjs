// Découverte de candidats via Google Places, insérés en brouillon (status pending).
// AUCUN appel IA ici, AUCUNE publication : on ne fait que remplir establishment_drafts.
//
// Usage :
//   node scripts/fiches/discover.mjs --city "Montpellier"
//   node scripts/fiches/discover.mjs --city "Lyon" --category soiree --max 20
//   node scripts/fiches/discover.mjs --city "Nice" --dry     (n'insère rien, affiche)
import { supa } from './lib/supa.mjs';
import { requireConfig } from './lib/env.mjs';
import { buildDiscoveryQueries, PN_CATEGORIES } from './lib/categories.mjs';
import { searchText } from './lib/places.mjs';

requireConfig(['googlePlacesKey']);

function arg(name, def = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

const city = arg('city');
const category = arg('category');
const max = Number(arg('max', 60));
const dry = !!arg('dry');

if (!city) { console.error('--city requis'); process.exit(1); }
if (category && !PN_CATEGORIES[category]) {
  console.error(`--category inconnue "${category}". Valeurs : ${Object.keys(PN_CATEGORIES).join(', ')}`);
  process.exit(1);
}

const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim();

async function loadExisting() {
  // place_ids déjà connus (fiches en ligne + brouillons) + noms+ville des fiches en ligne.
  const seenPlaceIds = new Set();
  const seenNameCity = new Set();
  const est = await supa.from('establishments').select('place_id,name,city');
  for (const e of est.data || []) {
    if (e.place_id) seenPlaceIds.add(e.place_id);
    seenNameCity.add(`${norm(e.name)}|${norm(e.city)}`);
  }
  const dr = await supa.from('establishment_drafts').select('place_id');
  for (const d of dr.data || []) if (d.place_id) seenPlaceIds.add(d.place_id);
  return { seenPlaceIds, seenNameCity };
}

async function run() {
  const queries = buildDiscoveryQueries(city, category);
  console.log(`Découverte : "${city}"${category ? ` / ${category}` : ' (6 catégories)'} — ${queries.length} requêtes, cap ${max}`);

  const { seenPlaceIds, seenNameCity } = await loadExisting();
  const batchSeen = new Set();
  const toInsert = [];
  let found = 0, dupes = 0;

  for (const { category: cat, query, textQuery } of queries) {
    let places = [];
    try {
      places = await searchText(textQuery, { max });
    } catch (e) {
      console.warn(`  ⚠ "${textQuery}" → ${e.message}`);
      continue;
    }
    found += places.length;
    for (const p of places) {
      if (!p.place_id) continue;
      if (seenPlaceIds.has(p.place_id) || batchSeen.has(p.place_id)) { dupes++; continue; }
      const nc = `${norm(p.name)}|${norm(p.city || city)}`;
      if (seenNameCity.has(nc)) { dupes++; continue; }
      batchSeen.add(p.place_id);
      toInsert.push({
        place_id: p.place_id,
        name: p.name,
        address: p.address,
        city: p.city || city,
        postal_code: p.postal_code,
        latitude: p.latitude,
        longitude: p.longitude,
        phone: p.phone,
        website: p.website,
        google_rating: p.google_rating,
        google_rating_count: p.google_rating_count,
        google_primary_type: p.google_primary_type,
        raw: { editorial_summary: p.editorial_summary },
        category: cat,
        discovery_query: `${query} @ ${city}`,
        status: 'pending',
      });
    }
    console.log(`  ${cat} · "${query}" → ${places.length} lieux`);
  }

  console.log(`\nTotal trouvé ${found} · doublons écartés ${dupes} · nouveaux candidats ${toInsert.length}`);

  if (dry) {
    console.log('\n[DRY] Aperçu (10 premiers) :');
    for (const c of toInsert.slice(0, 10)) console.log(`  • ${c.name} — ${c.category} — ${c.city} — ${c.google_rating ?? '?'}★ (${c.google_rating_count ?? 0})`);
    console.log('\n[DRY] Rien inséré.');
    return;
  }

  // Insert par lots (upsert sur place_id pour idempotence).
  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += 100) {
    const chunk = toInsert.slice(i, i + 100);
    const { error, count } = await supa
      .from('establishment_drafts')
      .upsert(chunk, { onConflict: 'place_id', ignoreDuplicates: true, count: 'exact' });
    if (error) { console.error('Insert erreur :', error.message); process.exit(1); }
    inserted += count ?? chunk.length;
  }
  console.log(`✅ ${inserted} brouillons insérés (status pending). Prochaine étape : enrich.mjs`);
}

run();
