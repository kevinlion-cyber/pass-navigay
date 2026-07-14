import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, getAuthenticatedUser, jsonResponse, serviceClient } from "../_shared/auth.ts";
import { buildQueries, searchText, passesGate, PN_CATEGORIES } from "../_shared/fiches.ts";

// Découverte de candidats (admin only). Ne stocke RIEN : renvoie une liste au front
// pour que l'admin coche ce qu'il veut. Deux modes :
//   - ville (+ catégorie option) : balaie via des requêtes LGBT-ciblées puis génériques
//   - query : recherche libre par nom/terme (mode "ajout à l'unité")
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return jsonResponse({ error: "Non authentifié" }, 401);
    const svc = serviceClient();
    const { data: me } = await svc.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
    if (!me?.is_admin) return jsonResponse({ error: "Accès refusé" }, 403);

    const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
    if (!apiKey) return jsonResponse({ error: "GOOGLE_PLACES_API_KEY manquante" }, 500);

    const body = await req.json().catch(() => ({}));
    const city: string = (body.city || "").trim();
    const query: string = (body.query || "").trim();
    const category: string | null = body.category || null;
    const lgbtOnly: boolean = !!body.lgbtOnly;
    const minRating: number = typeof body.minRating === "number" ? body.minRating : 4.0;
    const minReviews: number = typeof body.minReviews === "number" ? body.minReviews : 20;
    const maxPerQuery: number = Math.min(Number(body.max) || 60, 60);

    if (!city && !query) return jsonResponse({ error: "Indiquez une ville ou une recherche." }, 400);
    if (category && !PN_CATEGORIES[category]) return jsonResponse({ error: "Catégorie inconnue" }, 400);

    // Requêtes à exécuter selon le mode.
    const queries = query
      ? [{ category: category || "soiree", query, textQuery: city ? `${query} ${city}` : query, targeted: true }]
      : buildQueries(city, category, lgbtOnly);

    // Dédup : place_ids déjà en base (fiches + brouillons non rejetés).
    const seen = new Set<string>();
    const est = await svc.from("establishments").select("place_id");
    for (const e of est.data || []) if (e.place_id) seen.add(e.place_id);
    const dr = await svc.from("establishment_drafts").select("place_id").neq("status", "rejected");
    for (const d of dr.data || []) if (d.place_id) seen.add(d.place_id);

    const byId = new Map<string, any>();
    let found = 0, duplicates = 0, belowGate = 0;

    for (const q of queries) {
      let places: any[] = [];
      try { places = await searchText(apiKey, q.textQuery, maxPerQuery); }
      catch (_e) { continue; }
      found += places.length;
      for (const p of places) {
        if (!p.place_id || byId.has(p.place_id)) continue;
        if (seen.has(p.place_id)) { duplicates++; continue; }
        if (!passesGate(p, minRating, minReviews)) { belowGate++; continue; }
        byId.set(p.place_id, { ...p, category: q.category, discovery_query: `${q.query}${city ? " @ " + city : ""}`, targeted: q.targeted });
      }
    }

    // Tri : requêtes LGBT-ciblées d'abord, puis par nombre d'avis décroissant.
    const candidates = [...byId.values()].sort((a, b) =>
      (b.targeted ? 1 : 0) - (a.targeted ? 1 : 0) || (b.google_rating_count ?? 0) - (a.google_rating_count ?? 0)
    );

    return jsonResponse({ candidates, stats: { found, unique: candidates.length, duplicates, belowGate, minRating, minReviews } });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Erreur" }, 500);
  }
});
