import { useEffect, useState } from 'react';
import { X, MapPin, Phone, Globe, Map, Heart, Share2,
  Sun, Coffee, Leaf, Beer, Wine, Music, Baby, Users, Dog, CalendarCheck, Truck, ShoppingBag, Utensils, Accessibility, Car, Wallet, Martini, Check, type LucideIcon } from 'lucide-react';
import { useCategories } from '../../contexts/CategoriesContext';
import type { CategoryKey } from '../../lib/types';
import StarRating from '../../components/ui/StarRating';

// Aperçu de la fiche COMPLÈTE, calé sur le rendu public (EstablishmentDetail), avec photos Google.
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
  price_level?: number | null;
  amenities?: string[] | null;
  opening_hours?: Record<string, { open: string; close: string } | null> | null;
}

const DAYS_ORDER = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

const AMENITY_ICONS: Record<string, LucideIcon> = {
  'Terrasse': Sun, 'Petit-déjeuner': Coffee, 'Brunch': Coffee, 'Café': Coffee,
  'Options végé': Leaf, 'Cocktails': Martini, 'Bière': Beer, 'Vin': Wine, 'Musique live': Music,
  'Adapté enfants': Baby, 'Groupes': Users, 'Animaux acceptés': Dog, 'Réservation': CalendarCheck,
  'Livraison': Truck, 'À emporter': ShoppingBag, 'Sur place': Utensils, 'Accessible PMR': Accessibility,
  'Parking': Car, 'CB acceptée': Wallet,
};

const PHOTO_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fiches-photo`;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;
const photoUrl = (name: string, w = 1000) => `${PHOTO_BASE}?name=${encodeURIComponent(name)}&w=${w}&apikey=${ANON}`;

export default function FichePreviewModal({ data, open, onClose }: { data: FichePreviewData | null; open: boolean; onClose: () => void }) {
  const { categories } = useCategories();
  const [photos, setPhotos] = useState<string[]>([]);

  useEffect(() => {
    if (!open || !data?.place_id) { setPhotos([]); return; }
    let cancelled = false;
    fetch(`${PHOTO_BASE}?place_id=${encodeURIComponent(data.place_id)}&apikey=${ANON}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setPhotos(d.photos || []); })
      .catch(() => { if (!cancelled) setPhotos([]); });
    return () => { cancelled = true; };
  }, [open, data?.place_id]);

  if (!open || !data) return null;

  const categoryLabel = categories[data.category as CategoryKey]?.label || data.category;
  const rating = data.google_rating ?? 0;
  const gallery = photos.slice(1, 7);

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.65)' }} onClick={onClose}>
      <div className="w-full max-w-[430px] my-6 bg-light-bg dark:bg-dark-bg rounded-card overflow-hidden shadow-2xl border border-light-border dark:border-dark-border" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-2 bg-light-surface dark:bg-dark-surface border-b border-light-border dark:border-dark-border">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Aperçu de la fiche</span>
          <button onClick={onClose} className="p-1 text-gray-500 hover:text-gray-900 dark:hover:text-white"><X size={18} /></button>
        </div>

        {/* Hero immersif */}
        <div className="relative w-full h-52 overflow-hidden bg-gradient-to-br from-gray-200 to-gray-300 dark:from-dark-border dark:to-dark-bg">
          {photos[0] ? (
            <img src={photoUrl(photos[0], 1200)} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <MapPin size={40} className="text-gray-300 dark:text-gray-600" />
            </div>
          )}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(12,9,16,0.85) 0%, rgba(12,9,16,0.35) 40%, rgba(12,9,16,0) 65%)' }} />
          <div className="absolute top-3 right-3 flex items-center gap-2">
            <span className="w-8 h-8 rounded-full flex items-center justify-center bg-black/35 text-white/70"><Heart size={16} /></span>
            <span className="w-8 h-8 rounded-full flex items-center justify-center bg-black/35 text-white/70"><Share2 size={16} /></span>
          </div>
          <div className="absolute inset-x-0 bottom-0 p-4">
            <div className="flex items-end gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/95 dark:bg-dark-surface shadow-lg flex items-center justify-center shrink-0 overflow-hidden ring-1 ring-white/25">
                {photos[0] ? <img src={photoUrl(photos[0], 200)} alt="" className="w-full h-full object-cover" /> : <span className="text-primary text-xl font-bold">{data.name.charAt(0)}</span>}
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-white leading-tight" style={{ textShadow: '0 2px 14px rgba(0,0,0,0.55)' }}>{data.name}</h1>
                <p className="text-sm text-white/85">
                  {categoryLabel}{data.ai_subcategory ? ` · ${data.ai_subcategory}` : ''}
                  {typeof data.price_level === 'number' && data.price_level > 0 && (
                    <span className="ml-1.5 font-semibold">{'€'.repeat(data.price_level)}</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-5">
          {rating > 0 && (
            <div className="flex items-center gap-1.5">
              <StarRating rating={Math.round(rating)} size={16} />
              <span className="text-xs text-gray-500">({data.google_rating_count ?? 0} avis)</span>
            </div>
          )}

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

          {data.amenities && data.amenities.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Bon à savoir</h2>
              <div className="grid grid-cols-2 gap-2">
                {data.amenities.map((a) => {
                  const Icon = AMENITY_ICONS[a] || Check;
                  return (
                    <div key={a} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-input px-2.5 py-1.5">
                      <Icon size={14} className="text-primary shrink-0" />
                      <span className="truncate">{a}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {data.opening_hours && Object.keys(data.opening_hours).length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Horaires d'ouverture</h2>
              <div className="text-sm space-y-1">
                {DAYS_ORDER.map((day) => {
                  const slot = data.opening_hours?.[day];
                  return (
                    <div key={day} className="flex items-center justify-between">
                      <span className="capitalize text-gray-700 dark:text-gray-300">{day}</span>
                      <span className="text-gray-500 dark:text-gray-400">{slot ? `${slot.open} - ${slot.close}` : 'Fermé'}</span>
                    </div>
                  );
                })}
              </div>
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
