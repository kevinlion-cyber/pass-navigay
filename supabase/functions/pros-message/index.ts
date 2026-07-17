import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, getAuthenticatedUser, jsonResponse, serviceClient } from "../_shared/auth.ts";

// Demande Kevin : envoyer un message (e-mail) aux établissements QUI ONT UN COMPTE
// (owner_id renseigné). Modes :
//   - count : combien de destinataires pour la cible choisie (aperçu avant envoi)
//   - send  : envoi réel
// Cibles : all (tous les inscrits) | pro (Pro uniquement) | free (gratuits uniquement)
const SITE = Deno.env.get("PUBLIC_SITE_URL") || "https://passnavigay.com";

function html(estName: string, body: string): string {
  const paragraphs = body.split(/\n{2,}|\n/).map((p) => p.trim()).filter(Boolean)
    .map((p) => `<p style="margin:0 0 14px">${p.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>`).join("");
  return `<div style="background:#f4f4f7;padding:32px 12px;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #ececf1;">
    <div style="background:#7B2D8B;padding:26px 32px;text-align:center;"><div style="font-size:21px;font-weight:700;color:#fff;">Pass&nbsp;Navigay</div><div style="font-size:12px;color:#e9d4f0;margin-top:3px;">L'annuaire des lieux LGBT-friendly</div></div>
    <div style="padding:32px;color:#1a1a2e;font-size:15px;line-height:1.6;">
      <p style="margin:0 0 14px">Bonjour <strong>${estName}</strong>,</p>
      ${paragraphs}
      <div style="text-align:center;margin:26px 0;"><a href="${SITE}/pros/tableau-de-bord" style="display:inline-block;background:#7B2D8B;color:#fff;text-decoration:none;padding:13px 30px;border-radius:10px;font-weight:600;">Accéder à mon espace</a></div>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #f0f0f4;color:#9090a0;font-size:12px;text-align:center;">Vous recevez cet e-mail en tant que professionnel inscrit sur Pass Navigay.</div>
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

    const { mode, target = "all", subject, message } = await req.json().catch(() => ({}));

    // Établissements INSCRITS = ceux qui ont un compte propriétaire.
    let q = svc.from("establishments").select("id,name,contact_email,is_pro,owner_id").not("owner_id", "is", null);
    if (target === "pro") q = q.eq("is_pro", true);
    if (target === "free") q = q.eq("is_pro", false);
    const { data: ests } = await q.limit(2000);
    const rows = ests || [];

    // E-mail du compte propriétaire (sinon e-mail de contact de la fiche).
    const ownerIds = [...new Set(rows.map((e) => e.owner_id).filter(Boolean))] as string[];
    const emailByOwner: Record<string, string> = {};
    if (ownerIds.length) {
      const { data: profs } = await svc.from("profiles").select("id,email").in("id", ownerIds);
      (profs || []).forEach((p: any) => { if (p.email) emailByOwner[p.id] = p.email; });
    }
    const targets = rows
      .map((e) => ({ name: e.name as string, email: (e.owner_id && emailByOwner[e.owner_id]) || e.contact_email || null }))
      .filter((t) => !!t.email) as { name: string; email: string }[];

    if (mode === "count") return jsonResponse({ recipients: targets.length, establishments: rows.length });

    if (!subject || !message) return jsonResponse({ error: "Objet et message requis" }, 400);
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) return jsonResponse({ error: "RESEND_API_KEY manquante" }, 500);

    let sent = 0;
    const errors: string[] = [];
    for (const t of targets) {
      try {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: "Pass Navigay <bonjour@passnavigay.com>", to: t.email, subject, html: html(t.name, message) }),
        });
        if (r.ok) sent++; else errors.push(`${t.name}: ${(await r.text()).slice(0, 80)}`);
      } catch (err) { errors.push(`${t.name}: ${err instanceof Error ? err.message : "err"}`); }
    }
    return jsonResponse({ recipients: targets.length, sent, errors: errors.slice(0, 5) });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Erreur" }, 500);
  }
});
