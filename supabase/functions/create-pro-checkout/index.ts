import Stripe from "npm:stripe@14.14.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PRO_YEARLY_PRICE_ID = "price_1Th1ix18e2LOhPJqyeE1nmX1";
const MONTHLY_AMOUNT = 6900; // 69€ in cents

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

    const body = await req.json();
    const { establishmentId, email, billingInterval } = body;

    if (!email || !establishmentId) {
      return new Response(
        JSON.stringify({ error: "Email and establishmentId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const appUrl = Deno.env.get("APP_URL") || "https://passnavigay.com";

    let priceId = PRO_YEARLY_PRICE_ID;

    if (billingInterval === "monthly") {
      // Get the product from the yearly price
      const yearlyPrice = await stripe.prices.retrieve(PRO_YEARLY_PRICE_ID);
      const productId = typeof yearlyPrice.product === "string"
        ? yearlyPrice.product
        : (yearlyPrice.product as Stripe.Product).id;

      // Find existing monthly price or create one
      const existingPrices = await stripe.prices.list({
        product: productId,
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
          product: productId,
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
      success_url: `${appUrl}/partner/subscription?status=success`,
      cancel_url: `${appUrl}/partner/subscription?status=cancelled`,
      metadata: { establishmentId, billingInterval: billingInterval || "yearly" },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("create-pro-checkout error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
