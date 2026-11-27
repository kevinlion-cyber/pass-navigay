import Stripe from "npm:stripe@14.14.0";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";

// Fonction autonome (27/11/2026) — comptes inactifs depuis 3 ans (RGPD, décision de Kévin).
//
// Appelée chaque nuit par pg_cron (migration 78), avec l'en-tête x-pn-cron vérifié par
// pn_verifier_secret_inactifs. Vérification JWT : DÉSACTIVÉE (pas d'utilisateur).
//   1. Prévient par e-mail les comptes sans visite depuis 3 ans moins 30 jours.
//   2. Supprime ceux prévenus il y a 30 jours au moins et toujours absents.
// Les fiches d'établissement sont gardées dans l'annuaire, sans propriétaire.
// Un compte ayant encore un abonnement Stripe actif n'est jamais supprimé.
// Un résumé est envoyé à ADMIN_ALERT_EMAIL quand il s'est passé quelque chose.
// Secrets utilisés : RESEND_API_KEY, ADMIN_ALERT_EMAIL, STRIPE_SECRET_KEY (déjà en place).

const MAX_AVIS = 50;          // par nuit
const MAX_SUPPRESSIONS = 20;  // par nuit
const SITE = "https://passnavigay.com";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function echapper(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function dateLongue(d: Date): string {
  return d.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "long" });
}

async function envoyerEmail(cle: string, to: string, sujet: string, html: string): Promise<boolean> {
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cle}` },
      body: JSON.stringify({ from: "Pass Navigay <bonjour@passnavigay.com>", to: [to], subject: sujet, html }),
    });
    if (!r.ok) console.error("comptes-inactifs: Resend", r.status);
    return r.ok;
  } catch (e) {
    console.error("comptes-inactifs: Resend", e instanceof Error ? e.message : e);
    return false;
  }
}

async function viderDossier(svc: SupabaseClient, bucket: string, prefix: string, depth = 0): Promise<void> {
  if (depth > 3) return;
  const { data, error } = await svc.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error || !data) return;
  const fichiers: string[] = [];
  for (const item of data) {
    const chemin = `${prefix}/${item.name}`;
    if (item.id === null) await viderDossier(svc, bucket, chemin, depth + 1);
    else fichiers.push(chemin);
  }
  for (let i = 0; i < fichiers.length; i += 100) await svc.storage.from(bucket).remove(fichiers.slice(i, i + 100));
}

// Même nettoyage qu'une suppression volontaire (delete-account, fiches gardées).
async function supprimerCompte(svc: SupabaseClient, stripe: Stripe | null, uid: string): Promise<"supprime" | "abonnement_actif" | "erreur"> {
  const { data: profil } = await svc.from("profiles").select("stripe_customer_id").eq("id", uid).maybeSingle();
  if (profil?.stripe_customer_id && stripe) {
    try {
      const subs = await stripe.subscriptions.list({ customer: profil.stripe_customer_id, status: "all", limit: 20 });
      if (subs.data.some((s) => ["active", "trialing", "past_due", "unpaid"].includes(s.status))) return "abonnement_actif";
    } catch (e) {
      console.error("comptes-inactifs: Stripe", uid, e instanceof Error ? e.message : e);
      return "erreur"; // dans le doute, on ne supprime pas
    }
  } else if (profil?.stripe_customer_id && !stripe) {
    return "erreur";
  }

  const { data: fiches } = await svc.from("establishments").select("id").eq("owner_id", uid);
  const ids = (fiches ?? []).map((f) => f.id as string);
  if (ids.length > 0) {
    await svc.from("events").delete().in("establishment_id", ids);
    await svc.from("promotions").delete().in("establishment_id", ids);
    await svc.from("establishment_photos").delete().in("establishment_id", ids);
    const { error } = await svc.from("establishments").update({
      owner_id: null, is_pro: false, pro_expires_at: null, pro_billing_interval: null,
      stripe_subscription_id: null, stripe_customer_id: null, is_sponsor: false, is_verified: false,
      logo_url: null, banner_url: null,
    }).in("id", ids);
    if (error) { console.error("comptes-inactifs: fiches", uid, error.message); return "erreur"; }
  }

  await viderDossier(svc, "avatars", uid);
  for (const b of ["establishment-logos", "establishment-banners", "establishment-photos", "event-images", "promo-images"]) {
    await viderDossier(svc, b, uid);
    for (const id of ids) await viderDossier(svc, b, id);
  }

  const { error } = await svc.auth.admin.deleteUser(uid);
  if (error) { console.error("comptes-inactifs: suppression", uid, error.message); return "erreur"; }
  return "supprime";
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);

  const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const secret = req.headers.get("x-pn-cron") ?? "";
  const { data: ok } = await svc.rpc("pn_verifier_secret_inactifs", { p_secret: secret });
  if (ok !== true) return json({ error: "Non autorisé" }, 401);

  const resend = Deno.env.get("RESEND_API_KEY");
  if (!resend) return json({ error: "RESEND_API_KEY manquant" }, 500);
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: "2023-10-16" }) : null;

  const bilan = { avertis: 0, supprimes: 0, gardes_abonnement: 0, erreurs: 0 };

  // 1. Avertissements.
  const { data: aAvertir, error: e1 } = await svc.rpc("pn_comptes_inactifs", { p_etape: "avertir", p_limite: MAX_AVIS });
  if (e1) { console.error("comptes-inactifs: liste avertir", e1.message); return json({ error: "liste" }, 500); }
  for (const c of (aAvertir ?? []) as { user_id: string; email: string; prenom: string | null }[]) {
    const prevue = new Date(Date.now() + 30 * 86400_000);
    const envoye = await envoyerEmail(resend, c.email, "Ton compte Pass Navigay va être supprimé", `
<p>Bonjour${c.prenom ? ` ${echapper(c.prenom)}` : ""},</p>
<p>Tu ne t'es pas connecté·e à Pass Navigay depuis presque 3 ans. Pour protéger tes données,
nous supprimons les comptes inactifs depuis 3 ans.</p>
<p><strong>Ton compte sera supprimé le ${dateLongue(prevue)}</strong>, avec ton profil, tes favoris,
tes avis et tes messages.</p>
<p>Tu veux le garder ? Il suffit de <a href="${SITE}/connexion">te connecter</a> avant cette date.
Rien d'autre à faire.</p>
<p>L'équipe Pass Navigay</p>`);
    if (!envoye) { bilan.erreurs++; continue; }
    await svc.from("inactivite_avis").upsert({ user_id: c.user_id, averti_le: new Date().toISOString(), suppression_prevue_le: prevue.toISOString() });
    bilan.avertis++;
  }

  // 2. Suppressions.
  const { data: aSupprimer, error: e2 } = await svc.rpc("pn_comptes_inactifs", { p_etape: "supprimer", p_limite: MAX_SUPPRESSIONS });
  if (e2) { console.error("comptes-inactifs: liste supprimer", e2.message); return json({ error: "liste" }, 500); }
  for (const c of (aSupprimer ?? []) as { user_id: string }[]) {
    // Une erreur sur un compte ne doit pas arrêter les autres (réessayé la nuit suivante).
    const r = await supprimerCompte(svc, stripe, c.user_id).catch((e) => {
      console.error("comptes-inactifs:", c.user_id, e instanceof Error ? e.message : e);
      return "erreur" as const;
    });
    if (r === "supprime") bilan.supprimes++;
    else if (r === "abonnement_actif") bilan.gardes_abonnement++;
    else bilan.erreurs++;
  }

  const admin = Deno.env.get("ADMIN_ALERT_EMAIL");
  if (admin && (bilan.avertis || bilan.supprimes || bilan.gardes_abonnement || bilan.erreurs)) {
    await envoyerEmail(resend, admin, "Comptes inactifs — bilan de la nuit", `
<p>Nettoyage automatique des comptes inactifs depuis 3 ans :</p>
<ul>
  <li>Membres prévenus (suppression dans 30 jours) : ${bilan.avertis}</li>
  <li>Comptes supprimés : ${bilan.supprimes}</li>
  <li>Gardés car un abonnement Stripe est encore actif : ${bilan.gardes_abonnement}</li>
  <li>Erreurs (réessayées la nuit prochaine) : ${bilan.erreurs}</li>
</ul>
<p style="color:#888;font-size:12px">Par discrétion, cet e-mail ne contient aucun nom.</p>`);
  }

  return json({ success: true, ...bilan });
});
