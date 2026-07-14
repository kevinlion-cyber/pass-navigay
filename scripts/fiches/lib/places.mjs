// Client Google Places API (New). Deux usages :
//  - searchText : découverte large (masque léger, SKU "Pro"), jusqu'à 60 lieux/requête.
//  - placeDetails : détail d'un lieu AVEC ses avis (SKU "Enterprise+Atmosphere"),
//    appelé seulement à l'enrichissement pour limiter le coût.
import { config } from './env.mjs';

const SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const DETAILS_MASK = 'id,displayName,formattedAddress,location,rating,userRatingCount,businessStatus,primaryTypeDisplayName,nationalPhoneNumber,internationalPhoneNumber,websiteUri,editorialSummary,reviews';

const SEARCH_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.addressComponents',
  'places.location',
  'places.rating',
  'places.userRatingCount',
  'places.businessStatus',
  'places.primaryTypeDisplayName',
  'places.nationalPhoneNumber',
  'places.websiteUri',
  'nextPageToken',
].join(',');

function extractAddress(place) {
  const comps = place.addressComponents || [];
  const find = (type) => comps.find((c) => (c.types || []).includes(type))?.longText || '';
  return {
    postal_code: find('postal_code'),
    city: find('locality') || find('administrative_area_level_2') || '',
  };
}

// Découverte : renvoie jusqu'à `max` lieux OPERATIONNELS pour une requête textuelle.
export async function searchText(textQuery, { max = 60 } = {}) {
  const results = [];
  let pageToken = null;
  do {
    const body = { textQuery, languageCode: 'fr', regionCode: 'FR' };
    if (pageToken) body.pageToken = pageToken;
    const r = await fetch(SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': config.googlePlacesKey,
        'X-Goog-FieldMask': SEARCH_MASK,
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const txt = await r.text();
      throw new Error(`Places searchText ${r.status}: ${txt.slice(0, 300)}`);
    }
    const data = await r.json();
    for (const p of data.places || []) {
      if (p.businessStatus && p.businessStatus !== 'OPERATIONAL') continue; // zéro fiche fantôme
      const addr = extractAddress(p);
      results.push({
        place_id: p.id,
        name: p.displayName?.text || '',
        address: p.formattedAddress || '',
        postal_code: addr.postal_code,
        city: addr.city,
        latitude: p.location?.latitude ?? null,
        longitude: p.location?.longitude ?? null,
        phone: p.nationalPhoneNumber || '',
        website: p.websiteUri || '',
        google_rating: p.rating ?? null,
        google_rating_count: p.userRatingCount ?? null,
        google_primary_type: p.primaryTypeDisplayName?.text || '',
        editorial_summary: p.editorialSummary?.text || '',
      });
      if (results.length >= max) return results;
    }
    pageToken = data.nextPageToken || null;
  } while (pageToken && results.length < max);
  return results;
}

// Détail d'un lieu AVEC avis (max 5, plafond de l'API officielle). Utilisé à l'enrichissement.
export async function placeDetails(placeId) {
  const r = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=fr`, {
    headers: {
      'X-Goog-Api-Key': config.googlePlacesKey,
      'X-Goog-FieldMask': DETAILS_MASK,
    },
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Places details ${r.status}: ${txt.slice(0, 300)}`);
  }
  const p = await r.json();
  return {
    editorial_summary: p.editorialSummary?.text || '',
    reviews: (p.reviews || []).map((rv) => ({
      rating: rv.rating ?? null,
      text: rv.text?.text || rv.originalText?.text || '',
      author: rv.authorAttribution?.displayName || '',
      when: rv.relativePublishTimeDescription || rv.publishTime || '',
    })),
  };
}
