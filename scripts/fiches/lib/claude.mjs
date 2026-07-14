// Appel Claude (API Messages) pour l'enrichissement d'une fiche.
// Renvoie un objet JSON validé : description fun + sous-catégorie + tags + indice gay-friendly.
import { config } from './env.mjs';
import { PN_CATEGORIES } from './categories.mjs';

const DEFAULT_MODEL = process.env.FICHES_MODEL || 'claude-sonnet-5';

const SYSTEM = `Tu es l'éditeur de contenu de Pass Navigay, l'annuaire des lieux LGBT-friendly en France.
Ton but : transformer les données brutes d'un lieu en une fiche COURTE, chaleureuse et fun (vouvoiement).
Règles :
- Français, ton vivant et accueillant, jamais un guide touristique verbeux. 2 à 3 phrases maximum.
- Ne JAMAIS inventer de faits (pas d'horaires, prix, événements non fournis). Décris l'ambiance, pas des données incertaines.
- Le "signal gay-friendly" est un INDICE INTERNE d'aide à la validation humaine, JAMAIS un badge public automatique.
  Base-toi UNIQUEMENT sur les avis fournis. Si rien n'indique quoi que ce soit, signal="neutre".
- Signale toute VIGILANCE (propos/incidents homophobes, racistes, videurs violents, "pas safe") mentionnée dans les avis : précieux pour un annuaire LGBT.
Réponds STRICTEMENT en JSON valide, sans texte autour, sans balise markdown.`;

function buildUserPrompt(draft, reviewData) {
  const cat = PN_CATEGORIES[draft.category];
  const subcats = cat ? cat.subcategories : [];
  const reviews = (reviewData.reviews || [])
    .map((r, i) => `#${i + 1} (${r.rating ?? '?'}★, ${r.when || '?'}) : ${r.text}`)
    .join('\n') || '(aucun avis disponible)';

  return `LIEU
Nom : ${draft.name}
Catégorie Pass Navigay : ${draft.category} (${cat?.label || ''})
Type Google : ${draft.google_primary_type || '?'}
Ville : ${draft.city}
Note Google : ${draft.google_rating ?? '?'} (${draft.google_rating_count ?? 0} avis)
Résumé éditorial Google : ${reviewData.editorial_summary || '(aucun)'}

AVIS ANALYSÉS (${reviewData.total_reviews_read}, source ${reviewData.provider}, confiance ${reviewData.confidence}) :
${reviews}

SOUS-CATÉGORIES AUTORISÉES (choisis-en une, EXACTEMENT telle qu'écrite) : ${subcats.join(' | ')}

Renvoie ce JSON :
{
  "description": "2-3 phrases fun et chaleureuses sur l'ambiance du lieu",
  "subcategory": "une valeur EXACTE de la liste autorisée",
  "tags": ["3 à 6 mots-clés courts en minuscules"],
  "gay_friendly": {
    "signal": "fort | modere | neutre | evenementiel",
    "score": 0,
    "citations": ["extraits d'avis qui justifient le signal, sinon []"],
    "vigilance": "note de vigilance (homophobie/sécurité) si les avis en révèlent, sinon vide",
    "confidence": "${reviewData.confidence}"
  }
}
"score" = entier 0 à 100 (confiance dans le caractère gay-friendly, 0 si aucun signal).`;
}

export async function enrichWithClaude(draft, reviewData, model = DEFAULT_MODEL) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': config.anthropicKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 900,
      system: SYSTEM,
      messages: [{ role: 'user', content: buildUserPrompt(draft, reviewData) }],
    }),
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Claude ${r.status}: ${txt.slice(0, 300)}`);
  }
  const data = await r.json();
  const text = (data.content || []).map((c) => c.text || '').join('').trim();
  const jsonStr = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(`Réponse Claude non-JSON : ${text.slice(0, 200)}`);
  }
  return { parsed, model, usage: data.usage };
}
