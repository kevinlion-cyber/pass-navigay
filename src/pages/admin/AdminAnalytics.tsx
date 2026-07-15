import { useEffect, useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Users, Eye, Building2, Search, TrendingUp, Globe, BadgeCheck, ArrowRight, UserPlus, Heart, Star, MessageCircle, Ticket } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Overview {
  days: number;
  kpis: { visitors: number; pageviews: number; establishmentViews: number; searches: number; newSessions: number };
  engagement: { newMembers: number; favorites: number; reviews: number; messages: number; promoActivations: number };
  topPromos: { id: string; title: string; establishment: string | null; count: number }[];
  series: { date: string; pageviews: number; visitors: number }[];
  topFiches: { id: string; name: string; city: string | null; views: number }[];
  topSearches: { q: string; count: number }[];
  topSources: { source: string; count: number }[];
  funnel: { views: number; claim_start: number; claim_submit: number; register: number };
}

const RANGES = [
  { days: 7, label: '7 jours' },
  { days: 30, label: '30 jours' },
  { days: 90, label: '90 jours' },
];

export default function AdminAnalytics() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    supabase.functions.invoke('analytics', { body: { mode: 'overview', days } })
      .then(({ data: d, error: e }) => {
        if (cancelled) return;
        if (e || d?.error) { setError(d?.error || e?.message || 'Erreur'); setData(null); }
        else setData(d as Overview);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [days]);

  const sourceLabel = (s: string) => (s.startsWith('utm:') ? s.slice(4) : s);
  const maxSource = useMemo(() => Math.max(1, ...(data?.topSources || []).map((s) => s.count)), [data]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Analytics</h1>
          <p className="text-sm text-gray-500 mt-0.5">Audience et conversion du site, mesurées en direct (sans cookie ni outil externe).</p>
        </div>
        <div className="flex gap-1 bg-light-surface dark:bg-dark-surface p-1 rounded-input border border-light-border dark:border-dark-border">
          {RANGES.map((r) => (
            <button key={r.days} onClick={() => setDays(r.days)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${days === r.days ? 'bg-primary/15 text-primary' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-24 rounded-card" />)}</div>
          <div className="skeleton h-64 rounded-card" />
        </div>
      ) : error ? (
        <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card p-8 text-center text-sm text-gray-500">{error}</div>
      ) : data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi icon={Users} label="Visiteurs uniques" value={data.kpis.visitors} sub={`${data.kpis.newSessions} nouvelles sessions`} />
            <Kpi icon={Eye} label="Pages vues" value={data.kpis.pageviews} />
            <Kpi icon={Building2} label="Vues de fiches" value={data.kpis.establishmentViews} />
            <Kpi icon={Search} label="Recherches" value={data.kpis.searches} />
          </div>

          <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card p-6">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Fréquentation ({data.days} derniers jours)</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.series}>
                  <defs>
                    <linearGradient id="gPv" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7B2D8B" stopOpacity={0.4} /><stop offset="100%" stopColor="#7B2D8B" stopOpacity={0} /></linearGradient>
                    <linearGradient id="gVi" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#1a7a3a" stopOpacity={0.35} /><stop offset="100%" stopColor="#1a7a3a" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.12)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} interval="preserveStartEnd"
                    tickFormatter={(d) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} allowDecimals={false} width={28} />
                  <Tooltip contentStyle={{ background: '#16161f', border: '1px solid #2a2a35', borderRadius: 8, fontSize: 13, color: '#fff' }}
                    labelFormatter={(d) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                    formatter={(v: number, n: string) => [v, n === 'pageviews' ? 'Pages vues' : 'Visiteurs']} />
                  <Area type="monotone" dataKey="visitors" stroke="#1a7a3a" strokeWidth={2} fill="url(#gVi)" />
                  <Area type="monotone" dataKey="pageviews" stroke="#7B2D8B" strokeWidth={2} fill="url(#gPv)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Activité communauté */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <Kpi icon={UserPlus} label="Nouveaux membres" value={data.engagement.newMembers} />
            <Kpi icon={Ticket} label="Promos activées" value={data.engagement.promoActivations} />
            <Kpi icon={Heart} label="Favoris ajoutés" value={data.engagement.favorites} />
            <Kpi icon={Star} label="Avis publiés" value={data.engagement.reviews} />
            <Kpi icon={MessageCircle} label="Messages envoyés" value={data.engagement.messages} />
          </div>

          {/* Entonnoir de conversion */}
          <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card p-6">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Entonnoir de conversion</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <FunnelStep icon={Building2} label="Fiches consultées" value={data.funnel.views} base={data.funnel.views} first />
              <FunnelStep icon={ArrowRight} label="Clics « revendiquer »" value={data.funnel.claim_start} base={data.funnel.views} />
              <FunnelStep icon={BadgeCheck} label="Revendications envoyées" value={data.funnel.claim_submit} base={data.funnel.views} />
              <FunnelStep icon={Users} label="Inscriptions" value={data.funnel.register} base={data.funnel.views} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top fiches */}
            <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card p-6">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><Building2 size={15} className="text-primary" /> Fiches les plus vues</h2>
              {data.topFiches.length === 0 ? <Empty /> : (
                <div className="space-y-2">
                  {data.topFiches.map((f, i) => (
                    <div key={f.id} className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 w-4 text-right">{i + 1}</span>
                      <a href={`/establishment/${f.id}`} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 hover:text-primary">
                        <p className="text-sm text-gray-900 dark:text-white truncate">{f.name}</p>
                        {f.city && <p className="text-xs text-gray-500 truncate">{f.city}</p>}
                      </a>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white shrink-0">{f.views}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top recherches */}
            <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card p-6">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><Search size={15} className="text-primary" /> Recherches les plus fréquentes</h2>
              {data.topSearches.length === 0 ? <Empty /> : (
                <div className="space-y-2">
                  {data.topSearches.map((s, i) => (
                    <div key={s.q} className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 w-4 text-right">{i + 1}</span>
                      <span className="flex-1 min-w-0 text-sm text-gray-900 dark:text-white truncate capitalize">{s.q}</span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white shrink-0">{s.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Promos les plus activées */}
          <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card p-6">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><Ticket size={15} className="text-primary" /> Promos les plus activées</h2>
            {(!data.topPromos || data.topPromos.length === 0) ? <Empty /> : (
              <div className="space-y-2">
                {data.topPromos.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-4 text-right">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 dark:text-white truncate">{p.title}</p>
                      {p.establishment && <p className="text-xs text-gray-500 truncate">{p.establishment}</p>}
                    </div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white shrink-0">{p.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sources de trafic */}
          <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card p-6">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><Globe size={15} className="text-primary" /> Sources de trafic</h2>
            {data.topSources.length === 0 ? <Empty /> : (
              <div className="space-y-3">
                {data.topSources.map((s) => (
                  <div key={s.source}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-700 dark:text-gray-300 truncate">{sourceLabel(s.source)}</span>
                      <span className="font-semibold text-gray-900 dark:text-white ml-2">{s.count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-200 dark:bg-dark-border overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(s.count / maxSource) * 100}%`, background: '#7B2D8B' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub }: { icon: any; label: string; value: number; sub?: string }) {
  return (
    <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card p-5">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-input bg-primary/10 flex items-center justify-center"><Icon size={18} className="text-primary" /></div>
        <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value.toLocaleString('fr-FR')}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

function FunnelStep({ icon: Icon, label, value, base, first }: { icon: any; label: string; value: number; base: number; first?: boolean }) {
  const rate = base > 0 ? Math.round((value / base) * 100) : 0;
  return (
    <div className="rounded-input p-4 border border-light-border dark:border-dark-border" style={{ background: 'var(--pn-surface2, transparent)' }}>
      <div className="flex items-center gap-2 mb-2"><Icon size={15} className="text-primary" /><span className="text-xs text-gray-500">{label}</span></div>
      <p className="text-xl font-bold text-gray-900 dark:text-white">{value.toLocaleString('fr-FR')}</p>
      {!first && <p className="text-xs mt-1 flex items-center gap-1" style={{ color: '#1a7a3a' }}><TrendingUp size={11} /> {rate}% des vues</p>}
      {first && <p className="text-xs text-gray-500 mt-1">point de départ</p>}
    </div>
  );
}

function Empty() { return <p className="text-sm text-gray-500 py-4 text-center">Pas encore de données sur cette période.</p>; }
