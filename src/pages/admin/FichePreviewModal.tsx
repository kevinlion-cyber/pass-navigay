import { useState } from 'react';
import { X, MapPin, Phone, Globe, Map, Heart, Share2 } from 'lucide-react';
import { useCategories } from '../../contexts/CategoriesContext';
import type { CategoryKey } from '../../lib/types';
import StarRating from '../../components/ui/StarRating';

// Aperçu d'une fiche EXACTEMENT comme la page publique (EstablishmentDetail) l'affiche.
// ⚠️ Reproduit fidèlement les règles d'affichage du site — on ne change RIEN :
//   - Gratuit (défaut des fiches auto) : bannière + nom + catégorie + note + adresse.
//   - Pro : ajoute la description, le contact et le badge « partenaire ».
// La bascule Gratuit/Pro sert à VÉRIFIER les deux vues côté admin (n'affecte pas le site).
export interface FichePreviewData {
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

export default function FichePreviewModal({ data, open, onClose }: { data: FichePreviewData | null; open: boolean; onClose: () => void }) {
  const { categories } = useCategories();
  const [pro, setPro] = useState(false); // défaut = vue gratuite (ce que verra réellement le public)
  if (!open || !data) return null;

  const categoryLabel = categories[data.category as CategoryKey]?.label || data.category;
  const rating = data.google_rating ?? 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.65)' }} onClick={onClose}>
      <div className="w-full max-w-[430px] my-6 bg-light-bg dark:bg-dark-bg rounded-card overflow-hidden shadow-2xl border border-light-border dark:border-dark-border" onClick={(e) => e.stopPropagation()}>
        {/* Barre d'aperçu + bascule Gratuit / Pro */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-light-surface dark:bg-dark-surface border-b border-light-border dark:border-dark-border">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Aperçu — vue publique</span>
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5 bg-light-bg dark:bg-dark-bg p-0.5 rounded-input">
              <button onClick={() => setPro(false)} className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${!pro ? 'bg-primary text-white' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>Gratuit</button>
              <button onClick={() => setPro(true)} className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${pro ? 'bg-primary text-white' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>Pro</button>
            </div>
            <button onClick={onClose} className="p-1 text-gray-500 hover:text-gray-900 dark:hover:text-white"><X size={18} /></button>
          </div>
        </div>

        {/* Bannière (placeholder tant qu'aucun visuel n'est ajouté) */}
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
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{data.name}</h1>
                  {pro && <span className="badge-pro">PARTENAIRE OFFICIEL</span>}
                </div>
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

          {/* Description : réservée aux fiches Pro (comme sur le site) */}
          {pro && data.ai_description && (
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{data.ai_description}</p>
          )}

          {/* Contact : réservé aux fiches Pro (comme sur le site) */}
          {pro && (data.phone || data.website) && (
            <div className="flex flex-wrap gap-4 text-sm">
              {data.phone && <span className="flex items-center gap-2 text-primary"><Phone size={14} /> {data.phone}</span>}
              {data.website && <span className="flex items-center gap-2 text-primary"><Globe size={14} /> Site web</span>}
            </div>
          )}

          {!pro && (
            <p className="text-xs text-gray-400 italic border-t border-light-border dark:border-dark-border pt-3">
              Vue gratuite : la description et le contact ne s'affichent que sur les fiches Pro (réglage du site, non modifié).
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
