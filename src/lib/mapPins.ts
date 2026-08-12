import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';

/**
 * Les points de la carte, chargés INDÉPENDAMMENT de la liste.
 *
 * Avant, la carte affichait exactement les mêmes établissements que la liste : or
 * la liste est paginée (20 par page) et, dès qu'une ville était choisie, elle
 * ignorait le cadrage de la carte. Résultat : au maximum 20 points, toujours ceux
 * d'une seule ville. Se déplacer sur Béziers ne faisait apparaître aucun point.
 *
 * Ici on interroge la base avec le cadrage réel de la carte, on ne rapatrie que
 * ce qu'il faut pour poser un point, et on laisse le regroupement s'occuper de la
 * densité. La liste garde sa pagination de son côté.
 */
export interface MapPin {
  id: string;
  slug: string | null;
  name: string;
  latitude: number;
  longitude: number;
  category: string;
  subcategory: string;
  is_sponsor: boolean;
  is_pro: boolean;
}

export interface PinBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

/**
 * Plafond de sécurité. PostgREST refuse de renvoyer plus de 1000 lignes d'un coup,
 * et au-delà la carte n'apporte plus rien de lisible de toute façon.
 */
const MAX_PINS = 1000;

export function useMapPins(
  bounds: PinBounds | null,
  filters: { category?: string | null; subcategories?: string[] },
): { pins: MapPin[]; loading: boolean; truncated: boolean } {
  const [pins, setPins] = useState<MapPin[]>([]);
  const [loading, setLoading] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  // Les filtres arrivent en tableau/objet : on les compare par leur contenu pour
  // ne pas relancer une requête à chaque rendu.
  const filterKey = `${filters.category || ''}|${(filters.subcategories || []).join(',')}`;
  const boundsKey = bounds
    ? [bounds.north, bounds.south, bounds.east, bounds.west].map((n) => n.toFixed(4)).join(',')
    : '';

  useEffect(() => {
    if (!bounds) return;
    // Le cadrage change en continu pendant un déplacement : on attend que ça se
    // pose avant d'interroger la base.
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true);
      let q = supabase
        .from('establishments')
        .select('id, slug, name, latitude, longitude, category, subcategory, is_sponsor, is_pro')
        .gte('latitude', bounds.south)
        .lte('latitude', bounds.north)
        .gte('longitude', bounds.west)
        .lte('longitude', bounds.east)
        .limit(MAX_PINS);

      if (filters.category) q = q.eq('category', filters.category);
      if (filters.subcategories && filters.subcategories.length > 0) {
        q = q.in('subcategory', filters.subcategories);
      }

      const { data, error } = await q;
      if (!error && data) {
        const rows = data as MapPin[];
        setPins(rows);
        setTruncated(rows.length >= MAX_PINS);
      }
      setLoading(false);
    }, 250);

    return () => clearTimeout(timer.current);
  }, [boundsKey, filterKey]);

  return { pins, loading, truncated };
}
