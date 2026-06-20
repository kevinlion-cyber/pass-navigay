import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { geocodeFirst } from '../lib/geocode';
import { useAuth } from '../contexts/AuthContext';
import type { Establishment, CategoryKey } from '../lib/types';
import { DEFAULT_CENTER, PAGE_SIZE } from '../lib/constants';
import CategoryFilters from '../components/explore/CategoryFilters';
import EstablishmentCard from '../components/explore/EstablishmentCard';
import FeaturedEvents from '../components/explore/FeaturedEvents';
import MapView from '../components/explore/MapView';
import DisclaimerModal from '../components/ui/DisclaimerModal';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import PremiumQuestionnaireModal from '../components/ui/PremiumQuestionnaireModal';

type Bounds = { north: number; south: number; east: number; west: number };

export default function Explore() {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [questionnaireOpen, setQuestionnaireOpen] = useState(false);
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey | null>(null);
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [mapFlyTo, setMapFlyTo] = useState<{ lng: number; lat: number } | null>(null);

  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const listContainerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setUserLocation(DEFAULT_CENTER)
    );
  }, []);

  useEffect(() => {
    const premiumParam = searchParams.get('premium');
    if (premiumParam === 'success') {
      toast.success('Bienvenue dans Pass Navigay Premium !');
      searchParams.delete('premium');
      setSearchParams(searchParams, { replace: true });
      refreshProfile().then(() => {
        if (!profile?.questionnaire_completed) {
          setQuestionnaireOpen(true);
        }
      });
    } else if (premiumParam === 'cancelled') {
      toast('Paiement annule. Tu peux passer Premium a tout moment depuis ton profil.', { icon: '!' });
      searchParams.delete('premium');
      setSearchParams(searchParams, { replace: true });
    }
  }, []);

  useEffect(() => {
    if (search.trim()) {
      setSearchLoading(true);
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  const fetchEstablishments = useCallback(async (reset = false) => {
    setLoading(true);
    const currentPage = reset ? 0 : page;

    let query = supabase
      .from('establishments')
      .select('*')
      .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1)
      .order('is_sponsor', { ascending: false })
      .order('created_at', { ascending: false });

    if (selectedCategory) {
      query = query.eq('category', selectedCategory);
    }
    if (selectedSubcategories.length > 0) {
      query = query.in('subcategory', selectedSubcategories);
    }
    if (debouncedSearch.trim()) {
      query = query.or(
        `name.ilike.%${debouncedSearch.trim()}%,city.ilike.%${debouncedSearch.trim()}%,address.ilike.%${debouncedSearch.trim()}%,description.ilike.%${debouncedSearch.trim()}%`
      );
    }
    if (bounds && !debouncedSearch.trim()) {
      query = query
        .gte('latitude', bounds.south)
        .lte('latitude', bounds.north)
        .gte('longitude', bounds.west)
        .lte('longitude', bounds.east);
    }

    const { data } = await query;

    if (data) {
      const withRatings = await Promise.all(
        data.map(async (est) => {
          const { data: reviews } = await supabase
            .from('reviews')
            .select('rating, safety_rating')
            .eq('establishment_id', est.id);

          const ratings = reviews || [];
          const avg = ratings.length > 0
            ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
            : 0;
          const safety = ratings.filter((r) => r.safety_rating && r.safety_rating > 0);
          const avgSafety = safety.length > 0
            ? safety.reduce((sum, r) => sum + (r.safety_rating || 0), 0) / safety.length
            : 0;

          return { ...est, avg_rating: avg, review_count: ratings.length, avg_safety_rating: avgSafety };
        })
      );

      if (reset) {
        setEstablishments(withRatings);
        setPage(0);
      } else {
        setEstablishments((prev) => [...prev, ...withRatings]);
      }
      setHasMore(data.length === PAGE_SIZE);

      if (debouncedSearch.trim()) {
        // Centrer sur le 1er établissement aux coords valides ; sinon géocoder
        // la recherche (ex. « Paris ») pour afficher la ville même sans résultat.
        const firstValid = withRatings.find(
          (e) => Math.abs(e.latitude) > 0.0001 && Math.abs(e.longitude) > 0.0001
        );
        if (firstValid) {
          setMapFlyTo({ lng: firstValid.longitude, lat: firstValid.latitude });
        } else {
          const c = await geocodeFirst(debouncedSearch.trim());
          if (c) setMapFlyTo({ lng: c[0], lat: c[1] });
        }
      }
    }
    setLoading(false);
    setSearchLoading(false);
  }, [page, selectedCategory, selectedSubcategories, debouncedSearch, bounds]);

  useEffect(() => {
    fetchEstablishments(true);
  }, [selectedCategory, selectedSubcategories, debouncedSearch]);

  const handleBoundsChange = useCallback((newBounds: Bounds) => {
    setBounds(newBounds);
  }, []);

  useEffect(() => {
    if (bounds && !debouncedSearch.trim()) {
      fetchEstablishments(true);
    }
  }, [bounds]);

  const handleCategoryChange = (category: CategoryKey | null) => {
    setSelectedCategory(category);
    setSelectedSubcategories([]);
  };

  const handleSubcategoryToggle = (sub: string) => {
    setSelectedSubcategories((prev) =>
      prev.includes(sub) ? prev.filter((s) => s !== sub) : [...prev, sub]
    );
  };

  const loadMore = () => {
    setPage((p) => p + 1);
    fetchEstablishments();
  };

  const handlePinSelect = useCallback((id: string | null) => {
    setSelectedPinId(id);
    if (id) {
      const el = cardRefs.current.get(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, []);

  const registerCardRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) {
      cardRefs.current.set(id, el);
    } else {
      cardRefs.current.delete(id);
    }
  }, []);

  const handleCardClick = useCallback((est: Establishment) => {
    setSelectedPinId(est.id);
    setMapFlyTo({ lng: est.longitude, lat: est.latitude });
  }, []);

  const activeSearch = debouncedSearch.trim();

  const establishmentList = (
    <div className="space-y-3">
      {activeSearch && !loading && (
        <p className="text-xs text-gray-500 dark:text-gray-400 px-1">
          {establishments.length} resultat{establishments.length !== 1 ? 's' : ''} pour &laquo;&nbsp;{activeSearch}&nbsp;&raquo;
        </p>
      )}

      {establishments.map((est) => (
        <div
          key={est.id}
          ref={(el) => registerCardRef(est.id, el)}
          onClick={() => handleCardClick(est)}
          className={`rounded-card transition-all duration-300 cursor-pointer ${
            selectedPinId === est.id
              ? 'ring-2 ring-primary ring-offset-2 dark:ring-offset-dark-bg'
              : ''
          }`}
        >
          <EstablishmentCard establishment={est} />
        </div>
      ))}

      {loading && (
        <div className="flex justify-center py-8">
          <LoadingSpinner size={32} />
        </div>
      )}

      {!loading && establishments.length === 0 && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <p>Aucun etablissement trouve.</p>
          <p className="text-sm mt-1">Essaie de modifier tes filtres.</p>
        </div>
      )}

      {hasMore && !loading && establishments.length > 0 && (
        <button onClick={loadMore} className="btn-secondary w-full">
          Charger plus
        </button>
      )}
    </div>
  );

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: 'calc(100dvh - 3.5rem - 4rem)' }}>
      <DisclaimerModal />

      <FeaturedEvents />

      <div className="shrink-0 px-4 pt-2 pb-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            {searchLoading && (
              <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-primary animate-spin" />
            )}
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un lieu, une ville..."
              className="input-field pl-9 pr-9 text-xs w-full"
              style={{ height: 36, paddingTop: 6, paddingBottom: 6 }}
            />
          </div>
          <CategoryFilters
            selectedCategory={selectedCategory}
            selectedSubcategories={selectedSubcategories}
            onCategoryChange={handleCategoryChange}
            onSubcategoryToggle={handleSubcategoryToggle}
          />
        </div>
      </div>

      <div className="hidden lg:flex flex-1 min-h-0 gap-0">
        <div className="shrink-0 h-full" style={{ width: '55%' }}>
          <div className="h-full px-2 pb-2">
            <MapView
              establishments={establishments}
              userLocation={userLocation}
              onBoundsChange={handleBoundsChange}
              onEstablishmentClick={(id) => navigate(`/establishment/${id}`)}
              onPinSelect={handlePinSelect}
              flyTo={mapFlyTo}
              selectedId={selectedPinId}
            />
          </div>
        </div>

        <div
          className="h-full overflow-y-auto px-4 pb-4 space-y-4"
          style={{ width: '45%' }}
          ref={listContainerRef}
        >
          {establishmentList}
        </div>
      </div>

      <div className="lg:hidden flex flex-col flex-1 min-h-0">
        <div className="shrink-0 border-b border-light-border dark:border-dark-border" style={{ height: '40dvh' }}>
          <MapView
            establishments={establishments}
            userLocation={userLocation}
            onBoundsChange={handleBoundsChange}
            onEstablishmentClick={(id) => navigate(`/establishment/${id}`)}
            onPinSelect={handlePinSelect}
            flyTo={mapFlyTo}
            selectedId={selectedPinId}
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 p-4" style={{ minHeight: '200px' }}>
          {establishmentList}
        </div>
      </div>

      {questionnaireOpen && profile?.is_premium && (
        <PremiumQuestionnaireModal
          onClose={() => {
            setQuestionnaireOpen(false);
            refreshProfile();
          }}
        />
      )}
    </div>
  );
}
