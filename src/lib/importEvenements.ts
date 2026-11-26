/**
 * Import hebdomadaire des événements LGBT / LGBT-friendly de l'Hérault (décision de
 * Kévin, 26/11/2026). Une tâche planifiée de Claude produit un fichier JSON au format
 * ci-dessous ; l'admin le dépose dans « Événements à valider ». Ce module vérifie le
 * fichier ligne par ligne : tout ce qui ne respecte pas le format est écarté et listé,
 * rien n'est écrit tel quel sans contrôle.
 *
 * Format « passnavigay-evenements-v1 » :
 * {
 *   "format": "passnavigay-evenements-v1",
 *   "genere_le": "2026-11-30T08:00:00+01:00",
 *   "evenements": [{
 *     "titre": "…", "description": "… (texte réécrit, jamais copié)",
 *     "debut": "2026-12-05T21:00:00+01:00", "fin": "2026-12-06T03:00:00+01:00" | null,
 *     "lieu": "Nom du lieu" | null, "adresse": "12 rue …" | null,
 *     "ville": "Montpellier", "latitude": 43.6 | null, "longitude": 3.87 | null,
 *     "theme": "Soirée" | null, "gratuit": true, "prix": 0,
 *     "lien_source": "https://…", "nom_source": "OpenAgenda",
 *     "lien_billetterie": "https://…" | null,
 *     "raison_lgbt": "Pourquoi cet événement est LGBT ou LGBT-friendly",
 *     "etablissement_nom": "Nom tel que dans l'annuaire" | null
 *   }]
 * }
 */
export const FORMAT_IMPORT = 'passnavigay-evenements-v1';

export interface BrouillonImporte {
  dedupe_key: string;
  title: string;
  description: string;
  event_date: string;
  end_date: string | null;
  venue_name: string | null;
  address: string | null;
  city: string;
  latitude: number | null;
  longitude: number | null;
  theme: string | null;
  is_free: boolean;
  price: number;
  source_url: string;
  source_name: string | null;
  ticket_url: string | null;
  lgbt_reason: string | null;
  etablissement_nom: string | null;
}

export interface ResultatLecture {
  valides: BrouillonImporte[];
  ecartes: { ligne: number; titre: string; raison: string }[];
}

/** Titre ou ville réduits à l'essentiel, pour reconnaître un même événement. */
export function normaliser(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Jour de l'événement à l'heure de Paris (AAAA-MM-JJ). */
export function jourParis(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}

export function cleDoublon(titre: string, debut: string, ville: string): string {
  return `${normaliser(titre)}|${jourParis(debut)}|${normaliser(ville)}`;
}

const texte = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};
const lien = (v: unknown): string | null => {
  const t = texte(v, 1000);
  if (!t) return null;
  try {
    const u = new URL(t);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
};
const nombre = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const dateIso = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

export function lireFichierImport(contenu: string): ResultatLecture {
  let json: unknown;
  try {
    json = JSON.parse(contenu);
  } catch {
    throw new Error("Ce fichier n'est pas un fichier d'import valide (JSON illisible).");
  }
  const racine = json as { format?: unknown; evenements?: unknown };
  if (racine?.format !== FORMAT_IMPORT || !Array.isArray(racine.evenements)) {
    throw new Error(`Ce fichier n'est pas au format attendu (${FORMAT_IMPORT}).`);
  }

  const maintenant = Date.now();
  const valides: BrouillonImporte[] = [];
  const ecartes: ResultatLecture['ecartes'] = [];
  const vus = new Set<string>();

  racine.evenements.slice(0, 500).forEach((brut, i) => {
    const e = (brut ?? {}) as Record<string, unknown>;
    const ligne = i + 1;
    const titre = texte(e.titre, 200);
    const debut = dateIso(e.debut);
    const ville = texte(e.ville, 100);
    const source = lien(e.lien_source);
    const ecarter = (raison: string) => ecartes.push({ ligne, titre: titre || '(sans titre)', raison });

    if (!titre) return ecarter('titre manquant');
    if (!debut) return ecarter('date de début manquante ou illisible');
    if (!ville) return ecarter('ville manquante');
    if (!source) return ecarter('lien vers la source manquant ou invalide');
    const fin = dateIso(e.fin);
    if (new Date(fin ?? debut).getTime() < maintenant) return ecarter('événement déjà passé');

    const lat = nombre(e.latitude);
    const lng = nombre(e.longitude);
    const coordsOk = lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
    const gratuit = e.gratuit !== false;
    const prix = gratuit ? 0 : Math.max(0, nombre(e.prix) ?? 0);

    const cle = cleDoublon(titre, debut, ville);
    if (vus.has(cle)) return ecarter('doublon dans le fichier');
    vus.add(cle);

    valides.push({
      dedupe_key: cle,
      title: titre,
      description: texte(e.description, 5000) ?? '',
      event_date: debut,
      end_date: fin && new Date(fin) > new Date(debut) ? fin : null,
      venue_name: texte(e.lieu, 200),
      address: texte(e.adresse, 300),
      city: ville,
      latitude: coordsOk ? lat : null,
      longitude: coordsOk ? lng : null,
      theme: texte(e.theme, 60),
      is_free: gratuit,
      price: Math.round(prix * 100) / 100,
      source_url: source,
      source_name: texte(e.nom_source, 120),
      ticket_url: lien(e.lien_billetterie),
      lgbt_reason: texte(e.raison_lgbt, 1000),
      etablissement_nom: texte(e.etablissement_nom, 200),
    });
  });

  return { valides, ecartes };
}
