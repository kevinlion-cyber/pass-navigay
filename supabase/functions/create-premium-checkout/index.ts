import Stripe from "npm:stripe@14.14.0";
import { corsHeaders, jsonResponse, getAuthenticatedUser } from "../_shared/auth.ts";

const PREMIUM_YEARLY_PRICE_ID = "price_1Th1iL18e2LOhPJqAlgcaEJ9";
const MONTHLY_AMOUNT = 669;

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

    const { billingInterval } = await req.json().catch(() => ({}));

    const appUrl = Deno.env.get("APP_URL") || "https://passnavigay.com";

    let priceId = PREMIUM_YEARLY_PRICE_ID;

    if (billingInterval === "monthly") {
      const products = await stripe.products.search({
        query: "name:'Pass Premium Mensuel'",
      });

      let monthlyProductId: string;

      if (products.data.length > 0 && products.data[0].active) {
        monthlyProductId = products.data[0].id;
      } else {
        const newProduct = await stripe.products.create({
          name: "Pass Premium Mensuel",
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
      success_url: `${appUrl}/explore?premium=success`,
      cancel_url: `${appUrl}/explore?premium=cancelled`,
      metadata: { userId: user.id, billingInterval: billingInterval || "yearly" },
    });

    return jsonResponse({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
