import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Network, ExternalLink, RefreshCw, CheckCircle2, Clock, Building2, MapPin, Layers, FileText, Target, Sparkles, type LucideIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useCategories } from '../../contexts/CategoriesContext';
import type { CategoryKey } from '../../lib/types';
import AddPlacesModal from './AddPlacesModal';

// Matrice pilotée par la demande SEO : les requêtes à fort volume/intention.
const PRIORITY_CITIES = ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Bordeaux', 'Lille', 'Nantes', 'Nice', 'Strasbourg', 'Montpellier', 'Rennes', 'Grenoble'];
const PRIORITY_CATS: { key: string; label: string; kw: string }[] = [
  { key: 'soiree', label: 'Bars & clubs', kw: 'bar gay' },
  { key: 'bien_etre', label: 'Saunas & spas', kw: 'sauna gay' },
  { key: 'manger', label: 'Restaurants', kw: 'restaurant gay-friendly' },
  { key: 'se_loger', label: 'Hôtels', kw: 'hôtel gay-friendly' },
];

// Seuils identiques à l'edge function seo.ts (page indexable au-dessus du seuil).
const MIN_CITY = 3, MIN_CITY_CAT = 2, MIN_CAT = 3;

function slugify(s: string): string {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

interface Row { id: string; name: string; city: string; category: string }
interface Article { slug: string; title: string; h1: string | null; type: string; hero_emoji: string | null; related_city: string | null }

export default function AdminSeo() {
  const { categories } = useCategories();
  const [rows, setRows] = useState<Row[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<{ city: string; cat: string } | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const coverage = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(`${slugify(r.city)}|${r.category}`, (m.get(`${slugify(r.city)}|${r.category}`) || 0) + 1);
    return m;
  }, [rows]);

  const load = async () => {
    setLoading(true);
    const [est, arts] = await Promise.all([
      supabase.from('establishments').select('id,name,city,category').limit(5000),
      supabase.from('seo_articles').select('slug,title,h1,type,hero_emoji,related_city').eq('published', true).order('sort', { ascending: false }),
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
      <div className="bg-primary/5 border border-primary/20 rounded-card p-4 text-sm text-gray-700 dark:text-gray-300 space-y-1.5">
        <p className="font-semibold text-gray-900 dark:text-white">À quoi sert cette page&nbsp;?</p>
        <p>C'est le poste de pilotage du référencement Google du site. Le site crée <strong>tout seul</strong> des pages pour chaque ville et chaque type de lieu (« bar gay à Lyon », « sauna gay à Paris »…), plus les articles.</p>
        <p><strong>La seule chose à faire ici&nbsp;:</strong> remplir le catalogue de lieux là où ça rapporte (le tableau ci-dessous). Plus il y a de lieux, plus Google nous met en avant. Le reste est automatique.</p>
      </div>

      {!loading && (
        <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card p-5">
          <div className="flex items-center gap-2 mb-1"><Target size={16} className="text-primary" /><h2 className="text-base font-bold text-gray-900 dark:text-white">👉 À faire&nbsp;: ajouter des lieux dans les grandes villes</h2></div>
          <p className="text-xs text-gray-500 mb-3">Chaque case correspond à une recherche que les gens font vraiment sur Google (« bar gay à Paris »…). <strong className="text-emerald-600">Un chiffre vert</strong> = on a déjà des lieux. <strong>« Découvrir »</strong> = trouver et ajouter des lieux pour cette ville en un clic. Commencez par les villes du haut.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead><tr className="text-xs text-gray-500 uppercase tracking-wide"><th className="text-left py-2 pr-3 font-medium">Ville</th>{PRIORITY_CATS.map((c) => <th key={c.key} className="text-center px-2 font-medium">{c.label}</th>)}</tr></thead>
              <tbody>
                {PRIORITY_CITIES.map((city) => (
                  <tr key={city} className="border-t border-light-border dark:border-dark-border">
                    <td className="py-2 pr-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">{city}</td>
                    {PRIORITY_CATS.map((cat) => {
                      const n = coverage.get(`${slugify(city)}|${cat.key}`) || 0;
                      return (
                        <td key={cat.key} className="text-center px-2">
                          <button onClick={() => setTarget({ city, cat: cat.key })} title={`Découvrir : ${cat.kw} ${city}`}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${n > 0 ? 'text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20' : 'text-gray-500 hover:text-primary hover:bg-primary/10'}`}>
                            {n > 0 ? <><CheckCircle2 size={12} /> {n}</> : <><Sparkles size={12} /> Découvrir</>}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-24 rounded-card" />)}</div>
      ) : (
        <>
          {(() => {
            const editorial = articles.filter((a) => a.type !== 'city');
            const cityGuides = articles.filter((a) => a.type === 'city');
            return (<>
              <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card p-5">
                <div className="flex items-center gap-2 mb-1"><FileText size={16} className="text-primary" /><h2 className="text-base font-bold text-gray-900 dark:text-white">Ce qui est déjà en ligne</h2></div>
                <p className="text-xs text-gray-500 mb-4">Tout ceci est déjà créé et visible par Google — rien à faire, ça s'enrichit tout seul quand tu ajoutes des lieux.</p>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <Kpi icon={Building2} label="Fiches de lieux" value={model.fiches} />
                  <Kpi icon={FileText} label="Articles & guides" value={editorial.length} />
                  <Kpi icon={MapPin} label="Guides de ville" value={cityGuides.length} />
                  <Kpi icon={Network} label="Pages ville × type" value={model.spokes.length} />
                </div>
                <button onClick={() => setShowDetails((v) => !v)} className="text-sm text-primary hover:underline mt-4">
                  {showDetails ? 'Masquer le détail' : 'Voir le détail de toutes les pages'}
                </button>
              </div>

              {showDetails && (<>
                <Section icon={FileText} title={`Articles & guides (${editorial.length})`} hint="Articles rédigés à la main, en ligne">
                  {editorial.map((a) => <LineItem key={a.slug} title={`${a.hero_emoji ? a.hero_emoji + ' ' : ''}${a.h1 || a.title}`} sub={a.type === 'guide' ? 'Guide pratique' : 'Info'} url={`/guides/${a.slug}`} ok={true} />)}
                </Section>
                {cityGuides.length > 0 && (
                  <Section icon={MapPin} title={`Guides de ville (${cityGuides.length})`} hint="Pages ville avec un texte rédigé — en ligne">
                    {cityGuides.map((a) => <LineItem key={a.slug} title={`${a.hero_emoji ? a.hero_emoji + ' ' : ''}${a.h1 || a.title}`} sub={a.related_city || ''} url={`/annuaire/${slugify(a.related_city || '')}`} ok={true} />)}
                  </Section>
                )}
                <Section icon={Layers} title={`Pages « type de lieu » (${model.catPillars.length})`} hint="Ex. « Bars gays en France »">
                  {model.catPillars.map((p) => <LineItem key={p.key} title={p.label} sub={`${p.n} lieu${p.n > 1 ? 'x' : ''}`} url={p.url} ok={p.indexable} />)}
                </Section>
                <Section icon={MapPin} title={`Pages « ville » (${model.cityPillars.length})`} hint="Ex. « Lieux LGBT-friendly à Montpellier »">
                  {model.cityPillars.map((p) => <LineItem key={p.slug} title={p.name} sub={`${p.n} lieu${p.n > 1 ? 'x' : ''}`} url={p.url} ok={p.indexable} />)}
                </Section>
                <Section icon={Network} title={`Pages « ville × type » (${model.spokes.length})`} hint="Ex. « Bars gays à Montpellier »">
                  {model.spokes.map((s) => <LineItem key={s.url} title={`${s.label} à ${s.city}`} sub={`${s.n} lieu${s.n > 1 ? 'x' : ''}`} url={s.url} ok={s.indexable} />)}
                </Section>
              </>)}
            </>);
          })()}
        </>
      )}

      {target && (
        <AddPlacesModal key={`${target.city}-${target.cat}`} open initialCity={target.city} initialCategory={target.cat}
          onClose={() => setTarget(null)} onDone={() => { setTarget(null); load(); }} />
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card p-5">
      <div className="flex items-center gap-3 mb-2"><div className="w-9 h-9 rounded-input bg-primary/10 flex items-center justify-center"><Icon size={18} className="text-primary" /></div><span className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</span></div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}
function Section({ icon: Icon, title, hint, children }: { icon: LucideIcon; title: string; hint: string; children: ReactNode }) {
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
