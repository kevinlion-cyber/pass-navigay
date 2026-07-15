import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, jsonResponse, serviceClient } from "../_shared/auth.ts";

// Module 5 : capture analytics first-party (PUBLIC, --no-verify-jwt).
// Le client anon envoie un événement ; on l'insère + on met à jour l'agrégat
// de session (identity). Écriture via service role (les tables sont RLS-locked).
// Best-effort : ne jamais faire échouer côté client (renvoie toujours 200).

// Liste blanche des noms d'événements (refuse tout le reste = anti-pollution).
const ALLOWED = new Set<string>([
  "page_view",
  "search",
  "establishment_view",
  "event_view",
  "promo_view",
  "claim_start",
  "claim_submit",
  "register_start",
  "register_complete",
  "premium_view",
  "pro_view",
  "outbound_click",
]);

function host(url: string | null | undefined): string | null {
  if (!url) return null;
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return null; }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const sid = typeof body.session_id === "string" ? body.session_id.slice(0, 64) : "";
    const name = typeof body.name === "string" ? body.name : "";
    if (!sid || !ALLOWED.has(name)) return jsonResponse({ ok: false }, 200);

    const svc = serviceClient();
    const now = new Date().toISOString();
    const isPV = name === "page_view";

    // UUID d'établissement seulement si ça ressemble à un UUID (sinon null).
    const estId = typeof body.establishment_id === "string" && /^[0-9a-f-]{36}$/i.test(body.establishment_id)
      ? body.establishment_id : null;
    const userId = typeof body.user_id === "string" && /^[0-9a-f-]{36}$/i.test(body.user_id)
      ? body.user_id : null;

    const utm = {
      source: typeof body.utm_source === "string" ? body.utm_source.slice(0, 120) : null,
      medium: typeof body.utm_medium === "string" ? body.utm_medium.slice(0, 120) : null,
      campaign: typeof body.utm_campaign === "string" ? body.utm_campaign.slice(0, 120) : null,
    };
    const referrer = typeof body.referrer === "string" ? body.referrer.slice(0, 300) : null;
    const country = req.headers.get("x-country") || req.headers.get("cf-ipcountry") || null;
    const ua = (req.headers.get("user-agent") || "").slice(0, 300);

    // 1) Événement brut.
    await svc.from("analytics_events").insert({
      session_id: sid,
      name,
      path: typeof body.path === "string" ? body.path.slice(0, 300) : null,
      establishment_id: estId,
      user_id: userId,
      payload: body.payload && typeof body.payload === "object" ? body.payload : {},
      referrer,
      utm_source: utm.source,
      utm_medium: utm.medium,
      utm_campaign: utm.campaign,
      created_at: now,
    });

    // 2) Agrégat de session (attribution 1er contact : referrer/utm posés à l'insert seulement).
    const { data: existing } = await svc.from("analytics_identities")
      .select("session_id, page_views").eq("session_id", sid).maybeSingle();
    if (existing) {
      await svc.from("analytics_identities").update({
        last_seen: now,
        page_views: (existing.page_views || 0) + (isPV ? 1 : 0),
        ...(userId ? { user_id: userId } : {}),
      }).eq("session_id", sid);
    } else {
      await svc.from("analytics_identities").insert({
        session_id: sid,
        user_id: userId,
        first_seen: now,
        last_seen: now,
        referrer,
        utm_source: utm.source,
        utm_medium: utm.medium,
        utm_campaign: utm.campaign,
        country,
        user_agent: ua,
        page_views: isPV ? 1 : 0,
      });
    }

    return jsonResponse({ ok: true, source: host(referrer) }, 200);
  } catch {
    // Best-effort : ne jamais casser le client.
    return jsonResponse({ ok: false }, 200);
  }
});
