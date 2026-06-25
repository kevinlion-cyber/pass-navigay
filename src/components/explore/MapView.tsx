import { useCallback, useEffect, useRef, useState } from 'react';
import { APIProvider, Map, AdvancedMarker, InfoWindow, useMap } from '@vis.gl/react-google-maps';
import type { Establishment, CategoryKey } from '../../lib/types';
import { DEFAULT_CENTER } from '../../lib/constants';
import { useCategories } from '../../contexts/CategoriesContext';
import { supabase } from '../../lib/supabase';

interface MapViewProps {
  establishments: Establishment[];
  userLocation: { lat: number; lng: number } | null;
  onBoundsChange: (bounds: { north: number; south: number; east: number; west: number }) => void;
  onEstablishmentClick: (id: string) => void;
  onPinSelect?: (id: string | null) => void;
  flyTo?: { lng: number; lat: number } | null;
  selectedId?: string | null;
  highlightId?: string | null;
}

interface PopupData {
  promo?: { title: string };
  event?: { title: string; dateLabel: string };
}

async function fetchPopupExtras(estId: string): Promise<PopupData> {
  const now = new Date().toISOString();
  const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const [promoRes, eventRes] = await Promise.all([
    supabase
      .from('public_promotions')
      .select('title')
      .eq('establishment_id', estId)
      .lte('valid_from', now)
      .gte('valid_until', now)
      .limit(1),
    supabase
      .from('events')
      .select('title, event_date')
      .eq('establishment_id', estId)
      .gte('event_date', now)
      .lte('event_date', weekFromNow)
      .order('event_date', { ascending: true })
      .limit(1),
  ]);

  const result: PopupData = {};
  if (promoRes.data?.[0]) result.promo = promoRes.data[0];
  if (eventRes.data?.[0]) {
    const ev = eventRes.data[0];
    const d = new Date(ev.event_date);
    const dayName = d.toLocaleDateString('fr-FR', { weekday: 'long' });
    const dayNum = d.getDate();
    const month = d.toLocaleDateString('fr-FR', { month: 'short' });
    result.event = { title: ev.title, dateLabel: `${dayName} ${dayNum} ${month}.` };
  }
  return result;
}

function MapInner({ establishments, userLocation, onBoundsChange, onEstablishmentClick, onPinSelect, flyTo, selectedId, highlightId }: MapViewProps) {
  const map = useMap();
  const [activeMarker, setActiveMarker] = useState<string | null>(null);
  const [popupData, setPopupData] = useState<PopupData>({});
  const [popupLoading, setPopupLoading] = useState(false);
  const boundsTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const emitBounds = useCallback(() => {
    if (!map) return;
    const bounds = map.getBounds();
    if (!bounds) return;
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    onBoundsChange({
      north: ne.lat(),
      south: sw.lat(),
      east: ne.lng(),
      west: sw.lng(),
    });
  }, [map, onBoundsChange]);

  useEffect(() => {
    if (!map) return;

    const listener = map.addListener('idle', () => {
      clearTimeout(boundsTimeoutRef.current);
      boundsTimeoutRef.current = setTimeout(emitBounds, 100);
    });

    return () => {
      google.maps.event.removeListener(listener);
      clearTimeout(boundsTimeoutRef.current);
    };
  }, [map, emitBounds]);

  useEffect(() => {
    if (!flyTo || !map) return;
    map.panTo({ lat: flyTo.lat, lng: flyTo.lng });
    map.setZoom(14);
  }, [flyTo, map]);

  useEffect(() => {
    if (!selectedId || !map) return;
    const est = establishments.find((e) => e.id === selectedId);
    if (est) {
      map.panTo({ lat: est.latitude, lng: est.longitude });
      if ((map.getZoom() || 13) < 14) map.setZoom(14);
      handleMarkerClick(est);
    }
  }, [selectedId]);

  const handleMarkerClick = async (est: Establishment) => {
    setActiveMarker(est.id);
    onPinSelect?.(est.id);
    setPopupLoading(true);
    setPopupData({});
    const extras = await fetchPopupExtras(est.id);
    setPopupData(extras);
    setPopupLoading(false);
  };

  const handleMapClick = () => {
    setActiveMarker(null);
    onPinSelect?.(null);
  };

  const activeEst = establishments.find((e) => e.id === activeMarker);

  return (
    <>
      <Map
        defaultCenter={userLocation || DEFAULT_CENTER}
        defaultZoom={13}
        gestureHandling="greedy"
        disableDefaultUI={false}
        mapId="pass-navigay-map"
        onClick={handleMapClick}
        style={{ width: '100%', height: '100%' }}
        colorScheme="DARK"
      >
        {establishments.map((est) => (
          <AdvancedMarker
            key={est.id}
            position={{ lat: est.latitude, lng: est.longitude }}
            onClick={() => handleMarkerClick(est)}
          >
            <div
              className="w-5 h-5 rounded-full border-2 border-white cursor-pointer shadow-md"
              style={{
                backgroundColor: est.is_sponsor ? '#d4a017' : '#7B2D8B',
                // Halo si actif (clic) ou survolé depuis la liste ; zoom uniquement au survol liste (E2).
                boxShadow: (activeMarker === est.id || highlightId === est.id)
                  ? '0 0 0 4px rgba(123,45,139,0.45)'
                  : '0 1px 3px rgba(0,0,0,0.3)',
                transform: highlightId === est.id ? 'scale(1.4)' : 'scale(1)',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}
            />
          </AdvancedMarker>
        ))}

        {activeEst && (
          <InfoWindow
            position={{ lat: activeEst.latitude, lng: activeEst.longitude }}
            onCloseClick={() => { setActiveMarker(null); onPinSelect?.(null); }}
            pixelOffset={[0, -10]}
          >
            <PopupContent
              est={activeEst}
              extras={popupData}
              loading={popupLoading}
              onNavigate={onEstablishmentClick}
            />
          </InfoWindow>
        )}
      </Map>
    </>
  );
}

function PopupContent({ est, extras, loading, onNavigate }: { est: Establishment; extras: PopupData; loading: boolean; onNavigate: (id: string) => void }) {
  const { categories } = useCategories();
  const catLabel = categories[est.category as CategoryKey]?.label || est.category;

  return (
    <div className="w-[240px] font-sans">
      {est.banner_url && (
        <div className="relative h-[80px] -mx-2 -mt-2 mb-2 overflow-hidden rounded-t">
          <img src={est.banner_url} alt="" className="w-full h-full object-cover" />
          {est.logo_url && (
            <img src={est.logo_url} alt="" className="absolute bottom-[-8px] left-2 w-7 h-7 rounded-full border-2 border-white object-cover bg-white" />
          )}
        </div>
      )}

      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-[13px] font-semibold text-gray-900 truncate max-w-[150px]">{est.name}</span>
        {est.is_pro && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">PRO</span>}
        {est.is_sponsor && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">Sponsor</span>}
      </div>

      <p className="text-[11px] text-gray-500 mt-0.5">{catLabel} · {est.subcategory}</p>
      <p className="text-[11px] text-gray-500 mt-0.5 truncate">{est.address}, {est.city}</p>

      {((est.avg_rating ?? 0) > 0 || (est.avg_safety_rating ?? 0) > 0) && (
        <div className="flex items-center gap-2 mt-1">
          {(est.avg_rating ?? 0) > 0 && (
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <svg key={i} width="11" height="11" viewBox="0 0 24 24" fill={i <= Math.round(est.avg_rating || 0) ? '#d4a017' : 'none'} stroke={i <= Math.round(est.avg_rating || 0) ? '#d4a017' : '#ccc'} strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              ))}
              <span className="text-[10px] text-gray-400 ml-0.5">({est.review_count || 0})</span>
            </div>
          )}
          {(est.avg_safety_rating ?? 0) > 0 && (
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <svg key={i} width="11" height="11" viewBox="0 0 24 24" fill={i <= Math.round(est.avg_safety_rating || 0) ? '#10b981' : 'none'} stroke={i <= Math.round(est.avg_safety_rating || 0) ? '#10b981' : '#ccc'} strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              ))}
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-1.5 mt-2 text-[11px] text-gray-400">
          <div className="w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          Chargement...
        </div>
      )}

      {extras.promo && (
        <div className="mt-2 px-2 py-1 rounded bg-green-50 text-[11px] text-green-700 flex items-center gap-1">
          <span>🏷</span> {extras.promo.title}
        </div>
      )}

      {extras.event && (
        <div className="mt-1 px-2 py-1 rounded bg-purple-50 text-[11px] text-purple-700 flex items-center gap-1">
          <span>📅</span> {extras.event.title} — {extras.event.dateLabel}
        </div>
      )}

      <button
        onClick={() => onNavigate(est.id)}
        className="mt-2 w-full py-1.5 rounded-lg text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
        style={{ background: '#7B2D8B' }}
      >
        Voir la fiche
      </button>
    </div>
  );
}

export default function MapView(props: MapViewProps) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY;

  if (!apiKey) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-dark-surface rounded-card text-gray-500 text-sm">
        Cle Google Maps non configuree
      </div>
    );
  }

  return (
    <div className="rounded-card overflow-hidden" style={{ width: '100%', height: '100%', minHeight: 300 }}>
      <APIProvider apiKey={apiKey}>
        <MapInner {...props} />
      </APIProvider>
    </div>
  );
}
