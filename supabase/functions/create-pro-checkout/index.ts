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

    const { establishmentId, billingInterval } = await req.json().catch(() => ({}));
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

    let priceId = PRO_YEARLY_PRICE_ID;

    if (billingInterval === "monthly") {
      const products = await stripe.products.search({
        query: "name:'Pass Pro Mensuel'",
      });

      let monthlyProductId: string;

      if (products.data.length > 0 && products.data[0].active) {
        monthlyProductId = products.data[0].id;
      } else {
        const newProduct = await stripe.products.create({
          name: "Pass Pro Mensuel",
        });
        monthlyProductId = newProduct.id;
      }

      const existingPrices = await stripe.prices.list({
        product: monthlyProductId,
        active: true,
        type: "recurring",
      });

      const monthlyPrice = existingPrices.data.find(
        (p) => p.recurring?.interval === "month" && p.unit_amount === MONTHLY_AMOUNT
      );

      if (monthlyPrice) {
        priceId = monthlyPrice.id;
      } else {
        const newPrice = await stripe.prices.create({
          product: monthlyProductId,
          currency: "eur",
          unit_amount: MONTHLY_AMOUNT,
          recurring: { interval: "month" },
        });
        priceId = newPrice.id;
      }
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
    });

    return jsonResponse({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("create-pro-checkout error:", message);
    return jsonResponse({ error: "Le paiement n'a pas pu être préparé. Réessayez dans quelques instants." }, 500);
  }
});
