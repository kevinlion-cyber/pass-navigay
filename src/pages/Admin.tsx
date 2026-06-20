import { Navigate, useNavigate } from 'react-router-dom';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import AdminLayout from '../components/admin/AdminLayout';

export default function AdminRoot() {
  const { user, profile, loading, signOut } = useAuth();
  const navigate = useNavigate();

  // Tant que la session/le profil chargent, on attend (évite un faux "accès refusé").
  if (loading || (user && !profile)) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <Loader2 className="animate-spin" size={28} style={{ color: '#7B2D8B' }} />
      </div>
    );
  }

  // Pas connecté → page de connexion classique.
  if (!user) {
    return <Navigate to="/auth/login?redirect=/admin" replace />;
  }

  // Connecté mais pas administrateur → accès refusé (vérifié en base, pas côté client).
  if (!profile?.is_admin) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center space-y-5">
          <div className="flex justify-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'rgba(192,57,43,0.12)' }}>
              <ShieldAlert size={28} style={{ color: '#c0392b' }} />
            </div>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Accès réservé</h1>
            <p className="text-sm text-gray-400 mt-2">
              Votre compte n'a pas les droits d'administration.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <button onClick={() => navigate('/explore')} className="btn-primary w-full">
              Retour à l'accueil
            </button>
            <button
              onClick={async () => { await signOut(); navigate('/auth/login?redirect=/admin'); }}
              className="w-full py-2.5 rounded-input text-sm font-medium transition-colors"
              style={{ color: '#808090' }}
            >
              Se connecter avec un autre compte
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <AdminLayout />;
}
