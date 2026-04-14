import { useEffect, useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { CalendarDays, Tag, Eye, CreditCard } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Establishment } from '../../lib/types';

interface PartnerContext {
  establishment: Establishment;
  reload: () => void;
}

export default function PartnerDashboard() {
  const { establishment } = useOutletContext<PartnerContext>();
  const navigate = useNavigate();
  const [activeEvents, setActiveEvents] = useState(0);
  const [activePromos, setActivePromos] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const now = new Date().toISOString();
        const [evRes, prRes] = await Promise.all([
          supabase.from('events').select('*', { count: 'exact', head: true }).eq('establishment_id', establishment.id).gte('event_date', now),
          supabase.from('promotions').select('*', { count: 'exact', head: true }).eq('establishment_id', establishment.id).gte('valid_until', now),
        ]);
        setActiveEvents(evRes.count ?? 0);
        setActivePromos(prRes.count ?? 0);
      } catch { /* handled */ }
      setLoading(false);
    };
    load();
  }, [establishment.id]);

  const subscriptionLabel = establishment.is_pro
    ? `Pro — expire le ${new Date(establishment.pro_expires_at || '').toLocaleDateString('fr-FR')}`
    : 'Gratuit';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Bonjour !</h1>
        <p className="text-sm text-gray-400 mt-1">{establishment.name}</p>
        <div className="mt-2">
          {establishment.is_pro ? (
            <span className="badge-pro text-xs">Pro</span>
          ) : (
            <span className="badge text-xs bg-gray-700 text-gray-400">Gratuit</span>
          )}
        </div>
      </div>

      {!establishment.is_pro && (
        <div className="bg-primary/10 border border-primary/20 rounded-card p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1">
            <p className="text-sm font-medium text-white">Passe au profil Pro pour debloquer la galerie, les evenements et les promotions</p>
            <p className="text-xs text-gray-400 mt-1">69 EUR/mois</p>
          </div>
          <button onClick={() => navigate('/pros/subscription')} className="btn-primary text-sm py-2 px-4 shrink-0">
            Passer Pro
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          [1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-24 rounded-card" />)
        ) : (
          <>
            <MetricCard icon={CreditCard} label="Abonnement" value={subscriptionLabel} />
            <MetricCard icon={Eye} label="Vues de la fiche" value="0" />
            <MetricCard icon={CalendarDays} label="Evenements actifs" value={String(activeEvents)} />
            <MetricCard icon={Tag} label="Promos actives" value={String(activePromos)} />
          </>
        )}
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="bg-dark-surface border border-dark-border rounded-card p-5">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-input bg-primary/10 flex items-center justify-center">
          <Icon size={18} className="text-primary" />
        </div>
        <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-lg font-bold text-white">{value}</p>
    </div>
  );
}
