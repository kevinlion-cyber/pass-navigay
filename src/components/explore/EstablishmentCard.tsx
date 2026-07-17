import { useNavigate } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { useCategories } from '../../contexts/CategoriesContext';
import type { Establishment, CategoryKey } from '../../lib/types';
import StarRating from '../ui/StarRating';
import ShieldRating from '../ui/ShieldRating';

interface EstablishmentCardProps {
  establishment: Establishment;
}

export default function EstablishmentCard({ establishment }: EstablishmentCardProps) {
  const navigate = useNavigate();
  const { categories } = useCategories();
  const categoryLabel = categories[establishment.category as CategoryKey]?.label || establishment.category;

  return (
    <div
      onClick={() => navigate(`/lieu/${establishment.slug || establishment.id}`)}
      className="card-hover p-4 flex gap-4"
    >
      <div className="w-14 h-14 rounded-card bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
        {establishment.logo_url ? (
          <img src={establishment.logo_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-primary text-lg font-semibold">
            {establishment.name.charAt(0)}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-medium text-gray-900 dark:text-white truncate">
            {establishment.name}
          </h3>
          {establishment.is_pro && <span className="badge-pro">PRO</span>}
          {establishment.is_sponsor && <span className="badge-sponsor">Sponsor</span>}
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {categoryLabel} &middot; {establishment.subcategory}
        </p>

        <div className="flex items-center gap-1 mt-1 text-xs text-gray-400 dark:text-gray-500">
          <MapPin size={12} />
          <span className="truncate">{establishment.address}, {establishment.city}</span>
        </div>

        {((establishment.avg_rating ?? 0) > 0 || (establishment.avg_safety_rating ?? 0) > 0) && (
          <div className="flex items-center gap-3 mt-1.5">
            {(establishment.avg_rating ?? 0) > 0 && (
              <div className="flex items-center gap-1.5">
                <StarRating rating={Math.round(establishment.avg_rating!)} size={12} />
                <span className="text-xs text-gray-400">({establishment.review_count})</span>
              </div>
            )}
            {(establishment.avg_safety_rating ?? 0) > 0 && (
              <ShieldRating rating={Math.round(establishment.avg_safety_rating!)} size={12} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
