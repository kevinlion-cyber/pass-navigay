import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, getAuthenticatedUser, jsonResponse, serviceClient } from "../_shared/auth.ts";

// Module 3 : validation d'une revendication (admin only), atomique côté serveur :
//   1) attribue la fiche au demandeur (owner_id) + le passe en compte "pro"
//   2) marque la revendication "approved"
//   3) envoie au propriétaire l'email « votre page est validée » (Resend)
// L'email est best-effort : si l'envoi échoue, la validation reste acquise.
const SITE = Deno.env.get("PUBLIC_SITE_URL") || "https://passnavigay.com";

function approvedHtml(estName: string, dashUrl: string): string {
  return `<div style="background:#f4f4f7;padding:32px 12px;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #ececf1;">
    <div style="background:#7B2D8B;padding:26px 32px;text-align:center;"><div style="font-size:21px;font-weight:700;color:#fff;">Pass&nbsp;Navigay</div><div style="font-size:12px;color:#e9d4f0;margin-top:3px;">L'annuaire des lieux LGBT-friendly</div></div>
    <div style="padding:32px;color:#1a1a2e;font-size:15px;line-height:1.6;">
      <p>Bonjour,</p>
      <p>Bonne nouvelle&nbsp;: votre revendication pour <strong>${estName}</strong> a été <strong>validée</strong>. La fiche est désormais rattachée à votre compte.</p>
      <p>Vous pouvez maintenant gérer votre page depuis votre espace&nbsp;: compléter vos infos, publier des événements et des promotions, répondre aux avis et gagner en visibilité auprès de notre communauté.</p>
      <div style="text-align:center;margin:26px 0;"><a href="${dashUrl}" style="display:inline-block;background:#7B2D8B;color:#fff;text-decoration:none;padding:13px 30px;border-radius:10px;font-weight:600;">Gérer ma page</a></div>
      <p style="font-size:12px;color:#9090a0;">Si le bouton ne fonctionne pas : <a href="${dashUrl}" style="color:#7B2D8B;word-break:break-all;">${dashUrl}</a></p>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #f0f0f4;color:#9090a0;font-size:12px;text-align:center;">Vous recevez cet e-mail suite à votre demande de revendication sur Pass Navigay.</div>
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

    const { claimId } = await req.json().catch(() => ({}));
    if (!claimId) return jsonResponse({ error: "claimId requis" }, 400);

    const { data: claim, error: cErr } = await svc.from("establishment_claims")
      .select("id,establishment_id,claimant_profile_id,email,status").eq("id", claimId).maybeSingle();
    if (cErr || !claim) return jsonResponse({ error: "Revendication introuvable" }, 404);

    // 1) Attribution de la fiche + passage en pro.
    const { error: e1 } = await svc.from("establishments").update({ owner_id: claim.claimant_profile_id }).eq("id", claim.establishment_id);
    if (e1) return jsonResponse({ error: e1.message }, 500);
    if (claim.claimant_profile_id) await svc.from("profiles").update({ account_type: "pro" }).eq("id", claim.claimant_profile_id);

    // 2) Marquer la revendication validée.
    const { error: e2 } = await svc.from("establishment_claims")
      .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: user.id }).eq("id", claim.id);
    if (e2) return jsonResponse({ error: e2.message }, 500);

    // 3) Email de notification (best-effort).
    let emailed = false;
    let emailError: string | null = null;
    try {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (resendKey) {
        const { data: est } = await svc.from("establishments").select("name").eq("id", claim.establishment_id).maybeSingle();
        let to = claim.email as string | null;
        if (claim.claimant_profile_id) {
          const { data: prof } = await svc.from("profiles").select("email").eq("id", claim.claimant_profile_id).maybeSingle();
          if (prof?.email) to = prof.email;
        }
        if (to) {
          const estName = est?.name || "votre établissement";
          const r = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "Pass Navigay <bonjour@passnavigay.com>",
              to,
              subject: `${estName} — votre page est validée ✅`,
              html: approvedHtml(estName, `${SITE}/pros/tableau-de-bord`),
            }),
          });
          if (r.ok) emailed = true;
          else emailError = (await r.text()).slice(0, 120);
        } else emailError = "aucun email destinataire";
      } else emailError = "RESEND_API_KEY manquante";
    } catch (err) { emailError = err instanceof Error ? err.message : "err"; }

    return jsonResponse({ ok: true, emailed, emailError });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Erreur" }, 500);
  }
});
