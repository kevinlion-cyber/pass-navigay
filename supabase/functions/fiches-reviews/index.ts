import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, getAuthenticatedUser, jsonResponse, serviceClient } from "../_shared/auth.ts";
import { dfsAuth, dfsPostReviewTasks, dfsFetchReviews } from "../_shared/fiches.ts";

// Avis Google en profondeur via DataForSEO (admin only, compte de Kevin).
//
// ⚠️ L'API DataForSEO est ASYNCHRONE : impossible de tout faire en un appel.
//    (le mode "live" n'existe pas pour les avis — testé, 404). D'où deux actions :
//
//   action:"post"    → poste les tâches pour une liste de lieux. Réponse immédiate.
//   action:"collect" → relit les tâches prêtes. À rappeler jusqu'à ce que
//                      "pending" soit vide (comptez 8 à 15 min au total).
//
// Google Places ne donne que 5 avis ; ici on peut en lire des centaines, ce qui
// change nettement la qualité des descriptions générées ensuite.
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return jsonResponse({ error: "Non authentifié" }, 401);
    const svc = serviceClient();
    const { data: me } = await svc.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
    if (!me?.is_admin) return jsonResponse({ error: "Accès refusé" }, 403);

    const auth = dfsAuth();
    if (!auth) {
      return jsonResponse({ error: "Identifiants DataForSEO absents (DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD)." }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const action: string = body.action || "post";

    // ── Solde du compte : affiché dans l'admin avant de lancer une ville ──────
    if (action === "balance") {
      const r = await fetch("https://api.dataforseo.com/v3/appendix/user_data", { headers: { Authorization: auth } });
      const j = await r.json().catch(() => null);
      const money = j?.tasks?.[0]?.result?.[0]?.money;
      return jsonResponse({ balance: money?.balance ?? null, currency: "USD" });
    }

    // ── 1) On poste les tâches ───────────────────────────────────────────────
    if (action === "post") {
      const items: { place_id: string }[] = Array.isArray(body.items) ? body.items : [];
      const depth = Number(body.depth) || 100;
      if (!items.length) return jsonResponse({ error: "Aucun lieu fourni" }, 400);
      const tasks = await dfsPostReviewTasks(auth, items, depth);
      return jsonResponse({ tasks, posted: Object.keys(tasks).length, requested: items.length });
    }

    // ── 2) On relit ce qui est prêt ──────────────────────────────────────────
    if (action === "collect") {
      const tasks: Record<string, string> = body.tasks || {};
      const entries = Object.entries(tasks);
      if (!entries.length) return jsonResponse({ error: "Aucune tâche fournie" }, 400);

      const ready: Record<string, unknown[]> = {};
      const pending: string[] = [];
      // On borne le lot pour ne pas dépasser la durée max d'une Edge Function.
      for (const [placeId, taskId] of entries.slice(0, 40)) {
        const reviews = await dfsFetchReviews(auth, taskId);
        if (reviews) ready[placeId] = reviews;
        else pending.push(placeId);
      }
      const notChecked = entries.slice(40).map(([p]) => p);
      return jsonResponse({ ready, pending: [...pending, ...notChecked], readyCount: Object.keys(ready).length });
    }

    return jsonResponse({ error: "Action inconnue" }, 400);
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Erreur" }, 500);
  }
});
