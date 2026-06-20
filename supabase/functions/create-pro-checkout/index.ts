import Stripe from "npm:stripe@14.14.0";
import { corsHeaders, jsonResponse, getAuthenticatedUser, serviceClient } from "../_shared/auth.ts";

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
      success_url: `${appUrl}/partner/subscription?status=success`,
      cancel_url: `${appUrl}/partner/subscription?status=cancelled`,
      metadata: { establishmentId, billingInterval: billingInterval || "yearly" },
    });

    return jsonResponse({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("create-pro-checkout error:", message);
    return jsonResponse({ error: message }, 500);
  }
});
