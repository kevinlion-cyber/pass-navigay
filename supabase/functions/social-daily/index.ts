import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";

// Réseaux sociaux (Facebook + Instagram) — fonction AUTONOME (pas d'import ../_shared),
// pour pouvoir être redéployée depuis le tableau de bord Supabase.
//
// Depuis le 28/11/2026, plus rien n'est publié sans validation de l'admin :
//   action "preparer" (défaut : bouton de l'admin ou tâche du matin)
//       → choisit un lieu (+ un événement à venir), fait écrire la légende par Claude,
//         enregistre un BROUILLON (status 'brouillon'). Rien n'est publié.
//   action "publier"  { post_id, caption } (admin seulement)
//       → publie le brouillon sur Facebook + Instagram avec le texte relu/modifié.
//   action "annuler"  { post_id } (admin seulement) → brouillon écarté.
// Les fiches « Coquin 18+ » (catégorie adulte) ne sont jamais proposées.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE = Deno.env.get("PUBLIC_SITE_URL") || "https://passnavigay.com";
const MODEL = Deno.env.get("FICHES_MODEL") || "claude-sonnet-5";
const CATEGORIES_EXCLUES = ["adulte"];
const LONGUEUR_MAX = 2000; // Instagram accepte 2 200 caractères, lien compris.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Social-Secret",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const service = (): SupabaseClient => createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function aal2(authHeader: string): boolean {
  try {
    const part = authHeader.slice(7).split(".")[1];
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
    return JSON.parse(atob(b64)).aal === "aal2";
  } catch {
    return false;
  }
}

// Vrai si l'appel vient d'un admin connecté avec la double authentification.
async function estAdmin(req: Request): Promise<boolean> {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return false;
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return false;
  const { data: me } = await service().from("profiles").select("is_admin").eq("id", data.user.id).maybeSingle();
  return !!me?.is_admin && aal2(auth);
}

async function legende(anthropicKey: string, kind: string, ctx: Record<string, unknown>): Promise<string> {
  const sys = `Tu es le community manager de Pass Navigay, l'annuaire des lieux LGBT-friendly en France.
Écris une légende Instagram/Facebook courte, chaleureuse et vivante (tutoiement inclusif, ton fun), qui donne envie.
Termine TOUJOURS par un appel à avis ("Tu connais ? Laisse ton avis 👉") et 4-6 hashtags pertinents (dont #PassNavigay).
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

interface Acces { token?: string | null; pageId?: string | null; igUser?: string | null }

async function publierMeta(acces: Acces, image: string, texte: string, lien: string) {
  const out: { fb?: string; ig?: string; errors: string[] } = { errors: [] };
  if (!acces.token) { out.errors.push("Meta non connecté (cliquez « Connecter Instagram + Facebook »)"); return out; }
  const V = "v21.0";
  const message = `${texte}\n${lien}`;
  if (acces.pageId) {
    try {
      const r = await fetch(`https://graph.facebook.com/${V}/${acces.pageId}/photos`, {
        method: "POST", body: new URLSearchParams({ url: image, message, access_token: acces.token }),
      });
      const j = await r.json();
      if (j.id || j.post_id) out.fb = j.post_id || j.id; else out.errors.push(`Facebook : ${JSON.stringify(j.error?.message || j).slice(0, 150)}`);
    } catch (e) { out.errors.push(`Facebook : ${e instanceof Error ? e.message : "erreur"}`); }
  }
  if (acces.igUser) {
    try {
      const cr = await fetch(`https://graph.facebook.com/${V}/${acces.igUser}/media`, {
        method: "POST", body: new URLSearchParams({ image_url: image, caption: message, access_token: acces.token }),
      });
      const cj = await cr.json();
      if (cj.id) {
        const pr = await fetch(`https://graph.facebook.com/${V}/${acces.igUser}/media_publish`, {
          method: "POST", body: new URLSearchParams({ creation_id: cj.id, access_token: acces.token }),
        });
        const pj = await pr.json();
        if (pj.id) out.ig = pj.id; else out.errors.push(`Instagram : ${JSON.stringify(pj.error?.message || pj).slice(0, 150)}`);
      } else out.errors.push(`Instagram : ${JSON.stringify(cj.error?.message || cj).slice(0, 150)}`);
    } catch (e) { out.errors.push(`Instagram : ${e instanceof Error ? e.message : "erreur"}`); }
  }
  return out;
}

async function preparer(svc: SupabaseClient) {
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY manquante");
  const brouillons: unknown[] = [];

  // 1) Lieu : avec bannière, hors Coquin 18+, le moins récemment mis en avant.
  const { data: est } = await svc.from("establishments")
    .select("id,name,category,subcategory,city,description,banner_url")
    .not("banner_url", "is", null)
    .not("category", "in", `(${CATEGORIES_EXCLUES.join(",")})`)
    .order("last_social_at", { ascending: true, nullsFirst: true })
    .limit(1);
  if (est?.[0]) {
    const e = est[0];
    const texte = await legende(anthropicKey, "establishment", {
      nom: e.name, categorie: e.category, sous_categorie: e.subcategory, ville: e.city, description: (e.description || "").slice(0, 400),
    });
    const { data } = await svc.from("social_posts").insert({
      kind: "establishment", establishment_id: e.id, caption: texte, image_url: e.banner_url,
      link_url: `${SITE}/establishment/${e.id}?src=social`, status: "brouillon",
    }).select("id").single();
    await svc.from("establishments").update({ last_social_at: new Date().toISOString() }).eq("id", e.id);
    brouillons.push({ id: data?.id, kind: "establishment", name: e.name });
  }

  // 2) Événement à venir avec image, dont le lieu n'est pas en Coquin 18+.
  const { data: evs } = await svc.from("events")
    .select("id,establishment_id,title,description,event_date,image_url,address,establishments(category)")
    .gte("event_date", new Date().toISOString())
    .not("image_url", "is", null)
    .order("last_social_at", { ascending: true, nullsFirst: true })
    .order("event_date", { ascending: true })
    .limit(10);
  const v = (evs || []).find((x: Record<string, any>) => !CATEGORIES_EXCLUES.includes(x.establishments?.category));
  if (v) {
    const texte = await legende(anthropicKey, "event", {
      titre: v.title, description: (v.description || "").slice(0, 400), date: v.event_date, lieu: v.address,
    });
    const { data } = await svc.from("social_posts").insert({
      kind: "event", establishment_id: v.establishment_id ?? null, event_id: v.id, caption: texte, image_url: v.image_url,
      link_url: `${SITE}/agenda/${v.id}?src=social`, status: "brouillon",
    }).select("id").single();
    await svc.from("events").update({ last_social_at: new Date().toISOString() }).eq("id", v.id);
    brouillons.push({ id: data?.id, kind: "event", name: v.title });
  }
  return brouillons;
}

async function publier(svc: SupabaseClient, postId: string, caption: string) {
  const texte = (caption || "").trim();
  if (!texte) return json({ error: "Le texte est vide." }, 400);
  if (texte.length > LONGUEUR_MAX) return json({ error: `Texte trop long (${texte.length} caractères, ${LONGUEUR_MAX} maximum).` }, 400);

  // On « réserve » le brouillon : deux clics rapides ne publient jamais deux fois.
  const { data: post } = await svc.from("social_posts")
    .update({ status: "publication", caption: texte })
    .eq("id", postId).eq("status", "brouillon")
    .select("id,image_url,link_url").maybeSingle();
  if (!post) return json({ error: "Ce brouillon n'est plus disponible (déjà publié ou annulé)." }, 409);
  if (!post.image_url) {
    await svc.from("social_posts").update({ status: "failed", error: "pas de visuel" }).eq("id", postId);
    return json({ error: "Pas de visuel pour ce post." }, 400);
  }

  const { data: integ } = await svc.from("social_integrations").select("page_id,page_access_token,ig_user_id").eq("id", 1).maybeSingle();
  const acces: Acces = { token: integ?.page_access_token, pageId: integ?.page_id, igUser: integ?.ig_user_id };
  const platforms: string[] = [];
  if (acces.pageId) platforms.push("facebook");
  if (acces.igUser) platforms.push("instagram");

  const meta = await publierMeta(acces, post.image_url, texte, post.link_url || SITE);
  const ok = !!(meta.fb || meta.ig);
  const status = ok ? (meta.errors.length ? "partial" : "posted") : "failed";
  await svc.from("social_posts").update({
    status, platforms, fb_post_id: meta.fb ?? null, ig_media_id: meta.ig ?? null,
    error: meta.errors.join(" | "), posted_at: ok ? new Date().toISOString() : null,
  }).eq("id", postId);
  return json({ status, errors: meta.errors });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action || "preparer";
    const secret = req.headers.get("x-social-secret");
    const cronOk = !!secret && secret === Deno.env.get("SOCIAL_CRON_SECRET");
    const admin = await estAdmin(req);

    // La tâche planifiée ne peut que PRÉPARER des brouillons ; publier exige un admin.
    if (!admin && !(cronOk && action === "preparer")) return json({ error: "Accès refusé" }, 403);
    const svc = service();

    if (action === "preparer") return json({ ran: true, posts: await preparer(svc) });
    if (action === "publier") {
      if (typeof body.post_id !== "string") return json({ error: "post_id manquant" }, 400);
      return await publier(svc, body.post_id, body.caption);
    }
    if (action === "annuler") {
      if (typeof body.post_id !== "string") return json({ error: "post_id manquant" }, 400);
      const { data } = await svc.from("social_posts").update({ status: "annule" })
        .eq("id", body.post_id).eq("status", "brouillon").select("id").maybeSingle();
      return data ? json({ ok: true }) : json({ error: "Ce brouillon n'est plus disponible." }, 409);
    }
    return json({ error: "Action inconnue" }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Erreur" }, 500);
  }
});
