// Logique partagée du moteur de fiches (Module 1) côté Edge Functions.
// Catégories PN + requêtes de découverte (LGBT-ciblées EN TÊTE), appels Google Places,
// appel Claude d'enrichissement, gate qualité. Aligné avec src/lib/constants.ts.

export const PN_CATEGORIES: Record<string, { label: string; subcategories: string[]; lgbt: string[]; generic: string[] }> = {
  se_loger: {
    label: "Se loger",
    subcategories: ["Maison d'hotes", "Hotel", "Location particuliere"],
    lgbt: ["hôtel gay friendly", "maison d'hôtes lgbt"],
    generic: ["hôtels", "maisons d'hôtes"],
  },
  shopping: {
    label: "Shopping",
    subcategories: ["Vetements", "Deco", "Art", "Chaussures", "Sex-shop", "Jeux"],
    lgbt: ["sex-shop gay", "boutique lgbt", "concept store queer"],
    generic: ["boutique de vêtements", "concept store", "galerie d'art"],
  },
  manger: {
    label: "Manger",
    subcategories: ["Restaurant", "Fast-food", "Brunch", "Salon de the", "Bar a vins"],
    lgbt: ["restaurant gay friendly", "cantine queer"],
    generic: ["restaurants", "brunch", "bar à vins"],
  },
  soiree: {
    label: "Soiree",
    subcategories: ["Bar tranquille", "Bar musical", "Boite de nuit"],
    lgbt: ["bar gay", "bar lgbt", "club gay", "bar queer", "cabaret drag"],
    generic: ["bars", "bar à cocktails", "boîte de nuit"],
  },
  bien_etre: {
    label: "Bien-etre",
    subcategories: ["Sauna", "Massage", "Esthetique"],
    lgbt: ["sauna gay", "sauna lgbt"],
    generic: ["sauna", "spa", "institut de massage"],
  },
  culture: {
    label: "Culture",
    subcategories: ["Musee", "Visite guidee", "Concert", "Cinema", "Autres"],
    lgbt: ["lieu culturel lgbt", "association lgbt", "centre lgbt"],
    generic: ["musées", "cinéma", "salle de concert", "théâtre"],
  },
};

export const CATEGORY_KEYS = Object.keys(PN_CATEGORIES);

// Construit les requêtes pour une ville : LGBT-ciblées d'abord (remontent les lieux
// communautaires en tête), puis génériques. `lgbtOnly` limite aux requêtes ciblées.
export function buildQueries(city: string, category: string | null, lgbtOnly = false): { category: string; query: string; textQuery: string; targeted: boolean }[] {
  const cats = category ? [category] : CATEGORY_KEYS;
  const out: { category: string; query: string; textQuery: string; targeted: boolean }[] = [];
  for (const cat of cats) {
    const def = PN_CATEGORIES[cat];
    if (!def) continue;
    for (const q of def.lgbt) out.push({ category: cat, query: q, textQuery: `${q} ${city}`, targeted: true });
    if (!lgbtOnly) for (const q of def.generic) out.push({ category: cat, query: q, textQuery: `${q} ${city}`, targeted: false });
  }
  return out;
}

const SEARCH_MASK = [
  "places.id", "places.displayName", "places.formattedAddress", "places.addressComponents",
  "places.location", "places.rating", "places.userRatingCount", "places.businessStatus",
  "places.primaryTypeDisplayName", "places.nationalPhoneNumber", "places.websiteUri", "nextPageToken",
].join(",");

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
      });
      if (results.length >= max) return results;
    }
    pageToken = data.nextPageToken || null;
  } while (pageToken && results.length < max);
  return results;
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
Le "signal gay-friendly" est un INDICE INTERNE d'aide à la validation humaine, JAMAIS un badge public auto.
Base-toi UNIQUEMENT sur les avis fournis ; si rien, signal="neutre". Signale toute VIGILANCE (homophobie, racisme, videurs violents, "pas safe") mentionnée.
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

AVIS (${reviewData.reviews?.length || 0}, source google5, confiance faible) :
${reviews}

SOUS-CATÉGORIES AUTORISÉES (choisis-en une EXACTE) : ${subcats.join(" | ")}

Renvoie ce JSON :
{"description":"2-3 phrases fun","subcategory":"valeur exacte de la liste","tags":["3-6 mots-clés minuscules"],"gay_friendly":{"signal":"fort|modere|neutre|evenementiel","score":0,"citations":[],"vigilance":"","confidence":"low"}}`;

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
