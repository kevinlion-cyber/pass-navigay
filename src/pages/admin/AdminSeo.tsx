import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Network, ExternalLink, RefreshCw, CheckCircle2, Clock, Building2, MapPin, Layers, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useCategories } from '../../contexts/CategoriesContext';
import type { CategoryKey } from '../../lib/types';

// Seuils identiques à l'edge function seo.ts (page indexable au-dessus du seuil).
const MIN_CITY = 3, MIN_CITY_CAT = 2, MIN_CAT = 3;

function slugify(s: string): string {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

interface Row { id: string; name: string; city: string; category: string }
interface Article { slug: string; title: string; h1: string | null; type: string; hero_emoji: string | null }

export default function AdminSeo() {
  const { categories } = useCategories();
  const [rows, setRows] = useState<Row[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [est, arts] = await Promise.all([
      supabase.from('establishments').select('id,name,city,category').limit(5000),
      supabase.from('seo_articles').select('slug,title,h1,type,hero_emoji').eq('published', true).order('sort', { ascending: false }),
    ]);
    setRows((est.data as Row[]) || []);
    setArticles((arts.data as Article[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const catLabel = (k: string) => categories[k as CategoryKey]?.label || k;

  const model = useMemo(() => {
    const cities = new Map<string, { name: string; n: number; cats: Map<string, number> }>();
    const cats = new Map<string, number>();
    for (const r of rows) {
      const cs = slugify(r.city); if (!cs) continue;
      const c = cities.get(cs) || { name: r.city, n: 0, cats: new Map() };
      c.n++; c.cats.set(r.category, (c.cats.get(r.category) || 0) + 1); cities.set(cs, c);
      cats.set(r.category, (cats.get(r.category) || 0) + 1);
    }
    const cityPillars = [...cities.entries()].map(([s, c]) => ({ slug: s, name: c.name, n: c.n, indexable: c.n >= MIN_CITY, url: `/annuaire/${s}`, cats: c.cats }))
      .sort((a, b) => b.n - a.n);
    const catPillars = [...cats.entries()].map(([k, n]) => ({ key: k, label: catLabel(k), n, indexable: n >= MIN_CAT, url: `/lieux/${slugify(k)}` }))
      .sort((a, b) => b.n - a.n);
    const spokes: { city: string; citySlug: string; cat: string; label: string; n: number; indexable: boolean; url: string }[] = [];
    for (const cp of cityPillars) for (const [cat, n] of cp.cats) spokes.push({ city: cp.name, citySlug: cp.slug, cat, label: catLabel(cat), n, indexable: n >= MIN_CITY_CAT, url: `/annuaire/${cp.slug}/${slugify(cat)}` });
    spokes.sort((a, b) => b.n - a.n);

    const guidesN = articles.length + (articles.length ? 1 : 0); // articles + index /guides
    const allPages = 1 /* index annuaire */ + catPillars.length + cityPillars.length + spokes.length + rows.length + guidesN;
    const indexablePages = 1 + catPillars.filter((p) => p.indexable).length + cityPillars.filter((p) => p.indexable).length + spokes.filter((p) => p.indexable).length + rows.length + guidesN;
    return { cityPillars, catPillars, spokes, allPages, indexablePages, thin: allPages - indexablePages, fiches: rows.length };
  }, [rows, articles]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2"><Network size={20} className="text-primary" /><h1 className="text-xl font-bold text-gray-900 dark:text-white">SEO — Silo & maillage</h1></div>
        <div className="flex items-center gap-3">
          <a href="/sitemap.xml" target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1"><FileText size={14} /> sitemap.xml</a>
          <a href="/annuaire" target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1"><ExternalLink size={14} /> /annuaire</a>
          <button onClick={load} className="text-sm text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center gap-1"><RefreshCw size={14} /> Rafraîchir</button>
        </div>
      </div>
      <p className="text-sm text-gray-500 -mt-2">Pages SEO générées automatiquement depuis le catalogue (racine → piliers ville/catégorie → satellites ville×catégorie → fiches), rendues en vraie HTML côté serveur. Une page passe « Indexée » dès qu'elle a assez de lieux — elle se remplit toute seule quand le catalogue grandit.</p>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-24 rounded-card" />)}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi icon={Network} label="Pages générées" value={model.allPages} />
            <Kpi icon={CheckCircle2} label="Indexables" value={model.indexablePages} />
            <Kpi icon={Clock} label="En attente (mince)" value={model.thin} />
            <Kpi icon={Building2} label="Fiches établissements" value={model.fiches} />
          </div>

          <Section icon={FileText} title={`Guides & contenus éditoriaux (${articles.length})`} hint="Articles rédigés à la main — evergreen, indexés">
            {articles.length === 0 ? <p className="text-sm text-gray-500 py-2">Aucun article.</p> : articles.map((a) => <LineItem key={a.slug} title={`${a.hero_emoji ? a.hero_emoji + ' ' : ''}${a.h1 || a.title}`} sub={a.type === 'guide' ? 'Guide pratique' : 'Contenu informatif'} url={`/guides/${a.slug}`} ok={true} />)}
          </Section>

          <Section icon={Layers} title={`Piliers catégorie (${model.catPillars.length})`} hint="Ex. « Restaurants LGBT-friendly en France »">
            {model.catPillars.map((p) => <LineItem key={p.key} title={p.label} sub={`${p.n} lieu${p.n > 1 ? 'x' : ''}`} url={p.url} ok={p.indexable} />)}
          </Section>

          <Section icon={MapPin} title={`Piliers ville (${model.cityPillars.length})`} hint="Ex. « Lieux LGBT-friendly à Montpellier »">
            {model.cityPillars.map((p) => <LineItem key={p.slug} title={p.name} sub={`${p.n} lieu${p.n > 1 ? 'x' : ''}`} url={p.url} ok={p.indexable} />)}
          </Section>

          <Section icon={Network} title={`Satellites ville × catégorie (${model.spokes.length})`} hint="Ex. « Meilleurs bars gays à Montpellier »">
            {model.spokes.map((s) => <LineItem key={s.url} title={`${s.label} à ${s.city}`} sub={`${s.n} lieu${s.n > 1 ? 'x' : ''}`} url={s.url} ok={s.indexable} />)}
          </Section>
        </>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card p-5">
      <div className="flex items-center gap-3 mb-2"><div className="w-9 h-9 rounded-input bg-primary/10 flex items-center justify-center"><Icon size={18} className="text-primary" /></div><span className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</span></div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}
function Section({ icon: Icon, title, hint, children }: { icon: any; title: string; hint: string; children: ReactNode }) {
  return (
    <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card p-5">
      <div className="flex items-center gap-2 mb-1"><Icon size={16} className="text-primary" /><h2 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h2></div>
      <p className="text-xs text-gray-500 mb-3">{hint}</p>
      <div className="divide-y divide-light-border dark:divide-dark-border">{children}</div>
    </div>
  );
}
function LineItem({ title, sub, url, ok }: { title: string; sub: string; url: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0"><p className="text-sm text-gray-900 dark:text-white truncate">{title}</p><p className="text-xs text-gray-500">{sub}</p></div>
      <div className="flex items-center gap-3 shrink-0">
        <Badge ok={ok} />
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-primary" title="Ouvrir la page"><ExternalLink size={15} /></a>
      </div>
    </div>
  );
}
function Badge({ ok }: { ok: boolean }) {
  return ok
    ? <span className="inline-flex items-center gap-1 text-xs text-emerald-600 whitespace-nowrap"><CheckCircle2 size={13} /> Indexée</span>
    : <span className="inline-flex items-center gap-1 text-xs text-amber-600 whitespace-nowrap"><Clock size={13} /> En attente</span>;
}
