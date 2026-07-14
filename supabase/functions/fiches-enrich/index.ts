import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, getAuthenticatedUser, jsonResponse, serviceClient } from "../_shared/auth.ts";
import { placeDetails, enrichWithClaude, validSubcat } from "../_shared/fiches.ts";

// Enrichissement des lieux SÉLECTIONNÉS par l'admin (admin only) : pour chaque candidat
// coché → détail Google (avis) + Claude → insère un brouillon "enriched".
//
// ⛔ GARDE-FOU : sur la clé Anthropic de dev (ANTHROPIC_KEY_OWNER != "kevin"),
//    le nombre par appel est plafonné DUR → pas de traitement de masse sur la clé de Fred.
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return jsonResponse({ error: "Non authentifié" }, 401);
    const svc = serviceClient();
    const { data: me } = await svc.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
    if (!me?.is_admin) return jsonResponse({ error: "Accès refusé" }, 403);

    const placesKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!placesKey || !anthropicKey) return jsonResponse({ error: "Clés Places/Anthropic manquantes" }, 500);
    const owner = (Deno.env.get("ANTHROPIC_KEY_OWNER") || "flpower").toLowerCase();
    const model = Deno.env.get("FICHES_MODEL") || "claude-sonnet-5";
    const flpowerCap = Number(Deno.env.get("FICHES_FLPOWER_CAP") || 5);

    const body = await req.json().catch(() => ({}));
    const items: any[] = Array.isArray(body.items) ? body.items : [];
    if (!items.length) return jsonResponse({ error: "Aucun lieu sélectionné" }, 400);

    // Garde-fou clé.
    let capped = false;
    let toProcess = items;
    if (owner !== "kevin" && items.length > flpowerCap) {
      toProcess = items.slice(0, flpowerCap);
      capped = true;
    }

    const results: any[] = [];
    let inTok = 0, outTok = 0, ok = 0;

    for (const it of toProcess) {
      if (!it?.place_id || !it?.category) continue;
      try {
        const det = await placeDetails(placesKey, it.place_id);
        const reviewData = { provider: "google5", confidence: "low", editorial_summary: det.editorial_summary, reviews: det.reviews };
        const { parsed, usage } = await enrichWithClaude(anthropicKey, model, it, reviewData);
        inTok += usage?.input_tokens || 0;
        outTok += usage?.output_tokens || 0;
        const subcategory = validSubcat(it.category, parsed.subcategory);

        const { error } = await svc.from("establishment_drafts").upsert({
          place_id: it.place_id,
          name: it.name,
          address: it.address || "",
          city: it.city || "",
          postal_code: it.postal_code || "",
          latitude: it.latitude ?? null,
          longitude: it.longitude ?? null,
          phone: it.phone || "",
          website: it.website || "",
          google_rating: it.google_rating ?? null,
          google_rating_count: it.google_rating_count ?? null,
          google_primary_type: it.google_primary_type || "",
          raw: { editorial_summary: det.editorial_summary },
          category: it.category,
          discovery_query: it.discovery_query || "",
          ai_description: parsed.description || "",
          ai_subcategory: subcategory,
          ai_tags: parsed.tags || [],
          opening_hours: det.opening_hours || {},
          price_level: det.price_level,
          amenities: det.amenities || [],
          ai_model: model,
          ai_generated_at: new Date().toISOString(),
          status: "enriched",
        }, { onConflict: "place_id" });
        if (error) throw error;
        ok++;
        results.push({ place_id: it.place_id, name: it.name, ok: true });
      } catch (e) {
        results.push({ place_id: it.place_id, name: it.name, ok: false, error: e instanceof Error ? e.message : "err" });
      }
    }

    return jsonResponse({
      enriched: ok,
      requested: items.length,
      capped,
      cap: capped ? flpowerCap : null,
      owner,
      tokens: { in: inTok, out: outTok },
      results,
    });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Erreur" }, 500);
  }
});
