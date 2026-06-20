import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, HeartOff, MapPin, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useCategories } from '../../contexts/CategoriesContext';
import type { Favorite, CategoryKey } from '../../lib/types';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

interface ProfileFavoritesProps {
  userId: string;
}

export default function ProfileFavorites({ userId }: ProfileFavoritesProps) {
  const navigate = useNavigate();
  const { categories } = useCategories();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase
      .from('favorites')
      .select('*, establishment:establishments(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    setFavorites((data as Favorite[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [userId]);

  const removeFavorite = async (e: React.MouseEvent, favId: string) => {
    e.stopPropagation();
    const { error } = await supabase.from('favorites').delete().eq('id', favId);
    if (error) {
      toast.error('Erreur lors de la suppression');
      return;
    }
    setFavorites((prev) => prev.filter((f) => f.id !== favId));
    toast.success('Favori retire');
  };

  return (
    <section>
      <h2 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <Heart size={18} className="text-primary" />
        Mes favoris
      </h2>

      {loading ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner size={24} />
        </div>
      ) : favorites.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Tu n'as pas encore de favoris — explore les lieux pour en ajouter !
          </p>
          <button
            onClick={() => navigate('/explore')}
            className="text-sm text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1.5"
          >
            Explorer les lieux
            <ArrowRight size={14} />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {favorites.map((fav) => {
            const est = fav.establishment;
            if (!est) return null;
            const catLabel = categories[est.category as CategoryKey]?.label || est.category;

            return (
              <div
                key={fav.id}
                onClick={() => navigate(`/establishment/${est.id}`)}
                className="card-hover overflow-hidden relative group"
              >
                <div className="aspect-[4/3] bg-gray-100 dark:bg-dark-border overflow-hidden">
                  {est.banner_url || est.logo_url ? (
                    <img
                      src={est.banner_url || est.logo_url || ''}
                      alt={est.name}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-primary/5">
                      <span className="text-primary text-2xl font-bold">{est.name.charAt(0)}</span>
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {est.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                    {catLabel}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1 mt-0.5">
                    <MapPin size={10} />
                    <span className="truncate">{est.city}</span>
                  </p>
                </div>
                <button
                  onClick={(e) => removeFavorite(e, fav.id)}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-alert/80"
                  aria-label="Retirer des favoris"
                >
                  <HeartOff size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
