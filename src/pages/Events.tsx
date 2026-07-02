import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Search, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Event } from '../lib/types';
import FilterDropdown from '../components/ui/FilterDropdown';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const THEME_FILTERS = [
  'Tous',
  'Soiree',
  'Concert',
  'Expo',
  'Brunch',
  'Bien-etre',
  'Culture',
  'Drag',
  'Rencontre',
];

type PriceFilter = 'all' | 'free' | 'paid';

export default function Events() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [themeFilter, setThemeFilter] = useState('Tous');
  const [priceFilter, setPriceFilter] = useState<PriceFilter>('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const now = new Date().toISOString();
      const { data } = await supabase
        .from('events')
        .select('*, establishment:establishments(name, logo_url, city)')
        .or(`event_date.gte.${now},end_date.gte.${now}`)
        .order('event_date');
      if (data) setEvents(data as unknown as Event[]);
      setLoading(false);
    };
    load();
  }, []);

  const cities = Array.from(
    new Set(events.map((e) => (e.establishment as any)?.city).filter(Boolean))
  ).sort() as string[];

  const filtered = events.filter((e) => {
    if (themeFilter !== 'Tous' && e.theme?.toLowerCase() !== themeFilter.toLowerCase()) return false;
    if (priceFilter === 'free' && !e.is_free) return false;
    if (priceFilter === 'paid' && e.is_free) return false;
    if (cityFilter !== 'all' && (e.establishment as any)?.city !== cityFilter) return false;
    if (dateFrom && new Date(e.event_date) < new Date(dateFrom)) return false;
    if (dateTo && new Date(e.event_date) > new Date(`${dateTo}T23:59:59`)) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchTitle = e.title.toLowerCase().includes(q);
      const matchAddr = e.address?.toLowerCase().includes(q);
      const matchEst = (e.establishment as any)?.name?.toLowerCase().includes(q);
      if (!matchTitle && !matchAddr && !matchEst) return false;
    }
    return true;
  });

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
    });

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Événements</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {filtered.length} événement{filtered.length !== 1 ? 's' : ''} à venir
        </p>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un événement..."
            className="input-field pl-9 text-xs w-full"
            style={{ height: 36, paddingTop: 6, paddingBottom: 6 }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <FilterDropdown
          label="Theme"
          value={themeFilter}
          options={THEME_FILTERS.map((t) => ({ value: t, label: t }))}
          onChange={setThemeFilter}
        />
        <FilterDropdown
          label="Prix"
          value={priceFilter}
          options={[
            { value: 'all' as PriceFilter, label: 'Tous les prix' },
            { value: 'free' as PriceFilter, label: 'Gratuit' },
            { value: 'paid' as PriceFilter, label: 'Payant' },
          ]}
          onChange={setPriceFilter}
        />
        {cities.length > 0 && (
          <FilterDropdown
            label="Ville"
            value={cityFilter}
            options={[{ value: 'all', label: 'Toutes les villes' }, ...cities.map((c) => ({ value: c, label: c }))]}
            onChange={setCityFilter}
          />
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          Du
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="input-field text-xs" style={{ height: 32, padding: '4px 8px' }} />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          Au
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="input-field text-xs" style={{ height: 32, padding: '4px 8px' }} />
        </label>
        {(dateFrom || dateTo) && (
          <button onClick={() => { setDateFrom(''); setDateTo(''); }}
            className="text-xs text-primary hover:underline">Réinitialiser les dates</button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <Calendar size={48} className="mx-auto text-gray-300 dark:text-gray-600" />
          <p className="text-gray-500 dark:text-gray-400">Aucun événement trouvé</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((event) => {
            const est = event.establishment as any;
            return (
              <div
                key={event.id}
                onClick={() => navigate(`/events/${event.id}`)}
                className="card-hover flex gap-4 p-4"
              >
                <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-primary/10 flex items-center justify-center">
                  {event.image_url ? (
                    <img src={event.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Calendar size={28} className="text-primary/40" />
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                    {event.title}
                  </h3>

                  <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      {formatDate(event.event_date)} à {formatTime(event.event_date)}
                    </span>
                  </div>

                  {(est?.name || event.address) && (
                    <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <MapPin size={12} />
                      <span className="truncate">
                        {est?.name ? `${est.name}` : ''}
                        {est?.name && event.address ? ' — ' : ''}
                        {event.address || ''}
                      </span>
                    </div>
                  )}

                  <div>
                    {event.is_free ? (
                      <span className="badge-free">Gratuit</span>
                    ) : (
                      <span className="badge bg-gray-100 dark:bg-dark-border text-gray-600 dark:text-gray-300">
                        {event.price} EUR
                      </span>
                    )}
                    {event.theme && (
                      <span className="badge bg-primary/10 text-primary ml-2">{event.theme}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
