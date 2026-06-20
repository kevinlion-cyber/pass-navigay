import Stripe from "npm:stripe@14.14.0";
import { corsHeaders, jsonResponse, getAuthenticatedUser, serviceClient } from "../_shared/auth.ts";

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
    if (!user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { establishmentId, returnUrl } = await req.json().catch(() => ({}));

    // Le customerId n'est JAMAIS lu du body : on le dérive de la base pour
    // l'appelant (son profil, ou un établissement dont il est propriétaire).
    const admin = serviceClient();
    let customerId: string | null = null;

    if (establishmentId) {
      const { data: est } = await admin
        .from("establishments")
        .select("owner_id, stripe_customer_id")
        .eq("id", establishmentId)
        .maybeSingle();
      if (!est || est.owner_id !== user.id) {
        return jsonResponse({ error: "Forbidden" }, 403);
      }
      customerId = est.stripe_customer_id;
    } else {
      const { data: profile } = await admin
        .from("profiles")
        .select("stripe_customer_id")
        .eq("id", user.id)
        .maybeSingle();
      customerId = profile?.stripe_customer_id ?? null;
    }

    if (!customerId) {
      return jsonResponse({ error: "Aucun abonnement Stripe trouvé" }, 404);
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const appUrl = Deno.env.get("APP_URL") || "https://passnavigay.com";

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || appUrl,
    });

    return jsonResponse({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
