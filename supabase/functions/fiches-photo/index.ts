import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Proxy photos Google Places (public, sans JWT — sert des images dans des <img>).
// Deux modes :
//   ?place_id=XXX        → JSON { photos: [resourceName, ...] } (liste des photos du lieu)
//   ?name=<resourceName> → renvoie l'image (bytes) de cette photo
// La clé Google reste côté serveur (jamais exposée au navigateur).
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, apikey, Authorization",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });

  const key = Deno.env.get("GOOGLE_PLACES_API_KEY");
  if (!key) return new Response("no key", { status: 500, headers: cors });

  const url = new URL(req.url);
  const placeId = url.searchParams.get("place_id");
  const name = url.searchParams.get("name");
  const iParam = url.searchParams.get("i");

  try {
    // Mode vignette : ?place_id=X&i=N → renvoie directement l'image de la N-ème photo.
    if (placeId && iParam !== null) {
      const idx = Math.max(0, Number(iParam) || 0);
      const maxW = Math.min(Number(url.searchParams.get("w")) || 400, 1600);
      const dr = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=fr`, { headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "photos" } });
      if (!dr.ok) return new Response("no photo", { status: 404, headers: cors });
      const names = ((await dr.json()).photos || []).map((p: { name: string }) => p.name);
      const target = names[idx];
      if (!target) return new Response("no photo", { status: 404, headers: cors });
      const g = await fetch(`https://places.googleapis.com/v1/${target}/media?maxWidthPx=${maxW}&key=${key}`);
      if (!g.ok) return new Response("photo error", { status: 502, headers: cors });
      return new Response(await g.arrayBuffer(), { status: 200, headers: { ...cors, "Content-Type": g.headers.get("Content-Type") || "image/jpeg", "Cache-Control": "public, max-age=86400" } });
    }

    // Mode liste : renvoie les noms de ressources photo du lieu.
    if (placeId) {
      const r = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=fr`, {
        headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "photos" },
      });
      if (!r.ok) return new Response(JSON.stringify({ photos: [] }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
      const data = await r.json();
      const photos = (data.photos || []).map((p: { name: string }) => p.name).filter(Boolean).slice(0, 6);
      return new Response(JSON.stringify({ photos }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Mode image : renvoie les bytes de la photo demandée.
    if (name) {
      const maxW = Math.min(Number(url.searchParams.get("w")) || 1000, 1600);
      const g = await fetch(`https://places.googleapis.com/v1/${name}/media?maxWidthPx=${maxW}&key=${key}`);
      if (!g.ok) return new Response("photo error", { status: 502, headers: cors });
      const buf = await g.arrayBuffer();
      return new Response(buf, {
        status: 200,
        headers: { ...cors, "Content-Type": g.headers.get("Content-Type") || "image/jpeg", "Cache-Control": "public, max-age=86400" },
      });
    }

    return new Response("place_id ou name requis", { status: 400, headers: cors });
  } catch (_e) {
    return new Response("error", { status: 500, headers: cors });
  }
});
