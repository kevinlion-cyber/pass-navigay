import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getAnalyticsConsent, setAnalyticsConsent, CONSENT_OPEN_EVENT,
} from '../../lib/analytics';

// Bandeau de consentement aux statistiques (CNIL, décision de Kévin du 24/11/2026).
// « Refuser » est aussi visible et aussi simple que « Accepter ». Sans réponse, les
// statistiques restent anonymes (voir src/lib/analytics.ts).
export default function ConsentBanner() {
  const [open, setOpen] = useState(() => getAnalyticsConsent() === null);

  useEffect(() => {
    const reopen = () => setOpen(true);
    window.addEventListener(CONSENT_OPEN_EVENT, reopen);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, reopen);
  }, []);

  if (!open) return null;

  const choose = (v: 'granted' | 'denied') => {
    setAnalyticsConsent(v);
    setOpen(false);
  };

  return (
    <div className="fixed left-0 right-0 bottom-16 md:bottom-0 z-[900] p-3" role="dialog" aria-label="Cookies et statistiques">
      <div className="max-w-3xl mx-auto bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card shadow-lg p-4 flex flex-col md:flex-row md:items-center gap-3">
        <p className="text-xs text-gray-600 dark:text-gray-300 flex-1 leading-relaxed">
          Pass Navigay mesure sa fréquentation pour s’améliorer. Avec votre accord, ces statistiques sont reliées
          à votre compte pour comprendre votre parcours sur le site. Sans accord, elles restent anonymes.{' '}
          <Link to="/legal/confidentialite" className="underline hover:text-primary">En savoir plus</Link>
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => choose('denied')}
            className="flex-1 md:flex-none px-4 py-2 rounded-input text-sm font-medium border border-light-border dark:border-dark-border text-gray-800 dark:text-gray-100 hover:border-primary"
          >
            Refuser
          </button>
          <button
            onClick={() => choose('granted')}
            className="flex-1 md:flex-none px-4 py-2 rounded-input text-sm font-medium border border-light-border dark:border-dark-border text-gray-800 dark:text-gray-100 hover:border-primary"
          >
            Accepter
          </button>
        </div>
      </div>
    </div>
  );
}
