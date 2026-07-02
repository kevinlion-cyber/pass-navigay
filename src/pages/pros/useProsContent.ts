import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  DEFAULT_PROS_CONTENT,
  PROS_SETTINGS_KEY,
  ProsContent,
  ProsStatItem,
  mergeProsContent,
} from './prosContent';

type LiveCounts = {
  establishments: number | null;
  events: number | null;
  members: number | null;
  reviews: number | null;
};

// Formate un compteur pour l'affichage (ex. 1234 -> "1 234").
function fmt(n: number): string {
  return n.toLocaleString('fr-FR');
}

// Résout la valeur affichée d'une stat selon le mode et les compteurs live.
export function resolveStatValue(
  item: ProsStatItem,
  mode: 'auto' | 'manual',
  counts: LiveCounts,
): string {
  if (mode === 'manual' || item.source === 'custom') return item.value || '—';
  const n = counts[item.source as keyof LiveCounts];
  return n == null ? '—' : fmt(n);
}

export function useProsContent() {
  const [content, setContent] = useState<ProsContent>(DEFAULT_PROS_CONTENT);
  const [counts, setCounts] = useState<LiveCounts>({
    establishments: null,
    events: null,
    members: null,
    reviews: null,
  });

  useEffect(() => {
    let alive = true;

    // 1) contenu éditable
    supabase
      .from('app_settings')
      .select('value')
      .eq('key', PROS_SETTINGS_KEY)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return;
        if (data?.value) {
          try {
            setContent(mergeProsContent(JSON.parse(data.value)));
          } catch {
            setContent(DEFAULT_PROS_CONTENT);
          }
        }
      });

    // 2) compteurs live (lisibles en anonyme)
    const head = (table: string) =>
      supabase.from(table).select('id', { count: 'exact', head: true });

    Promise.all([
      head('establishments'),
      head('events'),
      head('public_profiles'),
      head('reviews'),
    ]).then(([e, ev, m, r]) => {
      if (!alive) return;
      setCounts({
        establishments: e.count ?? null,
        events: ev.count ?? null,
        members: m.count ?? null,
        reviews: r.count ?? null,
      });
    });

    return () => {
      alive = false;
    };
  }, []);

  return { content, counts };
}
