import { useEffect, useState } from 'react';

/** Vrai sur un écran d'au moins 1024 px (point de rupture « lg » de Tailwind). */
const REQUETE = '(min-width: 1024px)';

export function useEcranLarge(): boolean {
  const [large, setLarge] = useState(() => typeof window !== 'undefined' && window.matchMedia(REQUETE).matches);
  useEffect(() => {
    const mq = window.matchMedia(REQUETE);
    const maj = () => setLarge(mq.matches);
    maj();
    mq.addEventListener('change', maj);
    return () => mq.removeEventListener('change', maj);
  }, []);
  return large;
}
