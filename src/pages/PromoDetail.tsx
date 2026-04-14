import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tag, Clock, ChevronLeft, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Promotion } from '../lib/types';
import LoadingSpinner from '../components/ui/LoadingSpinner';

export default function PromoDetail() {
  const { promoId } = useParams<{ promoId: string }>();
  const navigate = useNavigate();
  const [promo, setPromo] = useState<Promotion | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!promoId) return;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('promotions')
        .select('*, establishment:establishments(id, name, logo_url, city, address)')
        .eq('id', promoId)
        .maybeSingle();
      if (data) setPromo(data as unknown as Promotion);
      setLoading(false);
    };
    load();
  }, [promoId]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size={40} />
      </div>
    );
  }

  if (!promo) {
    return (
      <div className="text-center py-20 text-gray-500">
        <p>Promotion non trouvee.</p>
        <button onClick={() => navigate('/promos')} className="btn-primary mt-4">
          Retour aux promotions
        </button>
      </div>
    );
  }

  const est = promo.establishment as any;

  const promoLabel = () => {
    if (promo.promo_type === 'percentage' && promo.value) return `-${promo.value}%`;
    if (promo.promo_type === 'fixed' && promo.value) return `-${promo.value} EUR`;
    return 'Offre speciale';
  };

  const promoTypeLabel = () => {
    if (promo.promo_type === 'percentage') return 'Reduction en pourcentage';
    if (promo.promo_type === 'fixed') return 'Reduction montant fixe';
    if (promo.promo_type === 'recurring') return 'Offre recurrente';
    return 'Offre speciale';
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  const daysLeft = () => {
    const diff = new Date(promo.valid_until).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const remaining = daysLeft();
  const isExpired = new Date(promo.valid_until) < new Date();

  return (
    <div className="max-w-3xl mx-auto pb-8">
      {promo.image_url && (
        <img
          src={promo.image_url}
          alt={promo.title}
          className="w-full h-48 md:h-64 object-cover"
        />
      )}

      <div className="p-4 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {promo.title}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {promoTypeLabel()}
            </p>
          </div>
          <span className="shrink-0 text-2xl font-bold text-primary">
            {promoLabel()}
          </span>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
            <Calendar size={16} className="shrink-0 text-success" />
            <span>Du {formatDate(promo.valid_from)} au {formatDate(promo.valid_until)}</span>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <Clock size={16} className="shrink-0 text-success" />
            {isExpired ? (
              <span className="text-alert font-medium">Expiree</span>
            ) : remaining <= 3 ? (
              <span className="text-alert font-medium">Plus que {remaining} jour{remaining > 1 ? 's' : ''} !</span>
            ) : (
              <span className="text-gray-600 dark:text-gray-400">{remaining} jours restants</span>
            )}
          </div>

          {promo.is_recurring && promo.recurrence_rule && (
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
              <Tag size={16} className="shrink-0 text-success" />
              <span>Recurrente : {promo.recurrence_rule}</span>
            </div>
          )}
        </div>

        {promo.description && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Description</h2>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
              {promo.description}
            </p>
          </div>
        )}

        {est && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Etablissement</h2>
            <div
              onClick={() => navigate(`/establishment/${est.id}`)}
              className="card p-4 flex items-center gap-4 cursor-pointer hover:ring-1 hover:ring-primary/30 transition-shadow"
            >
              <div className="w-12 h-12 rounded-card bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                {est.logo_url ? (
                  <img src={est.logo_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-primary font-semibold">{est.name?.charAt(0)}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-white">{est.name}</p>
                {(est.city || est.address) && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {est.address ? `${est.address}, ` : ''}{est.city || ''}
                  </p>
                )}
              </div>
              <ChevronLeft size={16} className="ml-auto rotate-180 text-gray-400 shrink-0" />
            </div>
          </div>
        )}

        <button onClick={() => navigate(-1)} className="btn-ghost flex items-center gap-2">
          <ChevronLeft size={16} />
          Retour
        </button>
      </div>
    </div>
  );
}
