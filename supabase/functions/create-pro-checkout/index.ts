import Stripe from "npm:stripe@14.14.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const YEARLY_PRICE_ID = "price_1Th1ix18e2LOhPJqyeE1nmX1";

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

    const { establishmentId, email, establishmentName, billingInterval } = await req.json();

    if (!email || !establishmentId) {
      return new Response(
        JSON.stringify({ error: "Email and establishmentId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const appUrl = Deno.env.get("APP_URL") || "https://passnavigay.com";

    let lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];

    if (billingInterval === "monthly") {
      // Retrieve the product from the yearly price to create a monthly price_data
      const yearlyPrice = await stripe.prices.retrieve(YEARLY_PRICE_ID);
      const productId = yearlyPrice.product as string;

      lineItems = [
        {
          price_data: {
            currency: "eur",
            product: productId,
            recurring: { interval: "month" },
            unit_amount: 6900, // 69€
          },
          quantity: 1,
        },
      ];
    } else {
      lineItems = [
        {
          price: YEARLY_PRICE_ID,
          quantity: 1,
        },
      ];
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: lineItems,
      success_url: `${appUrl}/partner/subscription?status=success`,
      cancel_url: `${appUrl}/partner/subscription?status=cancelled`,
      metadata: { establishmentId, billingInterval: billingInterval || "yearly" },
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
