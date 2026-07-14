import { useEffect, useState } from 'react';
import { X, MapPin, Phone, Globe, Map, Heart, Share2 } from 'lucide-react';
import { useCategories } from '../../contexts/CategoriesContext';
import type { CategoryKey } from '../../lib/types';
import StarRating from '../../components/ui/StarRating';

// Aperçu de la fiche COMPLÈTE (comme la page publique), avec les vraies photos Google.
export interface FichePreviewData {
  place_id: string;
  name: string;
  category: string;
  ai_subcategory?: string | null;
  ai_description?: string | null;
  address?: string;
  postal_code?: string;
  city?: string;
  phone?: string;
  website?: string;
  google_rating?: number | null;
  google_rating_count?: number | null;
}

const PHOTO_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fiches-photo`;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;
const photoUrl = (name: string, w = 1000) => `${PHOTO_BASE}?name=${encodeURIComponent(name)}&w=${w}&apikey=${ANON}`;

export default function FichePreviewModal({ data, open, onClose }: { data: FichePreviewData | null; open: boolean; onClose: () => void }) {
  const { categories } = useCategories();
  const [photos, setPhotos] = useState<string[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);

  useEffect(() => {
    if (!open || !data?.place_id) { setPhotos([]); return; }
    let cancelled = false;
    setLoadingPhotos(true);
    fetch(`${PHOTO_BASE}?place_id=${encodeURIComponent(data.place_id)}&apikey=${ANON}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setPhotos(d.photos || []); })
      .catch(() => { if (!cancelled) setPhotos([]); })
      .finally(() => { if (!cancelled) setLoadingPhotos(false); });
    return () => { cancelled = true; };
  }, [open, data?.place_id]);

  if (!open || !data) return null;

  const categoryLabel = categories[data.category as CategoryKey]?.label || data.category;
  const rating = data.google_rating ?? 0;
  const gallery = photos.slice(1, 5);

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.65)' }} onClick={onClose}>
      <div className="w-full max-w-[430px] my-6 bg-light-bg dark:bg-dark-bg rounded-card overflow-hidden shadow-2xl border border-light-border dark:border-dark-border" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-2.5 bg-light-surface dark:bg-dark-surface border-b border-light-border dark:border-dark-border">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Aperçu de la fiche</span>
          <button onClick={onClose} className="p-1 text-gray-500 hover:text-gray-900 dark:hover:text-white"><X size={18} /></button>
        </div>

        {/* Bannière : vraie photo Google */}
        <div className="w-full h-44 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-dark-border dark:to-dark-bg flex items-center justify-center overflow-hidden">
          {photos[0] ? (
            <img src={photoUrl(photos[0], 1200)} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="text-center">
              <MapPin size={36} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
              <p className="text-sm text-gray-400 dark:text-gray-500">{loadingPhotos ? 'Chargement des photos…' : data.name}</p>
            </div>
          )}
        </div>

        <div className="p-4 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-card bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                {photos[0] ? <img src={photoUrl(photos[0], 200)} alt="" className="w-full h-full object-cover" /> : <span className="text-primary text-2xl font-semibold">{data.name.charAt(0)}</span>}
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
              {data.phone && <span className="flex items-center gap-2 text-primary"><Phone size={14} /> {data.phone}</span>}
              {data.website && <span className="flex items-center gap-2 text-primary"><Globe size={14} /> Site web</span>}
            </div>
          )}

          {gallery.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Galerie</h2>
              <div className="grid grid-cols-3 gap-2">
                {gallery.map((n) => (
                  <img key={n} src={photoUrl(n, 400)} alt="" className="w-full h-20 object-cover rounded-input" />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
