import Stripe from "npm:stripe@14.14.0";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";

// Réception des événements Stripe (abonnements Premium membres et Pro établissements).
//
// Revu le 24/11/2026 (faille M4 de l'audit) :
//  - la date de fin d'accès vient de Stripe (fin de la période payée), au lieu
//    d'un calcul maison qui prolongeait un Pro mensuel d'un an et un Premium
//    annuel d'un mois ;
//  - si l'écriture en base échoue, on répond une erreur : Stripe réessaie
//    automatiquement (avant, il recevait « OK » et le client payait sans accès) ;
//  - nouvel événement géré : customer.subscription.updated (résiliation en fin
//    de période, impayé définitif, changement de formule).
//
// Événements à cocher dans Stripe : checkout.session.completed, invoice.paid,
// customer.subscription.updated, customer.subscription.deleted.
// Cette fonction doit être déployée SANS vérification JWT (Stripe n'en envoie
// pas) : la sécurité repose sur la signature Stripe, vérifiée ci-dessous.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, Stripe-Signature",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Statuts pour lesquels l'accès reste ouvert (past_due = paiement en cours de relance).
const ACCESS_STATUSES = new Set(["active", "trialing", "past_due"]);

function periodEndIso(sub: Stripe.Subscription): string {
  // Selon la version d'API Stripe, la fin de période est sur l'abonnement ou sur sa ligne.
  const end = sub.current_period_end
    ?? (sub.items?.data?.[0] as unknown as { current_period_end?: number } | undefined)?.current_period_end;
  if (!end) throw new Error(`fin de période introuvable pour ${sub.id}`);
  return new Date(end * 1000).toISOString();
}

function intervalOf(sub: Stripe.Subscription): "monthly" | "yearly" {
  return sub.items.data[0]?.price?.recurring?.interval === "month" ? "monthly" : "yearly";
}

// Lève une erreur si l'écriture échoue : la réponse sera 500 et Stripe réessaiera.
function check(label: string, error: { message: string } | null) {
  if (error) throw new Error(`${label}: ${error.message}`);
}

// Applique l'état d'un abonnement à l'établissement ou au profil concerné.
async function applySubscription(
  db: SupabaseClient,
  sub: Stripe.Subscription,
  hint: { establishmentId?: string | null; userId?: string | null } = {},
) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const active = ACCESS_STATUSES.has(sub.status);

  // 1. Établissement : par l'id fourni au paiement, sinon par l'id d'abonnement enregistré.
  let estId = hint.establishmentId ?? null;
  if (!estId) {
    const { data: est, error } = await db
      .from("establishments").select("id").eq("stripe_subscription_id", sub.id).maybeSingle();
    check("lecture établissement", error);
    estId = est?.id ?? null;
  }
  if (estId) {
    const update = active
      ? {
        is_pro: true,
        pro_expires_at: periodEndIso(sub),
        pro_billing_interval: intervalOf(sub),
        stripe_subscription_id: sub.id,
        stripe_customer_id: customerId,
      }
      : { is_pro: false, pro_expires_at: null, stripe_subscription_id: null };
    const { error } = await db.from("establishments").update(update).eq("id", estId);
    check("mise à jour établissement", error);
    return;
  }

  // 2. Membre Premium : par l'id fourni au paiement, sinon par le client Stripe enregistré.
  let query = db.from("profiles").update(
    active
      ? {
        is_premium: true,
        premium_expires_at: periodEndIso(sub),
        premium_billing_interval: intervalOf(sub),
        stripe_customer_id: customerId,
      }
      : { is_premium: false, premium_expires_at: null },
  );
  query = hint.userId ? query.eq("id", hint.userId) : query.eq("stripe_customer_id", customerId);
  const { error } = await query;
  check("mise à jour profil", error);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!stripeKey || !webhookSecret) {
    console.error("stripe-webhook: STRIPE_SECRET_KEY ou STRIPE_WEBHOOK_SECRET manquant");
    return json({ error: "Stripe not configured" }, 500);
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Signature : seule protection de cette adresse publique. Version asynchrone,
  // celle prévue par Stripe pour l'environnement Deno des fonctions Supabase.
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) return json({ error: "No signature" }, 400);

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body, sig, webhookSecret, undefined, Stripe.createSubtleCryptoProvider(),
    );
  } catch (err) {
    console.error("stripe-webhook: signature invalide", err instanceof Error ? err.message : err);
    return json({ error: "Signature verification failed" }, 400);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (!session.subscription) break;
        const sub = await stripe.subscriptions.retrieve(session.subscription as string);
        await applySubscription(db, sub, {
          establishmentId: session.metadata?.establishmentId ?? null,
          userId: session.metadata?.userId ?? null,
        });
        break;
      }

      case "invoice.paid": {
        // Renouvellement : on relit l'abonnement pour la nouvelle date de fin.
        const invoice = event.data.object as Stripe.Invoice;
        if (!invoice.subscription) break;
        const sub = await stripe.subscriptions.retrieve(invoice.subscription as string);
        await applySubscription(db, sub);
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        // On relit l'abonnement avec la version d'API de ce code (le contenu de
        // l'événement dépend de la version choisie dans Stripe pour le webhook).
        const obj = event.data.object as Stripe.Subscription;
        const sub = await stripe.subscriptions.retrieve(obj.id);
        await applySubscription(db, sub);
        break;
      }
    }
  } catch (err) {
    // Erreur → 500 : Stripe renverra l'événement plus tard (jusqu'à 3 jours).
    console.error("stripe-webhook:", event.type, event.id, err instanceof Error ? err.message : err);
    return json({ error: "Processing failed" }, 500);
  }

  return json({ received: true });
});
