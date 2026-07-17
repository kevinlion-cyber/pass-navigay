import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { CATEGORIES as DEFAULT_CATEGORIES } from '../lib/constants';
import type { CategoryKey } from '../lib/types';
import { supabase } from '../lib/supabase';

// Dictionnaire DYNAMIQUE : l'admin peut ajouter/supprimer/renommer des catégories,
// donc on n'exige pas les 6 clés d'origine (sinon impossible de construire la map).
export type CategoriesMap = Record<string, { label: string; subcategories: string[] }>;

interface CategoriesState {
  categories: CategoriesMap;
  categoryKeys: CategoryKey[];
  loading: boolean;
  reload: () => Promise<void>;
}

const CategoriesContext = createContext<CategoriesState | undefined>(undefined);

// Normalise une config stockée : elle devient la source de vérité (l'admin peut
// ajouter/supprimer/renommer des catégories). Retourne null si vide/invalide -> défauts.
function normalizeConfig(raw: unknown): CategoriesMap | null {
  if (!raw || typeof raw !== 'object') return null;
  const out: CategoriesMap = {};
  for (const [k, c] of Object.entries(raw as Record<string, any>)) {
    if (!k || !c || typeof c !== 'object') continue;
    const label = typeof c.label === 'string' && c.label.trim() ? c.label.trim() : k;
    const subcategories = Array.isArray(c.subcategories)
      ? c.subcategories.filter((s: any) => typeof s === 'string' && s.trim())
      : [];
    out[k] = { label, subcategories };
  }
  return Object.keys(out).length ? out : null;
}

export function CategoriesProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<CategoriesMap>(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'categories_config')
        .maybeSingle();
      if (data?.value) {
        const norm = normalizeConfig(JSON.parse(data.value));
        if (norm) setCategories(norm);
      }
    } catch {
      /* on garde les valeurs par défaut */
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <CategoriesContext.Provider
      value={{ categories, categoryKeys: Object.keys(categories) as CategoryKey[], loading, reload: load }}
    >
      {children}
    </CategoriesContext.Provider>
  );
}

export function useCategories() {
  const ctx = useContext(CategoriesContext);
  if (!ctx) throw new Error('useCategories must be used within CategoriesProvider');
  return ctx;
}
