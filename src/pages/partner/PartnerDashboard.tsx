import { useEffect, useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import {
  CalendarDays, Tag, Eye, CreditCard, TrendingUp,
  ArrowRight, ChevronRight, Users, BarChart3,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { supabase } from '../../lib/supabase';
import type { Establishment, Event, Promotion } from '../../lib/types';

interface ViewStats { total: number; last30: number; last7: number; uniqueVisitors30: number; series: { date: string; value: number }[] }

interface PartnerContext {
  establishment: Establishment;
  reload: () => void;
}

interface DashboardData {
  activeEvents: number;
  pastEventsThisMonth: number;
  activePromos: number;
  expiredPromos: number;
  promoUses: number;
  views: number;
  viewStats: ViewStats | null;
  recentEvents: Event[];
  recentPromos: Promotion[];
}

export default function PartnerDashboard() {
  const { establishment } = useOutletContext<PartnerContext>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData>({
    activeEvents: 0,
    pastEventsThisMonth: 0,
    activePromos: 0,
    expiredPromos: 0,
    promoUses: 0,
    views: 0,
    viewStats: null,
    recentEvents: [],
    recentPromos: [],
  });

  useEffect(() => {
    const load = async () => {
      try {
        const now = new Date().toISOString();
        const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

        const [evActiveRes, evPastRes, prActiveRes, prExpiredRes, evRecentRes, prRecentRes] = await Promise.all([
          supabase.from('events').select('*', { count: 'exact', head: true })
            .eq('establishment_id', establishment.id).gte('event_date', now),
          supabase.from('events').select('*', { count: 'exact', head: true })
            .eq('establishment_id', establishment.id).lt('event_date', now).gte('event_date', monthStart),
          supabase.from('promotions').select('*', { count: 'exact', head: true })
            .eq('establishment_id', establishment.id).gte('valid_until', now),
          supabase.from('promotions').select('*', { count: 'exact', head: true })
            .eq('establishment_id', establishment.id).lt('valid_until', now),
          supabase.from('events').select('*')
            .eq('establishment_id', establishment.id).gte('event_date', now)
            .order('event_date', { ascending: true }).limit(3),
          supabase.from('promotions').select('*')
            .eq('establishment_id', establishment.id).gte('valid_until', now)
            .order('valid_until', { ascending: true }).limit(3),
        ]);

        // Nombre total d'utilisations des promotions de l'établissement
        const { data: promoIdRows } = await supabase
          .from('promotions').select('id').eq('establishment_id', establishment.id);
        const promoIdList = (promoIdRows || []).map((r: { id: string }) => r.id);
        let promoUses = 0;
        if (promoIdList.length) {
          const { count } = await supabase
            .from('promotion_uses').select('*', { count: 'exact', head: true })
            .in('promotion_id', promoIdList);
          promoUses = count ?? 0;
        }

        // Statistiques réelles de la fiche via l'analytics first-party.
        let views = 0;
        let viewStats: ViewStats | null = null;
        try {
          const { data: av } = await supabase.functions.invoke('analytics', {
            body: { mode: 'establishment', establishmentId: establishment.id },
          });
          if (av && !av.error) { views = av.last30 ?? 0; viewStats = av as ViewStats; }
        } catch { /* best-effort */ }

        setData({
          activeEvents: evActiveRes.count ?? 0,
          pastEventsThisMonth: evPastRes.count ?? 0,
          activePromos: prActiveRes.count ?? 0,
          expiredPromos: prExpiredRes.count ?? 0,
          promoUses,
          views,
          viewStats,
          recentEvents: (evRecentRes.data as Event[]) || [],
          recentPromos: (prRecentRes.data as Promotion[]) || [],
        });
      } catch {
        // handled
      }
      setLoading(false);
    };
    load();
  }, [establishment.id]);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });

  const formatExpiry = (d: string | null) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const promoLabel = (p: Promotion) => {
    if (p.promo_type === 'percentage' && p.value) return `-${p.value}%`;
    if (p.promo_type === 'fixed' && p.value) return `-${p.value} \u20ac`;
    return 'Offre';
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Bonjour {establishment.name} <span role="img" aria-label="wave">👋</span>
        </h1>
        <p className="text-sm text-gray-400 mt-1">Bienvenue dans votre espace partenaire Pass Navigay.</p>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-sm text-gray-500">{establishment.name}</span>
          {establishment.is_pro ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-pill text-xs font-semibold"
              style={{ background: 'rgba(123,45,139,0.15)', color: '#7B2D8B' }}>
              Pro
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-pill text-xs font-medium bg-gray-700 text-gray-400">
              Gratuit
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton h-32 rounded-card" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Abonnement */}
            <div className="rounded-card p-5"
              style={establishment.is_pro
                ? { background: 'rgba(123,45,139,0.1)', border: '1px solid rgba(123,45,139,0.3)' }
                : { background: 'var(--pn-surface)', border: '1px solid var(--pn-border2)' }
              }>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-input flex items-center justify-center"
                  style={{ background: 'rgba(123,45,139,0.15)' }}>
                  <CreditCard size={18} style={{ color: '#7B2D8B' }} />
                </div>
                <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Abonnement</span>
              </div>
              {establishment.is_pro ? (
                <>
                  <p className="text-lg font-bold" style={{ color: '#7B2D8B' }}>Pro ✓</p>
                  <p className="text-xs text-gray-500 mt-1">Expire le {formatExpiry(establishment.pro_expires_at)}</p>
                  <button onClick={() => navigate('/pros/abonnement')}
                    className="text-xs mt-2 font-medium hover:underline"
                    style={{ color: '#7B2D8B' }}>
                    Gérer <ArrowRight size={12} className="inline ml-0.5" />
                  </button>
                </>
              ) : (
                <>
                  <p className="text-lg font-bold text-gray-400">Gratuit</p>
                  <button onClick={() => navigate('/pros/abonnement')}
                    className="text-xs mt-2 font-semibold px-3 py-1.5 rounded-input transition-colors hover:opacity-90"
                    style={{ background: '#7B2D8B', color: '#fff' }}>
                    Passez Pro
                  </button>
                </>
              )}
            </div>

            {/* Vues */}
            <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-input flex items-center justify-center"
                  style={{ background: 'rgba(123,45,139,0.15)' }}>
                  <Eye size={18} style={{ color: '#7B2D8B' }} />
                </div>
                <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Vues de la fiche</span>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{data.views}</p>
              <p className="text-xs text-gray-500 mt-1">ce mois-ci</p>
              {data.views > 0 ? (
                <p className="text-xs mt-1 flex items-center gap-1" style={{ color: '#1a7a3a' }}>
                  <TrendingUp size={12} /> en hausse
                </p>
              ) : (
                <p className="text-xs text-gray-500 mt-1">Pas encore de vues</p>
              )}
            </div>

            {/* Événements */}
            <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-input flex items-center justify-center"
                  style={{ background: 'rgba(123,45,139,0.15)' }}>
                  <CalendarDays size={18} style={{ color: '#7B2D8B' }} />
                </div>
                <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Événements à venir</span>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{data.activeEvents}</p>
              <p className="text-xs text-gray-500 mt-1">{data.pastEventsThisMonth} passé{data.pastEventsThisMonth > 1 ? 's' : ''} ce mois</p>
              {data.activeEvents === 0 && (
                <button onClick={() => navigate('/pros/evenements')}
                  className="text-xs mt-2 font-medium hover:underline"
                  style={{ color: '#7B2D8B' }}>
                  + Créer un événement <ArrowRight size={12} className="inline ml-0.5" />
                </button>
              )}
            </div>

            {/* Promos */}
            <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-input flex items-center justify-center"
                  style={{ background: 'rgba(123,45,139,0.15)' }}>
                  <Tag size={18} style={{ color: '#7B2D8B' }} />
                </div>
                <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Promos actives</span>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{data.activePromos}</p>
              <p className="text-xs text-gray-500 mt-1">{data.expiredPromos} expirée{data.expiredPromos > 1 ? 's' : ''}</p>
              {data.activePromos === 0 && (
                <button onClick={() => navigate('/pros/promotions')}
                  className="text-xs mt-2 font-medium hover:underline"
                  style={{ color: '#7B2D8B' }}>
                  + Créer une promo <ArrowRight size={12} className="inline ml-0.5" />
                </button>
              )}
            </div>

            {/* Promos utilisées */}
            <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-input flex items-center justify-center"
                  style={{ background: 'rgba(26,122,58,0.12)' }}>
                  <TrendingUp size={18} style={{ color: '#1a7a3a' }} />
                </div>
                <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Promos utilisées</span>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{data.promoUses}</p>
              <p className="text-xs text-gray-500 mt-1">total des validations</p>
            </div>
          </div>

          {/* Statistiques de la page */}
          <div className="rounded-card p-5" style={{ background: 'var(--pn-surface)', border: '1px solid var(--pn-border2)' }}>
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={18} style={{ color: '#7B2D8B' }} />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Statistiques de votre page</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <MiniStat icon={Eye} label="Vues totales" value={data.viewStats?.total ?? 0} />
              <MiniStat icon={TrendingUp} label="30 derniers jours" value={data.viewStats?.last30 ?? 0} />
              <MiniStat icon={CalendarDays} label="7 derniers jours" value={data.viewStats?.last7 ?? 0} />
              <MiniStat icon={Users} label="Visiteurs uniques (30j)" value={data.viewStats?.uniqueVisitors30 ?? 0} />
            </div>
            {data.viewStats && data.viewStats.total > 0 ? (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.viewStats.series}>
                    <defs><linearGradient id="pnViews" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7B2D8B" stopOpacity={0.35} /><stop offset="100%" stopColor="#7B2D8B" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.12)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} interval="preserveStartEnd" tickFormatter={(d) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} />
                    <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} allowDecimals={false} width={26} />
                    <Tooltip contentStyle={{ background: '#16161f', border: '1px solid #2a2a35', borderRadius: 8, fontSize: 13, color: '#fff' }} labelFormatter={(d) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} formatter={(v: number) => [v, 'Vues']} />
                    <Area type="monotone" dataKey="value" stroke="#7B2D8B" strokeWidth={2} fill="url(#pnViews)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-6">Votre page n'a pas encore été consultée. Complétez votre fiche et partagez-la pour attirer vos premiers visiteurs.</p>
            )}
            {!establishment.is_pro && data.viewStats && data.viewStats.total > 0 && (
              <div className="mt-4 flex items-center justify-between gap-3 flex-wrap rounded-input p-3" style={{ background: 'rgba(123,45,139,0.08)' }}>
                <p className="text-sm text-gray-700 dark:text-gray-300">Passez Pro pour ressortir en tête des résultats et gagner encore plus de vues.</p>
                <button onClick={() => navigate('/pros/abonnement')} className="text-xs font-semibold px-3 py-1.5 rounded-input shrink-0" style={{ background: '#7B2D8B', color: '#fff' }}>Passez Pro</button>
              </div>
            )}
          </div>

          {/* Actions rapides */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Par où commencer ?</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <QuickActionCard
                emoji="🏪"
                title="Compléter ma fiche"
                text="Ajoutez votre description, vos photos et vos coordonnées pour attirer plus de visiteurs."
                buttonLabel="Modifier ma fiche"
                onClick={() => navigate('/pros/mon-etablissement')}
                showBadge={!establishment.description}
              />
              <QuickActionCard
                emoji="📅"
                title="Publier un événement"
                text="Touchez des milliers de membres en publiant vos prochaines soirées, brunchs ou concerts."
                buttonLabel="Créer un événement"
                onClick={() => navigate('/pros/evenements')}
              />
              <QuickActionCard
                emoji="🏷"
                title="Lancer une promotion"
                text="Attirez de nouveaux clients avec une offre exclusive réservée aux membres Pass Navigay."
                buttonLabel="Créer une promo"
                onClick={() => navigate('/pros/promotions')}
              />
            </div>
          </div>

          {/* Derniers événements */}
          {data.recentEvents.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Mes derniers événements</h2>
                <button onClick={() => navigate('/pros/evenements')}
                  className="text-xs font-medium hover:underline flex items-center gap-1"
                  style={{ color: '#7B2D8B' }}>
                  Voir tous mes événements <ChevronRight size={14} />
                </button>
              </div>
              <div className="space-y-2">
                {data.recentEvents.map((ev) => (
                  <div key={ev.id} className="flex items-center gap-4 p-3 rounded-card"
                    style={{ background: 'var(--pn-surface)', border: '1px solid var(--pn-border2)' }}>
                    <div className="w-12 h-12 rounded-input overflow-hidden shrink-0 bg-gray-200 dark:bg-dark-border">
                      {ev.image_url ? (
                        <img src={ev.image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <CalendarDays size={18} className="text-gray-600" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{ev.title}</p>
                      <p className="text-xs text-gray-500 capitalize">{formatDate(ev.event_date)}</p>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-pill text-xs font-medium shrink-0"
                      style={{ background: 'rgba(26,122,58,0.1)', color: '#1a7a3a' }}>
                      À venir
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dernières promos */}
          {data.recentPromos.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Mes dernières promos</h2>
                <button onClick={() => navigate('/pros/promotions')}
                  className="text-xs font-medium hover:underline flex items-center gap-1"
                  style={{ color: '#7B2D8B' }}>
                  Voir toutes mes promos <ChevronRight size={14} />
                </button>
              </div>
              <div className="space-y-2">
                {data.recentPromos.map((p) => (
                  <div key={p.id} className="flex items-center gap-4 p-3 rounded-card"
                    style={{ background: 'var(--pn-surface)', border: '1px solid var(--pn-border2)' }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{p.title}</p>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-pill text-xs font-semibold shrink-0"
                          style={{ background: 'rgba(123,45,139,0.15)', color: '#7B2D8B' }}>
                          {promoLabel(p)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        Jusqu'au {new Date(p.valid_until).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                      </p>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-pill text-xs font-medium shrink-0"
                      style={{ background: 'rgba(26,122,58,0.1)', color: '#1a7a3a' }}>
                      Active
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MiniStat({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-input p-3 text-center">
      <Icon size={16} className="mx-auto mb-1" style={{ color: '#7B2D8B' }} />
      <p className="text-lg font-bold text-gray-900 dark:text-white leading-none">{value.toLocaleString('fr-FR')}</p>
      <p className="text-[11px] text-gray-500 mt-1">{label}</p>
    </div>
  );
}

function QuickActionCard({
  emoji, title, text, buttonLabel, onClick, showBadge,
}: {
  emoji: string;
  title: string;
  text: string;
  buttonLabel: string;
  onClick: () => void;
  showBadge?: boolean;
}) {
  return (
    <button onClick={onClick} className="relative text-left p-6 rounded-card transition-all duration-200 group"
      style={{ background: 'var(--pn-surface2)', border: '1px solid var(--pn-border)' }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#7B2D8B';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--pn-border)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}>
      {showBadge && (
        <span className="absolute top-3 right-3 text-xs font-medium px-2 py-0.5 rounded-pill"
          style={{ background: 'rgba(234,148,40,0.15)', color: '#ea9428' }}>
          À compléter
        </span>
      )}
      <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl mb-4"
        style={{ background: 'rgba(123,45,139,0.15)' }}>
        {emoji}
      </div>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">{title}</h3>
      <p className="text-xs text-gray-500 leading-relaxed mb-4">{text}</p>
      <span className="text-xs font-medium flex items-center gap-1" style={{ color: '#7B2D8B' }}>
        {buttonLabel} <ArrowRight size={12} />
      </span>
    </button>
  );
}
