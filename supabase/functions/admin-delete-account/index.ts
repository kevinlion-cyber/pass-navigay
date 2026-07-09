import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, getAuthenticatedUser, jsonResponse, serviceClient } from "../_shared/auth.ts";

// Suppression complète d'un compte (admin uniquement) : supprime l'utilisateur
// d'authentification, ce qui cascade sur le profil et tout ce qui lui est rattaché
// (établissements, avis, favoris, messages, usages de promo).
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return jsonResponse({ error: "Non authentifié" }, 401);

    const svc = serviceClient();

    // Vérifie que l'appelant est admin (côté serveur, jamais côté client).
    const { data: me } = await svc.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
    if (!me?.is_admin) return jsonResponse({ error: "Accès refusé" }, 403);

    const { userId } = await req.json().catch(() => ({}));
    if (!userId || typeof userId !== "string") {
      return jsonResponse({ error: "userId requis" }, 400);
    }
    if (userId === user.id) {
      return jsonResponse({ error: "Vous ne pouvez pas supprimer votre propre compte." }, 400);
    }

    const { error } = await svc.auth.admin.deleteUser(userId);
    if (error) return jsonResponse({ error: error.message }, 500);

    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Erreur" }, 500);
  }
});
