import { supabase } from './supabase';

/**
 * Publication en masse de brouillons.
 *
 * Partagée entre la page « Villes » (publier une ville d'un coup, là où on vient
 * de la créer) et « Fiches auto » (publier ce qui est filtré). Une seule
 * implémentation : la publication passe toujours par `fiches-publish`, qui crée
 * l'établissement, range ses photos dans le Storage et déduplique son adresse.
 */
export interface PublishFilters {
  citySlug?: string;
  city?: string;
  category?: string;
  search?: string;
}

/** Ids de TOUS les brouillons à publier correspondant aux filtres (pas une page). */
export async function draftIdsToPublish(f: PublishFilters): Promise<string[]> {
  const out: string[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    let q = supabase.from('establishment_drafts').select('id').eq('status', 'enriched');
    if (f.citySlug) q = q.eq('city_slug', f.citySlug);
    if (f.city) q = q.eq('city', f.city);
    if (f.category) q = q.eq('category', f.category);
    if (f.search?.trim()) q = q.ilike('name', `%${f.search.trim()}%`);
    const { data } = await q.range(from, from + PAGE - 1);
    if (!data?.length) break;
    out.push(...data.map((d) => (d as { id: string }).id));
    if (data.length < PAGE) break;
  }
  return out;
}

/**
 * Publie les brouillons donnés, 4 à la fois. Un échec ne fait pas tomber le
 * reste : la fiche concernée reste « à valider » et sera reprise au prochain
 * passage. `onProgress` est appelé après chaque fiche.
 */
export async function publishDraftIds(
  ids: string[],
  onProgress: (p: { done: number; failed: number; total: number }) => void,
): Promise<{ done: number; failed: number }> {
  let done = 0, failed = 0, cursor = 0;
  onProgress({ done, failed, total: ids.length });

  const worker = async () => {
    while (cursor < ids.length) {
      const id = ids[cursor++];
      try {
        const { data, error } = await supabase.functions.invoke('fiches-publish', { body: { draftId: id } });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        done++;
      } catch {
        failed++;
      }
      onProgress({ done, failed, total: ids.length });
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  return { done, failed };
}
