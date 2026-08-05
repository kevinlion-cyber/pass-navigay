// Logique partagée du moteur de fiches (Module 1) côté Edge Functions.
// On découvre de VRAIS établissements par ville × catégorie (pas de guide touristique,
// pas de signal gay-friendly : ça, c'est la communauté de l'app qui le définira dans le temps).
// Aligné avec src/lib/constants.ts.

// ⚠️ MODÈLE PRODUIT (décision Fred) : Pass Navigay N'EST PAS un annuaire de lieux gays.
// C'est un annuaire de lieux de QUALITÉ et DIVERS, que LA COMMUNAUTÉ note ensuite —
// ce sont les avis des membres qui révèlent le caractère accueillant, pas un pré-filtrage.
// => Les `queries` restent GÉNÉRIQUES et on filtre sur la qualité (note + nb d'avis).
// NE PAS les remplacer par « bar gay », « sauna gay »… : ça détruirait la diversité
// (et c'est aussi pour ça que DataForSEO / le détecteur gay-friendly a été abandonné).
export const PN_CATEGORIES: Record<string, { label: string; subcategories: string[]; queries: string[] }> = {
  se_loger: {
    label: "Se loger",
    subcategories: ["Maison d'hotes", "Hotel", "Location particuliere"],
    queries: ["hôtels", "maisons d'hôtes", "chambres d'hôtes"],
  },
  shopping: {
    label: "Shopping",
    subcategories: ["Vetements", "Deco", "Art", "Chaussures", "Sex-shop", "Jeux"],
    queries: ["boutique de vêtements", "concept store", "boutique déco", "sex-shop", "galerie d'art"],
  },
  manger: {
    label: "Manger",
    subcategories: ["Restaurant", "Fast-food", "Brunch", "Salon de the", "Bar a vins"],
    queries: ["restaurants", "brunch", "salon de thé", "bar à vins"],
  },
  soiree: {
    label: "Soiree",
    subcategories: ["Bar tranquille", "Bar musical", "Boite de nuit"],
    queries: ["bars", "bar à cocktails", "boîte de nuit"],
  },
  bien_etre: {
    label: "Bien-etre",
    subcategories: ["Sauna", "Massage", "Esthetique"],
    queries: ["sauna", "spa", "institut de massage", "institut de beauté"],
  },
  culture: {
    label: "Culture",
    subcategories: ["Musee", "Visite guidee", "Concert", "Cinema", "Autres"],
    queries: ["cinéma", "salle de concert", "théâtre", "galerie d'art"],
  },
};

export const CATEGORY_KEYS = Object.keys(PN_CATEGORIES);

// Requêtes de découverte pour une ville × catégorie(s).
export function buildQueries(city: string, category: string | null): { category: string; query: string; textQuery: string }[] {
  const cats = category ? [category] : CATEGORY_KEYS;
  const out: { category: string; query: string; textQuery: string }[] = [];
  for (const cat of cats) {
    const def = PN_CATEGORIES[cat];
    if (!def) continue;
    for (const q of def.queries) out.push({ category: cat, query: q, textQuery: `${q} ${city}` });
  }
  return out;
}

const SEARCH_MASK = [
  "places.id", "places.displayName", "places.formattedAddress", "places.addressComponents",
  "places.location", "places.rating", "places.userRatingCount", "places.businessStatus",
  "places.primaryType", "places.primaryTypeDisplayName", "places.types",
  "places.nationalPhoneNumber", "places.websiteUri", "nextPageToken",
].join(",");

// Types Google à EXCLURE : pas des établissements « qui accueillent un public »
// (monuments, places, parcs, aqueducs, lieux de culte, administrations, transports, services…).
// Pass Navigay n'est PAS un guide touristique → uniquement des lieux commerciaux où l'on entre.
export const BLOCK_TYPES = new Set([
  "tourist_attraction", "historical_landmark", "historical_place", "monument", "observation_deck",
  "plaza", "town_square", "park", "national_park", "state_park", "dog_park", "garden", "botanical_garden",
  "hiking_area", "beach", "campground", "rv_park", "marina", "pier",
  "place_of_worship", "church", "hindu_temple", "mosque", "synagogue", "cemetery", "funeral_home",
  "city_hall", "local_government_office", "government_office", "courthouse", "embassy", "fire_station",
  "police", "post_office", "hospital", "doctor", "dentist", "pharmacy", "drugstore", "physiotherapist", "veterinary_care",
  "school", "primary_school", "secondary_school", "preschool", "university", "child_care_agency",
  "transit_station", "bus_station", "train_station", "subway_station", "light_rail_station", "transit_depot",
  "airport", "parking", "rest_stop", "gas_station", "electric_vehicle_charging_station",
  "atm", "bank", "insurance_agency", "accounting", "real_estate_agency", "lawyer",
  "car_repair", "car_dealer", "car_rental", "car_wash", "auto_parts_store", "storage", "moving_company",
  "plumber", "electrician", "roofing_contractor", "general_contractor", "painter", "locksmith",
  "aquarium", "zoo", "amusement_park", "water_park", "stadium", "sports_complex", "gym", "fitness_center",
]);

// Vrai établissement accueillant du public (≠ POI touristique / service) ?
export function isRealVenue(primaryType: string): boolean {
  return !!primaryType && !BLOCK_TYPES.has(primaryType);
}

// Nettoie le nom : "gay friendly"/"lgbt friendly" ne doit JAMAIS rester dans le titre
// (ça relèvera d'un badge, jamais du nom). Retire parenthèses, séparateurs et mentions isolées.
export function cleanName(name: string): string {
  let n = name || "";
  n = n.replace(/\s*\([^)]*(?:gay|lgbtq?)[\s-]*friendly[^)]*\)/gi, "");
  n = n.replace(/\s*[-–—|·,]\s*(?:gay|lgbtq?)[\s-]*friendly\b/gi, "");
  n = n.replace(/\b(?:gay|lgbtq?)[\s-]*friendly\b/gi, "");
  n = n.replace(/\(\s*\)/g, "").replace(/\s*[-–—|·,]\s*$/g, "").replace(/\s{2,}/g, " ").trim();
  return n || name;
}

const DETAILS_MASK = [
  "id", "displayName", "formattedAddress", "location", "rating", "userRatingCount", "businessStatus",
  "primaryTypeDisplayName", "nationalPhoneNumber", "websiteUri", "editorialSummary", "reviews",
  "regularOpeningHours", "priceLevel",
  "outdoorSeating", "liveMusic", "servesBreakfast", "servesBrunch", "servesLunch", "servesDinner",
  "servesVegetarianFood", "servesCoffee", "servesDessert", "servesBeer", "servesWine", "servesCocktails",
  "goodForChildren", "goodForGroups", "allowsDogs", "restroom", "reservable", "delivery", "takeout", "dineIn",
  "accessibilityOptions", "parkingOptions", "paymentOptions",
].join(",");

const APP_DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"]; // Google : 0 = dimanche
const pad = (n: number) => String(n).padStart(2, "0");

// Convertit les horaires Google (periods) vers le format app { lundi:{open,close}|null, ... }.
function googleHoursToApp(roh: any): Record<string, { open: string; close: string } | null> {
  const out: Record<string, { open: string; close: string } | null> = {};
  for (const p of roh?.periods || []) {
    if (p.open?.day == null) continue;
    const day = APP_DAYS[p.open.day];
    const open = `${pad(p.open.hour ?? 0)}:${pad(p.open.minute ?? 0)}`;
    const close = p.close ? `${pad(p.close.hour ?? 0)}:${pad(p.close.minute ?? 0)}` : "23:59";
    const cur = out[day];
    if (!cur) out[day] = { open, close };
    else { if (open < cur.open) cur.open = open; if (close > cur.close) cur.close = close; }
  }
  if (Object.keys(out).length === 0) return {};
  for (const d of APP_DAYS) if (!(d in out)) out[d] = null; // jours sans créneau = fermé
  return out;
}

const PRICE_MAP: Record<string, number> = {
  PRICE_LEVEL_FREE: 0, PRICE_LEVEL_INEXPENSIVE: 1, PRICE_LEVEL_MODERATE: 2, PRICE_LEVEL_EXPENSIVE: 3, PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

const AMENITY_MAP: [string, string][] = [
  ["outdoorSeating", "Terrasse"], ["servesBreakfast", "Petit-déjeuner"], ["servesBrunch", "Brunch"],
  ["servesVegetarianFood", "Options végé"], ["servesCocktails", "Cocktails"], ["servesBeer", "Bière"],
  ["servesWine", "Vin"], ["servesCoffee", "Café"], ["liveMusic", "Musique live"], ["goodForChildren", "Adapté enfants"],
  ["goodForGroups", "Groupes"], ["allowsDogs", "Animaux acceptés"], ["restroom", "Toilettes"],
  ["reservable", "Réservation"], ["delivery", "Livraison"], ["takeout", "À emporter"], ["dineIn", "Sur place"],
];

function googleAmenities(p: any): string[] {
  const out: string[] = [];
  for (const [k, label] of AMENITY_MAP) if (p[k] === true) out.push(label);
  if (p.accessibilityOptions?.wheelchairAccessibleEntrance) out.push("Accessible PMR");
  if (p.parkingOptions && Object.values(p.parkingOptions).some((v: any) => (Array.isArray(v) ? v.length : v))) out.push("Parking");
  if (p.paymentOptions?.acceptsCreditCards) out.push("CB acceptée");
  return out;
}

function addrParts(place: any) {
  const comps = place.addressComponents || [];
  const find = (t: string) => comps.find((c: any) => (c.types || []).includes(t))?.longText || "";
  return { postal_code: find("postal_code"), city: find("locality") || find("administrative_area_level_2") || "" };
}

export async function searchText(apiKey: string, textQuery: string, max = 60): Promise<any[]> {
  const results: any[] = [];
  let pageToken: string | null = null;
  do {
    const body: any = { textQuery, languageCode: "fr", regionCode: "FR" };
    if (pageToken) body.pageToken = pageToken;
    const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": SEARCH_MASK },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`Places searchText ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const data = await r.json();
    for (const p of data.places || []) {
      if (p.businessStatus && p.businessStatus !== "OPERATIONAL") continue;
      const a = addrParts(p);
      results.push({
        place_id: p.id,
        name: cleanName(p.displayName?.text || ""),
        address: p.formattedAddress || "",
        postal_code: a.postal_code,
        city: a.city,
        latitude: p.location?.latitude ?? null,
        longitude: p.location?.longitude ?? null,
        phone: p.nationalPhoneNumber || "",
        website: p.websiteUri || "",
        google_rating: p.rating ?? null,
        google_rating_count: p.userRatingCount ?? null,
        google_primary_type: p.primaryTypeDisplayName?.text || "",
        primary_type: p.primaryType || "",
      });
      if (results.length >= max) return results;
    }
    pageToken = data.nextPageToken || null;
  } while (pageToken && results.length < max);
  return results;
}

// Noms de ressources photo d'un lieu (pour stockage à la publication).
export async function getPhotoNames(apiKey: string, placeId: string, max = 5): Promise<string[]> {
  const r = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=fr`, {
    headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": "photos" },
  });
  if (!r.ok) return [];
  const data = await r.json();
  return (data.photos || []).map((p: { name: string }) => p.name).filter(Boolean).slice(0, max);
}

// Télécharge les bytes d'une photo (JPEG) à stocker dans Supabase Storage.
export async function fetchPhotoMedia(apiKey: string, name: string, w = 1200): Promise<Uint8Array | null> {
  const g = await fetch(`https://places.googleapis.com/v1/${name}/media?maxWidthPx=${w}&key=${apiKey}`);
  if (!g.ok) return null;
  return new Uint8Array(await g.arrayBuffer());
}

export async function placeDetails(apiKey: string, placeId: string): Promise<{
  editorial_summary: string; reviews: any[];
  opening_hours: Record<string, unknown>; price_level: number | null; amenities: string[];
}> {
  const r = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=fr`, {
    headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": DETAILS_MASK },
  });
  if (!r.ok) throw new Error(`Places details ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const p = await r.json();
  return {
    editorial_summary: p.editorialSummary?.text || "",
    reviews: (p.reviews || []).map((rv: any) => ({
      rating: rv.rating ?? null,
      text: rv.text?.text || rv.originalText?.text || "",
      when: rv.relativePublishTimeDescription || "",
    })),
    opening_hours: googleHoursToApp(p.regularOpeningHours),
    price_level: p.priceLevel ? (PRICE_MAP[p.priceLevel] ?? null) : null,
    amenities: googleAmenities(p),
  };
}

export function passesGate(c: { google_rating: number | null; google_rating_count: number | null }, minRating: number, minReviews: number): boolean {
  return (c.google_rating ?? 0) >= minRating && (c.google_rating_count ?? 0) >= minReviews;
}

const SYSTEM = `Tu es l'éditeur de contenu de Pass Navigay, l'annuaire des lieux LGBT-friendly en France.
Écris une fiche chaleureuse, vivante et fun (vouvoiement) qui donne VRAIMENT envie d'y aller.
Règles : français vivant, découpé en 2 ou 3 COURTS paragraphes séparés par une ligne vide (jamais un pavé) : (1) l'accroche et l'ambiance, (2) ce qu'on y trouve/mange/boit, (3) pour quelle occasion y aller. 2-3 phrases par paragraphe max.
N'invente AUCUN fait (horaires, prix, événements) : appuie-toi sur les avis et le résumé fournis pour capter l'ambiance, sans les citer mot pour mot.
Réponds STRICTEMENT en JSON valide, sans texte ni markdown autour (les retours à la ligne dans la description sont échappés en \\n).`;

export async function enrichWithClaude(anthropicKey: string, model: string, draft: any, reviewData: any): Promise<any> {
  const cat = PN_CATEGORIES[draft.category];
  const subcats = cat ? cat.subcategories : [];
  const reviews = (reviewData.reviews || []).map((r: any, i: number) => `#${i + 1} (${r.rating ?? "?"}★) : ${r.text}`).join("\n") || "(aucun avis)";
  const userPrompt = `LIEU
Nom : ${draft.name}
Catégorie : ${draft.category} (${cat?.label || ""})
Type Google : ${draft.google_primary_type || "?"}
Ville : ${draft.city}
Note : ${draft.google_rating ?? "?"} (${draft.google_rating_count ?? 0} avis)
Résumé Google : ${reviewData.editorial_summary || "(aucun)"}

AVIS (${reviewData.reviews?.length || 0}, pour capter l'ambiance) :
${reviews}

SOUS-CATÉGORIES AUTORISÉES (choisis-en une EXACTE) : ${subcats.join(" | ")}

Renvoie ce JSON :
{"description":"2 à 3 courts paragraphes séparés par \\n\\n (accroche/ambiance, ce qu'on y trouve, pour quelle occasion)","subcategory":"valeur exacte de la liste","tags":["3-6 mots-clés minuscules"]}`;

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": anthropicKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 1200, system: SYSTEM, messages: [{ role: "user", content: userPrompt }] }),
  });
  if (!r.ok) throw new Error(`Claude ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const data = await r.json();
  const text = (data.content || []).map((c: any) => c.text || "").join("").trim();
  const jsonStr = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  return { parsed: JSON.parse(jsonStr), usage: data.usage };
}

export function validSubcat(category: string, proposed: string): string {
  const allowed = PN_CATEGORIES[category]?.subcategories || [];
  if (allowed.includes(proposed)) return proposed;
  const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").trim();
  return allowed.find((a) => norm(a) === norm(proposed)) || allowed[0] || proposed;
}

// ─────────────────────────────────────────────────────────────────────────────
// DataForSEO — avis Google en profondeur (option payante, compte de Kevin).
//
// ⚠️ L'API est ASYNCHRONE : on poste des tâches, elles mettent 8 à 15 min à
// être prêtes, puis on les relit. Il n'existe pas de mode direct (testé : 404).
// D'où le découpage en deux temps `post` puis `collect`.
//
// Google Places ne renvoie que 5 avis ; DataForSEO permet d'en lire des
// centaines, ce qui donne des fiches nettement plus riches et plus justes.
// ─────────────────────────────────────────────────────────────────────────────

export function dfsAuth(): string | null {
  const login = Deno.env.get("DATAFORSEO_LOGIN");
  const password = Deno.env.get("DATAFORSEO_PASSWORD");
  if (!login || !password) return null;
  return "Basic " + btoa(`${login}:${password}`);
}

/** Poste un lot de tâches d'avis (max 100 par appel). Renvoie place_id -> task_id. */
export async function dfsPostReviewTasks(
  auth: string,
  places: { place_id: string }[],
  depth: number,
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (let i = 0; i < places.length; i += 100) {
    const chunk = places.slice(i, i + 100);
    const body = chunk.map((p, k) => ({
      place_id: p.place_id,
      location_name: "France",
      language_code: "fr",
      depth: Math.max(10, Math.min(depth, 1000)),
      sort_by: "newest",
      priority: 1, // normal : moitié prix, on n'est pas pressé
      tag: `pn-${i + k}`,
    }));
    const r = await fetch("https://api.dataforseo.com/v3/business_data/google/reviews/task_post", {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    for (const t of j.tasks || []) {
      const idx = Number(String(t?.data?.tag || "").replace("pn-", ""));
      const place = places[idx];
      if (place && t?.id) out[place.place_id] = t.id;
    }
  }
  return out;
}

/** Relit une tâche. Renvoie null si elle n'est pas encore prête (HTTP 404 côté DataForSEO). */
export async function dfsFetchReviews(
  auth: string,
  taskId: string,
): Promise<{ rating: number | null; text: string; date: string }[] | null> {
  const r = await fetch(
    `https://api.dataforseo.com/v3/business_data/google/reviews/task_get/${taskId}`,
    { headers: { Authorization: auth } },
  );
  const j = await r.json().catch(() => null);
  const task = j?.tasks?.[0];
  if (task?.status_code !== 20000) return null;
  const items = (task.result?.[0]?.items || []).filter(
    (x: any) => x.type === "google_reviews_search",
  );
  return items
    .map((x: any) => ({
      rating: x.rating?.value ?? null,
      text: String(x.review_text || "").replace(/\s+/g, " ").trim(),
      date: String(x.timestamp || "").slice(0, 10),
    }))
    .filter((x: any) => x.text);
}

/**
 * Rédige UNE fiche et l'enregistre en brouillon.
 *
 * Extrait de `fiches-enrich` pour que le traitement en tâche de fond
 * (`city-worker`, qui continue même navigateur fermé) produise EXACTEMENT la
 * même chose que le bouton de l'interface. Toute évolution du contenu d'une
 * fiche se fait ici, jamais en double.
 */
export async function writeDraft(
  svc: { from: (t: string) => any; storage: { from: (b: string) => any } },
  keys: { placesKey: string; anthropicKey: string; model: string },
  it: Record<string, any>,
  opts: { photos: number; citySlug: string | null; deepReviews?: unknown[] | null },
): Promise<{ tokensIn: number; tokensOut: number; deep: boolean }> {
  const det = await placeDetails(keys.placesKey, it.place_id);

  // Avis en profondeur (DataForSEO) si on les a, sinon les 5 avis de Google.
  const deep = Array.isArray(opts.deepReviews) ? opts.deepReviews : [];
  const reviewData = deep.length
    ? { provider: "dataforseo", confidence: "high", editorial_summary: det.editorial_summary, reviews: deep }
    : { provider: "google5", confidence: "low", editorial_summary: det.editorial_summary, reviews: det.reviews };

  const { parsed, usage } = await enrichWithClaude(keys.anthropicKey, keys.model, it, reviewData);
  const subcategory = validSubcat(it.category, parsed.subcategory);

  // Photos téléchargées UNE fois et stockées : plus aucune facturation Google à l'affichage.
  const photoUrls: string[] = [];
  try {
    const names = opts.photos > 0 ? await getPhotoNames(keys.placesKey, it.place_id, opts.photos) : [];
    for (let i = 0; i < names.length; i++) {
      const bytes = await fetchPhotoMedia(keys.placesKey, names[i], i === 0 ? 1400 : 900);
      if (!bytes) continue;
      const path = `${it.place_id}/${i}.jpg`;
      const up = await svc.storage.from("place-photos").upload(path, bytes, { contentType: "image/jpeg", upsert: true });
      if (!up.error) photoUrls.push(svc.storage.from("place-photos").getPublicUrl(path).data.publicUrl);
    }
  } catch { /* photos best-effort : une fiche sans photo vaut mieux qu'une fiche perdue */ }

  const { error } = await svc.from("establishment_drafts").upsert({
    place_id: it.place_id,
    name: it.name,
    address: it.address || "",
    city: it.city || "",
    city_slug: opts.citySlug,
    postal_code: it.postal_code || "",
    latitude: it.latitude ?? null,
    longitude: it.longitude ?? null,
    phone: it.phone || "",
    website: it.website || "",
    google_rating: it.google_rating ?? null,
    google_rating_count: it.google_rating_count ?? null,
    google_primary_type: it.google_primary_type || "",
    raw: { editorial_summary: det.editorial_summary, reviews_provider: reviewData.provider, reviews_count: reviewData.reviews?.length || 0 },
    google_reviews: reviewData.reviews || [],
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
    ai_model: keys.model,
    ai_generated_at: new Date().toISOString(),
    status: "enriched",
  }, { onConflict: "place_id" });
  if (error) throw error;

  return { tokensIn: usage?.input_tokens || 0, tokensOut: usage?.output_tokens || 0, deep: deep.length > 0 };
}
