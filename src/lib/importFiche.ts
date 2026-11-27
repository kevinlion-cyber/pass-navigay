/**
 * Fiche d'établissement préparée par l'assistant « Créateur de fiches » pendant un
 * rendez-vous avec le gérant (décision de Kévin, 27/11/2026). L'assistant produit un
 * fichier fiche.json + les images (bandeau 16:9, galerie, logo). L'admin les dépose
 * dans « Fiches auto » : la fiche arrive en attente, puis se publie comme les autres.
 *
 * Format « passnavigay-fiche-v1 » :
 * {
 *   "format": "passnavigay-fiche-v1",
 *   "genere_le": "2026-11-27T10:00:00+01:00",
 *   "etablissement": {
 *     "nom": "…", "categorie": "manger", "sous_categorie": "Restaurant",
 *     "description": "Texte LGBT-friendly, tutoiement, 3 paragraphes max",
 *     "adresse": "14 rue en Gondeau", "code_postal": "34000", "ville": "Montpellier",
 *     "latitude": 43.61 | null, "longitude": 3.87 | null,
 *     "telephone": "…" | null, "site_web": "https://…" | null,
 *     "horaires": { "lundi": { "ouverture": "10:00", "fermeture": "19:00" } | null, … } | null,
 *     "equipements": ["Terrasse", "CB acceptée", …], "niveau_prix": 1-4 | null,
 *     "mots_cles": ["céramique", "fait main"]
 *   },
 *   "images": { "bandeau": "bandeau.jpg", "logo": "logo.png" | null, "galerie": ["1.jpg", …] },
 *   "inclusion": { "engagements": "…", "consentements": "…" },
 *   "reseaux": { "facebook": "texte du post", "instagram_legende": "…", "carrousel": ["slide-1.png", …] }
 * }
 */
export const FORMAT_FICHE = 'passnavigay-fiche-v1';

export const EQUIPEMENTS = [
  'Terrasse', 'Petit-déjeuner', 'Brunch', 'Café', 'Options végé', 'Cocktails', 'Bière', 'Vin',
  'Musique live', 'Adapté enfants', 'Groupes', 'Animaux acceptés', 'Réservation', 'Livraison',
  'À emporter', 'Sur place', 'Accessible PMR', 'Parking', 'CB acceptée',
];
const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

export interface FicheLue {
  nom: string;
  categorie: string;
  sous_categorie: string | null;
  description: string;
  adresse: string;
  code_postal: string;
  ville: string;
  latitude: number | null;
  longitude: number | null;
  telephone: string;
  site_web: string;
  horaires: Record<string, { open: string; close: string } | null> | null;
  equipements: string[];
  niveau_prix: number | null;
  mots_cles: string[];
  bandeau: string;
  logo: string | null;
  galerie: string[];
  infos: Record<string, unknown>;
  avertissements: string[];
}

const texte = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};
const nombre = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const heure = (v: unknown): string | null => {
  const t = texte(v, 5);
  return t && /^([01]\d|2[0-3]):[0-5]\d$/.test(t) ? t : null;
};
const nomFichier = (v: unknown): string | null => {
  const t = texte(v, 120);
  return t && /^[\w.\- ]+\.(jpe?g|png|webp)$/i.test(t) ? t : null;
};

export function lireFiche(contenu: string, categoriesConnues: string[]): FicheLue {
  let racine: Record<string, unknown>;
  try {
    racine = JSON.parse(contenu);
  } catch {
    throw new Error("Ce fichier n'est pas une fiche valide (JSON illisible).");
  }
  if (racine?.format !== FORMAT_FICHE) throw new Error(`Ce fichier n'est pas au format attendu (${FORMAT_FICHE}).`);
  const e = (racine.etablissement ?? {}) as Record<string, unknown>;
  const img = (racine.images ?? {}) as Record<string, unknown>;
  const avertissements: string[] = [];

  const nom = texte(e.nom, 150);
  if (!nom) throw new Error('Nom de l’établissement manquant.');
  const categorie = texte(e.categorie, 40);
  if (!categorie || !categoriesConnues.includes(categorie)) {
    throw new Error(`Catégorie inconnue : « ${categorie ?? ''} ». Attendu : ${categoriesConnues.join(', ')}.`);
  }
  const ville = texte(e.ville, 100);
  if (!ville) throw new Error('Ville manquante.');
  const adresse = texte(e.adresse, 300);
  if (!adresse) throw new Error('Adresse manquante.');
  const description = texte(e.description, 4000);
  if (!description) throw new Error('Description manquante.');
  const bandeau = nomFichier(img.bandeau);
  if (!bandeau) throw new Error('Image de bandeau manquante (ex. "bandeau.jpg").');

  let site = texte(e.site_web, 300) ?? '';
  if (site) {
    try {
      const u = new URL(site);
      if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error();
      site = u.toString();
    } catch {
      avertissements.push('Site web ignoré (adresse invalide).');
      site = '';
    }
  }

  let horaires: FicheLue['horaires'] = null;
  if (e.horaires && typeof e.horaires === 'object') {
    horaires = {};
    for (const j of JOURS) {
      const h = (e.horaires as Record<string, unknown>)[j] as Record<string, unknown> | null | undefined;
      const o = heure(h?.ouverture);
      const f = heure(h?.fermeture);
      horaires[j] = o && f ? { open: o, close: f } : null;
    }
  }

  const equipements = Array.isArray(e.equipements)
    ? (e.equipements as unknown[]).filter((x): x is string => typeof x === 'string' && EQUIPEMENTS.includes(x))
    : [];
  const ignores = Array.isArray(e.equipements) ? (e.equipements as unknown[]).length - equipements.length : 0;
  if (ignores > 0) avertissements.push(`${ignores} équipement(s) non reconnu(s) ignoré(s).`);

  const lat = nombre(e.latitude);
  const lng = nombre(e.longitude);
  const coordsOk = lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  const prix = nombre(e.niveau_prix);

  return {
    nom,
    categorie,
    sous_categorie: texte(e.sous_categorie, 80),
    description,
    adresse,
    code_postal: texte(e.code_postal, 10) ?? '',
    ville,
    latitude: coordsOk ? lat : null,
    longitude: coordsOk ? lng : null,
    telephone: texte(e.telephone, 30) ?? '',
    site_web: site,
    horaires,
    equipements,
    niveau_prix: prix !== null && prix >= 1 && prix <= 4 ? Math.round(prix) : null,
    mots_cles: Array.isArray(e.mots_cles) ? (e.mots_cles as unknown[]).filter((x): x is string => typeof x === 'string').slice(0, 12).map((x) => x.slice(0, 40)) : [],
    bandeau,
    logo: nomFichier(img.logo),
    galerie: Array.isArray(img.galerie) ? (img.galerie as unknown[]).map(nomFichier).filter((x): x is string => !!x).slice(0, 19) : [],
    infos: {
      source: 'entretien',
      genere_le: texte(racine.genere_le, 40),
      inclusion: racine.inclusion ?? null,
      reseaux: racine.reseaux ?? null,
    },
    avertissements,
  };
}

export const slugVille = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
