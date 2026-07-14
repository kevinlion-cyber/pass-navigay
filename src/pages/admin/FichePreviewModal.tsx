import { X, MapPin, Phone, Globe, Map, Heart, Share2 } from 'lucide-react';
import { useCategories } from '../../contexts/CategoriesContext';
import type { CategoryKey } from '../../lib/types';
import StarRating from '../../components/ui/StarRating';

// Aperçu d'une fiche EXACTEMENT comme la page publique (EstablishmentDetail) l'affichera
// une fois publiée. Alimenté par un brouillon (données Google + texte IA).
export interface FichePreviewData {
  name: string;
  category: string;
  ai_subcategory?: string | null;
  ai_description?: string | null;
  ai_tags?: string[] | null;
  address?: string;
  postal_code?: string;
  city?: string;
  phone?: string;
  website?: string;
  google_rating?: number | null;
  google_rating_count?: number | null;
}

export default function FichePreviewModal({ data, open, onClose }: { data: FichePreviewData | null; open: boolean; onClose: () => void }) {
  const { categories } = useCategories();
  if (!open || !data) return null;

  const categoryLabel = categories[data.category as CategoryKey]?.label || data.category;
  const rating = data.google_rating ?? 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.65)' }} onClick={onClose}>
      <div className="w-full max-w-[430px] my-6 bg-light-bg dark:bg-dark-bg rounded-card overflow-hidden shadow-2xl border border-light-border dark:border-dark-border" onClick={(e) => e.stopPropagation()}>
        {/* Barre d'aperçu */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-light-surface dark:bg-dark-surface border-b border-light-border dark:border-dark-border">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Aperçu de la fiche</span>
          <button onClick={onClose} className="p-1 text-gray-500 hover:text-gray-900 dark:hover:text-white"><X size={18} /></button>
        </div>

        {/* Bannière (placeholder, comme le site quand pas encore de visuel) */}
        <div className="w-full h-40 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-dark-border dark:to-dark-bg flex items-center justify-center overflow-hidden">
          <div className="text-center">
            <MapPin size={36} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-sm text-gray-400 dark:text-gray-500">{data.name}</p>
          </div>
        </div>

        <div className="p-4 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-card bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-primary text-2xl font-semibold">{data.name.charAt(0)}</span>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{data.name}</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {categoryLabel}{data.ai_subcategory ? ` · ${data.ai_subcategory}` : ''}
                </p>
                {rating > 0 && (
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <StarRating rating={Math.round(rating)} size={14} />
                    <span className="text-xs text-gray-400">({data.google_rating_count ?? 0})</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="btn-ghost p-2 opacity-40"><Heart size={18} /></span>
              <span className="btn-ghost p-2 opacity-40"><Share2 size={18} /></span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400 flex-1">
              <MapPin size={16} className="shrink-0 mt-0.5" />
              <span>{[data.address, [data.postal_code, data.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</span>
            </div>
            <span className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary bg-primary/10 rounded-lg opacity-70">
              <Map size={14} /> Itinéraire
            </span>
          </div>

          {data.ai_description && (
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{data.ai_description}</p>
          )}

          {(data.phone || data.website) && (
            <div className="flex flex-wrap gap-4 text-sm">
              {data.phone && (
                <span className="flex items-center gap-2 text-primary"><Phone size={14} /> {data.phone}</span>
              )}
              {data.website && (
                <span className="flex items-center gap-2 text-primary truncate max-w-[220px]"><Globe size={14} /> {data.website.replace(/^https?:\/\//, '')}</span>
              )}
            </div>
          )}

          {data.ai_tags && data.ai_tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {data.ai_tags.map((t) => (
                <span key={t} className="text-xs text-gray-500 bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border px-2 py-0.5 rounded-full">{t}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
