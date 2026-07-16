import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, getAuthenticatedUser, jsonResponse, serviceClient } from "../_shared/auth.ts";

// Récupère les COMMENTAIRES laissés sur nos publications (Facebook + Instagram)
// et les stocke → on sait ce que les gens pensent de nos posts.
// Appelable par l'admin (bouton) ou par le cron (secret partagé).
// Idempotent : dédup sur comment_id (unique).
const V = "v21.0";

async function fbComments(postId: string, token: string) {
  const url = `https://graph.facebook.com/${V}/${postId}/comments?fields=id,from{name},message,created_time&limit=100&access_token=${token}`;
  const j = await (await fetch(url)).json();
  if (j.error) return { rows: [], error: String(j.error.message).slice(0, 150) };
  return {
    rows: (j.data || []).map((c: any) => ({
      platform: "facebook", comment_id: String(c.id),
      author: c.from?.name ?? null, text: c.message ?? "", commented_at: c.created_time ?? null,
    })), error: null as string | null,
  };
}
async function igComments(mediaId: string, token: string) {
  const url = `https://graph.facebook.com/${V}/${mediaId}/comments?fields=id,username,text,timestamp&limit=100&access_token=${token}`;
  const j = await (await fetch(url)).json();
  if (j.error) return { rows: [], error: String(j.error.message).slice(0, 150) };
  return {
    rows: (j.data || []).map((c: any) => ({
      platform: "instagram", comment_id: String(c.id),
      author: c.username ?? null, text: c.text ?? "", commented_at: c.timestamp ?? null,
    })), error: null as string | null,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const svc = serviceClient();
    const body = await req.json().catch(() => ({}));

    // Auth : cron (secret) OU admin connecté.
    const cronSecret = Deno.env.get("GENERATION_WORKER_SECRET");
    const isCron = !!cronSecret && body.secret === cronSecret;
    if (!isCron) {
      const user = await getAuthenticatedUser(req);
      if (!user) return jsonResponse({ error: "Non authentifié" }, 401);
      const { data: me } = await svc.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
      if (!me?.is_admin) return jsonResponse({ error: "Accès refusé" }, 403);
    }

    const { data: integ } = await svc.from("social_integrations").select("page_access_token").eq("id", 1).maybeSingle();
    const token = integ?.page_access_token;
    if (!token) return jsonResponse({ error: "Meta non connecté — cliquez « Connecter Instagram + Facebook »" }, 400);

    // Posts publiés récents (90 j) ayant un id Meta.
    const since = new Date(Date.now() - 90 * 86400000).toISOString();
    const { data: posts } = await svc.from("social_posts")
      .select("id, fb_post_id, ig_media_id").gte("created_at", since)
      .or("fb_post_id.not.is.null,ig_media_id.not.is.null").limit(200);

    let fetched = 0, inserted = 0;
    const errors: string[] = [];
    for (const p of posts || []) {
      const batches: { rows: any[]; error: string | null }[] = [];
      if (p.fb_post_id) batches.push(await fbComments(p.fb_post_id, token));
      if (p.ig_media_id) batches.push(await igComments(p.ig_media_id, token));
      for (const b of batches) {
        if (b.error) { errors.push(b.error); continue; }
        for (const c of b.rows) {
          fetched++;
          const { error } = await svc.from("social_comments").upsert({ post_id: p.id, ...c }, { onConflict: "comment_id" });
          if (!error) inserted++;
        }
      }
    }
    return jsonResponse({ posts: (posts || []).length, fetched, stored: inserted, errors: errors.slice(0, 3) });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Erreur" }, 500);
  }
});
