import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  MapPin, Plus, Search, Building2, Globe, Sparkles, ExternalLink, CheckCircle2,
  AlertTriangle, ArrowUpDown, Loader2, Camera, MessageSquare, Wallet, Play,
  ChevronDown, ChevronRight, type LucideIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useCategories } from '../../contexts/CategoriesContext';

/** Seuils d'indexation — alignés sur netlify/edge-functions/seo.ts */
const MIN_CITY = 3;
const MIN_CITY_CAT = 2;

/**
 * Rayon de regroupement : une commune à moins de 45 km fait partie de l'agglo.
 * Mesuré sur les données réelles — toutes les communes de l'Hérault rattachées à
 * Montpellier sont entre 4 et 44 km (Sète 27, Péret 39, Saint-Thibéry 44).
 */
const AGGLO_KM = 45;
/** Un brouillon isolé est rattaché à l'agglo la plus proche jusqu'à 60 km. */
const DRAFT_KM = 60;

/**
 * Tarifs unitaires (août 2026). Les prix Google sont des ordres de grandeur
 * relevés sur leur grille : à ajuster si elle bouge. Le tarif Claude est le
 * tarif de lancement de Sonnet 5 (2 $/M en entrée, 10 $/M en sortie), qui
 * repasse à 3 $/15 $ au 1er septembre 2026.
 */
const PRICE = {
  textSearch: 32 / 1000,      // $ / requête de recherche
  placeDetails: 25 / 1000,    // $ / fiche (détails + avis Google)
  photo: 7 / 1000,            // $ / photo téléchargée
  claudeIn: 2 / 1_000_000,    // $ / token en entrée
  claudeOut: 10 / 1_000_000,  // $ / token en sortie
  dfsPer10: 0.00075,          // $ / 10 avis DataForSEO (priorité normale)
};

/** Tokens envoyés à Claude : base (nom, type, résumé…) + ~55 tokens par avis. */
const TOKENS_BASE_IN = 800;
const TOKENS_PER_REVIEW = 55;
const TOKENS_OUT = 500;

const QUERIES_PER_CITY = 23; // buildQueries() : 3+5+4+3+4+4 requêtes

function slugify(s: string): string {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const money = (n: number) => (n < 1 ? `${(n * 100).toFixed(0)} ¢` : `${n.toFixed(2)} $`);

interface Commune { name: string; slug: string; total: number }
interface Agglo {
  name: string;
  slug: string;
  total: number;
  byCategory: Record<string, number>;
  pending: number;
  lastAdded: string | null;
  lat: number;
  lng: number;
  communes: Commune[];
}

/** Contourne le plafond de 1000 lignes de PostgREST. */
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
  const [agglos, setAgglos] = useState<Agglo[]>([]);
  const [orphanDrafts, setOrphanDrafts] = useState<{ city: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'total' | 'name' | 'pending'>('total');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, drafts] = await Promise.all([
        fetchAll<{ city: string; category: string; created_at: string; latitude: number | null; longitude: number | null }>(
          'establishments', 'city, category, created_at, latitude, longitude',
        ),
        fetchAll<{ city: string; status: string; latitude: number | null; longitude: number | null }>(
          'establishment_drafts', 'city, status, latitude, longitude',
        ),
      ]);

      // 1) Agrégation par commune — UNIQUEMENT les fiches publiées. Une commune
      //    qui n'a que des brouillons n'est pas une ville : elle sera rattachée
      //    plus bas à l'agglo la plus proche.
      const byCommune = new Map<string, {
        name: string; total: number; byCategory: Record<string, number>;
        lat: number; lng: number; n: number; last: string | null;
      }>();
      for (const e of rows) {
        const name = (e.city || '').trim();
        if (!name) continue;
        const k = name.toLowerCase();
        const c = byCommune.get(k) || { name, total: 0, byCategory: {}, lat: 0, lng: 0, n: 0, last: null };
        c.total += 1;
        if (e.category) c.byCategory[e.category] = (c.byCategory[e.category] || 0) + 1;
        if (e.latitude && e.longitude) { c.lat += e.latitude; c.lng += e.longitude; c.n += 1; }
        if (e.created_at && (!c.last || e.created_at > c.last)) c.last = e.created_at;
        byCommune.set(k, c);
      }

      const communes = [...byCommune.values()]
        .map((c) => ({ ...c, lat: c.n ? c.lat / c.n : 0, lng: c.n ? c.lng / c.n : 0 }))
        .sort((a, b) => b.total - a.total);

      // 2) Regroupement : la commune la plus fournie absorbe ses voisines.
      const used = new Set<string>();
      const out: Agglo[] = [];
      for (const main of communes) {
        if (used.has(main.name)) continue;
        used.add(main.name);
        const group: typeof communes = [main];
        if (main.lat && main.lng) {
          for (const other of communes) {
            if (used.has(other.name) || !other.lat || !other.lng) continue;
            if (other.total > main.total) continue;
            if (km(main, other) <= AGGLO_KM) { used.add(other.name); group.push(other); }
          }
        }
        const byCategory: Record<string, number> = {};
        let total = 0, last: string | null = null;
        for (const g of group) {
          total += g.total;
          for (const [k, v] of Object.entries(g.byCategory)) byCategory[k] = (byCategory[k] || 0) + v;
          if (g.last && (!last || g.last > last)) last = g.last;
        }
        out.push({
          name: main.name, slug: slugify(main.name), total, byCategory, pending: 0, lastAdded: last,
          lat: main.lat, lng: main.lng,
          communes: group.map((g) => ({ name: g.name, slug: slugify(g.name), total: g.total })),
        });
      }

      // 3) Brouillons : rattachés à l'agglo la plus proche. Au-delà de 60 km, on
      //    les signale à part plutôt que d'inventer une ville sans aucune fiche.
      const far: { city: string; count: number }[] = [];
      const byDraftCity = new Map<string, { name: string; lat: number; lng: number; n: number; count: number }>();
      for (const d of drafts) {
        if (d.status !== 'enriched') continue;
        const name = (d.city || '').trim();
        if (!name) continue;
        const k = name.toLowerCase();
        const c = byDraftCity.get(k) || { name, lat: 0, lng: 0, n: 0, count: 0 };
        c.count += 1;
        if (d.latitude && d.longitude) { c.lat += d.latitude; c.lng += d.longitude; c.n += 1; }
        byDraftCity.set(k, c);
      }
      for (const d of byDraftCity.values()) {
        const p = { lat: d.n ? d.lat / d.n : 0, lng: d.n ? d.lng / d.n : 0 };
        let best: Agglo | null = null;
        let bestKm = Infinity;
        if (p.lat && p.lng) {
          for (const a of out) {
            if (!a.lat || !a.lng) continue;
            const k = km({ lat: a.lat, lng: a.lng }, p);
            if (k < bestKm) { bestKm = k; best = a; }
          }
        }
        // Une commune déjà dans l'agglo est rattachée par son nom, sinon par distance.
        const byName = out.find((a) => a.communes.some((c) => c.name.toLowerCase() === d.name.toLowerCase()));
        if (byName) byName.pending += d.count;
        else if (best && bestKm <= DRAFT_KM) best.pending += d.count;
        else far.push({ city: d.name, count: d.count });
      }

      setAgglos(out);
      setOrphanDrafts(far);
    } catch {
      setAgglos([]);
      setOrphanDrafts([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? agglos.filter((a) => a.name.toLowerCase().includes(q) || a.communes.some((c) => c.name.toLowerCase().includes(q))) : agglos;
    return [...list].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name, 'fr');
      if (sort === 'pending') return b.pending - a.pending || b.total - a.total;
      return b.total - a.total || a.name.localeCompare(b.name, 'fr');
    });
  }, [agglos, search, sort]);

  const totals = useMemo(() => {
    const fiches = agglos.reduce((s, a) => s + a.total, 0);
    const indexable = agglos.filter((a) => a.total >= MIN_CITY).length;
    const pending = agglos.reduce((s, a) => s + a.pending, 0);
    const satellites = agglos.reduce((s, a) => s + Object.values(a.byCategory).filter((n) => n >= MIN_CITY_CAT).length, 0);
    return { villes: agglos.length, fiches, indexable, pending, satellites };
  }, [agglos]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-24 rounded-card" />)}
        </div>
        <div className="skeleton h-64 rounded-card" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Villes</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Couverture de l'annuaire, coût d'ajout d'une ville et pages SEO générées automatiquement.
        </p>
      </div>

      <AddCityPanel existing={agglos} onDone={load} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard icon={MapPin} label="Villes couvertes" value={String(totals.villes)} sub={`${totals.indexable} avec une page indexable`} />
        <MetricCard icon={Building2} label="Fiches publiées" value={String(totals.fiches)} />
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
          {agglos.length > 1 && (
            <button
              onClick={() => setSort(sort === 'total' ? 'name' : sort === 'name' ? 'pending' : 'total')}
              className="btn-ghost flex items-center gap-2 text-sm whitespace-nowrap"
            >
              <ArrowUpDown size={15} />
              {sort === 'total' ? 'Nombre de fiches' : sort === 'name' ? 'Alphabétique' : 'Brouillons'}
            </button>
          )}
        </div>

        {visible.length === 0 ? (
          <div className="p-12 text-center">
            <MapPin size={32} className="mx-auto text-gray-400 mb-3" />
            <p className="text-sm text-gray-500">Aucune ville pour l'instant.</p>
          </div>
        ) : (
          <ul className="divide-y divide-light-border dark:divide-dark-border">
            {visible.map((a) => (
              <AggloRow key={a.slug} agglo={a} categories={categories} categoryKeys={categoryKeys as string[]} />
            ))}
          </ul>
        )}
      </div>

      {orphanDrafts.length > 0 && (
        <p className="text-xs text-gray-500">
          Brouillons situés hors de toute agglomération couverte :{' '}
          {orphanDrafts.map((o) => `${o.city} (${o.count})`).join(', ')} — à valider ou à supprimer dans « Fiches auto ».
        </p>
      )}

      <p className="text-xs text-gray-500">
        Une ville regroupe sa commune principale et celles situées à moins de {AGGLO_KM} km : Montpellier inclut donc
        Castelnau-le-Lez, Lattes, Sète, Mauguio… Une page ville devient indexable à partir de{' '}
        <strong>{MIN_CITY} fiches</strong>, une page ville × catégorie à partir de <strong>{MIN_CITY_CAT}</strong>.
      </p>
    </div>
  );
}

/* ───────────────────────── Module d'ajout d'une ville ───────────────────────── */

interface Candidate { place_id: string; name: string; city: string; category: string; [k: string]: unknown }

function AddCityPanel({ existing, onDone }: { existing: Agglo[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [city, setCity] = useState('');
  const [photos, setPhotos] = useState(3);
  const [useDfs, setUseDfs] = useState(false);
  const [depth, setDepth] = useState(100);
  const [minRating, setMinRating] = useState(4.0);
  const [minReviews, setMinReviews] = useState(20);

  const [analyzing, setAnalyzing] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  // À qui appartient la clé Claude configurée : on refuse la création de ville
  // tant que ce n'est pas celle de Kevin (sinon c'est FL POWER qui paie).
  const [keyOwner, setKeyOwner] = useState<{ owner: string; bulkAllowed: boolean } | null>(null);

  useEffect(() => {
    if (!open || keyOwner) return;
    supabase.functions.invoke('fiches-enrich', { body: { probe: true } }).then(({ data }) => {
      if (data && typeof data.owner === 'string') setKeyOwner({ owner: data.owner, bulkAllowed: !!data.bulkAllowed });
    });
  }, [open, keyOwner]);

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, step: '' });

  const known = existing.some((a) => a.name.toLowerCase() === city.trim().toLowerCase());

  /** Estimation tant qu'on n'a pas analysé ; chiffre réel ensuite. */
  const n = candidates?.length ?? 0;
  const cost = useMemo(() => {
    const reviewsPerFiche = useDfs ? depth : 5;
    const tokensIn = TOKENS_BASE_IN + reviewsPerFiche * TOKENS_PER_REVIEW;
    const search = QUERIES_PER_CITY * 3 * PRICE.textSearch; // 3 pages max par requête
    const details = n * PRICE.placeDetails;
    const photoCost = n * photos * PRICE.photo;
    const claude = n * (tokensIn * PRICE.claudeIn + TOKENS_OUT * PRICE.claudeOut);
    const dfs = useDfs ? n * Math.ceil(depth / 10) * PRICE.dfsPer10 : 0;
    return { search, details, photos: photoCost, claude, dfs, google: search + details + photoCost, total: search + details + photoCost + claude + dfs };
  }, [n, photos, useDfs, depth]);

  const analyze = async () => {
    if (!city.trim()) { toast.error('Indiquez une ville'); return; }
    setAnalyzing(true);
    setCandidates(null);
    try {
      const { data, error } = await supabase.functions.invoke('fiches-search', {
        body: { city: city.trim(), category: null, minRating, minReviews },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setCandidates(data.candidates || []);
      if (useDfs) {
        const { data: b } = await supabase.functions.invoke('fiches-reviews', { body: { action: 'balance' } });
        if (typeof b?.balance === 'number') setBalance(b.balance);
      }
      toast.success(`${data.candidates?.length || 0} lieux trouvés à ${city.trim()}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impossible d'analyser cette ville");
    }
    setAnalyzing(false);
  };

  const create = async () => {
    if (!candidates?.length) return;
    setRunning(true);
    const items = [...candidates];
    const dfsReviews: Record<string, unknown[]> = {};

    try {
      // 1) Avis en profondeur (optionnel, asynchrone chez DataForSEO)
      if (useDfs) {
        setProgress({ done: 0, total: items.length, step: 'Demande des avis à DataForSEO…' });
        const { data: posted, error } = await supabase.functions.invoke('fiches-reviews', {
          body: { action: 'post', items: items.map((i) => ({ place_id: i.place_id })), depth },
        });
        if (error || posted?.error) throw new Error(posted?.error || 'Échec DataForSEO');
        let tasks: Record<string, string> = posted.tasks || {};

        // DataForSEO met 8 à 15 min : on repasse régulièrement récupérer ce qui est prêt.
        for (let round = 0; round < 40 && Object.keys(tasks).length; round++) {
          await new Promise((r) => setTimeout(r, 20000));
          const { data: col } = await supabase.functions.invoke('fiches-reviews', { body: { action: 'collect', tasks } });
          for (const [pid, revs] of Object.entries(col?.ready || {})) dfsReviews[pid] = revs as unknown[];
          const stillPending: Record<string, string> = {};
          for (const pid of col?.pending || []) if (tasks[pid]) stillPending[pid] = tasks[pid];
          tasks = stillPending;
          setProgress({
            done: Object.keys(dfsReviews).length,
            total: items.length,
            step: `Récupération des avis… ${Object.keys(dfsReviews).length}/${items.length}`,
          });
        }
      }

      // 2) Génération des fiches, par lots (la fonction plafonne à 5 par appel)
      let done = 0;
      for (let i = 0; i < items.length; i += 5) {
        const batch = items.slice(i, i + 5).map((it) => ({ ...it, dfs_reviews: dfsReviews[it.place_id] || null }));
        const { data, error } = await supabase.functions.invoke('fiches-enrich', { body: { items: batch, photos, bulk: true } });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        done += data?.enriched || 0;
        setProgress({ done, total: items.length, step: `Rédaction des fiches… ${done}/${items.length}` });
      }

      toast.success(`${done} fiches créées pour ${city.trim()}. À valider dans « Fiches auto ».`);
      setCandidates(null);
      setCity('');
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur pendant la création');
    }
    setRunning(false);
    setProgress({ done: 0, total: 0, step: '' });
  };

  return (
    <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full p-4 flex items-center justify-between text-left hover:bg-light-bg/60 dark:hover:bg-dark-bg/40 transition-colors"
      >
        <span className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-input bg-primary/10 flex items-center justify-center">
            <Plus size={18} className="text-primary" />
          </span>
          <span>
            <span className="block font-semibold text-gray-900 dark:text-white">Ajouter une ville</span>
            <span className="block text-xs text-gray-500">Balaye toutes les catégories et rédige les fiches automatiquement</span>
          </span>
        </span>
        {open ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
      </button>

      {open && (
        <div className="p-4 pt-0 space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* ── Réglages ─────────────────────────────────────────────── */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Ville à ajouter</label>
                <input
                  value={city}
                  onChange={(e) => { setCity(e.target.value); setCandidates(null); }}
                  placeholder="Béziers, Nîmes, Sète…"
                  className="input-field bg-light-bg dark:bg-dark-bg border-light-border dark:border-dark-border text-gray-900 dark:text-white text-sm py-2 w-full"
                />
                {known && <p className="text-xs text-sponsor mt-1">Cette ville existe déjà — les lieux en double seront ignorés.</p>}
              </div>

              <Slider
                icon={Camera} label="Photos par fiche" value={photos} min={0} max={5} onChange={(v) => setPhotos(v)}
                hint={photos === 0 ? 'Aucune photo (le moins cher)' : `${photos} photo${photos > 1 ? 's' : ''} téléchargée${photos > 1 ? 's' : ''} et stockée${photos > 1 ? 's' : ''}`}
              />

              <div className="rounded-input border border-light-border dark:border-dark-border p-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={useDfs} onChange={(e) => { setUseDfs(e.target.checked); setCandidates(null); }} className="mt-0.5" />
                  <span>
                    <span className="flex items-center gap-1.5 text-sm font-medium text-gray-900 dark:text-white">
                      <MessageSquare size={14} /> Avis en profondeur (DataForSEO)
                    </span>
                    <span className="block text-xs text-gray-500 mt-0.5">
                      Google ne donne que 5 avis par lieu. Avec cette option on en lit beaucoup plus, ce qui rend
                      les descriptions nettement plus justes. Compter 10 à 15 min d'attente en plus.
                    </span>
                  </span>
                </label>
                {useDfs && (
                  <div className="mt-3 pl-7">
                    <Slider
                      icon={MessageSquare} label="Avis par fiche" value={depth} min={20} max={300} step={20}
                      onChange={setDepth} hint={`${depth} avis lus par lieu`}
                    />
                    {balance !== null && (
                      <p className="text-xs text-gray-500 mt-2 flex items-center gap-1.5">
                        <Wallet size={12} /> Solde DataForSEO : <strong>{balance.toFixed(2)} $</strong>
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Slider icon={Sparkles} label="Note minimum" value={minRating} min={0} max={4.8} step={0.1}
                  onChange={(v) => { setMinRating(v); setCandidates(null); }} hint={`${minRating.toFixed(1)} ★ et plus`} />
                <Slider icon={Sparkles} label="Avis minimum" value={minReviews} min={0} max={200} step={10}
                  onChange={(v) => { setMinReviews(v); setCandidates(null); }} hint={`${minReviews} avis et plus`} />
              </div>
              <p className="text-xs text-gray-500">
                Ces deux filtres déterminent combien de lieux sortiront : plus ils sont hauts, moins il y a de fiches,
                mais elles sont de meilleure qualité.
              </p>
            </div>

            {/* ── Estimation ───────────────────────────────────────────── */}
            <div className="rounded-input bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border p-4 flex flex-col">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Estimation</h3>

              {candidates === null ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
                  <p className="text-sm text-gray-500 mb-3">
                    Lancez l'analyse pour connaître le nombre réel de lieux et le coût exact.
                    L'analyse ne crée rien et coûte environ {money(QUERIES_PER_CITY * 3 * PRICE.textSearch)}.
                  </p>
                  <button onClick={analyze} disabled={analyzing || !city.trim()} className="btn-primary text-sm flex items-center gap-2">
                    {analyzing ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                    {analyzing ? 'Analyse en cours…' : 'Analyser la ville'}
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-3">
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">{n}</p>
                    <p className="text-xs text-gray-500">lieux trouvés à {city.trim()} avec ces filtres</p>
                  </div>

                  <ul className="text-sm space-y-1.5 border-t border-light-border dark:border-dark-border pt-3">
                    <Line label="Recherche Google" value={cost.search} />
                    <Line label={`Détails des ${n} lieux`} value={cost.details} />
                    <Line label={photos === 0 ? 'Photos (désactivées)' : `Photos (${n} × ${photos})`} value={cost.photos} />
                    {useDfs && <Line label={`Avis DataForSEO (${n} × ${depth})`} value={cost.dfs} />}
                    <Line label="Rédaction des fiches (Claude)" value={cost.claude} />
                  </ul>

                  <div className="border-t border-light-border dark:border-dark-border mt-3 pt-3 flex items-baseline justify-between">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">Coût total estimé</span>
                    <span className="text-xl font-bold text-primary">{money(cost.total)}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    dont {money(cost.google)} chez Google — absorbés par les 200 $ de crédit offerts chaque mois.
                  </p>
                  <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                    <strong>Vraiment approximatif :</strong> le nombre de lieux est réel, mais les tarifs Google
                    évoluent et certains lieux ont beaucoup plus d'avis que d'autres.
                  </p>

                  {keyOwner && !keyOwner.bulkAllowed && (
                    <div className="mt-3 rounded-input bg-alert/10 border border-alert/30 p-3">
                      <p className="text-xs text-alert flex items-start gap-1.5">
                        <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                        <span>
                          <strong>Création bloquée :</strong> la clé Claude configurée n'est pas celle de Kevin
                          (<code>ANTHROPIC_KEY_OWNER = « {keyOwner.owner} »</code>). Créer une ville entière la ferait
                          payer par ce compte. Renseignez la clé de Kevin dans Supabase et passez cette variable à
                          « kevin ».
                        </span>
                      </p>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button onClick={create} disabled={running || n === 0 || (keyOwner ? !keyOwner.bulkAllowed : false)} className="btn-primary text-sm flex items-center gap-2">
                      {running ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
                      {running ? 'Création en cours…' : `Créer la ville (${n} fiches)`}
                    </button>
                    <button onClick={() => setCandidates(null)} disabled={running} className="btn-ghost text-sm">
                      Modifier les réglages
                    </button>
                  </div>

                  {running && progress.total > 0 && (
                    <div className="mt-3">
                      <div className="h-1.5 rounded-full bg-light-border dark:bg-dark-border overflow-hidden">
                        <div className="h-full bg-primary transition-all" style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} />
                      </div>
                      <p className="text-xs text-gray-500 mt-1.5">{progress.step}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Gardez cet onglet ouvert jusqu'à la fin.</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Line({ label, value }: { label: string; value: number }) {
  return (
    <li className="flex items-center justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 dark:text-white font-medium">{money(value)}</span>
    </li>
  );
}

function Slider({
  icon: Icon, label, value, min, max, step = 1, onChange, hint,
}: {
  icon: LucideIcon; label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; hint?: string;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-1.5">
        <Icon size={13} /> {label}
      </label>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-primary" />
      {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
    </div>
  );
}

/* ───────────────────────────── Liste des villes ─────────────────────────────── */

function AggloRow({
  agglo, categories, categoryKeys,
}: {
  agglo: Agglo;
  categories: Record<string, { label: string; subcategories: string[] }>;
  categoryKeys: string[];
}) {
  const [expanded, setExpanded] = useState(false);
  const indexable = agglo.total >= MIN_CITY;
  const satellites = categoryKeys.filter((k) => (agglo.byCategory[k] || 0) >= MIN_CITY_CAT);
  const missing = MIN_CITY - agglo.total;

  return (
    <li className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900 dark:text-white">{agglo.name}</h3>
            {indexable ? (
              <span className="badge text-xs bg-success/10 text-success flex items-center gap-1"><CheckCircle2 size={12} /> Page indexable</span>
            ) : (
              <span className="badge text-xs bg-alert/10 text-alert flex items-center gap-1"><AlertTriangle size={12} /> {missing} fiche{missing > 1 ? 's' : ''} manquante{missing > 1 ? 's' : ''}</span>
            )}
            {agglo.pending > 0 && (
              <span className="badge text-xs bg-sponsor/10 text-sponsor flex items-center gap-1"><Sparkles size={12} /> {agglo.pending} à valider</span>
            )}
          </div>

          <p className="text-sm text-gray-500 mt-1">
            <strong className="text-gray-900 dark:text-white">{agglo.total}</strong> fiche{agglo.total > 1 ? 's' : ''}
            {satellites.length > 0 && <> · {satellites.length} page{satellites.length > 1 ? 's' : ''} catégorie</>}
            {agglo.lastAdded && <> · dernier ajout le {new Date(agglo.lastAdded).toLocaleDateString('fr-FR')}</>}
          </p>

          <div className="flex flex-wrap gap-1.5 mt-2">
            {categoryKeys.map((k) => {
              const nb = agglo.byCategory[k] || 0;
              const ok = nb >= MIN_CITY_CAT;
              return (
                <span key={k}
                  title={ok ? 'Page catégorie indexable' : `${MIN_CITY_CAT} fiches minimum pour indexer cette page`}
                  className={`badge text-xs ${ok ? 'bg-primary/10 text-primary' : nb > 0 ? 'bg-gray-500/10 text-gray-500' : 'bg-gray-500/5 text-gray-400'}`}>
                  {categories[k]?.label ?? k} <b className="ml-0.5">{nb}</b>
                </span>
              );
            })}
          </div>

          {agglo.communes.length > 1 && (
            <button onClick={() => setExpanded(!expanded)} className="text-xs text-primary hover:underline mt-2">
              {expanded ? 'Masquer' : 'Voir'} les {agglo.communes.length} communes
            </button>
          )}
          {expanded && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {agglo.communes.map((c) => (
                <a key={c.slug} href={`/annuaire/${c.slug}`} target="_blank" rel="noreferrer"
                  className="badge text-xs bg-gray-500/10 text-gray-500 hover:text-primary">
                  {c.name} <b className="ml-0.5">{c.total}</b>
                </a>
              ))}
            </div>
          )}
        </div>

        <a href={`/annuaire/${agglo.slug}`} target="_blank" rel="noreferrer" className="btn-ghost text-sm flex items-center gap-1.5 shrink-0">
          <ExternalLink size={15} /> Voir la page
        </a>
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
