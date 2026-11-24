// Module 5 : tracker analytics first-party (client). Envoie les événements à
// l'Edge Function `track` en fire-and-forget (keepalive), sans cookie ni SDK tiers.
// Toujours best-effort : ne jette jamais, ne bloque jamais l'UI.
//
// Consentement (CNIL, décision de Kévin du 24/11/2026) : sans accord explicite via
// le bandeau, les statistiques restent ANONYMES — identifiant de visite limité à
// l'onglet (sessionStorage), jamais relié au compte, rien de conservé d'une visite
// à l'autre. Avec accord : identifiant durable et lien avec le compte connecté
// (parcours visibles dans Admin → Utilisateurs).

const SESSION_KEY = 'pn_session_id';
const ATTR_KEY = 'pn_attr';
const CONSENT_KEY = 'pn_analytics_consent';
export const CONSENT_CHANGE_EVENT = 'pn-analytics-consent-change';
export const CONSENT_OPEN_EVENT = 'pn-analytics-consent-open';
const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track`;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export type AnalyticsEvent =
  | 'page_view' | 'search' | 'establishment_view' | 'event_view' | 'promo_view'
  | 'claim_start' | 'claim_submit' | 'register_start' | 'register_complete'
  | 'premium_view' | 'pro_view' | 'outbound_click';

let currentUserId: string | null = null;

function safeGet(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } }
function safeSet(k: string, v: string): void { try { localStorage.setItem(k, v); } catch { /* webview strict */ } }

function uuid(): string {
  try { if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID(); } catch { /* fallback */ }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export type AnalyticsConsent = 'granted' | 'denied' | null;

export function getAnalyticsConsent(): AnalyticsConsent {
  const v = safeGet(CONSENT_KEY);
  return v === 'granted' || v === 'denied' ? v : null;
}

export function setAnalyticsConsent(v: 'granted' | 'denied'): void {
  safeSet(CONSENT_KEY, v);
  if (v === 'denied') {
    // Refus : on oublie l'identifiant durable et l'origine de la visite.
    try { localStorage.removeItem(SESSION_KEY); localStorage.removeItem(ATTR_KEY); } catch { /* indisponible */ }
  }
  try { window.dispatchEvent(new Event(CONSENT_CHANGE_EVENT)); } catch { /* sans effet */ }
}

// Rouvre le bandeau (lien « Cookies et statistiques »).
export function openAnalyticsConsent(): void {
  try { window.dispatchEvent(new Event(CONSENT_OPEN_EVENT)); } catch { /* sans effet */ }
}

const granted = () => getAnalyticsConsent() === 'granted';

let tabSessionId: string | null = null;
export function getSessionId(): string {
  if (granted()) {
    let s = safeGet(SESSION_KEY);
    if (!s) { s = uuid(); safeSet(SESSION_KEY, s); }
    return s;
  }
  // Sans accord : identifiant de l'onglet uniquement, oublié à sa fermeture.
  try {
    let s = sessionStorage.getItem(SESSION_KEY);
    if (!s) { s = uuid(); sessionStorage.setItem(SESSION_KEY, s); }
    return s;
  } catch {
    if (!tabSessionId) tabSessionId = uuid();
    return tabSessionId;
  }
}

interface Attribution { referrer: string | null; utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; }

// Attribution 1er contact, capturée une seule fois (referrer externe + UTM du lien d'entrée).
let memAttr: Attribution | null = null;
function getAttribution(): Attribution {
  if (!granted() && memAttr) return memAttr;
  const cached = granted() ? safeGet(ATTR_KEY) : null;
  if (cached) { try { return JSON.parse(cached) as Attribution; } catch { /* recompute */ } }
  let referrer: string | null = null;
  try { if (document.referrer && new URL(document.referrer).host !== location.host) referrer = document.referrer; } catch { /* none */ }
  let utm_source: string | null = null, utm_medium: string | null = null, utm_campaign: string | null = null;
  try {
    const p = new URLSearchParams(location.search);
    utm_source = p.get('utm_source'); utm_medium = p.get('utm_medium'); utm_campaign = p.get('utm_campaign');
  } catch { /* none */ }
  const attr: Attribution = { referrer, utm_source, utm_medium, utm_campaign };
  if (granted()) safeSet(ATTR_KEY, JSON.stringify(attr)); else memAttr = attr;
  return attr;
}

// Relie la session au membre connecté (appelé depuis l'AuthContext).
export function setAnalyticsUser(id: string | null): void { currentUserId = id; }

export function track(name: AnalyticsEvent, payload?: Record<string, unknown>, establishmentId?: string | null): void {
  try {
    const attr = getAttribution();
    const body = JSON.stringify({
      session_id: getSessionId(),
      name,
      path: location.pathname,
      establishment_id: establishmentId ?? null,
      user_id: granted() ? currentUserId : null,
      payload: payload ?? {},
      referrer: attr.referrer,
      utm_source: attr.utm_source,
      utm_medium: attr.utm_medium,
      utm_campaign: attr.utm_campaign,
    });
    fetch(ENDPOINT, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}` },
      body,
    }).catch(() => { /* best-effort */ });
  } catch { /* never throw */ }
}

export const trackPageView = (): void => track('page_view');
export const trackSearch = (q: string): void => { const s = q.trim(); if (s.length >= 2) track('search', { q: s }); };
export const trackEstablishmentView = (id: string): void => track('establishment_view', {}, id);
