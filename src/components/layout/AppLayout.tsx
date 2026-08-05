import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Header from './Header';
import BottomNav from './BottomNav';

/**
 * Coquille du site (en-tête + navigation).
 *
 * ⛔ Avant, ce composant renvoyait TOUT visiteur non connecté vers la page
 * d'inscription dès que le réglage « inscription obligatoire » était actif.
 * Conséquence : personne ne voyait l'annuaire sans créer un compte, et Google
 * non plus, donc aucune des pages ne pouvait remonter dans les résultats.
 *
 * Désormais la consultation est libre (annuaire, fiches, événements, promos) et
 * seul l'espace membre demande un compte : `requireAuth` sur le groupe de routes
 * concerné. La mise en avant de l'inscription passe par le mot de bienvenue
 * (`WelcomeModal`), qui lit toujours le réglage `require_signup`.
 */
export default function AppLayout({ requireAuth = false }: { requireAuth?: boolean }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="min-h-screen bg-light-bg dark:bg-dark-bg" />;
  }

  if (requireAuth && !user) {
    const back = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/auth/register?redirect=${back}`} replace />;
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-14 pb-16 md:pb-0">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
