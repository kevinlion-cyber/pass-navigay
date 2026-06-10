import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, Building2, CalendarDays, Tag, Crown, TrendingUp, ShieldCheck, DollarSign } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Stats {
  members: number;
  premiumMembers: number;
  verifiedMembers: number;
  establishments: { total: number; pro: number; sponsors: number };
  upcomingEvents: number;
  activePromos: number;
  newThisWeek: number;
  estimatedRevenue: number;
}

interface ChartPoint {
  date: string;
  count: number;
}

interface RecentMember {
  id: string;
  username: string;
  avatar_url: string | null;
  created_at: string;
}

interface RecentEstablishment {
  id: string;
  name: string;
  category: string;
  is_pro: boolean;
  is_sponsor: boolean;
  created_at: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [chart, setChart] = useState<ChartPoint[]>([]);
  const [recentMembers, setRecentMembers] = useState<RecentMember[]>([]);
  const [recentEstablishments, setRecentEstablishments] = useState<RecentEstablishment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const now = new Date().toISOString();
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        const [membersRes, premiumRes, verifiedRes, estRes, eventsRes, promosRes, chartRes, weekRes, rmRes, reRes] = await Promise.all([
          supabase.from('profiles').select('*', { count: 'exact', head: true }),
          supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_premium', true),
          supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_verified', true),
          supabase.from('establishments').select('id, is_pro, is_sponsor'),
          supabase.from('events').select('*', { count: 'exact', head: true }).gte('event_date', now),
          supabase.from('promotions').select('*', { count: 'exact', head: true }).gte('valid_until', now),
          supabase.from('profiles').select('created_at').gte('created_at', thirtyDaysAgo),
          supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
          supabase.from('profiles').select('id, username, avatar_url, created_at').order('created_at', { ascending: false }).limit(5),
          supabase.from('establishments').select('id, name, category, is_pro, is_sponsor, created_at').order('created_at', { ascending: false }).limit(5),
        ]);

        const estData = estRes.data || [];
        const proCount = estData.filter((e: any) => e.is_pro).length;

        setStats({
          members: membersRes.count ?? 0,
          premiumMembers: premiumRes.count ?? 0,
          verifiedMembers: verifiedRes.count ?? 0,
          establishments: {
            total: estData.length,
            pro: proCount,
            sponsors: estData.filter((e: any) => e.is_sponsor).length,
          },
          upcomingEvents: eventsRes.count ?? 0,
          activePromos: promosRes.count ?? 0,
          newThisWeek: weekRes.count ?? 0,
          estimatedRevenue: proCount * 690,
        });

        const grouped: Record<string, number> = {};
        (chartRes.data || []).forEach((p: any) => {
          const d = p.created_at.slice(0, 10);
          grouped[d] = (grouped[d] || 0) + 1;
        });
        const chartData: ChartPoint[] = [];
        for (let i = 29; i >= 0; i--) {
          const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
          chartData.push({ date: d, count: grouped[d] || 0 });
        }
        setChart(chartData);
        setRecentMembers((rmRes.data as any) || []);
        setRecentEstablishments((reRes.data as any) || []);
      } catch { /* handled */ }
      setLoading(false);
    };
    load();
  }, []);

  const daysAgo = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return "aujourd'hui";
    if (diff === 1) return 'il y a 1 jour';
    return `il y a ${diff} jours`;
  };

  const statusBadge = (est: RecentEstablishment) => {
    if (est.is_sponsor) return <span className="badge-sponsor text-xs">Sponsor</span>;
    if (est.is_pro) return <span className="badge-pro text-xs">Pro</span>;
    return <span className="badge text-xs bg-gray-700 text-gray-400">Gratuit</span>;
  };

  const conversionRate = stats && stats.members > 0
    ? ((stats.premiumMembers / stats.members) * 100).toFixed(1)
    : '0';

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <div key={i} className="skeleton h-24 rounded-card" />)}
        </div>
        <div className="skeleton h-64 rounded-card" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-white">Tableau de bord</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard icon={Users} label="Membres inscrits" value={String(stats?.members ?? 0)} sub={`+${stats?.newThisWeek ?? 0} cette semaine`} />
        <MetricCard icon={Crown} label="Membres Premium" value={String(stats?.premiumMembers ?? 0)} sub={`${conversionRate}% de conversion`} />
        <MetricCard icon={ShieldCheck} label="Comptes verifies" value={String(stats?.verifiedMembers ?? 0)} />
        <MetricCard icon={DollarSign} label="Revenu annuel estime" value={`${stats?.estimatedRevenue ?? 0} EUR`} sub={`${stats?.establishments.pro ?? 0} Pro x 690 EUR`} />
        <MetricCard
          icon={Building2}
          label="Etablissements"
          value={`${stats?.establishments.total ?? 0} total`}
          sub={`${stats?.establishments.pro ?? 0} Pro · ${stats?.establishments.sponsors ?? 0} sponsors`}
        />
        <MetricCard icon={CalendarDays} label="Evenements a venir" value={String(stats?.upcomingEvents ?? 0)} />
        <MetricCard icon={Tag} label="Promos actives" value={String(stats?.activePromos ?? 0)} />
        <MetricCard icon={TrendingUp} label="Nouveaux (7j)" value={String(stats?.newThisWeek ?? 0)} />
      </div>

      <div className="bg-dark-surface border border-dark-border rounded-card p-6">
        <h2 className="text-sm font-semibold text-white mb-4">Inscriptions (30 derniers jours)</h2>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickFormatter={(d) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: '#16161f', border: '1px solid #2a2a35', borderRadius: 8, fontSize: 13 }}
                labelFormatter={(d) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              />
              <Line type="monotone" dataKey="count" stroke="#7B2D8B" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-dark-surface border border-dark-border rounded-card p-6">
          <h2 className="text-sm font-semibold text-white mb-4">Derniers membres inscrits</h2>
          <div className="space-y-3">
            {recentMembers.map((m) => (
              <div key={m.id} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 overflow-hidden">
                  {m.avatar_url ? (
                    <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-primary text-xs font-medium">{m.username?.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{m.username}</p>
                  <p className="text-xs text-gray-500">{daysAgo(m.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-dark-surface border border-dark-border rounded-card p-6">
          <h2 className="text-sm font-semibold text-white mb-4">Derniers etablissements</h2>
          <div className="space-y-3">
            {recentEstablishments.map((e) => (
              <div key={e.id} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{e.name}</p>
                  <p className="text-xs text-gray-500">{e.category} · {daysAgo(e.created_at)}</p>
                </div>
                {statusBadge(e)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-dark-surface border border-dark-border rounded-card p-5">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-input bg-primary/10 flex items-center justify-center">
          <Icon size={18} className="text-primary" />
        </div>
        <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}
