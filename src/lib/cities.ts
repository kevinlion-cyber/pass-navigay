import { useEffect, useState } from 'react';
import { supabase } from './supabase';

/**
 * Villes réellement couvertes par l'annuaire, alimentées par `public_city_list`.
 *
 * Une ville = une ville de rattachement (`city_slug`), indépendante de l'adresse :
 * un lieu à Lattes est un lieu de Montpellier. On l'utilise pour les filtres Ville
 * de l'app (Explorer, Promotions, Agenda) afin que tout soit cohérent et qu'une
 * ville apparaisse dès qu'elle est couverte, même sans promo ni événement encore.
 */
export interface CoveredCity {
  slug: string;
  name: string;
  n: number;
}

function slugifyCity(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function useCoveredCities(): CoveredCity[] {
  const [cities, setCities] = useState<CoveredCity[]>([]);
  useEffect(() => {
    supabase.from('public_city_list').select('city_slug,city,n').then(({ data }) => {
      const rows = (data as { city_slug: string; city: string; n: number }[]) || [];
      const by = new Map<string, CoveredCity>();
      for (const r of rows) {
        if (!r.city_slug) continue;
        const g = by.get(r.city_slug) || { slug: r.city_slug, name: '', n: 0 };
        g.n += r.n;
        // Nom d'affichage : la commune dont le slug correspond au rattachement.
        if (!g.name || slugifyCity(r.city) === r.city_slug) g.name = r.city;
        by.set(r.city_slug, g);
      }
      setCities([...by.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr')));
    });
  }, []);
  return cities;
}
