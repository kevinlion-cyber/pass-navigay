import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, getAuthenticatedUser, jsonResponse, serviceClient } from "../_shared/auth.ts";
import { placeDetails, enrichWithClaude, validSubcat, getPhotoNames, fetchPhotoMedia } from "../_shared/fiches.ts";

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

    // Sonde : permet à l'admin de savoir À QUI appartient la clé Claude
    // configurée, AVANT de lancer quoi que ce soit. Ne consomme rien.
    if (body.probe) {
      return jsonResponse({ owner, cap: flpowerCap, bulkAllowed: owner === "kevin" });
    }

    const items: any[] = Array.isArray(body.items) ? body.items : [];
    if (!items.length) return jsonResponse({ error: "Aucun lieu sélectionné" }, 400);

    // ⛔ GARDE-FOU RENFORCÉ : le traitement de masse (création d'une ville entière)
    //    est INTERDIT tant que la clé Claude configurée n'est pas celle de Kevin.
    //    Sans ça, une boucle côté interface contournerait le plafond par appel et
    //    ferait payer des centaines de fiches au propriétaire de la clé de dev.
    if (body.bulk && owner !== "kevin") {
      return jsonResponse({
        error:
          "Traitement de masse bloqué : la clé Claude configurée n'appartient pas à Kevin " +
          `(ANTHROPIC_KEY_OWNER = "${owner}"). Renseignez la clé Anthropic de Kevin et passez ` +
          'ANTHROPIC_KEY_OWNER à "kevin" avant de créer une ville.',
        owner,
        bulkAllowed: false,
      }, 403);
    }

    // Nombre de photos à télécharger par fiche (0 à 5). Chaque photo = un appel
    // Google facturé, c'est le principal levier de coût d'une ville.
    const photos = Math.max(0, Math.min(Number(body.photos ?? 5), 5));

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
        // Si l'appelant a déjà récupéré des avis en profondeur (DataForSEO), on les
        // utilise : la fiche est bien plus juste qu'avec les 5 avis de Google.
        const deep: any[] = Array.isArray(it.dfs_reviews) ? it.dfs_reviews : [];
        const reviewData = deep.length
          ? { provider: "dataforseo", confidence: "high", editorial_summary: det.editorial_summary, reviews: deep }
          : { provider: "google5", confidence: "low", editorial_summary: det.editorial_summary, reviews: det.reviews };
        const { parsed, usage } = await enrichWithClaude(anthropicKey, model, it, reviewData);
        inTok += usage?.input_tokens || 0;
        outTok += usage?.output_tokens || 0;
        const subcategory = validSubcat(it.category, parsed.subcategory);

        // Photos : téléchargées UNE fois et stockées en Storage (réutilisées vignette/aperçu/publication).
        const photoUrls: string[] = [];
        try {
          const names = photos > 0 ? await getPhotoNames(placesKey, it.place_id, photos) : [];
          for (let i = 0; i < names.length; i++) {
            const bytes = await fetchPhotoMedia(placesKey, names[i], i === 0 ? 1400 : 900);
            if (!bytes) continue;
            const path = `${it.place_id}/${i}.jpg`;
            const up = await svc.storage.from("place-photos").upload(path, bytes, { contentType: "image/jpeg", upsert: true });
            if (!up.error) photoUrls.push(svc.storage.from("place-photos").getPublicUrl(path).data.publicUrl);
          }
        } catch { /* photos best-effort */ }

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
          raw: { editorial_summary: det.editorial_summary, reviews_provider: reviewData.provider, reviews_count: reviewData.reviews?.length || 0 },
          google_reviews: reviewData.reviews || [],   // on CONSERVE les avis (ce que les gens pensent du lieu)
          category: it.category,
          discovery_query: it.discovery_query || "",
          ai_description: parsed.description || "",
          ai_subcategory: subcategory,
          ai_tags: parsed.tags || [],
          thumb_url: photoUrls[0] ?? null,
          photo_urls: photoUrls,
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
