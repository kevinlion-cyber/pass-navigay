import { supabase } from './supabase';

// Suggestion d'adresse au format historiquement attendu par les formulaires
// (place_name + center [lng,lat] + context avec ville/code postal).
export type GeoFeature = {
  place_name: string;
  center: [number, number];
  context: { id: string; text: string }[];
};

// Géocodage via l'Edge Function `geocode` (OSM/Nominatim côté serveur).
// Remplace l'appel direct à Google Geocoding, refusé car la clé Maps est
// restreinte par référent.
export async function geocodeAddress(query: string, limit = 5): Promise<GeoFeature[]> {
  if (!query || query.trim().length < 3) return [];
  try {
    const { data } = await supabase.functions.invoke('geocode', { body: { query, limit } });
    const results = (data?.results || []) as {
      place_name: string; center: [number, number]; city: string; postcode: string;
    }[];
    return results.map((r) => ({
      place_name: r.place_name,
      center: r.center,
      context: [
        { id: 'place.1', text: r.city },
        { id: 'postcode.1', text: r.postcode },
      ],
    }));
  } catch {
    return [];
  }
}

// Version pour les champs d'adresse avec suggestions : n'interroge le serveur qu'une
// fois la frappe terminée (pause de 350 ms) au lieu d'une requête par lettre.
// Un appel dépassé par une frappe plus récente renvoie null : l'appelant l'ignore.
let suggestTimer: ReturnType<typeof setTimeout> | null = null;
let pendingResolve: ((v: GeoFeature[] | null) => void) | null = null;
let suggestSeq = 0;
export function geocodeSuggest(query: string, limit = 5): Promise<GeoFeature[] | null> {
  const seq = ++suggestSeq;
  if (suggestTimer) clearTimeout(suggestTimer);
  if (pendingResolve) pendingResolve(null);
  return new Promise((resolve) => {
    pendingResolve = resolve;
    suggestTimer = setTimeout(async () => {
      pendingResolve = null;
      const res = await geocodeAddress(query, limit);
      resolve(seq === suggestSeq ? res : null);
    }, 350);
  });
}

// Renvoie uniquement les coordonnées [lng,lat] du meilleur résultat (ou null).
export async function geocodeFirst(query: string): Promise<[number, number] | null> {
  const r = await geocodeAddress(query, 1);
  return r[0]?.center ?? null;
}
