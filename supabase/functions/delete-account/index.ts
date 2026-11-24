// Suppression de compte par le membre ou le pro lui-même (faille E3 de l'audit).
//
// Fichier autonome (aucun import de ../_shared) pour pouvoir être déployé aussi
// depuis l'éditeur du tableau de bord Supabase.
//
// Trois actions, toutes réservées à l'utilisateur connecté et à SON compte :
//   status    → abonnements Stripe en cours + établissements possédés (rien n'est modifié)
//   downgrade → « rester en gratuit » : les abonnements s'arrêtent à la fin de la
//               période payée (cancel_at_period_end). Le compte est conservé ; le
//               webhook Stripe repasse le compte en gratuit à l'échéance.
//   delete    → « tout supprimer » : abonnements arrêtés immédiatement, sans
//               remboursement ; fiches supprimées ou gardées en gratuit sans
//               propriétaire (choix du pro) ; fichiers supprimés ; compte supprimé.
//               Si Stripe échoue, RIEN n'est supprimé (le membre ne doit jamais
//               continuer à payer un compte disparu).
//
// Décisions validées par Kévin le 24/11/2026.

import Stripe from "npm:stripe@14.14.0";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

const LIVE_STATUSES = new Set(["active", "trialing", "past_due", "unpaid"]);

interface SubInfo {
  id: string;
  kind: "premium" | "pro";
  label: string;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

// Supprime tous les fichiers sous un dossier (sous-dossiers compris). Au mieux :
// une erreur de stockage ne doit pas bloquer la suppression du compte.
async function removeFolder(svc: SupabaseClient, bucket: string, prefix: string, depth = 0): Promise<void> {
  if (depth > 3) return;
  const { data, error } = await svc.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error || !data) return;
  const files: string[] = [];
  for (const item of data) {
    const path = `${prefix}/${item.name}`;
    if (item.id === null) await removeFolder(svc, bucket, path, depth + 1); // dossier
    else files.push(path);
  }
  for (let i = 0; i < files.length; i += 100) {
    await svc.storage.from(bucket).remove(files.slice(i, i + 100));
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);

  try {
    // 1. Qui appelle ? (jeton de connexion obligatoire)
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Non authentifié" }, 401);
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: auth, error: authErr } = await userClient.auth.getUser();
    if (authErr || !auth.user) return json({ error: "Non authentifié" }, 401);
    const uid = auth.user.id;

    const { action, keepEstablishments } = await req.json().catch(() => ({}));
    if (!["status", "downgrade", "delete"].includes(action)) return json({ error: "Action inconnue" }, 400);

    const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: profile } = await svc
      .from("profiles").select("id, is_admin, stripe_customer_id").eq("id", uid).maybeSingle();
    const { data: ests } = await svc
      .from("establishments").select("id, name, stripe_subscription_id").eq("owner_id", uid);
    const establishments = ests ?? [];

    // 2. Abonnements Stripe en cours (compte membre + établissements possédés)
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const needsStripe = !!profile?.stripe_customer_id || establishments.some((e) => e.stripe_subscription_id);
    if (needsStripe && !stripeKey) return json({ error: "Paiements non configurés. Contacte le support." }, 500);
    const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: "2023-10-16" }) : null;

    const subs = new Map<string, SubInfo>();
    const toInfo = (s: Stripe.Subscription, kind: "premium" | "pro", label: string): SubInfo => ({
      id: s.id,
      kind,
      label,
      periodEnd: s.current_period_end ? new Date(s.current_period_end * 1000).toISOString() : null,
      cancelAtPeriodEnd: !!s.cancel_at_period_end,
    });

    if (stripe) {
      for (const e of establishments) {
        if (!e.stripe_subscription_id) continue;
        try {
          const s = await stripe.subscriptions.retrieve(e.stripe_subscription_id);
          if (LIVE_STATUSES.has(s.status)) subs.set(s.id, toInfo(s, "pro", `Pro — ${e.name}`));
        } catch { /* abonnement introuvable chez Stripe : rien à arrêter */ }
      }
      if (profile?.stripe_customer_id) {
        const list = await stripe.subscriptions.list({ customer: profile.stripe_customer_id, status: "all", limit: 100 });
        for (const s of list.data) {
          if (LIVE_STATUSES.has(s.status) && !subs.has(s.id)) subs.set(s.id, toInfo(s, "premium", "Premium"));
        }
      }
    }
    const subList = [...subs.values()];

    // 3a. Lecture seule
    if (action === "status") {
      return json({
        isAdmin: !!profile?.is_admin,
        subscriptions: subList,
        establishments: establishments.map((e) => ({ id: e.id, name: e.name })),
      });
    }

    // 3b. Rester en gratuit à la fin de la période payée
    if (action === "downgrade") {
      if (subList.length === 0) return json({ error: "Aucun abonnement en cours." }, 400);
      for (const s of subList) {
        if (!s.cancelAtPeriodEnd) {
          await stripe!.subscriptions.update(s.id, { cancel_at_period_end: true });
          s.cancelAtPeriodEnd = true;
        }
      }
      return json({ success: true, subscriptions: subList });
    }

    // 3c. Tout supprimer
    if (profile?.is_admin) {
      return json({ error: "Un compte administrateur ne peut pas être supprimé depuis l'application." }, 400);
    }

    // Arrêt immédiat des abonnements, sans remboursement (pas de prorata).
    // En cas d'échec : on s'arrête là, rien n'a été supprimé.
    for (const s of subList) {
      try {
        await stripe!.subscriptions.cancel(s.id, { prorate: false, invoice_now: false });
      } catch (e) {
        console.error("delete-account: échec arrêt abonnement", s.id, e);
        return json({ error: "Impossible d'arrêter ton abonnement pour le moment. Rien n'a été supprimé. Réessaie plus tard ou contacte le support." }, 502);
      }
    }

    const estIds = establishments.map((e) => e.id);
    const keep = keepEstablishments === true && estIds.length > 0;

    if (keep) {
      // Fiches conservées dans l'annuaire, en gratuit et sans propriétaire
      // (revendicables plus tard). Contenus propres au pro supprimés.
      await svc.from("events").delete().in("establishment_id", estIds);
      await svc.from("promotions").delete().in("establishment_id", estIds);
      await svc.from("establishment_photos").delete().in("establishment_id", estIds);
      const { error: upErr } = await svc.from("establishments").update({
        owner_id: null,
        is_pro: false,
        pro_expires_at: null,
        pro_billing_interval: null,
        stripe_subscription_id: null,
        stripe_customer_id: null,
        is_sponsor: false,
        is_verified: false,
        logo_url: null,
        banner_url: null,
      }).in("id", estIds);
      if (upErr) {
        console.error("delete-account: échec détachement fiches", upErr);
        return json({ error: "Impossible de conserver tes fiches. Ton abonnement est arrêté mais ton compte n'a pas été supprimé : réessaie." }, 500);
      }
    }

    // Fichiers : photo de profil et galerie, visuels des établissements.
    await removeFolder(svc, "avatars", uid);
    for (const bucket of ["establishment-logos", "establishment-banners", "establishment-photos", "event-images", "promo-images"]) {
      await removeFolder(svc, bucket, uid);
      for (const id of estIds) await removeFolder(svc, bucket, id);
    }

    // Suppression du compte : le profil suit (cascade), et avec lui favoris, avis,
    // messages, utilisations de promos, notifications — et les fiches si non conservées.
    const { error: delErr } = await svc.auth.admin.deleteUser(uid);
    if (delErr) {
      console.error("delete-account: échec suppression utilisateur", delErr);
      return json({ error: "La suppression n'a pas pu aboutir. Ton abonnement est arrêté ; réessaie ou contacte le support." }, 500);
    }

    return json({ success: true });
  } catch (err) {
    console.error("delete-account:", err);
    return json({ error: "Une erreur est survenue. Réessaie plus tard." }, 500);
  }
});
