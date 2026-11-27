import Stripe from "npm:stripe@14.14.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

// Fonction autonome (27/11/2026) — « Renoncer au contrat ici » pour le Premium.
//
// Depuis le 19 juin 2026 (art. L221-21 du Code de la consommation), un abonnement
// souscrit en ligne par un particulier doit offrir une fonction de rétractation
// pendant 14 jours, avec accusé de réception sur un support durable (e-mail).
//
//   { action: "statut" }                → le membre peut-il se rétracter ? jusqu'à quand ?
//   { action: "confirmer", nom: "..." } → arrête l'abonnement chez Stripe, garde la preuve
//                                         (table retractations), envoie l'accusé au membre
//                                         et une alerte à l'équipe avec le montant à rembourser.
//
// Le remboursement n'est PAS fait automatiquement : l'équipe le fait dans Stripe. Le
// montant tient compte de la période déjà utilisée (art. L221-25), puisque le membre a
// demandé à profiter du Premium tout de suite au moment du paiement.
//
// Vérification JWT : ACTIVÉE (appelée par un membre connecté).
// Secrets utilisés : STRIPE_SECRET_KEY, RESEND_API_KEY, ADMIN_ALERT_EMAIL (déjà en place).

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

const DELAI_JOURS = 14;
const JOUR = 86400;
const STATUTS_EN_COURS = new Set(["active", "trialing", "past_due"]);

function echapper(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function euros(centimes: number): string {
  return (centimes / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function dateHeure(d: Date): string {
  return d.toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "long", timeStyle: "short" });
}

function dateSeule(d: Date): string {
  return d.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "long" });
}

function bornesPeriode(sub: Stripe.Subscription): { debut: number; fin: number } {
  const item = sub.items?.data?.[0] as unknown as { current_period_start?: number; current_period_end?: number } | undefined;
  const debut = sub.current_period_start ?? item?.current_period_start ?? sub.start_date;
  const fin = sub.current_period_end ?? item?.current_period_end ?? debut + 30 * JOUR;
  return { debut, fin };
}

async function envoyerEmail(resendKey: string, to: string, sujet: string, html: string): Promise<boolean> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({ from: "Pass Navigay <bonjour@passnavigay.com>", to: [to], subject: sujet, html }),
    });
    if (!res.ok) console.error("retractation-premium: Resend", res.status);
    return res.ok;
  } catch (e) {
    console.error("retractation-premium: Resend", e instanceof Error ? e.message : e);
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Connecte-toi pour continuer." }, 401);

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return json({ error: "Paiements non configurés." }, 500);
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json().catch(() => ({}));
    const action = body?.action === "confirmer" ? "confirmer" : "statut";

    // 1. Abonnement Premium en cours du membre, souscrit il y a moins de 14 jours.
    const { data: profil } = await db
      .from("profiles").select("stripe_customer_id, prenom, nom").eq("id", user.id).maybeSingle();
    if (!profil?.stripe_customer_id) return json({ eligible: false, raison: "aucun_abonnement" });

    const subs = await stripe.subscriptions.list({ customer: profil.stripe_customer_id, status: "all", limit: 10 });
    const sub = subs.data
      .filter((s) => STATUTS_EN_COURS.has(s.status))
      .sort((a, b) => b.start_date - a.start_date)[0];
    if (!sub) return json({ eligible: false, raison: "aucun_abonnement" });

    const maintenant = Math.floor(Date.now() / 1000);
    const limite = sub.start_date + DELAI_JOURS * JOUR;
    if (maintenant > limite) return json({ eligible: false, raison: "delai_depasse" });

    const { data: dejaFaite } = await db
      .from("retractations").select("id").eq("stripe_subscription_id", sub.id).maybeSingle();
    if (dejaFaite) return json({ eligible: false, raison: "deja_demandee" });

    if (action === "statut") {
      return json({
        eligible: true,
        reference: sub.id,
        souscrit_le: new Date(sub.start_date * 1000).toISOString(),
        jusquau: new Date(limite * 1000).toISOString(),
      });
    }

    // 2. Confirmation : contrôle de la déclaration.
    const nom = typeof body?.nom === "string" ? body.nom.trim().replace(/\s+/g, " ") : "";
    if (nom.length < 2 || nom.length > 120) return json({ error: "Indique ton prénom et ton nom." }, 400);
    const email = user.email ?? "";

    // Montants : dernier paiement de l'abonnement, moins la période déjà utilisée.
    let paye = 0;
    try {
      const factures = await stripe.invoices.list({ subscription: sub.id, limit: 1 });
      paye = factures.data[0]?.amount_paid ?? 0;
    } catch (e) {
      console.warn("retractation-premium: facture introuvable", e instanceof Error ? e.message : e);
    }
    const { debut, fin } = bornesPeriode(sub);
    const joursPeriode = Math.max(1, Math.round((fin - debut) / JOUR));
    const joursUtilises = Math.min(joursPeriode, Math.max(1, Math.ceil((maintenant - sub.start_date) / JOUR)));
    const du = Math.round((paye * joursUtilises) / joursPeriode);
    const aRembourser = Math.max(0, paye - du);
    const formule = sub.items.data[0]?.price?.recurring?.interval === "month" ? "monthly" : "yearly";

    // 3. Preuve enregistrée AVANT d'arrêter l'abonnement : la contrainte d'unicité
    //    empêche une double demande (double clic, deux onglets).
    const demandeLe = new Date();
    const { data: ligne, error: errIns } = await db.from("retractations").insert({
      user_id: user.id,
      stripe_subscription_id: sub.id,
      stripe_customer_id: profil.stripe_customer_id,
      nom,
      email,
      formule,
      souscrit_le: new Date(sub.start_date * 1000).toISOString(),
      demande_le: demandeLe.toISOString(),
      montant_paye_centimes: paye,
      montant_du_centimes: du,
      montant_a_rembourser_centimes: aRembourser,
      statut: aRembourser > 0 ? "a_rembourser" : "rien_a_rembourser",
    }).select("id").single();
    if (errIns || !ligne) {
      if (errIns?.code === "23505") return json({ eligible: false, raison: "deja_demandee" });
      console.error("retractation-premium: enregistrement", errIns?.message);
      return json({ error: "La demande n'a pas pu être enregistrée. Réessaie dans un instant." }, 500);
    }

    // 4. Arrêt immédiat de l'abonnement (le contrat prend fin avec la rétractation).
    try {
      await stripe.subscriptions.cancel(sub.id, { prorate: false, invoice_now: false });
    } catch (e) {
      console.error("retractation-premium: arrêt Stripe", e instanceof Error ? e.message : e);
      await db.from("retractations").delete().eq("id", ligne.id);
      return json({ error: "L'abonnement n'a pas pu être arrêté. Réessaie dans un instant." }, 502);
    }
    // Le webhook Stripe coupe aussi le Premium ; on le fait ici sans attendre.
    await db.from("profiles").update({ is_premium: false, premium_expires_at: null }).eq("id", user.id);

    // 5. Accusé de réception au membre + alerte à l'équipe.
    const resendKey = Deno.env.get("RESEND_API_KEY");
    let accuse = false;
    if (resendKey && email) {
      accuse = await envoyerEmail(resendKey, email, "Accusé de réception de ta rétractation — Pass Navigay", `
<p>Bonjour,</p>
<p>Nous avons bien reçu ta demande de rétractation de ton abonnement Premium. Voici ce que tu as déclaré :</p>
<ul>
  <li><strong>Nom :</strong> ${echapper(nom)}</li>
  <li><strong>Adresse e-mail :</strong> ${echapper(email)}</li>
  <li><strong>Référence de l'abonnement :</strong> ${echapper(sub.id)}</li>
  <li><strong>Souscrit le :</strong> ${dateSeule(new Date(sub.start_date * 1000))}</li>
  <li><strong>Demande envoyée le :</strong> ${dateHeure(demandeLe)} (heure de Paris)</li>
</ul>
<p>Ton abonnement est arrêté : tu ne seras plus prélevé·e.</p>
<p><strong>Remboursement :</strong> tu as payé ${euros(paye)}. Comme tu as demandé à profiter du Premium
tout de suite, la période déjà utilisée (${joursUtilises} jour${joursUtilises > 1 ? "s" : ""}, soit ${euros(du)}) reste due.
${aRembourser > 0
  ? `Nous te remboursons <strong>${euros(aRembourser)}</strong> sur ta carte, au plus tard sous 14 jours.`
  : "Il n'y a pas de montant à rembourser."}</p>
<p>Ton compte gratuit reste actif. Garde cet e-mail : il prouve la date de ta demande.</p>
<p>L'équipe Pass Navigay</p>`);
    }
    const alerte = Deno.env.get("ADMIN_ALERT_EMAIL");
    if (resendKey && alerte) {
      await envoyerEmail(resendKey, alerte, `Rétractation Premium — ${aRembourser > 0 ? `${euros(aRembourser)} à rembourser` : "rien à rembourser"}`, `
<p>Un membre vient d'utiliser « Renoncer au contrat ici ». L'abonnement est déjà arrêté.</p>
<ul>
  <li><strong>Montant payé :</strong> ${euros(paye)}</li>
  <li><strong>Période utilisée :</strong> ${joursUtilises} / ${joursPeriode} jours (${euros(du)})</li>
  <li><strong>À rembourser :</strong> ${euros(aRembourser)} — au plus tard le ${dateSeule(new Date(demandeLe.getTime() + 14 * JOUR * 1000))}</li>
</ul>
${aRembourser > 0 ? `<p>Pour rembourser : <a href="https://dashboard.stripe.com/customers/${encodeURIComponent(profil.stripe_customer_id)}">ouvrir le client dans Stripe</a>
→ dernier paiement → <em>Rembourser</em> → montant partiel ${euros(aRembourser)}.</p>
<p>Puis, dans Supabase (table <code>retractations</code>), passer le statut à <code>rembourse</code>.</p>` : ""}`);
    }
    await db.from("retractations").update({ accuse_envoye: accuse }).eq("id", ligne.id);

    return json({
      success: true,
      accuse_envoye: accuse,
      montant_a_rembourser_centimes: aRembourser,
      demande_le: demandeLe.toISOString(),
    });
  } catch (err) {
    console.error("retractation-premium:", err instanceof Error ? err.message : err);
    return json({ error: "Erreur inattendue. Réessaie dans un instant." }, 500);
  }
});
