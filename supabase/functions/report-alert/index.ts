import { createClient } from "npm:@supabase/supabase-js@2.57.4";

// Alerte email à l'équipe quand un membre en signale un autre (E4, 24/11/2026).
// Appelée par le navigateur du signaleur juste après report_member().
// Garde-fous : seul l'auteur du signalement peut déclencher l'alerte, une seule
// fois par signalement ; l'email ne contient ni message ni donnée sensible, juste
// le motif et un lien vers l'admin.
// Secret requis : ADMIN_ALERT_EMAIL (adresse qui reçoit les alertes) + RESEND_API_KEY.
// Fichier autonome : peut être déployé depuis l'éditeur du tableau de bord Supabase.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const REASONS: Record<string, string> = {
  harcelement: "Harcèlement ou intimidation",
  contenu_sexuel: "Contenu sexuel non sollicité",
  faux_profil: "Faux profil ou arnaque",
  haine: "Propos haineux ou discriminatoires",
  mineur: "Personne possiblement mineure",
  autre: "Autre",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Non authentifié" }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: auth } = await userClient.auth.getUser();
    if (!auth?.user) return json({ error: "Non authentifié" }, 401);

    const { reportId } = await req.json().catch(() => ({}));
    if (typeof reportId !== "string") return json({ error: "reportId requis" }, 400);

    const svc = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: report } = await svc
      .from("user_reports")
      .select("id, reporter_id, reason, context, alerted_at, created_at")
      .eq("id", reportId)
      .maybeSingle();
    if (!report || report.reporter_id !== auth.user.id) return json({ error: "Signalement introuvable" }, 404);
    if (report.alerted_at) return json({ success: true, skipped: "already_alerted" });

    const to = Deno.env.get("ADMIN_ALERT_EMAIL");
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!to || !resendKey) {
      console.error("report-alert: ADMIN_ALERT_EMAIL ou RESEND_API_KEY manquant");
      return json({ success: true, skipped: "not_configured" });
    }

    // Marqué avant l'envoi : deux appels simultanés ne partent pas deux fois.
    await svc.from("user_reports").update({ alerted_at: new Date().toISOString() }).eq("id", report.id);

    const site = Deno.env.get("PUBLIC_SITE_URL") || "https://passnavigay.com";
    const reason = REASONS[report.reason] ?? report.reason;
    const where = report.context === "conversation" ? "depuis une conversation" : "depuis un profil";
    const urgent = report.reason === "mineur" || report.reason === "harcelement";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: "Pass Navigay <bonjour@passnavigay.com>",
        to: [to],
        subject: `${urgent ? "[URGENT] " : ""}Nouveau signalement : ${reason}`,
        html: `<p>Un membre vient d'en signaler un autre ${where}.</p>
<p><strong>Motif :</strong> ${reason}</p>
<p><a href="${site}/admin/signalements">Ouvrir les signalements dans l'administration</a></p>
<p style="color:#888;font-size:12px">Par discrétion, cet email ne contient ni nom ni message.</p>`,
      }),
    });
    if (!res.ok) {
      console.error("report-alert: Resend", res.status);
      return json({ error: "Envoi impossible" }, 502);
    }
    return json({ success: true });
  } catch (err) {
    console.error("report-alert:", err);
    return json({ error: "Erreur" }, 500);
  }
});
