import { useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import type { Establishment, CategoryKey } from '../../lib/types';
import { DEFAULT_CENTER, CATEGORIES } from '../../lib/constants';
import { supabase } from '../../lib/supabase';

interface MapViewProps {
  establishments: Establishment[];
  userLocation: { lat: number; lng: number } | null;
  onBoundsChange: (bounds: { north: number; south: number; east: number; west: number }) => void;
  onEstablishmentClick: (id: string) => void;
  onPinSelect?: (id: string | null) => void;
  flyTo?: { lng: number; lat: number } | null;
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
      .from('promotions')
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

function buildPopupElement(
  est: Establishment,
  extras: PopupData,
  onNavigate: (id: string) => void,
  isDark: boolean
): HTMLDivElement {
  const container = document.createElement('div');
  container.style.cssText = `width:260px;border-radius:12px;overflow:hidden;font-family:Inter,system-ui,sans-serif;background:${isDark ? '#16161f' : '#fff'};box-shadow:0 4px 20px rgba(0,0,0,${isDark ? '0.5' : '0.15'});`;

  const coverUrl = est.banner_url || '';
  const coverHtml = coverUrl
    ? `<div style="position:relative;height:100px;overflow:hidden;">
        <img src="${coverUrl}" style="width:100%;height:100%;object-fit:cover;" />
        ${est.logo_url ? `<img src="${est.logo_url}" style="position:absolute;bottom:-12px;left:12px;width:32px;height:32px;border-radius:50%;border:2px solid white;object-fit:cover;background:${isDark ? '#16161f' : '#fff'};" />` : ''}
      </div>`
    : `<div style="position:relative;height:60px;background:${isDark ? '#2a2a35' : '#f3e8f8'};">
        ${est.logo_url ? `<img src="${est.logo_url}" style="position:absolute;bottom:-12px;left:12px;width:32px;height:32px;border-radius:50%;border:2px solid white;object-fit:cover;background:${isDark ? '#16161f' : '#fff'};" />` : ''}
      </div>`;

  const textColor = isDark ? '#f3f3f3' : '#1a1a1a';
  const subColor = isDark ? '#a0a0a8' : '#666';
  const catLabel = CATEGORIES[est.category as CategoryKey]?.label || est.category;

  let badges = '';
  if (est.is_pro) badges += `<span style="display:inline-block;font-size:10px;font-weight:600;padding:1px 6px;border-radius:20px;background:rgba(123,45,139,0.15);color:#7B2D8B;margin-left:4px;">PRO</span>`;
  if (est.is_sponsor) badges += `<span style="display:inline-block;font-size:10px;font-weight:600;padding:1px 6px;border-radius:20px;background:rgba(212,160,23,0.15);color:#d4a017;margin-left:4px;">Sponsor</span>`;

  const avgRating = est.avg_rating || 0;
  const reviewCount = est.review_count || 0;
  let starsHtml = '';
  if (avgRating > 0) {
    const filled = Math.round(avgRating);
    const stars = [1, 2, 3, 4, 5]
      .map(
        (i) =>
          `<svg width="12" height="12" viewBox="0 0 24 24" fill="${i <= filled ? '#d4a017' : 'none'}" stroke="${i <= filled ? '#d4a017' : (isDark ? '#444' : '#ccc')}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`
      )
      .join('');
    starsHtml = `<div style="display:flex;align-items:center;gap:2px;margin-top:6px;">${stars}<span style="font-size:11px;color:${subColor};margin-left:4px;">(${reviewCount})</span></div>`;
  }

  let promoHtml = '';
  if (extras.promo) {
    promoHtml = `<div style="margin-top:8px;padding:5px 8px;border-radius:6px;background:rgba(26,122,58,0.1);font-size:11px;color:#1a7a3a;display:flex;align-items:center;gap:4px;">
      <span style="font-size:13px;">&#127991;&#65039;</span> ${escapeHtml(extras.promo.title)}
    </div>`;
  }

  let eventHtml = '';
  if (extras.event) {
    eventHtml = `<div style="margin-top:${extras.promo ? '4' : '8'}px;padding:5px 8px;border-radius:6px;background:rgba(123,45,139,0.08);font-size:11px;color:#7B2D8B;display:flex;align-items:center;gap:4px;">
      <span style="font-size:13px;">&#128197;</span> ${escapeHtml(extras.event.title)} — ${escapeHtml(extras.event.dateLabel)}
    </div>`;
  }

  container.innerHTML = `
    ${coverHtml}
    <div style="padding:${coverUrl ? '16' : '16'}px 12px 12px;">
      <div style="display:flex;align-items:center;flex-wrap:wrap;">
        <span style="font-size:13px;font-weight:600;color:${textColor};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px;">${escapeHtml(est.name)}</span>
        ${badges}
      </div>
      <div style="font-size:11px;color:${subColor};margin-top:3px;">${escapeHtml(catLabel)} &middot; ${escapeHtml(est.subcategory)}</div>
      <div style="font-size:11px;color:${subColor};margin-top:3px;display:flex;align-items:center;gap:3px;">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="${subColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(est.address)}, ${escapeHtml(est.city)}</span>
      </div>
      ${starsHtml}
      ${promoHtml}
      ${eventHtml}
    </div>
  `;

  const btn = document.createElement('button');
  btn.textContent = 'Voir la fiche';
  btn.style.cssText = `display:block;width:calc(100% - 24px);margin:0 12px 12px;padding:8px;border:none;border-radius:8px;background:#7B2D8B;color:white;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;transition:opacity 0.15s;`;
  btn.onmouseenter = () => { btn.style.opacity = '0.9'; };
  btn.onmouseleave = () => { btn.style.opacity = '1'; };
  btn.onclick = (e) => {
    e.stopPropagation();
    onNavigate(est.id);
  };
  container.appendChild(btn);

  return container;
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export default function MapView({ establishments, userLocation, onBoundsChange, onEstablishmentClick, onPinSelect, flyTo }: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const openPopupRef = useRef<mapboxgl.Popup | null>(null);

  const emitBounds = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const bounds = map.getBounds();
    onBoundsChange({
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
    });
  }, [onBoundsChange]);

  useEffect(() => {
    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    if (!token || !mapContainerRef.current) return;

    mapboxgl.accessToken = token;
    const center = userLocation || DEFAULT_CENTER;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [center.lng, center.lat],
      zoom: 13,
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.on('moveend', emitBounds);
    map.on('load', emitBounds);

    map.on('click', (e) => {
      const target = e.originalEvent.target as HTMLElement;
      if (target.closest('.mapboxgl-popup') || target.closest('.map-marker')) return;
      if (openPopupRef.current) {
        openPopupRef.current.remove();
        openPopupRef.current = null;
        onPinSelect?.(null);
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [userLocation, emitBounds, onPinSelect]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const timer = setTimeout(() => map.resize(), 150);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!flyTo || !mapRef.current) return;
    mapRef.current.flyTo({
      center: [flyTo.lng, flyTo.lat],
      zoom: 13,
      duration: 1000,
    });
  }, [flyTo]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const isDark = document.documentElement.classList.contains('dark');

    establishments.forEach((est) => {
      const el = document.createElement('div');
      el.className = 'map-marker';
      if (est.is_sponsor) {
        el.style.backgroundColor = '#d4a017';
      }

      el.addEventListener('click', async (e) => {
        e.stopPropagation();

        if (openPopupRef.current) {
          openPopupRef.current.remove();
          openPopupRef.current = null;
        }

        onPinSelect?.(est.id);

        const placeholderEl = document.createElement('div');
        placeholderEl.style.cssText = `width:260px;padding:40px;display:flex;align-items:center;justify-content:center;`;
        placeholderEl.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" class="animate-spin" style="color:#7B2D8B;animation:spin 1s linear infinite;"><style>@keyframes spin{to{transform:rotate(360deg)}}</style><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" opacity="0.2"/><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`;

        const popup = new mapboxgl.Popup({
          offset: 15,
          closeButton: false,
          closeOnClick: false,
          maxWidth: '260px',
          className: 'rich-popup',
        })
          .setLngLat([est.longitude, est.latitude])
          .setDOMContent(placeholderEl)
          .addTo(map);

        openPopupRef.current = popup;

        const extras = await fetchPopupExtras(est.id);
        if (!openPopupRef.current || openPopupRef.current !== popup) return;

        const content = buildPopupElement(est, extras, onEstablishmentClick, isDark);
        popup.setDOMContent(content);
      });

      const marker = new mapboxgl.Marker(el)
        .setLngLat([est.longitude, est.latitude])
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [establishments, onEstablishmentClick, onPinSelect]);

  return (
    <div
      ref={mapContainerRef}
      className="rounded-card overflow-hidden"
      style={{ width: '100%', height: '100%', minHeight: 300 }}
    />
  );
}
