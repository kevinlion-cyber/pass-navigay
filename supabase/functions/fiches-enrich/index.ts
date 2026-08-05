import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, getAuthenticatedUser, jsonResponse, serviceClient } from "../_shared/auth.ts";
import { writeDraft } from "../_shared/fiches.ts";

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

    // Ville de rattachement (tag), indépendante de l'adresse du lieu : un sauna à
    // Lattes balayé pour Montpellier est un lieu DE Montpellier. C'est ce tag qui
    // pilote l'annuaire et les pages /annuaire/:ville, pas la commune postale.
    const citySlug = String(body.city_slug || "").trim() || null;

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
        // Même code que le traitement en tâche de fond (`city-worker`) : une
        // seule façon d'écrire une fiche, donc jamais deux qualités différentes.
        const r = await writeDraft(svc, { placesKey, anthropicKey, model }, it, {
          photos,
          citySlug,
          deepReviews: Array.isArray(it.dfs_reviews) ? it.dfs_reviews : null,
        });
        inTok += r.tokensIn;
        outTok += r.tokensOut;
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
