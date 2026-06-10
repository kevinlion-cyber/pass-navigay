import Stripe from "npm:stripe@14.14.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!stripeKey || !webhookSecret) {
    return new Response(
      JSON.stringify({ error: "Stripe not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return new Response(
      JSON.stringify({ error: "No signature" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Signature verification failed";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const establishmentId = session.metadata?.establishmentId;
      const subscriptionId = session.subscription as string;
      const customerId = session.customer as string;

      if (establishmentId) {
        const expiresAt = new Date();
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
        await supabase
          .from("establishments")
          .update({
            is_pro: true,
            pro_expires_at: expiresAt.toISOString(),
            stripe_subscription_id: subscriptionId,
            stripe_customer_id: customerId,
          })
          .eq("id", establishmentId);
      } else if (userId) {
        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + 1);
        await supabase
          .from("profiles")
          .update({
            is_premium: true,
            premium_expires_at: expiresAt.toISOString(),
            stripe_customer_id: customerId,
          })
          .eq("id", userId);
      }
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoice.subscription as string;

      if (subscriptionId) {
        const { data: est } = await supabase
          .from("establishments")
          .select("id")
          .eq("stripe_subscription_id", subscriptionId)
          .maybeSingle();

        if (est) {
          const expiresAt = new Date();
          expiresAt.setFullYear(expiresAt.getFullYear() + 1);
          await supabase
            .from("establishments")
            .update({ is_pro: true, pro_expires_at: expiresAt.toISOString() })
            .eq("id", est.id);
        } else {
          const { data: profile } = await supabase
            .from("profiles")
            .select("id")
            .eq("stripe_customer_id", invoice.customer as string)
            .maybeSingle();

          if (profile) {
            const expiresAt = new Date();
            expiresAt.setMonth(expiresAt.getMonth() + 1);
            await supabase
              .from("profiles")
              .update({ is_premium: true, premium_expires_at: expiresAt.toISOString() })
              .eq("id", profile.id);
          }
        }
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const subId = subscription.id;
      const customerId = subscription.customer as string;

      const { data: est } = await supabase
        .from("establishments")
        .select("id")
        .eq("stripe_subscription_id", subId)
        .maybeSingle();

      if (est) {
        await supabase
          .from("establishments")
          .update({ is_pro: false, pro_expires_at: null, stripe_subscription_id: null })
          .eq("id", est.id);
      } else {
        await supabase
          .from("profiles")
          .update({ is_premium: false, premium_expires_at: null })
          .eq("stripe_customer_id", customerId);
      }
      break;
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
