import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

// Callback OAuth Meta (Facebook Login). Cible du redirect_uri.
// Échange le code contre un token de page long-lived + l'ID du compte Instagram Business,
// et les stocke (social_integrations). Puis renvoie l'admin vers /admin/social.
// Public (--no-verify-jwt) : c'est l'URL de redirection Facebook.
// Sécurité (point M2 de l'audit, 24/11/2026) : le retour doit porter un jeton
// « state » à usage unique créé par un admin juste avant (table oauth_states,
// migration 68), sinon il est refusé — un tiers ne peut plus remplacer la page
// Facebook/Instagram connectée par la sienne.
// Fichier autonome : peut être redéployé depuis l'éditeur du tableau de bord Supabase.
Deno.serve(async (req: Request) => {
  const site = Deno.env.get("PUBLIC_SITE_URL") || "https://passnavigay.com";
  const back = (params: string) => new Response(null, { status: 302, headers: { Location: `${site}/admin/social?${params}` } });

  const url = new URL(req.url);
  if (url.searchParams.get("error")) return back(`meta_error=${encodeURIComponent(url.searchParams.get("error_description") || "refus")}`);
  const code = url.searchParams.get("code");
  if (!code) return back("meta_error=nocode");

  // Jeton « state » : doit exister, dater de moins de 15 minutes, et n'est utilisable qu'une fois.
  const state = url.searchParams.get("state") ?? "";
  const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  if (!state) return back("meta_error=state");
  const { data: used } = await svc.from("oauth_states").delete().eq("state", state).select("created_at").maybeSingle();
  if (!used || Date.now() - new Date(used.created_at).getTime() > 15 * 60 * 1000) {
    return back("meta_error=state");
  }

  const appId = Deno.env.get("META_APP_ID");
  const appSecret = Deno.env.get("META_APP_SECRET");
  if (!appId || !appSecret) return back("meta_error=noapp");
  const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/meta-oauth`;
  const V = "v21.0";

  try {
    // 1) code → token utilisateur court
    const r1 = await (await fetch(`https://graph.facebook.com/${V}/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${encodeURIComponent(code)}`)).json();
    if (!r1.access_token) return back(`meta_error=${encodeURIComponent(r1.error?.message || "exchange")}`);

    // 2) court → long-lived
    const r2 = await (await fetch(`https://graph.facebook.com/${V}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${r1.access_token}`)).json();
    const longToken = r2.access_token || r1.access_token;

    // 3) pages de l'utilisateur (+ compte IG business rattaché)
    const r3 = await (await fetch(`https://graph.facebook.com/${V}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${longToken}`)).json();
    const pages = r3.data || [];
    const page = pages.find((p: { instagram_business_account?: unknown }) => p.instagram_business_account) || pages[0];
    if (!page) return back("meta_error=nopage");

    await svc.from("social_integrations").upsert({
      id: 1,
      provider: "meta",
      page_id: page.id,
      page_name: page.name,
      page_access_token: page.access_token,
      ig_user_id: page.instagram_business_account?.id ?? null,
      ig_username: page.instagram_business_account?.username ?? null,
      connected_at: new Date().toISOString(),
    });

    return back("connected=1");
  } catch (e) {
    return back(`meta_error=${encodeURIComponent(e instanceof Error ? e.message : "err")}`);
  }
});
