import Stripe from "npm:stripe@14.14.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PRODUCT_NAME = "PassNaviGay Pro";
const PRODUCT_METADATA_KEY = "passnavigay_pro";
const YEARLY_AMOUNT = 69000; // 690€ in cents
const MONTHLY_AMOUNT = 6900; // 69€ in cents

async function getOrCreateProProduct(stripe: Stripe) {
  // Search for existing product by metadata
  const products = await stripe.products.list({ active: true, limit: 100 });
  let product = products.data.find(
    (p) => p.metadata?.app_product === PRODUCT_METADATA_KEY
  );

  if (!product) {
    product = await stripe.products.create({
      name: PRODUCT_NAME,
      metadata: { app_product: PRODUCT_METADATA_KEY },
    });
  }

  return product;
}

async function getOrCreatePrice(
  stripe: Stripe,
  productId: string,
  interval: "month" | "year",
  unitAmount: number
) {
  const prices = await stripe.prices.list({
    product: productId,
    active: true,
    type: "recurring",
  });

  let price = prices.data.find(
    (p) => p.recurring?.interval === interval && p.unit_amount === unitAmount
  );

  if (!price) {
    price = await stripe.prices.create({
      product: productId,
      currency: "eur",
      unit_amount: unitAmount,
      recurring: { interval },
    });
  }

  return price;
}

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

    // Get or create the Pro product in Stripe
    const product = await getOrCreateProProduct(stripe);

    // Get or create the appropriate price
    const interval = billingInterval === "monthly" ? "month" : "year";
    const amount = billingInterval === "monthly" ? MONTHLY_AMOUNT : YEARLY_AMOUNT;
    const price = await getOrCreatePrice(stripe, product.id, interval, amount);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [{ price: price.id, quantity: 1 }],
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
