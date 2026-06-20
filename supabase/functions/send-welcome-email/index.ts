import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Jamais de clé en dur : la fonction échoue proprement si l'env n'est pas configuré.
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      return new Response(
        JSON.stringify({ error: "Email service is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, username, type } = await req.json().catch(() => ({}));

    // Validation basique de l'email (anti-abus de relais).
    const emailOk = typeof email === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
    if (!emailOk) {
      return new Response(
        JSON.stringify({ error: "Valid email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isPro = type === "pro";
    const rawName = (typeof username === "string" && username.trim()) || email.split("@")[0];
    const displayName = escapeHtml(rawName).slice(0, 80);

    const subject = isPro
      ? `Bienvenue sur Pass Navigay, ${displayName} ! Votre espace partenaire est pret`
      : `Bienvenue sur Pass Navigay, ${displayName} !`;

    const htmlBody = isPro
      ? buildProEmailHtml(displayName)
      : buildUserEmailHtml(displayName);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: "Pass Navigay <onboarding@resend.dev>",
        to: [email],
        subject,
        html: htmlBody,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: data.message || "Failed to send email" }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildUserEmailHtml(name: string): string {
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background:#0f0f17;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:#ffffff;font-size:24px;margin:0;">
        Pass <span style="color:#7B2D8B;">Navigay</span>
      </h1>
    </div>
    <div style="background:#16161f;border:1px solid #2a2a35;border-radius:14px;padding:32px 24px;">
      <h2 style="color:#ffffff;font-size:20px;margin:0 0 16px 0;">
        Bienvenue ${name} !
      </h2>
      <p style="color:#a0a0b0;font-size:15px;line-height:1.6;margin:0 0 16px 0;">
        Ton compte Pass Navigay est maintenant actif. Tu fais desormais partie d'une communaute bienveillante et inclusive.
      </p>
      <p style="color:#a0a0b0;font-size:15px;line-height:1.6;margin:0 0 24px 0;">
        Voici ce que tu peux faire des maintenant :
      </p>
      <ul style="color:#a0a0b0;font-size:14px;line-height:1.8;margin:0 0 24px 0;padding-left:20px;">
        <li>Decouvrir les etablissements friendly pres de chez toi</li>
        <li>Sauvegarder tes lieux favoris</li>
        <li>Profiter des promotions exclusives</li>
        <li>Participer aux evenements de la communaute</li>
        <li>Echanger avec les autres membres</li>
      </ul>
      <div style="text-align:center;margin-top:24px;">
        <a href="https://passnavigay.com/explore" style="display:inline-block;background:#7B2D8B;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:10px;font-size:14px;font-weight:600;">
          Explorer les lieux
        </a>
      </div>
    </div>
    <p style="color:#505060;font-size:12px;text-align:center;margin-top:24px;">
      Pass Navigay - L'annuaire LGBTQ+ friendly
    </p>
  </div>
</body>
</html>`;
}

function buildProEmailHtml(name: string): string {
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background:#0f0f17;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:#ffffff;font-size:24px;margin:0;">
        Pass <span style="color:#7B2D8B;">Navigay</span>
      </h1>
      <p style="color:#7B2D8B;font-size:13px;margin:8px 0 0 0;font-weight:500;">Espace Partenaire</p>
    </div>
    <div style="background:#16161f;border:1px solid #2a2a35;border-radius:14px;padding:32px 24px;">
      <h2 style="color:#ffffff;font-size:20px;margin:0 0 16px 0;">
        Bienvenue ${name} !
      </h2>
      <p style="color:#a0a0b0;font-size:15px;line-height:1.6;margin:0 0 16px 0;">
        Votre etablissement a ete enregistre avec succes sur Pass Navigay. Nous sommes ravis de vous compter parmi nos partenaires.
      </p>
      <p style="color:#a0a0b0;font-size:15px;line-height:1.6;margin:0 0 24px 0;">
        Voici les prochaines etapes :
      </p>
      <ul style="color:#a0a0b0;font-size:14px;line-height:1.8;margin:0 0 24px 0;padding-left:20px;">
        <li>Completez votre fiche etablissement (description, photos, horaires)</li>
        <li>Activez votre abonnement Pro pour debloquer toutes les fonctionnalites</li>
        <li>Creez vos premiers evenements et promotions</li>
        <li>Suivez vos statistiques depuis votre tableau de bord</li>
      </ul>
      <div style="text-align:center;margin-top:24px;">
        <a href="https://passnavigay.com/pros/tableau-de-bord" style="display:inline-block;background:#7B2D8B;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:10px;font-size:14px;font-weight:600;">
          Acceder a mon espace
        </a>
      </div>
    </div>
    <p style="color:#505060;font-size:12px;text-align:center;margin-top:24px;">
      Pass Navigay - L'annuaire LGBTQ+ friendly
    </p>
  </div>
</body>
</html>`;
}
