// Logique partagée du moteur de fiches (Module 1) côté Edge Functions.
// On découvre de VRAIS établissements par ville × catégorie (pas de guide touristique,
// pas de signal gay-friendly : ça, c'est la communauté de l'app qui le définira dans le temps).
// Aligné avec src/lib/constants.ts.

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

const DETAILS_MASK = "id,displayName,formattedAddress,location,rating,userRatingCount,businessStatus,primaryTypeDisplayName,nationalPhoneNumber,websiteUri,editorialSummary,reviews";

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
        name: p.displayName?.text || "",
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

export async function placeDetails(apiKey: string, placeId: string): Promise<{ editorial_summary: string; reviews: any[] }> {
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
  };
}

export function passesGate(c: { google_rating: number | null; google_rating_count: number | null }, minRating: number, minReviews: number): boolean {
  return (c.google_rating ?? 0) >= minRating && (c.google_rating_count ?? 0) >= minReviews;
}

const SYSTEM = `Tu es l'éditeur de contenu de Pass Navigay, l'annuaire des lieux LGBT-friendly en France.
Transforme les données brutes d'un lieu en une fiche COURTE, chaleureuse et fun (vouvoiement).
Règles : français vivant, 2-3 phrases max, jamais un guide verbeux. N'invente aucun fait (horaires/prix/événements).
Sers-toi des avis fournis pour capter l'ambiance, sans les citer mot pour mot.
Réponds STRICTEMENT en JSON valide, sans texte ni markdown autour.`;

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
{"description":"2-3 phrases fun sur l'ambiance du lieu","subcategory":"valeur exacte de la liste","tags":["3-6 mots-clés minuscules"]}`;

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": anthropicKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 900, system: SYSTEM, messages: [{ role: "user", content: userPrompt }] }),
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
