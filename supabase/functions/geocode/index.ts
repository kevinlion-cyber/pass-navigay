// Géocodage côté serveur via OpenStreetMap / Nominatim (gratuit, sans clé).
// Remplace l'appel direct à l'API Google Geocoding qui est refusée côté client
// (la clé Maps est restreinte par référent → le web service Geocoding la rejette).
// Si une clé serveur Google est fournie (GOOGLE_GEOCODING_KEY), on l'utilise en priorité.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type Suggestion = {
  place_name: string;
  center: [number, number]; // [lng, lat]
  city: string;
  postcode: string;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function viaGoogle(query: string, key: string, limit: number): Promise<Suggestion[]> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&components=country:FR&language=fr&key=${key}`;
  const r = await fetch(url);
  const d = await r.json();
  if (d.status !== "OK") return [];
  return (d.results || []).slice(0, limit).map((res: any) => {
    const comp = (res.address_components || []) as any[];
    const city = comp.find((c) => c.types.includes("locality"))?.long_name
      || comp.find((c) => c.types.includes("postal_town"))?.long_name || "";
    const postcode = comp.find((c) => c.types.includes("postal_code"))?.long_name || "";
    return {
      place_name: res.formatted_address,
      center: [res.geometry.location.lng, res.geometry.location.lat] as [number, number],
      city, postcode,
    };
  });
}

async function viaNominatim(query: string, limit: number): Promise<Suggestion[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=fr&limit=${limit}&q=${encodeURIComponent(query)}`;
  const r = await fetch(url, {
    headers: { "User-Agent": "PassNavigay/1.0 (bonjour@passnavigay.com)", "Accept-Language": "fr" },
  });
  if (!r.ok) return [];
  const d = await r.json();
  return (d || []).map((res: any) => {
    const a = res.address || {};
    const city = a.city || a.town || a.village || a.municipality || "";
    return {
      place_name: res.display_name,
      center: [parseFloat(res.lon), parseFloat(res.lat)] as [number, number],
      city,
      postcode: a.postcode || "",
    };
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const { query, limit } = await req.json().catch(() => ({}));
    if (typeof query !== "string" || query.trim().length < 2 || query.length > 200) {
      return json({ results: [] });
    }
    const max = Math.min(Math.max(Number(limit) || 5, 1), 8);
    const googleKey = Deno.env.get("GOOGLE_GEOCODING_KEY");

    let results: Suggestion[] = [];
    if (googleKey) results = await viaGoogle(query.trim(), googleKey, max);
    if (results.length === 0) results = await viaNominatim(query.trim(), max);

    return json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ error: message, results: [] }, 500);
  }
});
