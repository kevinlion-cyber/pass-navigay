import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Establishment, CategoryKey } from '../lib/types';
import { DEFAULT_CENTER, PAGE_SIZE } from '../lib/constants';
import CategoryFilters from '../components/explore/CategoryFilters';
import EstablishmentCard from '../components/explore/EstablishmentCard';
import FeaturedEvents from '../components/explore/FeaturedEvents';
import MapView from '../components/explore/MapView';
import DisclaimerModal from '../components/ui/DisclaimerModal';
import LoadingSpinner from '../components/ui/LoadingSpinner';

type Bounds = { north: number; south: number; east: number; west: number };

export default function Explore() {
  const navigate = useNavigate();
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey | null>(null);
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);

  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const listContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setUserLocation(DEFAULT_CENTER)
    );
  }, []);

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
    if (search.trim()) {
      query = query.or(`name.ilike.%${search.trim()}%,city.ilike.%${search.trim()}%,address.ilike.%${search.trim()}%`);
    }
    if (bounds) {
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
            .select('rating')
            .eq('establishment_id', est.id);

          const ratings = reviews || [];
          const avg = ratings.length > 0
            ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
            : 0;

          return { ...est, avg_rating: avg, review_count: ratings.length };
        })
      );

      if (reset) {
        setEstablishments(withRatings);
        setPage(0);
      } else {
        setEstablishments((prev) => [...prev, ...withRatings]);
      }
      setHasMore(data.length === PAGE_SIZE);
    }
    setLoading(false);
  }, [page, selectedCategory, selectedSubcategories, search, bounds]);

  useEffect(() => {
    fetchEstablishments(true);
  }, [selectedCategory, selectedSubcategories, search]);

  const handleBoundsChange = useCallback((newBounds: Bounds) => {
    setBounds(newBounds);
  }, []);

  useEffect(() => {
    if (bounds) {
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

  const establishmentList = (
    <div className="space-y-3">
      {establishments.map((est) => (
        <div
          key={est.id}
          ref={(el) => registerCardRef(est.id, el)}
          className={`rounded-card transition-all duration-300 ${
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
    <div className="max-w-7xl mx-auto flex flex-col overflow-hidden" style={{ height: 'calc(100dvh - 3.5rem - 4rem)' }}>
      <DisclaimerModal />

      <div className="shrink-0 px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un lieu, une ville..."
              className="input-field pl-9 text-xs w-full"
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

      {/* Desktop: side-by-side */}
      <div className="hidden md:flex gap-4 px-4 pb-4 flex-1 min-h-0">
        <div className="w-[60%] h-full min-h-0">
          <MapView
            establishments={establishments}
            userLocation={userLocation}
            onBoundsChange={handleBoundsChange}
            onEstablishmentClick={(id) => navigate(`/establishment/${id}`)}
            onPinSelect={handlePinSelect}
          />
        </div>

        <div className="w-[40%] h-full overflow-y-auto min-h-0 space-y-4" ref={listContainerRef}>
          <FeaturedEvents />
          {establishmentList}
        </div>
      </div>

      {/* Mobile: map on top, list below */}
      <div className="md:hidden flex flex-col flex-1 min-h-0">
        <div className="shrink-0 border-b border-light-border dark:border-dark-border" style={{ height: '40dvh' }}>
          <MapView
            establishments={establishments}
            userLocation={userLocation}
            onBoundsChange={handleBoundsChange}
            onEstablishmentClick={(id) => navigate(`/establishment/${id}`)}
            onPinSelect={handlePinSelect}
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 p-4" style={{ minHeight: '200px' }}>
          <FeaturedEvents />
          {establishmentList}
        </div>
      </div>
    </div>
  );
}
