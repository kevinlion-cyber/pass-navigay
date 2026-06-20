import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { CATEGORIES as DEFAULT_CATEGORIES, CATEGORY_KEYS } from '../lib/constants';
import type { CategoryKey } from '../lib/types';
import { supabase } from '../lib/supabase';

export type CategoriesMap = Record<CategoryKey, { label: string; subcategories: string[] }>;

interface CategoriesState {
  categories: CategoriesMap;
  categoryKeys: CategoryKey[];
  loading: boolean;
  reload: () => Promise<void>;
}

const CategoriesContext = createContext<CategoriesState | undefined>(undefined);

// Fusionne une config (issue de la base) au-dessus des valeurs par défaut du code,
// en garantissant que les 6 clés de catégories existent toujours.
function mergeConfig(raw: unknown): CategoriesMap {
  const merged = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)) as CategoriesMap;
  if (raw && typeof raw === 'object') {
    for (const k of CATEGORY_KEYS) {
      const c = (raw as any)[k];
      if (c) {
        if (typeof c.label === 'string' && c.label.trim()) merged[k].label = c.label;
        if (Array.isArray(c.subcategories)) merged[k].subcategories = c.subcategories.filter((s: any) => typeof s === 'string' && s.trim());
      }
    }
  }
  return merged;
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
      if (data?.value) setCategories(mergeConfig(JSON.parse(data.value)));
    } catch {
      /* on garde les valeurs par défaut */
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <CategoriesContext.Provider value={{ categories, categoryKeys: CATEGORY_KEYS, loading, reload: load }}>
      {children}
    </CategoriesContext.Provider>
  );
}

export function useCategories() {
  const ctx = useContext(CategoriesContext);
  if (!ctx) throw new Error('useCategories must be used within CategoriesProvider');
  return ctx;
}
