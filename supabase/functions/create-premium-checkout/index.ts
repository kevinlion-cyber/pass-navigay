import Stripe from "npm:stripe@14.14.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PREMIUM_YEARLY_PRICE_ID = "price_1Th1iL18e2LOhPJqAlgcaEJ9";
const MONTHLY_AMOUNT = 790;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(
        JSON.stringify({ error: "Stripe is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    const { userId, email, billingInterval } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/explore?premium=success`,
      cancel_url: `${appUrl}/explore?premium=cancelled`,
      metadata: { userId: userId || "", billingInterval: billingInterval || "yearly" },
    });

    return new Response(JSON.stringify({ url: session.url }), {
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
