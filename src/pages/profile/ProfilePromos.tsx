import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tag, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Promotion } from '../../lib/types';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

interface ProfilePromosProps {
  userId: string;
}

export default function ProfilePromos({ userId }: ProfilePromosProps) {
  const navigate = useNavigate();
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: favData } = await supabase
        .from('favorites')
        .select('establishment_id')
        .eq('user_id', userId);

      const estIds = favData?.map((f) => f.establishment_id) || [];

      if (estIds.length === 0) {
        setPromos([]);
        setLoading(false);
        return;
      }

      const now = new Date().toISOString();
      const { data } = await supabase
        .from('promotions')
        .select('*, establishment:establishments(name, logo_url)')
        .in('establishment_id', estIds)
        .gte('valid_until', now)
        .lte('valid_from', now)
        .order('valid_until', { ascending: true })
        .limit(10);

      setPromos((data as Promotion[]) || []);
      setLoading(false);
    };
    load();
  }, [userId]);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

  const promoLabel = (p: Promotion) => {
    if (p.promo_type === 'percentage' && p.value) return `-${p.value}%`;
    if (p.promo_type === 'fixed' && p.value) return `-${p.value} EUR`;
    return 'Offre';
  };

  return (
    <section>
      <h2 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <Tag size={18} className="text-primary" />
        Mes promos actives
      </h2>

      {loading ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner size={24} />
        </div>
      ) : promos.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Aucune promo active pour le moment. Jette un oeil aux offres en cours !
          </p>
          <button
            onClick={() => navigate('/promos')}
            className="text-sm text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1.5"
          >
            Voir les promos
            <ArrowRight size={14} />
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {promos.map((promo) => (
            <div
              key={promo.id}
              onClick={() => navigate(`/establishment/${promo.establishment_id}`)}
              className="card-hover p-3 flex items-center gap-3 cursor-pointer"
            >
              <span className="shrink-0 px-2.5 py-1 rounded-pill text-xs font-bold bg-primary/10 text-primary">
                {promoLabel(promo)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {promo.title}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Jusqu'au {formatDate(promo.valid_until)}
                </p>
                {promo.establishment && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                    {(promo.establishment as any).name}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
