import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

/** « aix-en-provence » → « Aix-en-Provence » (nom de repli si aucune fiche ne le porte). */
function prettify(slug: string): string {
  return slug.split('-').map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w)).join('-');
}

const money = (n: number) => (n < 1 ? `${(n * 100).toFixed(0)} ¢` : `${n.toFixed(2)} $`);

interface Commune { name: string; total: number }
interface Agglo {
  name: string;
  slug: string;
  total: number;
  byCategory: Record<string, number>;
  pending: number;
  lastAdded: string | null;
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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'total' | 'name' | 'pending'>('total');
  /** Incrémenté au lancement d'une création, pour que le suivi se rafraîchisse tout de suite. */
  const [jobKey, setJobKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, drafts] = await Promise.all([
        fetchAll<{ city: string; city_slug: string | null; category: string; created_at: string }>(
          'establishments', 'city, city_slug, category, created_at',
        ),
        fetchAll<{ city: string; city_slug: string | null; status: string }>(
          'establishment_drafts', 'city, city_slug, status',
        ),
      ]);

      // Regroupement par TAG de ville (`city_slug`), et non par l'adresse : un
      // sauna à Lattes ou à Pérols est un lieu DE Montpellier, il compte dans
      // Montpellier et s'affiche sur /annuaire/montpellier, tout en gardant sa
      // vraie adresse. Le tag étant explicite, aucune ville fantôme ne peut
      // apparaître ici (avant, on devinait par distance : 16 fausses villes).
      const groups = new Map<string, {
        slug: string; names: Map<string, number>; total: number;
        byCategory: Record<string, number>; last: string | null; pending: number;
      }>();
      const group = (slug: string) => {
        const g = groups.get(slug)
          || { slug, names: new Map<string, number>(), total: 0, byCategory: {}, last: null, pending: 0 };
        groups.set(slug, g);
        return g;
      };

      for (const e of rows) {
        // Repli sur l'adresse pour une fiche créée avant la migration du tag.
        const slug = (e.city_slug || slugify(e.city)).trim();
        if (!slug) continue;
        const g = group(slug);
        g.total += 1;
        const commune = (e.city || '').trim();
        if (commune) g.names.set(commune, (g.names.get(commune) || 0) + 1);
        if (e.category) g.byCategory[e.category] = (g.byCategory[e.category] || 0) + 1;
        if (e.created_at && (!g.last || e.created_at > g.last)) g.last = e.created_at;
      }

      for (const d of drafts) {
        if (d.status !== 'enriched') continue;
        const slug = (d.city_slug || slugify(d.city)).trim();
        if (!slug) continue;
        group(slug).pending += 1;
      }

      // Nom affiché : la commune qui porte le slug (« Montpellier »), sinon la
      // plus fournie, sinon le slug remis en forme (ville encore sans fiche).
      const out: Agglo[] = [...groups.values()].map((g) => {
        const communes = [...g.names.entries()]
          .map(([name, total]) => ({ name, total }))
          .sort((a, b) => b.total - a.total);
        const exact = communes.find((c) => slugify(c.name) === g.slug);
        return {
          name: exact?.name || communes[0]?.name || prettify(g.slug),
          slug: g.slug,
          total: g.total,
          byCategory: g.byCategory,
          pending: g.pending,
          lastAdded: g.last,
          communes,
        };
      });

      setAgglos(out);
    } catch {
      setAgglos([]);
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

      <CityJobPanel onFinished={load} refreshKey={jobKey} />
      <AddCityPanel existing={agglos} onJob={() => setJobKey((k) => k + 1)} />

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

      <p className="text-xs text-gray-500">
        Chaque fiche porte une <strong>ville de rattachement</strong>, indépendante de son adresse : un lieu situé à
        Lattes, Pérols ou Castelnau-le-Lez est un lieu <strong>de Montpellier</strong> et apparaît sur sa page, tout en
        affichant sa vraie adresse. Une page ville devient indexable à partir de <strong>{MIN_CITY} fiches</strong>,
        une page ville × catégorie à partir de <strong>{MIN_CITY_CAT}</strong>.
      </p>
    </div>
  );
}

/* ─────────────────── Suivi d'une création en cours (serveur) ─────────────────── */

interface CityJob {
  id: string; city: string; status: string; step: string;
  total: number; done: number; failed: number; shallow: number;
  error: string | null; created_at: string; finished_at: string | null;
}

/**
 * La création tourne sur le serveur : ce bloc ne fait que la regarder avancer.
 * On peut fermer la page et revenir, l'avancement est en base.
 */
function CityJobPanel({ onFinished, refreshKey }: { onFinished: () => void; refreshKey: number }) {
  const [job, setJob] = useState<CityJob | null>(null);
  const wasRunning = useRef(false);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      const { data } = await supabase.from('city_jobs')
        .select('id,city,status,step,total,done,failed,shallow,error,created_at,finished_at')
        .order('created_at', { ascending: false }).limit(1);
      if (stop) return;
      const j = (data?.[0] as CityJob) || null;
      setJob(j);
      const running = !!j && ['queued', 'reviews', 'writing'].includes(j.status);
      // La ville vient de se terminer : on recharge la liste des villes.
      if (wasRunning.current && !running) onFinished();
      wasRunning.current = running;
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => { stop = true; clearInterval(id); };
  }, [onFinished, refreshKey]);

  if (!job || job.status === 'cancelled') return null;
  const running = ['queued', 'reviews', 'writing'].includes(job.status);
  if (!running && job.status !== 'done' && job.status !== 'failed') return null;
  // Une ville terminée il y a plus d'une heure n'a plus besoin d'être affichée.
  if (!running && job.finished_at && Date.now() - new Date(job.finished_at).getTime() > 3600_000) return null;

  const pct = job.total ? Math.round(((job.done + job.failed) / job.total) * 100) : 0;
  const cancel = async () => {
    await supabase.functions.invoke('city-worker', { body: { action: 'cancel', job_id: job.id } });
  };

  return (
    <div className="bg-light-surface dark:bg-dark-surface border border-primary/30 rounded-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <span className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
          {running && <Loader2 size={16} className="animate-spin text-primary" />}
          {job.status === 'done' && <CheckCircle2 size={16} className="text-success" />}
          {job.status === 'failed' && <AlertTriangle size={16} className="text-alert" />}
          {job.city}
        </span>
        {running && job.total > 0 && <span className="text-sm text-gray-500 tabular-nums">{pct} %</span>}
      </div>

      {job.total > 0 && (
        <div className="h-1.5 rounded-full bg-light-border dark:bg-dark-border overflow-hidden mb-2">
          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}

      <p className="text-sm text-gray-500">{job.error || job.step}</p>
      {job.status === 'done' && job.shallow > 0 && (
        <p className="text-xs text-sponsor mt-1">
          {job.shallow} fiches écrites avec les 5 avis de Google, faute d'avis en profondeur rendus à temps.
        </p>
      )}
      {running && (
        <div className="flex items-center gap-3 mt-2">
          <p className="text-xs text-gray-400 flex-1">
            Le travail se fait sur le serveur. Vous pouvez fermer cette page, il continue.
          </p>
          <button onClick={cancel} className="text-xs text-alert hover:underline">Annuler</button>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Module d'ajout d'une ville ───────────────────────── */

interface Candidate {
  place_id: string; name: string; city: string; category: string;
  google_rating?: number | null; google_rating_count?: number | null;
  [k: string]: unknown;
}

function AddCityPanel({ existing, onJob }: { existing: Agglo[]; onJob: () => void }) {
  const [open, setOpen] = useState(false);
  const [city, setCity] = useState('');
  const [photos, setPhotos] = useState(3);
  const [useDfs, setUseDfs] = useState(false);
  const [depth, setDepth] = useState(100);
  const [minRating, setMinRating] = useState(4.0);
  const [minReviews, setMinReviews] = useState(20);

  const [analyzing, setAnalyzing] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  /** Filtres avec lesquels l'analyse a été faite : en dessous, la liste est incomplète. */
  const [base, setBase] = useState<{ minRating: number; minReviews: number } | null>(null);
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

  // Le tag posé sur chaque fiche créée : c'est lui qui rattache le lieu à la
  // ville, quelle que soit sa commune d'adresse.
  const citySlug = slugify(city);
  const known = existing.some((a) => a.slug === citySlug);

  /**
   * L'analyse renvoie chaque lieu AVEC sa note et son nombre d'avis. Durcir les
   * filtres se recalcule donc ici, sans repayer une analyse : on connaît déjà la
   * liste. Seul un ÉLARGISSEMENT (filtres plus bas que ceux de l'analyse) oblige
   * à relancer, puisque les lieux écartés n'ont jamais été rapportés.
   */
  const filtered = useMemo(() => {
    if (!candidates) return null;
    return candidates.filter((c) =>
      (c.google_rating ?? 0) >= minRating && (c.google_rating_count ?? 0) >= minReviews);
  }, [candidates, minRating, minReviews]);

  const tropLarge = !!base && (minRating < base.minRating || minReviews < base.minReviews);
  const n = filtered?.length ?? 0;
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
      setBase({ minRating, minReviews });
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

  /**
   * On ne fait plus tourner la création dans le navigateur : on dépose une
   * commande, et le serveur la traite (cron toutes les minutes). Fred peut
   * fermer l'onglet, éteindre son ordinateur, la ville continue de se
   * construire. L'interface ne fait plus que suivre l'avancement.
   */
  const create = async () => {
    if (!n) return;
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('city-worker', {
        body: {
          action: 'create',
          city: city.trim(),
          city_slug: citySlug,
          photos,
          use_dfs: useDfs,
          depth,
          min_rating: minRating,
          min_reviews: minReviews,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Création lancée. Elle continue même si vous fermez cette page.');
      setCandidates(null);
      setBase(null);
      setCity('');
      onJob();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Impossible de lancer la création');
    }
    setRunning(false);
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
                {/* Ces deux-là ne remettent PAS l'analyse à zéro : on recalcule
                    sur la liste déjà obtenue (voir `filtered`). */}
                <Slider icon={Sparkles} label="Note minimum" value={minRating} min={0} max={4.8} step={0.1}
                  onChange={setMinRating} hint={`${minRating.toFixed(1)} ★ et plus`} />
                <Slider icon={Sparkles} label="Avis minimum" value={minReviews} min={0} max={200} step={10}
                  onChange={setMinReviews} hint={`${minReviews} avis et plus`} />
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

                  {/* Filtres plus bas que ceux de l'analyse : les lieux écartés
                      n'ont jamais été rapportés, il faut réanalyser. */}
                  {tropLarge && (
                    <div className="mt-3 rounded-input bg-sponsor/10 border border-sponsor/30 p-3">
                      <p className="text-xs text-sponsor flex items-start gap-1.5">
                        <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                        <span>
                          Vous avez élargi les filtres sous ceux de l'analyse ({base?.minRating.toFixed(1)} ★ /{' '}
                          {base?.minReviews} avis). Les lieux en dessous n'ont pas été rapportés : relancez l'analyse
                          pour les voir.
                        </span>
                      </p>
                      <button onClick={analyze} disabled={analyzing} className="mt-2 text-xs font-semibold text-sponsor underline underline-offset-2">
                        {analyzing ? 'Analyse en cours…' : 'Relancer l’analyse'}
                      </button>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button onClick={create} disabled={running || n === 0 || tropLarge || (keyOwner ? !keyOwner.bulkAllowed : false)} className="btn-primary text-sm flex items-center gap-2">
                      {running ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
                      {running ? 'Lancement…' : `Créer la ville (${n} fiches)`}
                    </button>
                    <button onClick={() => { setCandidates(null); setBase(null); }} disabled={running} className="btn-ghost text-sm">
                      Nouvelle analyse
                    </button>
                  </div>

                  <p className="text-xs text-gray-500 mt-2">
                    La création se fait sur le serveur : vous pouvez fermer cette page, elle continue toute seule.
                  </p>
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
  // La valeur est affichée en clair à côté du libellé, et deux boutons permettent
  // de l'ajuster au cran près : viser un curseur fin à la souris est pénible, et
  // on ne voit pas toujours qu'il a bougé.
  const clamp = (v: number) => Math.min(max, Math.max(min, Number(v.toFixed(2))));
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
          <Icon size={13} /> {label}
        </label>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => onChange(clamp(value - step))} disabled={value <= min}
            aria-label={`Diminuer ${label}`}
            className="w-6 h-6 rounded border border-light-border dark:border-dark-border text-gray-500 hover:text-primary hover:border-primary disabled:opacity-30 leading-none">−</button>
          <span className="min-w-[2.5rem] text-center text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
            {Number.isInteger(step) ? value : value.toFixed(1)}
          </span>
          <button type="button" onClick={() => onChange(clamp(value + step))} disabled={value >= max}
            aria-label={`Augmenter ${label}`}
            className="w-6 h-6 rounded border border-light-border dark:border-dark-border text-gray-500 hover:text-primary hover:border-primary disabled:opacity-30 leading-none">+</button>
        </div>
      </div>
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
            // Communes = les adresses réelles des fiches. Elles n'ont pas de page
            // à elles : tout est regroupé sur la page de la ville de rattachement.
            <div className="flex flex-wrap gap-1.5 mt-2">
              {agglo.communes.map((c) => (
                <span key={c.name} className="badge text-xs bg-gray-500/10 text-gray-500">
                  {c.name} <b className="ml-0.5">{c.total}</b>
                </span>
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
