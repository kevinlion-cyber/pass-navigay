import Stripe from "npm:stripe@14.14.0";
import { createClient, type User } from "npm:@supabase/supabase-js@2.57.4";

// Fichier autonome (24/11/2026) : les aides de ../_shared/auth.ts sont recopiées
// ici pour pouvoir redéployer la fonction depuis le tableau de bord Supabase.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function serviceClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}
async function getAuthenticatedUser(req: Request): Promise<User | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

const PRO_YEARLY_PRICE_ID = "price_1Th1ix18e2LOhPJqyeE1nmX1";
const MONTHLY_AMOUNT = 6900;
const YEARLY_AMOUNT = 69000;

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

    const user = await getAuthenticatedUser(req);
    if (!user || !user.email) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { establishmentId, billingInterval, cgvAcceptees } = await req.json().catch(() => ({}));
    if (!establishmentId) {
      return jsonResponse({ error: "establishmentId is required" }, 400);
    }

    // L'appelant doit être propriétaire de l'établissement.
    const admin = serviceClient();
    const { data: establishment } = await admin
      .from("establishments")
      .select("id, owner_id")
      .eq("id", establishmentId)
      .maybeSingle();

    if (!establishment || establishment.owner_id !== user.id) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const appUrl = Deno.env.get("APP_URL") || "https://passnavigay.com";


    let priceId: string;
    try {
      priceId = billingInterval === "monthly"
        ? await prixMensuelFixe(stripe, "pn_pro_mensuel", "Pass Pro Mensuel", MONTHLY_AMOUNT)
        : await prixVerifie(stripe, PRO_YEARLY_PRICE_ID, YEARLY_AMOUNT, "year");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("prix:", msg);
      return jsonResponse({ error: "Le paiement est momentanément indisponible. Réessayez dans quelques minutes." }, 503);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      // /partner/subscription n'existe pas : le pro tombait sur une page vide après paiement.
      success_url: `${appUrl}/pros/abonnement?status=success`,
      cancel_url: `${appUrl}/pros/abonnement?status=cancelled`,
      metadata: { establishmentId, billingInterval: billingInterval || "yearly" },
      // Preuve (27/11/2026) : le partenaire a accepté les conditions de vente.
      subscription_data: {
        metadata: {
          establishmentId,
          cgv_acceptees: cgvAcceptees === true ? "oui" : "non",
          conditions_version: "2026-11-27",
          accord_le: new Date().toISOString(),
        },
      },
    });

    return jsonResponse({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("create-pro-checkout error:", message);
    return jsonResponse({ error: "Le paiement n'a pas pu être préparé. Réessayez dans quelques instants." }, 500);
  }
});
