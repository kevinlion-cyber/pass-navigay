import { call, cleanup } from './_admin.mjs';
const r = await call('fiches-search', { city: 'Paris', category: 'soiree', minRating: 4.0, minReviews: 30 });
const all = r.candidates || [];
// Curation : je garde les vrais lieux de la communauté, j'écarte le bruit
// (restos/brasseries du Marais, faux amis, mauvaise catégorie).
const KEEP = ['La Mutinerie','Quetzal Bar','Le Bunker Paris','Bears\' den','L\'Impact Bar','Duplex Bar',
  'Cabaret des Merveilles','Elles Bar','Le Dirty Queen','Abricot','Merci·Marsha','Les Aimant·e·s',
  'Rosa Bonheur Buttes Chaumont','Velvet Bar Paris','Le Subterfuge','Les Souffleuses','Au Bon Endroit Bar','TITI • Paris 18'];
const sel = all.filter((c) => KEEP.some((k) => c.name.startsWith(k)));
console.log(`sélection : ${sel.length}/${all.length}`);
sel.forEach((c) => console.log('  ✓', c.name, `(${c.google_rating}★ ${c.google_rating_count})`));
const e = await call('fiches-enrich', { items: sel });
console.log('\nENRICHI:', e.enriched, '/', e.requested, '| capé:', e.capped, '| owner clé:', e.owner);
console.log('tokens Claude:', JSON.stringify(e.tokens));
(e.results || []).filter((x) => !x.ok).forEach((x) => console.log('  ❌', x.name, x.error));
await cleanup();
