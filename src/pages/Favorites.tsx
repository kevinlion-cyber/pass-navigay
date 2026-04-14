import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Favorite } from '../lib/types';
import EstablishmentCard from '../components/explore/EstablishmentCard';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import AuthGateModal from '../components/ui/AuthGateModal';

export default function Favorites() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [authGateOpen, setAuthGateOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      setAuthGateOpen(true);
      return;
    }
    loadFavorites();
  }, [user]);

  const loadFavorites = async () => {
    const { data } = await supabase
      .from('favorites')
      .select('*, establishment:establishments(*)')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false });

    if (data) setFavorites(data as unknown as Favorite[]);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size={32} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <AuthGateModal
          open={authGateOpen}
          onClose={() => { setAuthGateOpen(false); navigate('/explore'); }}
          message="Cree ton compte pour sauvegarder tes lieux favoris."
        />
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Heart size={20} className="text-primary" />
          Tes favoris
        </h1>
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <Heart size={48} className="mx-auto mb-4 opacity-30" />
          <p>Connecte-toi pour retrouver tes favoris.</p>
          <button onClick={() => setAuthGateOpen(true)} className="btn-primary mt-4">
            Creer un compte
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
        <Heart size={20} className="text-primary" />
        Tes favoris
      </h1>

      {favorites.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <Heart size={48} className="mx-auto mb-4 opacity-30" />
          <p>Tu n'as pas encore de favoris.</p>
          <button onClick={() => navigate('/explore')} className="btn-primary mt-4">
            Explorer
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {favorites.map((fav) =>
            fav.establishment ? (
              <EstablishmentCard key={fav.id} establishment={fav.establishment} />
            ) : null
          )}
        </div>
      )}
    </div>
  );
}
