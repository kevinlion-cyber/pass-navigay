import Stripe from "npm:stripe@14.14.0";
import { corsHeaders, jsonResponse, getAuthenticatedUser, serviceClient } from "../_shared/auth.ts";

const PREMIUM_YEARLY_PRICE_ID = "price_1Th1iL18e2LOhPJqAlgcaEJ9";
const MONTHLY_AMOUNT = 669;
const YEARLY_AMOUNT = 6900;

// ----- Prix fixes (27/11/2026) -----
// Grille validée par Kévin : Premium 6,69 €/mois ou 69 €/an ; Pro 69 €/mois ou 690 €/an.
// Avant, le prix mensuel était cherché par le NOM du produit et recréé s'il n'était pas
// trouvé : un produit renommé ou un prix modifié dans Stripe pouvait créer des doublons.
// Désormais chaque prix porte une clé fixe (lookup_key) chez Stripe, et son montant est
// VÉRIFIÉ avant chaque paiement : si le prix Stripe ne correspond pas au prix affiché sur
// le site, le paiement est refusé (on ne facture jamais un autre montant que celui annoncé).
type Intervalle = "month" | "year";

async function prixVerifie(stripe: Stripe, priceId: string, montant: number, intervalle: Intervalle): Promise<string> {
  const p = await stripe.prices.retrieve(priceId);
  if (!p.active || p.currency !== "eur" || p.unit_amount !== montant || p.recurring?.interval !== intervalle) {
    console.error(`Prix Stripe incohérent ${priceId} : ${p.unit_amount} ${p.currency} / ${p.recurring?.interval} (attendu ${montant} eur / ${intervalle})`);
    throw new Error("prix_incoherent");
  }
  return p.id;
}

async function prixMensuelFixe(stripe: Stripe, lookupKey: string, ancienNomProduit: string, montant: number): Promise<string> {
  // 1. Le prix déjà repéré par sa clé fixe.
  const parCle = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  if (parCle.data[0]) return prixVerifie(stripe, parCle.data[0].id, montant, "month");

  // 2. Première fois : on reprend le prix mensuel existant (ancienne méthode) et on lui
  //    attribue la clé fixe, pour ne plus jamais avoir à le chercher par son nom.
  const produits = await stripe.products.search({ query: `name:'${ancienNomProduit}'` });
  for (const produit of produits.data.filter((x) => x.active)) {
    const prix = await stripe.prices.list({ product: produit.id, active: true, type: "recurring", limit: 100 });
    const bon = prix.data.find((x) => x.recurring?.interval === "month" && x.unit_amount === montant && x.currency === "eur");
    if (bon) {
      await stripe.prices.update(bon.id, { lookup_key: lookupKey, transfer_lookup_key: true });
      return bon.id;
    }
  }

  // 3. Aucun prix mensuel n'existe encore : création unique, avec sa clé fixe.
  const produit = produits.data.find((x) => x.active) ?? await stripe.products.create({ name: ancienNomProduit });
  const cree = await stripe.prices.create({
    product: produit.id, currency: "eur", unit_amount: montant,
    recurring: { interval: "month" }, lookup_key: lookupKey,
  });
  return cree.id;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return jsonResponse({ error: "Stripe is not configured" }, 500);
    }

    // Identité dérivée du JWT, jamais du body.
    const user = await getAuthenticatedUser(req);
    if (!user || !user.email) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Jamais deux abonnements Premium pour le même membre (27/11/2026) : si son
    // client Stripe a déjà un abonnement en cours, on refuse et l'appli propose
    // la gestion / résiliation à la place. Vérifié ici, pas seulement à l'écran.
    const { data: profil } = await serviceClient()
      .from("profiles").select("stripe_customer_id").eq("id", user.id).maybeSingle();
    if (profil?.stripe_customer_id) {
      try {
        const subs = await stripe.subscriptions.list({
          customer: profil.stripe_customer_id, status: "all", limit: 20,
        });
        const enCours = subs.data.some((s) =>
          ["active", "trialing", "past_due", "unpaid", "incomplete"].includes(s.status)
        );
        if (enCours) {
          return jsonResponse({
            error: "Tu as déjà un abonnement Premium. Tu peux le gérer ou le résilier depuis ton profil.",
            code: "deja_abonne",
          }, 409);
        }
      } catch (e) {
        // Client Stripe supprimé ou introuvable : rien à protéger, on continue.
        console.warn("Vérification abonnement existant impossible:", e instanceof Error ? e.message : e);
      }
    }

    const { billingInterval, executionImmediate } = await req.json().catch(() => ({}));

    const appUrl = Deno.env.get("APP_URL") || "https://passnavigay.com";


    let priceId: string;
    try {
      priceId = billingInterval === "monthly"
        ? await prixMensuelFixe(stripe, "pn_premium_mensuel", "Pass Premium Mensuel", MONTHLY_AMOUNT)
        : await prixVerifie(stripe, PREMIUM_YEARLY_PRICE_ID, YEARLY_AMOUNT, "year");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("prix:", msg);
      return jsonResponse({ error: "Le paiement est momentanément indisponible. Réessaie dans quelques minutes." }, 503);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/explorer?premium=success`,
      cancel_url: `${appUrl}/explorer?premium=cancelled`,
      metadata: { userId: user.id, billingInterval: billingInterval || "yearly" },
      // Preuve (27/11/2026) : le membre a demandé expressément à profiter du Premium tout
      // de suite. En cas de rétractation sous 14 jours, seule la période utilisée est due
      // (art. L221-25 Code conso). Enregistré sur l'abonnement Stripe.
      subscription_data: {
        metadata: {
          userId: user.id,
          execution_immediate_demandee: executionImmediate === true ? "oui" : "non",
          conditions_version: "2026-11-27",
          accord_le: new Date().toISOString(),
        },
      },
    });

    return jsonResponse({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
