import { useEffect, useRef, useState } from 'react';
import { MapPin, ChevronDown, LocateFixed, Check } from 'lucide-react';

export interface CityOption { slug: string; name: string; n: number; lat: number; lng: number }

/**
 * Choix de la ville consultée, alimenté par les villes réellement couvertes
 * (`public_city_list`). Chaque ville ajoutée depuis l'administration apparaît
 * ici toute seule, sans rien à modifier.
 *
 * « Autour de moi » sort du cadre d'une ville : on suit la position du visiteur
 * et la carte reprend la main sur ce qui est affiché.
 */
export default function CityFilter({
  cities, value, onSelectCity, onAroundMe, aroundMe, locating,
}: {
  cities: CityOption[];
  value: string | null;
  onSelectCity: (c: CityOption) => void;
  onAroundMe: () => void;
  aroundMe: boolean;
  locating: boolean;
}) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const current = cities.find((c) => c.slug === value);
  const label = aroundMe ? 'Autour de moi' : current?.name || 'Choisir une ville';

  return (
    <div className="relative shrink-0" ref={boxRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 px-3 rounded-input border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface text-xs font-medium text-gray-900 dark:text-white hover:border-primary transition-colors max-w-[9.5rem]"
        style={{ height: 36 }}
      >
        {aroundMe ? <LocateFixed size={14} className="text-primary shrink-0" /> : <MapPin size={14} className="text-primary shrink-0" />}
        <span className="truncate">{label}</span>
        <ChevronDown size={13} className="text-gray-400 shrink-0" />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 z-30 mt-1 w-56 max-h-72 overflow-y-auto rounded-card border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface shadow-xl py-1"
        >
          <button
            type="button"
            onClick={() => { setOpen(false); onAroundMe(); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-light-bg dark:hover:bg-dark-bg transition-colors"
          >
            <LocateFixed size={15} className="text-primary shrink-0" />
            <span className="flex-1 text-gray-900 dark:text-white">Autour de moi</span>
            {locating && <span className="text-xs text-gray-400">…</span>}
            {aroundMe && !locating && <Check size={14} className="text-primary" />}
          </button>

          <div className="my-1 border-t border-light-border dark:border-dark-border" />

          {cities.map((c) => (
            <button
              key={c.slug}
              type="button"
              role="option"
              aria-selected={!aroundMe && c.slug === value}
              onClick={() => { setOpen(false); onSelectCity(c); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-light-bg dark:hover:bg-dark-bg transition-colors"
            >
              <MapPin size={15} className="text-gray-400 shrink-0" />
              <span className="flex-1 text-gray-900 dark:text-white truncate">{c.name}</span>
              <span className="text-xs text-gray-400 tabular-nums">{c.n}</span>
              {!aroundMe && c.slug === value && <Check size={14} className="text-primary" />}
            </button>
          ))}

          {cities.length === 0 && (
            <p className="px-3 py-2 text-sm text-gray-500">Aucune ville couverte pour l'instant.</p>
          )}
        </div>
      )}
    </div>
  );
}
