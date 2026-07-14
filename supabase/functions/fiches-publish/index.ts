import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, getAuthenticatedUser, jsonResponse, serviceClient } from "../_shared/auth.ts";
import { getPhotoNames, fetchPhotoMedia, PN_CATEGORIES } from "../_shared/fiches.ts";

// Publication d'un brouillon (admin only) : crée l'établissement public à partir du
// brouillon ET stocke les photos Google dans Supabase Storage (comme toutmontpellier),
// pour que la fiche ne soit jamais vide. La 1re photo = bannière, les suivantes = galerie.
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return jsonResponse({ error: "Non authentifié" }, 401);
    const svc = serviceClient();
    const { data: me } = await svc.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
    if (!me?.is_admin) return jsonResponse({ error: "Accès refusé" }, 403);

    const { draftId } = await req.json().catch(() => ({}));
    if (!draftId) return jsonResponse({ error: "draftId requis" }, 400);

    const { data: d, error: dErr } = await svc.from("establishment_drafts").select("*").eq("id", draftId).maybeSingle();
    if (dErr || !d) return jsonResponse({ error: "Brouillon introuvable" }, 404);
    if (d.status === "approved" && d.published_establishment_id) {
      return jsonResponse({ establishment_id: d.published_establishment_id, already: true });
    }

    const subcategory = d.ai_subcategory || PN_CATEGORIES[d.category]?.subcategories?.[0] || "";

    // 1) Créer l'établissement (gratuit par défaut).
    const { data: est, error: eErr } = await svc.from("establishments").insert({
      name: d.name,
      description: d.ai_description || "",
      phone: d.phone || "",
      website: d.website || "",
      address: d.address || "",
      city: d.city || "",
      postal_code: d.postal_code || "",
      category: d.category,
      subcategory,
      latitude: d.latitude ?? 0,
      longitude: d.longitude ?? 0,
      place_id: d.place_id,
    }).select("id").single();
    if (eErr) return jsonResponse({ error: eErr.message }, 500);
    const estId = est.id;

    // 2) Stocker les photos Google dans Storage.
    let bannerUrl: string | null = null;
    let stored = 0;
    const placesKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
    if (placesKey) {
      try {
        const names = await getPhotoNames(placesKey, d.place_id, 5);
        for (let i = 0; i < names.length; i++) {
          const bytes = await fetchPhotoMedia(placesKey, names[i], i === 0 ? 1400 : 900);
          if (!bytes) continue;
          if (i === 0) {
            const path = `${estId}/banner.jpg`;
            const up = await svc.storage.from("establishment-banners").upload(path, bytes, { contentType: "image/jpeg", upsert: true });
            if (!up.error) bannerUrl = svc.storage.from("establishment-banners").getPublicUrl(path).data.publicUrl;
          } else {
            const path = `${estId}/${i}.jpg`;
            const up = await svc.storage.from("establishment-photos").upload(path, bytes, { contentType: "image/jpeg", upsert: true });
            if (!up.error) {
              const url = svc.storage.from("establishment-photos").getPublicUrl(path).data.publicUrl;
              await svc.from("establishment_photos").insert({ establishment_id: estId, url, order_index: i - 1 });
            }
          }
          stored++;
        }
        if (bannerUrl) await svc.from("establishments").update({ banner_url: bannerUrl }).eq("id", estId);
      } catch (_e) { /* photos best-effort : la fiche existe déjà */ }
    }

    // 3) Marquer le brouillon publié.
    await svc.from("establishment_drafts").update({ status: "approved", published_establishment_id: estId }).eq("id", draftId);

    return jsonResponse({ establishment_id: estId, photos_stored: stored, banner: !!bannerUrl });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Erreur" }, 500);
  }
});
