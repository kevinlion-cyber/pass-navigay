import { useCallback, useEffect, useRef, useState } from 'react';
import { APIProvider, Map, AdvancedMarker, InfoWindow, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import type { Establishment, CategoryKey } from '../../lib/types';
import { DEFAULT_CENTER } from '../../lib/constants';
import { useCategories } from '../../contexts/CategoriesContext';
import { supabase } from '../../lib/supabase';
import { useMapPins, type MapPin, type PinBounds } from '../../lib/mapPins';

interface MapViewProps {
  establishments: Establishment[];
  userLocation: { lat: number; lng: number } | null;
  onBoundsChange: (bounds: { north: number; south: number; east: number; west: number }) => void;
  onEstablishmentClick: (id: string) => void;
  onPinSelect?: (id: string | null) => void;
  flyTo?: { lng: number; lat: number } | null;
  selectedId?: string | null;
  highlightId?: string | null;
  fitToCity?: string | null;
  /** Filtres de l'annuaire, pour que la carte montre la même chose que la liste. */
  category?: string | null;
  subcategories?: string[];
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

function MapInner({ establishments, userLocation, onBoundsChange, onEstablishmentClick, onPinSelect, flyTo, selectedId, highlightId, fitToCity, category, subcategories }: MapViewProps) {
  const map = useMap();
  const [activeMarker, setActiveMarker] = useState<string | null>(null);
  const [popupData, setPopupData] = useState<PopupData>({});
  const [popupLoading, setPopupLoading] = useState(false);
  const boundsTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const lastFitRef = useRef<string | null>(null);

  // Cadrage courant de la carte : il pilote les points affichés. La carte est
  // ainsi autonome, elle ne dépend plus de la page de liste en cours.
  const [pinBounds, setPinBounds] = useState<PinBounds | null>(null);
  const { pins } = useMapPins(pinBounds, { category, subcategories });

  const emitBounds = useCallback(() => {
    if (!map) return;
    const bounds = map.getBounds();
    if (!bounds) return;
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const b = {
      north: ne.lat(),
      south: sw.lat(),
      east: ne.lng(),
      west: sw.lng(),
    };
    setPinBounds(b);
    onBoundsChange(b);
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

  // Quand une ville est choisie, cadrer la carte sur les lieux affichés (une seule
  // fois par ville, après le chargement des données) : sinon la carte reste centrée
  // sur le centre-ville et les lieux des communes rattachées tombent hors champ.
  useEffect(() => {
    if (!map || !fitToCity || fitToCity === lastFitRef.current) return;
    const valid = establishments.filter(
      (e) => Math.abs(e.latitude) > 0.0001 && Math.abs(e.longitude) > 0.0001
    );
    if (valid.length === 0) return;
    lastFitRef.current = fitToCity;
    if (valid.length === 1) {
      map.panTo({ lat: valid[0].latitude, lng: valid[0].longitude });
      map.setZoom(14);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    valid.forEach((e) => bounds.extend({ lat: e.latitude, lng: e.longitude }));
    map.fitBounds(bounds, 60);
  }, [fitToCity, establishments, map]);

  useEffect(() => {
    if (!selectedId || !map) return;
    const est = establishments.find((e) => e.id === selectedId);
    if (est) {
      map.panTo({ lat: est.latitude, lng: est.longitude });
      if ((map.getZoom() || 13) < 14) map.setZoom(14);
      handleMarkerClick(est);
    }
  }, [selectedId]);

  const handleMarkerClick = async (est: Establishment | MapPin) => {
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

  // La fiche ouverte dans la bulle peut venir de la liste (données complètes) ou
  // d'un point de la carte (données minimales) : on prend ce qu'on a.
  const activeFromList = establishments.find((e) => e.id === activeMarker);
  const activePin = pins.find((p) => p.id === activeMarker);
  const activeEst = activeFromList
    || (activePin ? ({ ...activePin, address: '', city: '' } as unknown as Establishment) : undefined);

  // Regroupement des points (bibliothèque officielle Google). Avec 886 lieux, poser
  // un marqueur par lieu rendait la carte illisible et lente : les points proches
  // sont donc rassemblés en pastilles qui se séparent au zoom.
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  // La bibliothèque des marqueurs se charge à la demande : sans attendre qu'elle
  // soit prête, l'effet passait trop tôt et aucun point n'était posé.
  const markerLib = useMapsLibrary('marker');

  useEffect(() => {
    if (!map || !markerLib) return;
    if (!clustererRef.current) {
      clustererRef.current = new MarkerClusterer({ map });
    }

    // On repart des points courants à chaque changement de cadrage ou de filtre.
    clustererRef.current.clearMarkers();
    markersRef.current.forEach((m) => { m.map = null; });
    markersRef.current = [];

    const { AdvancedMarkerElement } = markerLib;

    const created = pins
      .filter((p) => Math.abs(p.latitude) > 0.0001 || Math.abs(p.longitude) > 0.0001)
      .map((p) => {
        const dot = document.createElement('div');
        dot.className = 'w-5 h-5 rounded-full border-2 border-white cursor-pointer shadow-md';
        dot.style.backgroundColor = p.is_sponsor ? '#d4a017' : '#7B2D8B';
        dot.style.boxShadow = '0 1px 3px rgba(0,0,0,0.3)';
        dot.title = p.name;

        const marker = new AdvancedMarkerElement({
          position: { lat: p.latitude, lng: p.longitude },
          content: dot,
        });
        marker.addListener('click', () => handleMarkerClick(p));
        return marker;
      });

    markersRef.current = created;
    clustererRef.current.addMarkers(created);
  }, [map, markerLib, pins]);

  // Nettoyage au démontage : sans ça, les marqueurs restent attachés à la carte.
  useEffect(() => () => {
    clustererRef.current?.clearMarkers();
    markersRef.current.forEach((m) => { m.map = null; });
    markersRef.current = [];
    clustererRef.current = null;
  }, []);

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
        {/* Les points sont posés et regroupés par la bibliothèque de regroupement
            (voir l'effet plus haut), pas un par un ici : au-delà de quelques
            dizaines de lieux, un marqueur React par lieu sature la carte.
            On garde toutefois un marqueur mis en avant pour le lieu survolé dans
            la liste, sinon le lien entre la liste et la carte serait perdu. */}
        {highlightId && (() => {
          const h = establishments.find((e) => e.id === highlightId) || pins.find((p) => p.id === highlightId);
          if (!h || (Math.abs(h.latitude) < 0.0001 && Math.abs(h.longitude) < 0.0001)) return null;
          return (
            <AdvancedMarker
              key={`highlight-${h.id}`}
              position={{ lat: h.latitude, lng: h.longitude }}
              zIndex={999}
              onClick={() => handleMarkerClick(h)}
            >
              <div
                className="w-5 h-5 rounded-full border-2 border-white cursor-pointer"
                style={{
                  backgroundColor: h.is_sponsor ? '#d4a017' : '#7B2D8B',
                  boxShadow: '0 0 0 4px rgba(123,45,139,0.45)',
                  transform: 'scale(1.4)',
                }}
              />
            </AdvancedMarker>
          );
        })()}

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
