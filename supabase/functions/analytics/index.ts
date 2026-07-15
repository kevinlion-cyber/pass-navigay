import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getAuthenticatedUser, jsonResponse, serviceClient, corsHeaders } from "../_shared/auth.ts";

// Module 5 : lecture des analytics (JWT requis). Deux modes :
//   - overview      (admin)        : audience + entonnoir de conversion sur N jours
//   - establishment (owner|admin)  : nb de vues d'UNE fiche (levier upsell espace Pro)
// Les tables sont RLS-locked → toute lecture passe par ici (service role) après contrôle.

const MAX_ROWS = 100000;

function host(url: string | null): string | null {
  if (!url) return null;
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return null; }
}
// Regroupement par JOUR CALENDAIRE Europe/Paris (gère l'heure d'été via Intl) —
// pas d'UTC, sinon décalage de minuit. 'en-CA' formate en AAAA-MM-JJ.
const PARIS_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" });
function dayKey(iso: string): string { return PARIS_DAY.format(new Date(iso)); }
function sinceIso(days: number): string { return new Date(Date.now() - days * 86400000).toISOString(); }
function emptyDays(days: number): { date: string; value: number }[] {
  // Ancre = aujourd'hui (Paris) à midi UTC : le pas de 24 h ne franchit jamais minuit (robuste au DST).
  const anchor = new Date(`${PARIS_DAY.format(new Date())}T12:00:00Z`);
  const out: { date: string; value: number }[] = [];
  for (let i = days - 1; i >= 0; i--) out.push({ date: PARIS_DAY.format(new Date(anchor.getTime() - i * 86400000)), value: 0 });
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return jsonResponse({ error: "Non authentifié" }, 401);
    const svc = serviceClient();
    const { data: me } = await svc.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();

    const body = await req.json().catch(() => ({}));
    const mode = body.mode || "overview";

    // ---- Vues d'une fiche (owner ou admin) ----
    if (mode === "establishment") {
      const estId = String(body.establishmentId || "");
      if (!estId) return jsonResponse({ error: "establishmentId requis" }, 400);
      const { data: est } = await svc.from("establishments").select("owner_id").eq("id", estId).maybeSingle();
      if (!est) return jsonResponse({ error: "Établissement introuvable" }, 404);
      if (!me?.is_admin && est.owner_id !== user.id) return jsonResponse({ error: "Accès refusé" }, 403);

      const since30 = sinceIso(30);
      const since7 = sinceIso(7);
      // Ids des promos de cette fiche (pour attribuer les activations).
      const { data: promoRows } = await svc.from("promotions").select("id").eq("establishment_id", estId);
      const promoIds = (promoRows || []).map((p) => p.id);
      const [totalRes, rowsRes, promoTotalRes, promoUsesRes, contactTotalRes, contactRowsRes] = await Promise.all([
        svc.from("analytics_events").select("*", { count: "exact", head: true }).eq("establishment_id", estId).eq("name", "establishment_view"),
        svc.from("analytics_events").select("created_at, session_id").eq("establishment_id", estId).eq("name", "establishment_view").gte("created_at", since30).limit(MAX_ROWS),
        promoIds.length ? svc.from("promotion_uses").select("*", { count: "exact", head: true }).in("promotion_id", promoIds) : Promise.resolve({ count: 0 }),
        promoIds.length ? svc.from("promotion_uses").select("used_at").in("promotion_id", promoIds).gte("used_at", since30).limit(MAX_ROWS) : Promise.resolve({ data: [] }),
        svc.from("analytics_events").select("*", { count: "exact", head: true }).eq("establishment_id", estId).eq("name", "outbound_click"),
        svc.from("analytics_events").select("created_at, payload").eq("establishment_id", estId).eq("name", "outbound_click").gte("created_at", since30).limit(MAX_ROWS),
      ]);
      const rows = rowsRes.data || [];
      const series = emptyDays(30);
      const idx: Record<string, number> = {}; series.forEach((d, i) => (idx[d.date] = i));
      let last7 = 0;
      const visitors = new Set<string>();
      for (const r of rows) {
        const k = dayKey(r.created_at); if (k in idx) series[idx[k]].value++;
        if (r.created_at >= since7) last7++;
        visitors.add(r.session_id);
      }
      const promoUses = (promoUsesRes.data || []) as { used_at: string }[];
      const promoSeries = emptyDays(30);
      const pidx: Record<string, number> = {}; promoSeries.forEach((d, i) => (pidx[d.date] = i));
      let promoLast7 = 0;
      for (const u of promoUses) { const k = dayKey(u.used_at); if (k in pidx) promoSeries[pidx[k]].value++; if (u.used_at >= since7) promoLast7++; }
      // Clics de contact (site web / téléphone / itinéraire) + répartition par type.
      const contactRows = (contactRowsRes.data || []) as { created_at: string; payload: Record<string, unknown> }[];
      let contactLast7 = 0; const contactKinds: Record<string, number> = {};
      for (const c of contactRows) { if (c.created_at >= since7) contactLast7++; const k = String(c.payload?.kind || "autre"); contactKinds[k] = (contactKinds[k] || 0) + 1; }
      return jsonResponse({
        mode, total: totalRes.count ?? 0, last30: rows.length, last7,
        uniqueVisitors30: visitors.size, series,
        promoActivations: { total: promoTotalRes.count ?? 0, last30: promoUses.length, last7: promoLast7, series: promoSeries },
        contactClicks: { total: contactTotalRes.count ?? 0, last30: contactRows.length, last7: contactLast7, kinds: contactKinds },
      });
    }

    // ---- Vue d'ensemble (admin only) ----
    if (!me?.is_admin) return jsonResponse({ error: "Accès refusé" }, 403);
    const days = [7, 30, 90].includes(Number(body.days)) ? Number(body.days) : 30;
    const since = sinceIso(days);

    const [evRes, idRes, newMembersRes, favRes, revRes, msgRes, promoUsesRes] = await Promise.all([
      svc.from("analytics_events").select("session_id, name, establishment_id, payload, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(MAX_ROWS),
      svc.from("analytics_identities").select("session_id, referrer, utm_source").gte("first_seen", since).limit(MAX_ROWS),
      svc.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", since).neq("account_type", "pro"),
      svc.from("favorites").select("*", { count: "exact", head: true }).gte("created_at", since),
      svc.from("reviews").select("*", { count: "exact", head: true }).gte("created_at", since),
      svc.from("messages").select("*", { count: "exact", head: true }).gte("created_at", since),
      svc.from("promotion_uses").select("promotion_id, used_at").gte("used_at", since).limit(MAX_ROWS),
    ]);
    const events = evRes.data || [];
    const identities = idRes.data || [];

    const visitors = new Set<string>();
    let pageviews = 0, estViews = 0, searches = 0, contactClicks = 0;
    const tsPV: Record<string, number> = {};
    const tsVisit: Record<string, Set<string>> = {};
    const fiches: Record<string, number> = {};
    const queries: Record<string, number> = {};
    const funnelSets: Record<string, Set<string>> = { view: new Set(), claim_start: new Set(), claim_submit: new Set(), register: new Set() };

    for (const e of events) {
      visitors.add(e.session_id);
      const k = dayKey(e.created_at);
      (tsVisit[k] ||= new Set()).add(e.session_id);
      if (e.name === "page_view") { pageviews++; tsPV[k] = (tsPV[k] || 0) + 1; }
      else if (e.name === "establishment_view") {
        estViews++;
        if (e.establishment_id) fiches[e.establishment_id] = (fiches[e.establishment_id] || 0) + 1;
        funnelSets.view.add(e.session_id);
      } else if (e.name === "search") {
        searches++;
        const q = (e.payload?.q || "").toString().trim().toLowerCase();
        if (q) queries[q] = (queries[q] || 0) + 1;
      } else if (e.name === "outbound_click") contactClicks++;
      else if (e.name === "claim_start") funnelSets.claim_start.add(e.session_id);
      else if (e.name === "claim_submit") funnelSets.claim_submit.add(e.session_id);
      else if (e.name === "register_complete") funnelSets.register.add(e.session_id);
    }

    // Timeseries jour par jour.
    const series = emptyDays(days).map((d) => ({ date: d.date, pageviews: tsPV[d.date] || 0, visitors: (tsVisit[d.date]?.size) || 0 }));

    // Top fiches (résout les noms).
    const topFicheIds = Object.entries(fiches).sort((a, b) => b[1] - a[1]).slice(0, 10);
    let topFiches: { id: string; name: string; city: string | null; views: number }[] = [];
    if (topFicheIds.length) {
      const { data: ests } = await svc.from("establishments").select("id, name, city").in("id", topFicheIds.map((x) => x[0]));
      const byId: Record<string, { name: string; city: string | null }> = {};
      (ests || []).forEach((e) => (byId[e.id] = { name: e.name, city: e.city }));
      topFiches = topFicheIds.map(([id, views]) => ({ id, name: byId[id]?.name || "Fiche supprimée", city: byId[id]?.city || null, views }));
    }

    const topSearches = Object.entries(queries).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([q, count]) => ({ q, count }));

    // Sources de trafic (1er contact via identities).
    const sources: Record<string, number> = {};
    for (const i of identities) {
      const key = i.utm_source ? `utm:${i.utm_source}` : (host(i.referrer) || "Accès direct");
      sources[key] = (sources[key] || 0) + 1;
    }
    const topSources = Object.entries(sources).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([source, count]) => ({ source, count }));

    // Promos activées (validation sur place) + classement des promos les plus activées.
    const promoUses = (promoUsesRes.data || []) as { promotion_id: string; used_at: string }[];
    const promoCount: Record<string, number> = {};
    for (const u of promoUses) if (u.promotion_id) promoCount[u.promotion_id] = (promoCount[u.promotion_id] || 0) + 1;
    const topPromoIds = Object.entries(promoCount).sort((a, b) => b[1] - a[1]).slice(0, 10);
    let topPromos: { id: string; title: string; establishment: string | null; count: number }[] = [];
    if (topPromoIds.length) {
      const { data: promos } = await svc.from("promotions").select("id, title, establishment_id").in("id", topPromoIds.map((x) => x[0]));
      const pEstIds = [...new Set((promos || []).map((p) => p.establishment_id).filter(Boolean))];
      const estMap: Record<string, string> = {};
      if (pEstIds.length) { const { data: ests } = await svc.from("establishments").select("id, name").in("id", pEstIds); (ests || []).forEach((e) => (estMap[e.id] = e.name)); }
      const pMap: Record<string, { title: string; est: string | null }> = {};
      (promos || []).forEach((p) => (pMap[p.id] = { title: p.title, est: estMap[p.establishment_id] || null }));
      topPromos = topPromoIds.map(([id, count]) => ({ id, title: pMap[id]?.title || "Promo supprimée", establishment: pMap[id]?.est || null, count }));
    }

    const funnel = {
      views: funnelSets.view.size,
      claim_start: funnelSets.claim_start.size,
      claim_submit: funnelSets.claim_submit.size,
      register: funnelSets.register.size,
    };

    return jsonResponse({
      mode, days,
      kpis: { visitors: visitors.size, pageviews, establishmentViews: estViews, searches, contactClicks, newSessions: identities.length },
      engagement: { newMembers: newMembersRes.count ?? 0, favorites: favRes.count ?? 0, reviews: revRes.count ?? 0, messages: msgRes.count ?? 0, promoActivations: promoUses.length },
      series, topFiches, topSearches, topSources, topPromos, funnel,
      capped: events.length >= MAX_ROWS,
    });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Erreur" }, 500);
  }
});
