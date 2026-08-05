import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  MapPin, Plus, Search, Building2, Globe, Sparkles, ExternalLink,
  CheckCircle2, AlertTriangle, ArrowUpDown, type LucideIcon,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useCategories } from '../../contexts/CategoriesContext';
import AddPlacesModal from './AddPlacesModal';

/** Seuils d'indexation — doivent rester alignés avec netlify/edge-functions/seo.ts */
const MIN_CITY = 3;      // pilier ville /annuaire/:ville
const MIN_CITY_CAT = 2;  // satellite /annuaire/:ville/:categorie

/** Même règle de slug que l'Edge Function SEO. */
function slugify(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

interface CityRow {
  name: string;
  slug: string;
  total: number;
  byCategory: Record<string, number>;
  pending: number;
  lastAdded: string | null;
}

type SortKey = 'total' | 'name' | 'pending';

/** Récupère toutes les lignes en contournant le plafond de 1000 de PostgREST. */
async function fetchAll<T>(table: string, columns: string): Promise<T[]> {
  const PAGE = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + PAGE - 1);
    if (error || !data) break;
    out.push(...(data as T[]));
    if (data.length < PAGE) break;
  }
  return out;
}

export default function AdminCities() {
  const { categories, categoryKeys } = useCategories();
  const [rows, setRows] = useState<CityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('total');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalCity, setModalCity] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [establishments, drafts] = await Promise.all([
        fetchAll<{ city: string; category: string; created_at: string }>('establishments', 'city, category, created_at'),
        fetchAll<{ city: string; status: string }>('establishment_drafts', 'city, status'),
      ]);

      const map = new Map<string, CityRow>();
      for (const e of establishments) {
        const name = (e.city || '').trim();
        if (!name) continue;
        const key = name.toLowerCase();
        const row = map.get(key) || { name, slug: slugify(name), total: 0, byCategory: {}, pending: 0, lastAdded: null };
        row.total += 1;
        if (e.category) row.byCategory[e.category] = (row.byCategory[e.category] || 0) + 1;
        if (e.created_at && (!row.lastAdded || e.created_at > row.lastAdded)) row.lastAdded = e.created_at;
        map.set(key, row);
      }

      // Brouillons en attente de validation (statut "enriched")
      for (const d of drafts) {
        if (d.status !== 'enriched') continue;
        const name = (d.city || '').trim();
        if (!name) continue;
        const key = name.toLowerCase();
        const row = map.get(key) || { name, slug: slugify(name), total: 0, byCategory: {}, pending: 0, lastAdded: null };
        row.pending += 1;
        map.set(key, row);
      }

      setRows([...map.values()]);
    } catch {
      setRows([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : rows;
    return [...list].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name, 'fr');
      if (sort === 'pending') return b.pending - a.pending || b.total - a.total;
      return b.total - a.total || a.name.localeCompare(b.name, 'fr');
    });
  }, [rows, search, sort]);

  const totals = useMemo(() => {
    const fiches = rows.reduce((s, r) => s + r.total, 0);
    const indexable = rows.filter((r) => r.total >= MIN_CITY).length;
    const pending = rows.reduce((s, r) => s + r.pending, 0);
    const satellites = rows.reduce(
      (s, r) => s + Object.values(r.byCategory).filter((n) => n >= MIN_CITY_CAT).length,
      0,
    );
    return { villes: rows.length, fiches, indexable, pending, satellites };
  }, [rows]);

  const openModal = (city = '') => { setModalCity(city); setModalOpen(true); };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-24 rounded-card" />)}
        </div>
        <div className="skeleton h-96 rounded-card" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Villes</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Couverture de l'annuaire et pages SEO générées automatiquement.
          </p>
        </div>
        <button onClick={() => openModal()} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} /> Ajouter une ville
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard icon={MapPin} label="Villes couvertes" value={String(totals.villes)} sub={`${totals.indexable} avec une page indexable`} />
        <MetricCard icon={Building2} label="Fiches publiées" value={String(totals.fiches)} sub="tous statuts confondus" />
        <MetricCard icon={Globe} label="Pages SEO actives" value={String(totals.indexable + totals.satellites)} sub={`${totals.indexable} piliers ville · ${totals.satellites} pages catégorie`} />
        <MetricCard icon={Sparkles} label="Brouillons à valider" value={String(totals.pending)} sub={totals.pending > 0 ? 'en attente dans Fiches auto' : 'rien en attente'} />
      </div>

      <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card overflow-hidden">
        <div className="p-4 flex flex-wrap items-center gap-3 border-b border-light-border dark:border-dark-border">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une ville…"
              className="input-field bg-light-bg dark:bg-dark-bg border-light-border dark:border-dark-border text-gray-900 dark:text-white text-sm py-2 pl-9 w-full"
            />
          </div>
          <button
            onClick={() => setSort(sort === 'total' ? 'name' : sort === 'name' ? 'pending' : 'total')}
            className="btn-ghost flex items-center gap-2 text-sm whitespace-nowrap"
            title="Changer le tri"
          >
            <ArrowUpDown size={15} />
            {sort === 'total' ? 'Nombre de fiches' : sort === 'name' ? 'Ordre alphabétique' : 'Brouillons en attente'}
          </button>
        </div>

        {visible.length === 0 ? (
          <div className="p-12 text-center">
            <MapPin size={32} className="mx-auto text-gray-400 mb-3" />
            <p className="text-sm text-gray-500">
              {search ? 'Aucune ville ne correspond à cette recherche.' : "Aucune ville pour l'instant."}
            </p>
            {!search && (
              <button onClick={() => openModal()} className="btn-primary mt-4 text-sm">
                Ajouter une première ville
              </button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-light-border dark:divide-dark-border">
            {visible.map((city) => (
              <CityCard
                key={city.slug}
                city={city}
                categories={categories}
                categoryKeys={categoryKeys as string[]}
                onAdd={() => openModal(city.name)}
              />
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-gray-500">
        Une page ville devient indexable à partir de <strong>{MIN_CITY} fiches</strong>, et une page ville × catégorie
        à partir de <strong>{MIN_CITY_CAT} fiches</strong> dans cette catégorie. En dessous, la page existe mais reste
        en <em>noindex</em> pour éviter le contenu trop mince.
      </p>

      <AddPlacesModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onDone={() => { setModalOpen(false); load(); }}
        initialCity={modalCity}
      />
    </div>
  );
}

function CityCard({
  city, categories, categoryKeys, onAdd,
}: {
  city: CityRow;
  categories: Record<string, { label: string; subcategories: string[] }>;
  categoryKeys: string[];
  onAdd: () => void;
}) {
  const indexable = city.total >= MIN_CITY;
  const satellites = categoryKeys.filter((k) => (city.byCategory[k] || 0) >= MIN_CITY_CAT);
  const missing = MIN_CITY - city.total;

  return (
    <li className="p-4 hover:bg-light-bg/60 dark:hover:bg-dark-bg/40 transition-colors">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900 dark:text-white">{city.name}</h3>
            {indexable ? (
              <span className="badge text-xs bg-success/10 text-success flex items-center gap-1">
                <CheckCircle2 size={12} /> Page indexable
              </span>
            ) : (
              <span className="badge text-xs bg-alert/10 text-alert flex items-center gap-1">
                <AlertTriangle size={12} /> {missing} fiche{missing > 1 ? 's' : ''} pour être indexable
              </span>
            )}
            {city.pending > 0 && (
              <span className="badge text-xs bg-sponsor/10 text-sponsor flex items-center gap-1">
                <Sparkles size={12} /> {city.pending} à valider
              </span>
            )}
          </div>

          <p className="text-sm text-gray-500 mt-1">
            <strong className="text-gray-900 dark:text-white">{city.total}</strong> fiche{city.total > 1 ? 's' : ''}
            {satellites.length > 0 && <> · {satellites.length} page{satellites.length > 1 ? 's' : ''} catégorie active{satellites.length > 1 ? 's' : ''}</>}
            {city.lastAdded && <> · dernier ajout le {new Date(city.lastAdded).toLocaleDateString('fr-FR')}</>}
          </p>

          <div className="flex flex-wrap gap-1.5 mt-2">
            {categoryKeys.map((k) => {
              const n = city.byCategory[k] || 0;
              const ok = n >= MIN_CITY_CAT;
              return (
                <span
                  key={k}
                  title={ok ? 'Page indexable' : `Il faut ${MIN_CITY_CAT} fiches minimum pour indexer cette page`}
                  className={`badge text-xs ${
                    ok
                      ? 'bg-primary/10 text-primary'
                      : n > 0
                        ? 'bg-gray-500/10 text-gray-500'
                        : 'bg-gray-500/5 text-gray-400'
                  }`}
                >
                  {categories[k]?.label ?? k} <b className="ml-0.5">{n}</b>
                </span>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href={`/annuaire/${city.slug}`}
            target="_blank"
            rel="noreferrer"
            className="btn-ghost text-sm flex items-center gap-1.5"
            title="Voir la page publique"
          >
            <ExternalLink size={15} /> Voir
          </a>
          <button onClick={onAdd} className="btn-secondary text-sm flex items-center gap-1.5">
            <Plus size={15} /> Ajouter des lieux
          </button>
        </div>
      </div>
    </li>
  );
}

function MetricCard({ icon: Icon, label, value, sub }: { icon: LucideIcon; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card p-5">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-input bg-primary/10 flex items-center justify-center">
          <Icon size={18} className="text-primary" />
        </div>
        <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}
