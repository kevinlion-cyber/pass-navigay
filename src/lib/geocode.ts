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

// Renvoie uniquement les coordonnées [lng,lat] du meilleur résultat (ou null).
export async function geocodeFirst(query: string): Promise<[number, number] | null> {
  const r = await geocodeAddress(query, 1);
  return r[0]?.center ?? null;
}
