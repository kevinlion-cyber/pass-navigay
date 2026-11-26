import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Search, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useCategories } from '../contexts/CategoriesContext';
import { useCoveredCities, slugifyCity } from '../lib/cities';
import type { Event, CategoryKey } from '../lib/types';
import FilterDropdown from '../components/ui/FilterDropdown';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import InscriptionGateModal from '../components/ui/InscriptionGateModal';

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
  const [catFilter, setCatFilter] = useState('all');
  const [subcatFilter, setSubcatFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showProPopup, setShowProPopup] = useState(false);
  const navigate = useNavigate();
  const { categories, categoryKeys } = useCategories();
  const coveredCities = useCoveredCities();
  const { user } = useAuth();

  // Invitation à s'inscrire : une fois par visite, non bloquante, et seulement
  // pour un visiteur SANS compte. Demande de Kevin : cet appel à l'action vise
  // l'inscription des visiteurs (formule gratuite ou pass Premium), pas les
  // établissements. Quelqu'un de déjà connecté n'a rien à créer.
  useEffect(() => {
    if (user) { setShowProPopup(false); return; }
    try {
      if (sessionStorage.getItem('pn_events_popup_seen') !== '1') setShowProPopup(true);
    } catch {
      setShowProPopup(true);
    }
  }, [user]);

  const closeProPopup = () => {
    setShowProPopup(false);
    try { sessionStorage.setItem('pn_events_popup_seen', '1'); } catch { /* stockage indisponible */ }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const now = new Date().toISOString();
      const { data } = await supabase
        .from('events')
        .select('*, establishment:establishments(name, logo_url, city, city_slug, category, subcategory)')
        .or(`event_date.gte.${now},end_date.gte.${now}`)
        .order('event_date');
      if (data) setEvents(data as unknown as Event[]);
      setLoading(false);
    };
    load();
  }, []);

  // Filtres Ville (par rattachement) et Catégorie alignés sur l'annuaire : villes
  // depuis public_city_list, catégories depuis le catalogue. Ils s'affichent donc
  // toujours, même sans événement, comme sur la page Explorer.
  const subcats = catFilter === 'all' ? [] : (categories[catFilter as CategoryKey]?.subcategories || []);

  const filtered = events.filter((e) => {
    if (themeFilter !== 'Tous' && e.theme?.toLowerCase() !== themeFilter.toLowerCase()) return false;
    if (priceFilter === 'free' && !e.is_free) return false;
    if (priceFilter === 'paid' && e.is_free) return false;
    // Ville : celle de l'établissement, ou celle saisie pour un événement
    // organisé ailleurs (sinon ces événements n'apparaissaient dans aucune ville).
    if (cityFilter !== 'all') {
      const evCity = e.establishment?.city_slug
        || (e.custom_city ? slugifyCity(e.custom_city) : null);
      if (evCity !== cityFilter) return false;
    }
    if (catFilter !== 'all' && e.establishment?.category !== catFilter) return false;
    if (subcatFilter !== 'all' && e.establishment?.subcategory !== subcatFilter) return false;
    if (dateFrom && new Date(e.event_date) < new Date(dateFrom)) return false;
    if (dateTo && new Date(e.event_date) > new Date(`${dateTo}T23:59:59`)) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchTitle = e.title.toLowerCase().includes(q);
      const matchAddr = e.address?.toLowerCase().includes(q);
      const matchEst = e.establishment?.name?.toLowerCase().includes(q);
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

  // Version téléphone : sans l'intitulé « Ville : » et avec « Ville » au lieu de
  // « Toutes les villes », pour tenir sur la même ligne que les deux dates.
  const filtreVilleMobile = (
    <FilterDropdown
      label="Ville"
      compactMobile
      value={cityFilter}
      options={[{ value: 'all', label: 'Ville' }, ...coveredCities.map((c) => ({ value: c.slug, label: c.name }))]}
      onChange={setCityFilter}
    />
  );
  const filtreVille = (
    <FilterDropdown
      label="Ville"
      value={cityFilter}
      options={[{ value: 'all', label: 'Toutes les villes' }, ...coveredCities.map((c) => ({ value: c.slug, label: c.name }))]}
      onChange={setCityFilter}
    />
  );

  return (
    /*
     * Cadre à hauteur fixe, la liste défile à l'intérieur (même principe que la
     * page Lieux). Avant, c'était toute la page qui défilait : sur téléphone, la
     * barre d'outils du navigateur se rétracte pendant le défilement et masque la
     * barre d'onglets du bas, qui ne réapparaissait qu'arrivé tout en bas.
     * On retire la hauteur de l'en-tête (3,5rem) et, sur téléphone seulement,
     * celle de la barre d'onglets (4rem), qui n'existe pas sur grand écran.
     */
    <div className="flex flex-col overflow-hidden h-[calc(100dvh-3.5rem-4rem)] md:h-[calc(100dvh-3.5rem)]">
      <div className="shrink-0 w-full max-w-4xl mx-auto px-4 pt-6 pb-3 space-y-4">
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
          label="Thème"
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
        {coveredCities.length > 0 && (
          <div className="hidden sm:block">{filtreVille}</div>
        )}
        {categoryKeys.length > 0 && (
          <FilterDropdown
            label="Catégorie"
            value={catFilter}
            options={[{ value: 'all', label: 'Toutes les catégories' }, ...categoryKeys.map((c) => ({ value: c, label: categories[c as CategoryKey]?.label || c }))]}
            onChange={(v) => { setCatFilter(v); setSubcatFilter('all'); }}
          />
        )}
        {subcats.length > 0 && (
          <FilterDropdown
            label="Sous-catégorie"
            value={subcatFilter}
            options={[{ value: 'all', label: 'Toutes les sous-catégories' }, ...subcats.map((s) => ({ value: s, label: s }))]}
            onChange={setSubcatFilter}
          />
        )}
      </div>

      {/* Sur téléphone, la ville se place juste avant les dates, sur une seule ligne
          (demande de Kévin, 26/11/2026) ; les deux dates se partagent la place restante. */}
      <div className={`grid ${coveredCities.length > 0 ? 'grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)]' : 'grid-cols-2'} items-center gap-2 sm:flex sm:flex-wrap`}>
        {coveredCities.length > 0 && <div className="sm:hidden">{filtreVilleMobile}</div>}
        <label className="flex items-center gap-1.5 min-w-0 text-xs text-gray-500 dark:text-gray-400">
          Du
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="input-field text-xs w-full min-w-0 sm:w-auto" style={{ height: 32, padding: '4px 6px' }} />
        </label>
        <label className="flex items-center gap-1.5 min-w-0 text-xs text-gray-500 dark:text-gray-400">
          Au
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="input-field text-xs w-full min-w-0 sm:w-auto" style={{ height: 32, padding: '4px 6px' }} />
        </label>
        {(dateFrom || dateTo) && (
          <button onClick={() => { setDateFrom(''); setDateTo(''); }}
            className="col-span-full justify-self-start text-xs text-primary hover:underline">Réinitialiser les dates</button>
        )}
      </div>
      </div>

      {/* Seule cette zone défile : la barre d'onglets du bas reste donc toujours
          visible sur téléphone, et les filtres restent à portée de main. */}
      <div className="flex-1 overflow-y-auto">
        <div className="w-full max-w-4xl mx-auto px-4 pb-6">
      {filtered.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <Calendar size={48} className="mx-auto text-gray-300 dark:text-gray-600" />
          <p className="text-gray-500 dark:text-gray-400">Aucun événement trouvé</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((event) => {
            const est = event.establishment;
            return (
              <div
                key={event.id}
                onClick={() => navigate(`/agenda/${event.id}`)}
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
      </div>

      {/* Invitation à créer un compte, sans prix (choix de Kévin, 25/11/2026) : les prix
          ne sont montrés que devant une fonction Premium. */}
      <InscriptionGateModal open={showProPopup} onClose={closeProPopup} redirect="/agenda" />
    </div>
  );
}
