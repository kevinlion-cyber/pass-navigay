import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serviceClient } from "../_shared/auth.ts";

// Callback OAuth Meta (Facebook Login). Cible du redirect_uri.
// Échange le code contre un token de page long-lived + l'ID du compte Instagram Business,
// et les stocke (social_integrations). Puis renvoie l'admin vers /admin/social.
// Public (--no-verify-jwt) : c'est l'URL de redirection Facebook.
Deno.serve(async (req: Request) => {
  const site = Deno.env.get("PUBLIC_SITE_URL") || "https://passnavigay.com";
  const back = (params: string) => new Response(null, { status: 302, headers: { Location: `${site}/admin/social?${params}` } });

  const url = new URL(req.url);
  if (url.searchParams.get("error")) return back(`meta_error=${encodeURIComponent(url.searchParams.get("error_description") || "refus")}`);
  const code = url.searchParams.get("code");
  if (!code) return back("meta_error=nocode");

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

    const svc = serviceClient();
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
