import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getAuthenticatedUser, jsonResponse, serviceClient, corsHeaders } from "../_shared/auth.ts";

// Module 5 (admin) : suivi utilisateur « façon Intercom ». Une PERSONNE = un membre
// (toutes ses sessions liées par user_id) ou un visiteur anonyme (session isolée).
// - mode list   : liste des personnes + agrégats
// - mode detail : fiche complète + timeline chronologique de la MOINDRE action
// Répliqué de joyeusefête (src/lib/admin/people.ts), adapté au schéma Pass Navigay.

const LIM = 50000;
type Row = Record<string, unknown>;
const norm = (s: unknown) => (typeof s === "string" && s.trim() ? s.trim() : null);
const maxTs = (a: string | null, b: string | null) => (!a ? b : !b ? a : a > b ? a : b);
const minTs = (a: string | null, b: string | null) => (!a ? b : !b ? a : a < b ? a : b);
const isUuid = (s: unknown) => typeof s === "string" && /^[0-9a-f-]{36}$/i.test(s);

function pageLabel(path: string): string {
  if (!path || path === "/") return "Accueil";
  const seg = path.split("/").filter(Boolean);
  const map: Record<string, string> = {
    explore: "Explorer", events: "Agenda / Événements", promos: "Promotions", members: "Membres",
    pricing: "Offre Premium", pros: "Espace pro", favorites: "Favoris", messages: "Messagerie",
    revendiquer: "Revendication d'une fiche", profile: "Profil", legal: "Pages légales",
  };
  if (seg[0] === "establishment") return "Fiche établissement";
  if (seg[0] === "events" && seg[1]) return "Détail d'un événement";
  if (seg[0] === "promos" && seg[1]) return "Détail d'une promo";
  return map[seg[0]] || path;
}
const EVENT_FR: Record<string, string> = {
  claim_start: "A ouvert la revendication d'une fiche",
  claim_submit: "A envoyé une revendication ✓",
  register_complete: "Inscription terminée ✓",
  register_start: "A commencé une inscription",
  premium_view: "A vu l'offre Premium",
  pro_view: "A vu l'espace pro",
  event_view: "A vu un événement",
  promo_view: "A vu une promotion",
};

interface Bag {
  key: string; userId: string | null; email: string | null; name: string | null;
  city: string | null; country: string | null; userAgent: string | null; referrer: string | null;
  firstSeen: string | null; lastSeen: string | null; sessionIds: Set<string>;
  pageViews: number; events: number; searches: number; establishmentViews: number;
  favorites: number; reviews: number; messages: number; claims: number; promoUses: number;
  isPremium: boolean; isPro: boolean; isVerified: boolean; createdAt: string | null;
}
function newBag(key: string): Bag {
  return {
    key, userId: null, email: null, name: null, city: null, country: null, userAgent: null, referrer: null,
    firstSeen: null, lastSeen: null, sessionIds: new Set(),
    pageViews: 0, events: 0, searches: 0, establishmentViews: 0,
    favorites: 0, reviews: 0, messages: 0, claims: 0, promoUses: 0,
    isPremium: false, isPro: false, isVerified: false, createdAt: null,
  };
}
function fullName(p: Row): string | null {
  const pn = [norm(p.prenom), norm(p.nom)].filter(Boolean).join(" ");
  return pn || norm(p.username);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return jsonResponse({ error: "Non authentifié" }, 401);
    const svc = serviceClient();
    const { data: me } = await svc.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
    if (!me?.is_admin) return jsonResponse({ error: "Accès refusé" }, 403);

    const body = await req.json().catch(() => ({}));
    const mode = body.mode || "list";

    // -------- Index d'identité partagé (identities + profiles + events légers) --------
    const [identRes, profRes, evRes, favRes, revRes, msgRes, claimRes, promoRes] = await Promise.all([
      svc.from("analytics_identities").select("session_id,user_id,city,country,user_agent,referrer,first_seen,last_seen,page_views").limit(LIM),
      svc.from("profiles").select("id,username,prenom,nom,email,city,account_type,is_premium,is_verified,created_at,last_active_at").limit(LIM),
      svc.from("analytics_events").select("session_id,user_id,name,created_at").order("created_at", { ascending: false }).limit(LIM),
      svc.from("favorites").select("user_id").limit(LIM),
      svc.from("reviews").select("user_id").limit(LIM),
      svc.from("messages").select("sender_id").limit(LIM),
      svc.from("establishment_claims").select("claimant_profile_id").limit(LIM),
      svc.from("promotion_uses").select("user_id").limit(LIM),
    ]);
    const idents = (identRes.data ?? []) as Row[];
    const profiles = (profRes.data ?? []) as Row[];
    const events = (evRes.data ?? []) as Row[];

    const bags = new Map<string, Bag>();
    const userToKey = new Map<string, string>();
    const sessionToKey = new Map<string, string>();
    const bag = (k: string) => { let b = bags.get(k); if (!b) { b = newBag(k); bags.set(k, b); } return b; };

    // 1) Membres = profiles (clé = user_id).
    for (const p of profiles) {
      const uid = String(p.id);
      const b = bag(uid);
      b.userId = uid; b.email = norm(p.email); b.name = fullName(p); b.city = norm(p.city);
      b.isPremium = Boolean(p.is_premium); b.isPro = String(p.account_type) === "pro"; b.isVerified = Boolean(p.is_verified);
      b.createdAt = (p.created_at as string) || null;
      b.firstSeen = minTs(b.firstSeen, p.created_at as string);
      b.lastSeen = maxTs(b.lastSeen, (p.last_active_at as string) || null);
      userToKey.set(uid, uid);
    }
    // 2) Sessions.
    for (const it of idents) {
      const sid = String(it.session_id);
      const uid = it.user_id ? String(it.user_id) : null;
      const key = (uid && userToKey.get(uid)) || uid || sid;
      const b = bag(key);
      if (uid) { b.userId ??= uid; userToKey.set(uid, key); }
      b.name = b.name || null; b.city = b.city || norm(it.city); b.country = b.country || norm(it.country);
      b.userAgent = b.userAgent || norm(it.user_agent); b.referrer = b.referrer || norm(it.referrer);
      b.firstSeen = minTs(b.firstSeen, it.first_seen as string);
      b.lastSeen = maxTs(b.lastSeen, it.last_seen as string);
      b.sessionIds.add(sid); sessionToKey.set(sid, key);
    }
    // 3) Events (par session).
    for (const e of events) {
      const key = sessionToKey.get(String(e.session_id)) || (e.user_id ? userToKey.get(String(e.user_id)) : null) || String(e.session_id);
      const b = bag(key);
      b.sessionIds.add(String(e.session_id));
      b.events += 1;
      if (e.name === "page_view") b.pageViews += 1;
      else if (e.name === "search") b.searches += 1;
      else if (e.name === "establishment_view") b.establishmentViews += 1;
      b.lastSeen = maxTs(b.lastSeen, e.created_at as string);
      b.firstSeen = minTs(b.firstSeen, e.created_at as string);
    }
    // 4) Compteurs d'engagement (par user_id).
    const bump = (rows: Row[], col: string, field: keyof Bag) => {
      for (const r of rows) {
        const uid = r[col] ? String(r[col]) : null;
        const key = uid ? userToKey.get(uid) : null;
        if (key) (bags.get(key)![field] as number) += 1;
      }
    };
    bump((favRes.data ?? []) as Row[], "user_id", "favorites");
    bump((revRes.data ?? []) as Row[], "user_id", "reviews");
    bump((msgRes.data ?? []) as Row[], "sender_id", "messages");
    bump((claimRes.data ?? []) as Row[], "claimant_profile_id", "claims");
    bump((promoRes.data ?? []) as Row[], "user_id", "promoUses");

    // ============ LISTE ============
    if (mode === "list") {
      const isTest = (e: string | null) => !!e && (e.endsWith("@example.com") || e.includes("magicbob.lemonnier") || e.startsWith("qa_") || e.startsWith("qa-analytics"));
      let people = [...bags.values()]
        .filter((b) => !isTest(b.email))
        // Ignore le bruit : ni membre, ni la moindre activité.
        .filter((b) => b.userId || b.events > 0)
        .map((b) => ({
          key: b.key, kind: b.userId ? "member" : "guest", name: b.name, email: b.email,
          city: b.city, firstSeen: b.firstSeen, lastSeen: b.lastSeen, sessions: b.sessionIds.size,
          pageViews: b.pageViews, events: b.events, searches: b.searches, establishmentViews: b.establishmentViews,
          favorites: b.favorites, reviews: b.reviews, messages: b.messages, claims: b.claims,
          isPremium: b.isPremium, isPro: b.isPro, isVerified: b.isVerified,
        }))
        .sort((a, b) => (b.lastSeen ?? "").localeCompare(a.lastSeen ?? ""));

      const totals = {
        people: people.length,
        members: people.filter((p) => p.kind === "member").length,
        guests: people.filter((p) => p.kind === "guest").length,
        premium: people.filter((p) => p.isPremium).length,
        pros: people.filter((p) => p.isPro).length,
      };
      return jsonResponse({ mode, totals, people });
    }

    // ============ DÉTAIL + TIMELINE ============
    const key = String(body.key || "");
    const b = bags.get(key);
    if (!b) return jsonResponse({ error: "Personne introuvable" }, 404);
    const sessionIds = [...b.sessionIds];
    const uid = b.userId;

    // Rechargements ciblés (rows complètes) pour la timeline de CETTE personne.
    const [evFull, favFull, revFull, msgFull, claimFull, promoFull] = await Promise.all([
      sessionIds.length ? svc.from("analytics_events").select("name,path,payload,establishment_id,created_at").in("session_id", sessionIds).order("created_at", { ascending: false }).limit(2000) : Promise.resolve({ data: [] }),
      uid ? svc.from("favorites").select("establishment_id,created_at").eq("user_id", uid) : Promise.resolve({ data: [] }),
      uid ? svc.from("reviews").select("establishment_id,rating,comment,created_at").eq("user_id", uid) : Promise.resolve({ data: [] }),
      uid ? svc.from("messages").select("created_at").eq("sender_id", uid).order("created_at", { ascending: false }).limit(500) : Promise.resolve({ data: [] }),
      uid ? svc.from("establishment_claims").select("establishment_id,status,created_at").eq("claimant_profile_id", uid) : Promise.resolve({ data: [] }),
      uid ? svc.from("promotion_uses").select("promotion_id,used_at").eq("user_id", uid) : Promise.resolve({ data: [] }),
    ]);

    // Noms d'établissements référencés.
    const estIds = new Set<string>();
    for (const e of (evFull.data ?? []) as Row[]) if (isUuid(e.establishment_id)) estIds.add(String(e.establishment_id));
    for (const f of (favFull.data ?? []) as Row[]) if (isUuid(f.establishment_id)) estIds.add(String(f.establishment_id));
    for (const r of (revFull.data ?? []) as Row[]) if (isUuid(r.establishment_id)) estIds.add(String(r.establishment_id));
    for (const c of (claimFull.data ?? []) as Row[]) if (isUuid(c.establishment_id)) estIds.add(String(c.establishment_id));
    const estName = new Map<string, string>();
    if (estIds.size) {
      const { data: ests } = await svc.from("establishments").select("id,name").in("id", [...estIds]);
      (ests ?? []).forEach((e: Row) => estName.set(String(e.id), String(e.name)));
    }
    const nm = (id: unknown) => (isUuid(id) && estName.get(String(id))) || "une fiche";

    // Résolution des promos activées (titre + établissement).
    const promoIds = [...new Set(((promoFull.data ?? []) as Row[]).map((p) => p.promotion_id).filter(isUuid).map(String))];
    const promoMap = new Map<string, { title: string; est: string | null }>();
    if (promoIds.length) {
      const { data: promos } = await svc.from("promotions").select("id, title, establishments(name)").in("id", promoIds);
      (promos ?? []).forEach((p: Row) => promoMap.set(String(p.id), { title: String(p.title), est: (p.establishments as Row)?.name ? String((p.establishments as Row).name) : null }));
    }

    const timeline: { ts: string; type: string; label: string; detail?: string }[] = [];
    for (const e of (evFull.data ?? []) as Row[]) {
      const name = String(e.name);
      const path = String(e.path ?? "/");
      if (name === "page_view") {
        if (path.startsWith("/establishment/")) continue; // couvert par establishment_view (libellé + nom)
        timeline.push({ ts: String(e.created_at), type: "page", label: pageLabel(path), detail: path });
      } else if (name === "establishment_view") {
        timeline.push({ ts: String(e.created_at), type: "establishment", label: `A consulté la fiche ${nm(e.establishment_id)}` });
      } else if (name === "search") {
        const q = (e.payload as Row)?.q; timeline.push({ ts: String(e.created_at), type: "search", label: `A recherché « ${q ?? "?"} »` });
      } else {
        timeline.push({ ts: String(e.created_at), type: "event", label: EVENT_FR[name] ?? name });
      }
    }
    for (const f of (favFull.data ?? []) as Row[]) timeline.push({ ts: String(f.created_at), type: "favorite", label: `A mis en favori ${nm(f.establishment_id)}` });
    for (const r of (revFull.data ?? []) as Row[]) timeline.push({ ts: String(r.created_at), type: "review", label: `A laissé un avis sur ${nm(r.establishment_id)}`, detail: `${r.rating ?? "?"}/5${norm(r.comment) ? ` · « ${String(r.comment).slice(0, 80)} »` : ""}` });
    for (const m of (msgFull.data ?? []) as Row[]) timeline.push({ ts: String(m.created_at), type: "message", label: "A envoyé un message" });
    for (const c of (claimFull.data ?? []) as Row[]) timeline.push({ ts: String(c.created_at), type: "claim", label: `A revendiqué ${nm(c.establishment_id)}`, detail: String(c.status) });
    for (const p of (promoFull.data ?? []) as Row[]) {
      const info = promoMap.get(String(p.promotion_id));
      const label = info ? `A activé la promo « ${info.title} »${info.est ? ` chez ${info.est}` : ""}` : "A activé une promotion";
      timeline.push({ ts: String(p.used_at), type: "promo", label });
    }
    if (b.createdAt) timeline.push({ ts: b.createdAt, type: "signup", label: "Inscription sur Pass Navigay" });

    timeline.sort((a, c) => c.ts.localeCompare(a.ts));

    return jsonResponse({
      mode, person: {
        key: b.key, kind: b.userId ? "member" : "guest", name: b.name, email: b.email,
        city: b.city, country: b.country, userAgent: b.userAgent, referrer: b.referrer,
        firstSeen: b.firstSeen, lastSeen: b.lastSeen, sessions: b.sessionIds.size,
        pageViews: b.pageViews, events: b.events, searches: b.searches, establishmentViews: b.establishmentViews,
        favorites: b.favorites, reviews: b.reviews, messages: b.messages, claims: b.claims, promoUses: b.promoUses,
        isPremium: b.isPremium, isPro: b.isPro, isVerified: b.isVerified,
      },
      timeline: timeline.slice(0, 600),
    });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Erreur" }, 500);
  }
});
