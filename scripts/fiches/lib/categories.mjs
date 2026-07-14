// Mapping des 6 catégories Pass Navigay vers des requêtes de découverte Google Places.
// Doit rester aligné avec src/lib/constants.ts (CATEGORIES). Les sous-catégories
// définitives sont choisies par l'IA à l'enrichissement, dans la liste ci-dessous.

export const PN_CATEGORIES = {
  se_loger: {
    label: 'Se loger',
    subcategories: ["Maison d'hotes", 'Hotel', 'Location particuliere'],
    queries: ["hôtels", "maisons d'hôtes", 'chambres d’hôtes'],
  },
  shopping: {
    label: 'Shopping',
    subcategories: ['Vetements', 'Deco', 'Art', 'Chaussures', 'Sex-shop', 'Jeux'],
    queries: ['boutiques de vêtements', 'concept store', 'boutique déco', 'sex-shop', 'galerie d’art'],
  },
  manger: {
    label: 'Manger',
    subcategories: ['Restaurant', 'Fast-food', 'Brunch', 'Salon de the', 'Bar a vins'],
    queries: ['restaurants', 'brunch', 'salon de thé', 'bar à vins'],
  },
  soiree: {
    label: 'Soiree',
    subcategories: ['Bar tranquille', 'Bar musical', 'Boite de nuit'],
    queries: ['bars', 'bars à cocktails', 'boîte de nuit', 'bar lgbt'],
  },
  bien_etre: {
    label: 'Bien-etre',
    subcategories: ['Sauna', 'Massage', 'Esthetique'],
    queries: ['sauna', 'spa', 'institut de massage', 'institut de beauté'],
  },
  culture: {
    label: 'Culture',
    subcategories: ['Musee', 'Visite guidee', 'Concert', 'Cinema', 'Autres'],
    queries: ['musées', 'cinéma', 'salle de concert', 'théâtre'],
  },
};

export const CATEGORY_KEYS = Object.keys(PN_CATEGORIES);

// Construit la liste des requêtes textuelles pour une ville + une (ou toutes) catégorie(s).
// Chaque item = { category, query, textQuery }.
export function buildDiscoveryQueries(city, category = null) {
  const cats = category ? [category] : CATEGORY_KEYS;
  const out = [];
  for (const cat of cats) {
    const def = PN_CATEGORIES[cat];
    if (!def) continue;
    for (const q of def.queries) {
      out.push({ category: cat, query: q, textQuery: `${q} ${city}` });
    }
  }
  return out;
}
