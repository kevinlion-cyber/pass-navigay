import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, getAuthenticatedUser, jsonResponse, serviceClient } from "../_shared/auth.ts";

// Module 3 : relance propriétaires (admin only). Trois modes :
//   - stats    : combien d'établissements ont un site / un email / sont revendiquables
//   - discover : scrape le site web pour trouver un email de contact (batch)
//   - send      : envoie l'email d'annonce + lien « Revendique ta page » (batch, Resend)
const SITE = Deno.env.get("PUBLIC_SITE_URL") || "https://passnavigay.com";

async function findEmail(website: string): Promise<string | null> {
  const urls: string[] = [];
  try {
    const u = new URL(website.startsWith("http") ? website : `https://${website}`);
    urls.push(u.href, new URL("/contact", u).href, new URL("/contactez-nous", u).href, new URL("/mentions-legales", u).href);
  } catch { return null; }
  for (const url of urls) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { "User-Agent": "Mozilla/5.0 (compatible; PassNavigayBot/1.0)" } });
      if (!r.ok) continue;
      const html = await r.text();
      const found = [...html.matchAll(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)].map((m) => m[0].toLowerCase());
      const good = found.find((e) => e.length < 60 && !/(noreply|no-reply|example|sentry|wix\.com|wordpress|\.png|\.jpg|\.gif|@2x|domain\.|your-email|email@)/i.test(e));
      if (good) return good;
    } catch { /* url suivante */ }
  }
  return null;
}

function emailHtml(name: string, claimUrl: string): string {
  return `<div style="background:#f4f4f7;padding:32px 12px;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #ececf1;">
    <div style="background:#7B2D8B;padding:26px 32px;text-align:center;"><div style="font-size:21px;font-weight:700;color:#fff;">Pass&nbsp;Navigay</div><div style="font-size:12px;color:#e9d4f0;margin-top:3px;">L'annuaire des lieux LGBT-friendly</div></div>
    <div style="padding:32px;color:#1a1a2e;font-size:15px;line-height:1.6;">
      <p>Bonjour,</p>
      <p><strong>${name}</strong> est référencé sur Pass Navigay, l'annuaire des lieux accueillants pour la communauté LGBT.</p>
      <p>C'est votre établissement&nbsp;? Revendiquez votre page pour la gérer, compléter vos infos, répondre aux avis et gagner en visibilité auprès de notre communauté.</p>
      <div style="text-align:center;margin:26px 0;"><a href="${claimUrl}" style="display:inline-block;background:#7B2D8B;color:#fff;text-decoration:none;padding:13px 30px;border-radius:10px;font-weight:600;">Revendiquer ma page</a></div>
      <p style="font-size:12px;color:#9090a0;">Si le bouton ne fonctionne pas : <a href="${claimUrl}" style="color:#7B2D8B;word-break:break-all;">${claimUrl}</a></p>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #f0f0f4;color:#9090a0;font-size:12px;text-align:center;">Vous recevez cet e-mail car votre établissement est référencé publiquement. Pour ne plus être listé, répondez à cet e-mail.</div>
  </div>
</div>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return jsonResponse({ error: "Non authentifié" }, 401);
    const svc = serviceClient();
    const { data: me } = await svc.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
    if (!me?.is_admin) return jsonResponse({ error: "Accès refusé" }, 403);

    const { mode, limit } = await req.json().catch(() => ({}));
    const n = Math.min(Number(limit) || 20, 50);

    if (mode === "stats") {
      const all = await svc.from("establishments").select("website,contact_email,owner_id,outreach_sent_at");
      const rows = all.data || [];
      return jsonResponse({
        total: rows.length,
        with_site: rows.filter((r) => r.website).length,
        with_email: rows.filter((r) => r.contact_email).length,
        sendable: rows.filter((r) => r.contact_email && !r.owner_id && !r.outreach_sent_at).length,
        need_discovery: rows.filter((r) => r.website && !r.contact_email).length,
      });
    }

    if (mode === "discover") {
      const { data } = await svc.from("establishments").select("id,name,website").not("website", "is", null).is("contact_email", null).limit(n);
      let found = 0;
      for (const e of data || []) {
        if (!e.website) continue;
        const email = await findEmail(e.website);
        if (email) { await svc.from("establishments").update({ contact_email: email }).eq("id", e.id); found++; }
      }
      return jsonResponse({ scanned: (data || []).length, found });
    }

    if (mode === "send") {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (!resendKey) return jsonResponse({ error: "RESEND_API_KEY manquante" }, 500);
      const { data } = await svc.from("establishments")
        .select("id,name,contact_email").not("contact_email", "is", null).is("owner_id", null).is("outreach_sent_at", null).limit(n);
      let sent = 0;
      const errors: string[] = [];
      for (const e of data || []) {
        try {
          const r = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ from: "Pass Navigay <bonjour@passnavigay.com>", to: e.contact_email, subject: `${e.name} est sur Pass Navigay — revendiquez votre page`, html: emailHtml(e.name, `${SITE}/revendiquer/${e.id}`) }),
          });
          if (r.ok) { await svc.from("establishments").update({ outreach_sent_at: new Date().toISOString() }).eq("id", e.id); sent++; }
          else errors.push(`${e.name}: ${(await r.text()).slice(0, 80)}`);
        } catch (err) { errors.push(`${e.name}: ${err instanceof Error ? err.message : "err"}`); }
      }
      return jsonResponse({ candidates: (data || []).length, sent, errors: errors.slice(0, 5) });
    }

    return jsonResponse({ error: "mode requis (stats|discover|send)" }, 400);
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Erreur" }, 500);
  }
});
