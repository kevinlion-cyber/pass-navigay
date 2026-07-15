import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, getAuthenticatedUser, jsonResponse, serviceClient } from "../_shared/auth.ts";

// Module 2 : machine de contenu social quotidien.
// Choisit un établissement (+ un événement à venir si dispo), génère une légende IA
// avec appel à avis, et publie sur Instagram + Facebook (API Meta). 100% auto (cron).
// Sans token Meta configuré → le post est GÉNÉRÉ et journalisé (status 'generated'),
// prêt à passer en publication live dès que Kevin fournit l'accès.

const SITE = Deno.env.get("PUBLIC_SITE_URL") || "https://passnavigay.com";
const MODEL = Deno.env.get("FICHES_MODEL") || "claude-sonnet-5";

async function caption(anthropicKey: string, kind: string, ctx: Record<string, unknown>): Promise<string> {
  const sys = `Tu es le community manager de Pass Navigay, l'annuaire des lieux LGBT-friendly en France.
Écris une légende Instagram/Facebook courte, chaleureuse et vivante (vouvoiement ou tutoiement inclusif, ton fun), qui donne envie.
Termine TOUJOURS par un appel à avis ("Vous connaissez ? Laissez votre avis 👉") et 4-6 hashtags pertinents (dont #PassNavigay).
2-4 phrases max avant les hashtags. 1-2 emojis bien choisis. N'invente aucun fait. Réponds UNIQUEMENT par la légende, sans guillemets.`;
  const user = kind === "event"
    ? `ÉVÉNEMENT à annoncer :\n${JSON.stringify(ctx)}\nÉcris la légende (le lien sera ajouté séparément).`
    : `LIEU à mettre en avant :\n${JSON.stringify(ctx)}\nÉcris la légende (le lien sera ajouté séparément).`;
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": anthropicKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 500, system: sys, messages: [{ role: "user", content: user }] }),
  });
  if (!r.ok) throw new Error(`Claude ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const data = await r.json();
  return (data.content || []).map((c: { text?: string }) => c.text || "").join("").trim();
}

interface MetaCreds { token?: string | null; pageId?: string | null; igUser?: string | null }

// Publication Meta (Facebook Page + Instagram). Renvoie { fb_post_id, ig_media_id }.
async function postToMeta(creds: MetaCreds, image: string, text: string, link: string): Promise<{ fb?: string; ig?: string; errors: string[] }> {
  const token = creds.token;
  const pageId = creds.pageId;
  const igUser = creds.igUser;
  const out: { fb?: string; ig?: string; errors: string[] } = { errors: [] };
  if (!token) { out.errors.push("Meta non connecté (cliquez « Connecter Instagram + Facebook »)"); return out; }
  const V = "v21.0";

  if (pageId) {
    try {
      const body = new URLSearchParams({ url: image, message: `${text}\n${link}`, access_token: token });
      const r = await fetch(`https://graph.facebook.com/${V}/${pageId}/photos`, { method: "POST", body });
      const j = await r.json();
      if (j.id || j.post_id) out.fb = j.post_id || j.id; else out.errors.push(`FB: ${JSON.stringify(j.error || j).slice(0, 150)}`);
    } catch (e) { out.errors.push(`FB: ${e instanceof Error ? e.message : "err"}`); }
  }

  if (igUser) {
    try {
      const c = new URLSearchParams({ image_url: image, caption: `${text}\n${link}`, access_token: token });
      const cr = await fetch(`https://graph.facebook.com/${V}/${igUser}/media`, { method: "POST", body: c });
      const cj = await cr.json();
      if (cj.id) {
        const p = new URLSearchParams({ creation_id: cj.id, access_token: token });
        const pr = await fetch(`https://graph.facebook.com/${V}/${igUser}/media_publish`, { method: "POST", body: p });
        const pj = await pr.json();
        if (pj.id) out.ig = pj.id; else out.errors.push(`IG publish: ${JSON.stringify(pj.error || pj).slice(0, 150)}`);
      } else out.errors.push(`IG media: ${JSON.stringify(cj.error || cj).slice(0, 150)}`);
    } catch (e) { out.errors.push(`IG: ${e instanceof Error ? e.message : "err"}`); }
  }
  return out;
}

async function buildAndPost(svc: ReturnType<typeof serviceClient>, anthropicKey: string, creds: MetaCreds, kind: "establishment" | "event", row: Record<string, any>, image: string, ctx: Record<string, unknown>, link: string) {
  const platforms: string[] = [];
  if (creds.pageId) platforms.push("facebook");
  if (creds.igUser) platforms.push("instagram");

  const text = await caption(anthropicKey, kind, ctx);
  const meta = image ? await postToMeta(creds, image, text, link) : { errors: ["pas de visuel"] } as { fb?: string; ig?: string; errors: string[] };
  const posted = !!(meta.fb || meta.ig);
  const status = posted ? (meta.errors.length ? "partial" : "posted") : "generated";

  await svc.from("social_posts").insert({
    kind,
    establishment_id: kind === "establishment" ? row.id : row.establishment_id ?? null,
    event_id: kind === "event" ? row.id : null,
    caption: text,
    image_url: image,
    link_url: link,
    platforms,
    ig_media_id: meta.ig ?? null,
    fb_post_id: meta.fb ?? null,
    status,
    error: meta.errors.join(" | "),
    posted_at: posted ? new Date().toISOString() : null,
  });
  if (kind === "establishment") await svc.from("establishments").update({ last_social_at: new Date().toISOString() }).eq("id", row.id);
  else await svc.from("events").update({ last_social_at: new Date().toISOString() }).eq("id", row.id);
  return { kind, name: row.name || row.title, status, errors: meta.errors };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    // Auth : secret cron OU admin (déclenchement manuel).
    const secret = req.headers.get("x-social-secret");
    const cronOk = secret && secret === Deno.env.get("SOCIAL_CRON_SECRET");
    if (!cronOk) {
      const user = await getAuthenticatedUser(req);
      if (!user) return jsonResponse({ error: "Non autorisé" }, 401);
      const svc0 = serviceClient();
      const { data: me } = await svc0.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
      if (!me?.is_admin) return jsonResponse({ error: "Accès refusé" }, 403);
    }

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) return jsonResponse({ error: "ANTHROPIC_API_KEY manquante" }, 500);
    const svc = serviceClient();
    const { data: integ } = await svc.from("social_integrations").select("page_id,page_access_token,ig_user_id").eq("id", 1).maybeSingle();
    const creds: MetaCreds = { token: integ?.page_access_token, pageId: integ?.page_id, igUser: integ?.ig_user_id };
    const results: unknown[] = [];

    // 1) Établissement du jour : avec photo, le moins récemment mis en avant.
    const { data: est } = await svc.from("establishments")
      .select("id,name,category,subcategory,city,description,banner_url")
      .not("banner_url", "is", null)
      .order("last_social_at", { ascending: true, nullsFirst: true })
      .limit(1);
    if (est?.[0]) {
      const e = est[0];
      const link = `${SITE}/establishment/${e.id}?src=social`;
      results.push(await buildAndPost(svc, anthropicKey, creds, "establishment", e, e.banner_url,
        { nom: e.name, categorie: e.category, sous_categorie: e.subcategory, ville: e.city, description: (e.description || "").slice(0, 400) }, link));
    }

    // 2) Événement à venir (si dispo) : le plus proche non mis en avant récemment.
    const { data: ev } = await svc.from("events")
      .select("id,establishment_id,title,description,event_date,image_url,address")
      .gte("event_date", new Date().toISOString())
      .not("image_url", "is", null)
      .order("last_social_at", { ascending: true, nullsFirst: true })
      .order("event_date", { ascending: true })
      .limit(1);
    if (ev?.[0]) {
      const v = ev[0];
      const link = `${SITE}/events/${v.id}?src=social`;
      results.push(await buildAndPost(svc, anthropicKey, creds, "event", v, v.image_url,
        { titre: v.title, description: (v.description || "").slice(0, 400), date: v.event_date, lieu: v.address }, link));
    }

    return jsonResponse({ ran: true, posts: results });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Erreur" }, 500);
  }
});
