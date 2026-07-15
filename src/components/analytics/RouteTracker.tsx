import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '../../lib/analytics';

// Envoie un page_view à chaque changement de route, hors espaces internes
// (admin + tableau de bord partenaire) qui ne comptent pas dans l'audience.
export default function RouteTracker() {
  const { pathname } = useLocation();
  const last = useRef<string>('');

  useEffect(() => {
    if (pathname === last.current) return;
    last.current = pathname;
    if (pathname.startsWith('/admin') || pathname.startsWith('/pros/')) return;
    trackPageView();
  }, [pathname]);

  return null;
}
