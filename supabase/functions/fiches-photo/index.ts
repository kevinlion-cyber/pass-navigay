import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
// Proxy photos Google Places — RÉSERVÉ AUX ADMINS (point M3 de l'audit, 24/11/2026).
// Avant, ce proxy était public : n'importe qui pouvait faire grimper la facture
// Google (chaque appel = requêtes Places payantes). Il ne sert qu'aux écrans admin
// « Fiches auto ». Comme il alimente des balises <img> (qui ne peuvent pas envoyer
// d'en-tête), le jeton de connexion de l'admin est passé dans l'adresse (?token=…).
// Deux modes :
//   ?place_id=XXX        → JSON { photos: [resourceName, ...] } (liste des photos du lieu)
//   ?name=<resourceName> → renvoie l'image (bytes) de cette photo
// La clé Google reste côté serveur (jamais exposée au navigateur).
// Fichier autonome : peut être redéployé depuis l'éditeur du tableau de bord Supabase.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, apikey, Authorization",
};
const PLACE_ID_RE = /^[A-Za-z0-9_-]{10,300}$/;
const PHOTO_NAME_RE = /^places\/[A-Za-z0-9_-]{10,300}\/photos\/[A-Za-z0-9_-]{10,1000}$/;

async function isAdminRequest(req: Request, url: URL): Promise<boolean> {
  const header = req.headers.get("Authorization") ?? "";
  const token = url.searchParams.get("token") || (header.startsWith("Bearer ") ? header.slice(7) : "");
  if (!token) return false;
  const supaUrl = Deno.env.get("SUPABASE_URL")!;
  const svc = createClient(supaUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await svc.auth.getUser(token);
  if (error || !data.user) return false;
  // Double authentification obligatoire (session « aal2 »).
  try {
    const part = token.split(".")[1];
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
    if (JSON.parse(atob(b64)).aal !== "aal2") return false;
  } catch {
    return false;
  }
  const { data: me } = await svc.from("profiles").select("is_admin").eq("id", data.user.id).maybeSingle();
  return !!me?.is_admin;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });

  const key = Deno.env.get("GOOGLE_PLACES_API_KEY");
  if (!key) return new Response("no key", { status: 500, headers: cors });

  const url = new URL(req.url);
  if (!(await isAdminRequest(req, url))) return new Response("forbidden", { status: 403, headers: cors });
  const placeId = url.searchParams.get("place_id");
  const name = url.searchParams.get("name");
  if (placeId && !PLACE_ID_RE.test(placeId)) return new Response("place_id invalide", { status: 400, headers: cors });
  if (name && !PHOTO_NAME_RE.test(name)) return new Response("name invalide", { status: 400, headers: cors });
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
      return new Response(await g.arrayBuffer(), { status: 200, headers: { ...cors, "Content-Type": g.headers.get("Content-Type") || "image/jpeg", "Cache-Control": "private, max-age=86400" } });
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
        headers: { ...cors, "Content-Type": g.headers.get("Content-Type") || "image/jpeg", "Cache-Control": "private, max-age=86400" },
      });
    }

    return new Response("place_id ou name requis", { status: 400, headers: cors });
  } catch (_e) {
    return new Response("error", { status: 500, headers: cors });
  }
});
