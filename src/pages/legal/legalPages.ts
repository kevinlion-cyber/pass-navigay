// Pages légales personnalisées (A2) : onglets ajoutables en plus des 4 pages fixes.
// Stockées en JSON dans app_settings.key = 'legal_custom_pages'.

export interface LegalPage {
  slug: string;
  title: string;
  content: string; // markdown
}

export const LEGAL_CUSTOM_KEY = 'legal_custom_pages';

export function parseLegalPages(raw: string | null | undefined): LegalPage[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((p) => p && typeof p.slug === 'string' && p.slug.trim() && typeof p.title === 'string' && p.title.trim())
      .map((p) => ({ slug: String(p.slug), title: String(p.title), content: typeof p.content === 'string' ? p.content : '' }));
  } catch {
    return [];
  }
}

export const legalSlugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
