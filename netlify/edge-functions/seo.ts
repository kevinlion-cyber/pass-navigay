// SEO server-rendered (module 4) — Netlify Edge Function (Deno).
// Sert en VRAIE HTML : le sitemap, les pages programmatiques ville / ville×catégorie
// (avec maillage interne + JSON-LD), et injecte les balises meta/OG/LocalBusiness
// dans les fiches (le SPA continue de s'hydrater par-dessus).
// Zéro IA : tous les textes sont templatés. Données lues via l'API publique Supabase.

const SITE = "https://passnavigay.com";
const SUPA = "https://fbblzyiotqjmqxexvogs.supabase.co";
// Clé anon = publique (déjà exposée dans le bundle client). Lecture seule des données publiques.
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiYmx6eWlvdHFqbXF4ZXh2b2dzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwNzcyOTUsImV4cCI6MjA5MTY1MzI5NX0.VXvs4Zgfuf47UZu5mvGxd2kuJngN6ly91FwYt6O5wCU";

// Seuils anti « contenu mince » : sous ce nombre de lieux, la page existe mais est en noindex
// (et absente du sitemap). Elle bascule en indexable automatiquement quand la base grossit.
const MIN_CITY = 3;
const MIN_CITY_CAT = 2;

const CAT_LABEL: Record<string, string> = {
  se_loger: "Hébergements", shopping: "Shopping", manger: "Restaurants",
  soiree: "Bars & soirées", bien_etre: "Bien-être", culture: "Culture & sorties",
};
const catLabel = (k: string) => CAT_LABEL[k] || k.replace(/_/g, " ");

function slugify(s: string): string {
  return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

interface Est {
  id: string; name: string; category: string; subcategory: string | null; city: string;
  address: string | null; postal_code: string | null; description: string | null;
  google_rating: number | null; google_rating_count: number | null; banner_url: string | null;
  is_pro: boolean; is_sponsor: boolean; latitude: number | null; longitude: number | null;
  website: string | null; phone: string | null; created_at: string | null;
}

async function sb(query: string): Promise<any[]> {
  try {
    const r = await fetch(`${SUPA}/rest/v1/${query}`, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } });
    return r.ok ? await r.json() : [];
  } catch { return []; }
}
const FIELDS = "id,name,category,subcategory,city,address,postal_code,description,google_rating,google_rating_count,banner_url,is_pro,is_sponsor,latitude,longitude,website,phone,created_at";
const allEstablishments = () => sb(`establishments?select=${FIELDS}&order=is_sponsor.desc,google_rating_count.desc&limit=5000`) as Promise<Est[]>;

function snippet(desc: string | null, n = 160): string {
  if (!desc) return "";
  const clean = desc.replace(/\s+/g, " ").trim();
  return clean.length > n ? clean.slice(0, n).replace(/\s\S*$/, "") + "…" : clean;
}
function ratingStr(e: Est): string {
  if (!e.google_rating) return "";
  return `★ ${e.google_rating.toFixed(1)}${e.google_rating_count ? ` (${e.google_rating_count} avis)` : ""}`;
}

// ---------- Rendu commun ----------
function page(opts: { title: string; description: string; canonical: string; noindex: boolean; jsonLd: object[]; body: string }): Response {
  const ld = opts.jsonLd.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("\n");
  const html = `<!doctype html><html lang="fr"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(opts.title)}</title>
<meta name="description" content="${esc(opts.description)}">
<link rel="canonical" href="${esc(opts.canonical)}">
${opts.noindex ? '<meta name="robots" content="noindex,follow">' : '<meta name="robots" content="index,follow">'}
<meta property="og:type" content="website"><meta property="og:title" content="${esc(opts.title)}">
<meta property="og:description" content="${esc(opts.description)}"><meta property="og:url" content="${esc(opts.canonical)}">
<meta property="og:site_name" content="Pass Navigay"><meta property="og:image" content="${SITE}/logo-pass-navigay.png">
<link rel="icon" type="image/png" href="/favicon-32.png">
${ld}
<style>
:root{--p:#7B2D8B}*{box-sizing:border-box}body{margin:0;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a2e;background:#faf8fc;line-height:1.6}
a{color:var(--p);text-decoration:none}a:hover{text-decoration:underline}
header{background:#fff;border-bottom:1px solid #eee;padding:14px 20px}header .wrap{max-width:960px;margin:0 auto;display:flex;align-items:center;gap:8px}
.logo{font-weight:800;font-size:19px}.logo span{color:var(--p)}
main{max-width:960px;margin:0 auto;padding:24px 20px 48px}
.crumb{font-size:13px;color:#888;margin-bottom:14px}.crumb a{color:#888}
h1{font-size:27px;margin:.2em 0 .3em}.lead{color:#555;font-size:16px;margin:0 0 22px}
h2{font-size:19px;margin:28px 0 12px;border-bottom:2px solid #f0e8f4;padding-bottom:6px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}
.card{background:#fff;border:1px solid #eee;border-radius:12px;overflow:hidden;display:flex;flex-direction:column}
.card .ph{height:120px;background:#f0e8f4 center/cover no-repeat}
.card .bd{padding:12px 14px}.card h3{margin:0 0 4px;font-size:16px}.card .meta{font-size:12px;color:#999;margin:0 0 6px}
.card .rat{font-size:12px;color:#c78500;font-weight:600}.card .snip{font-size:13px;color:#555;margin:6px 0 0}
.links{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 0}.chip{display:inline-block;background:#fff;border:1px solid #e6d8ee;color:var(--p);border-radius:20px;padding:5px 13px;font-size:13px;font-weight:500}
.cta{display:inline-block;background:var(--p);color:#fff;border-radius:10px;padding:11px 22px;font-weight:600;margin-top:8px}.cta:hover{text-decoration:none;opacity:.92}
footer{border-top:1px solid #eee;padding:24px 20px;color:#999;font-size:13px}footer .wrap{max-width:960px;margin:0 auto}
</style></head><body>
<header><div class="wrap"><a class="logo" href="/">Pass <span>Navigay</span></a></div></header>
<main>${opts.body}</main>
<footer><div class="wrap">Pass Navigay — l'annuaire des lieux LGBT-friendly en France. <a href="/">Accueil</a> · <a href="/explore">Explorer</a> · <a href="/events">Événements</a></div></footer>
</body></html>`;
  return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600" } });
}

function venueCard(e: Est): string {
  const ph = e.banner_url ? ` style="background-image:url('${esc(e.banner_url)}')"` : "";
  const rat = ratingStr(e);
  return `<div class="card"><a href="/establishment/${esc(e.id)}"><div class="ph"${ph}></div></a>
<div class="bd"><h3><a href="/establishment/${esc(e.id)}">${esc(e.name)}</a></h3>
<p class="meta">${esc(catLabel(e.category))}${e.subcategory ? " · " + esc(e.subcategory) : ""} · ${esc(e.city)}</p>
${rat ? `<p class="rat">${esc(rat)}</p>` : ""}
${e.description ? `<p class="snip">${esc(snippet(e.description))}</p>` : ""}</div></div>`;
}

// ---------- Hubs ----------
async function renderHub(citySlug: string, catKey: string | null): Promise<Response> {
  const all = await allEstablishments();
  const cityRows = all.filter((e) => slugify(e.city) === citySlug);
  if (cityRows.length === 0) return notFound();
  const cityName = cityRows[0].city;

  // Catégories présentes dans la ville (pour le maillage).
  const catsInCity = [...new Set(cityRows.map((e) => e.category))];
  // Autres villes (maillage) — les plus fournies.
  const byCity = new Map<string, { name: string; n: number }>();
  for (const e of all) { const s = slugify(e.city); const c = byCity.get(s) || { name: e.city, n: 0 }; c.n++; byCity.set(s, c); }
  const otherCities = [...byCity.entries()].filter(([s]) => s !== citySlug).sort((a, b) => b[1].n - a[1].n).slice(0, 12);

  if (catKey) {
    // Page ville × catégorie.
    const rows = cityRows.filter((e) => e.category === catKey);
    if (rows.length === 0) return notFound();
    const label = catLabel(catKey);
    const canonical = `${SITE}/annuaire/${citySlug}/${slugify(catKey)}`;
    const title = `${label} LGBT-friendly à ${cityName} | Pass Navigay`;
    const description = `Les ${label.toLowerCase()} LGBT-friendly à ${cityName} : ${rows.length} adresse${rows.length > 1 ? "s" : ""} recommandée${rows.length > 1 ? "s" : ""} par la communauté, avec avis et infos pratiques.`;
    const crumb = `<nav class="crumb"><a href="/">Accueil</a> › <a href="/annuaire/${citySlug}">${esc(cityName)}</a> › ${esc(label)}</nav>`;
    const siblings = catsInCity.filter((c) => c !== catKey).map((c) => `<a class="chip" href="/annuaire/${citySlug}/${slugify(c)}">${esc(catLabel(c))} à ${esc(cityName)}</a>`).join("");
    const others = otherCities.map(([s, c]) => `<a class="chip" href="/annuaire/${s}">${esc(c.name)}</a>`).join("");
    const body = `${crumb}
<h1>${esc(label)} LGBT-friendly à ${esc(cityName)}</h1>
<p class="lead">${rows.length} ${esc(label.toLowerCase())} accueillant·es pour la communauté LGBT+ à ${esc(cityName)}, sélectionné·es par Pass Navigay. Adresses, avis et bons plans.</p>
<div class="grid">${rows.map(venueCard).join("")}</div>
${siblings ? `<h2>Autres catégories à ${esc(cityName)}</h2><div class="links">${siblings}</div>` : ""}
${others ? `<h2>Explorer d'autres villes</h2><div class="links">${others}</div>` : ""}
<p style="margin-top:26px"><a class="cta" href="/explore">Voir tous les lieux sur la carte</a></p>`;
    const jsonLd = [breadcrumbLd([["Accueil", SITE + "/"], [cityName, `${SITE}/annuaire/${citySlug}`], [label, canonical]]), itemListLd(rows)];
    return page({ title, description, canonical, noindex: rows.length < MIN_CITY_CAT, jsonLd, body });
  }

  // Page ville (toutes catégories).
  const canonical = `${SITE}/annuaire/${citySlug}`;
  const title = `Lieux LGBT-friendly à ${cityName} — bars, restaurants, sorties | Pass Navigay`;
  const description = `${cityRows.length} lieux LGBT-friendly à ${cityName} : ${catsInCity.map(catLabel).slice(0, 4).join(", ")}. Adresses, avis et communauté inclusive sur Pass Navigay.`;
  const crumb = `<nav class="crumb"><a href="/">Accueil</a> › ${esc(cityName)}</nav>`;
  let sections = "";
  for (const c of catsInCity) {
    const rows = cityRows.filter((e) => e.category === c);
    sections += `<h2><a href="/annuaire/${citySlug}/${slugify(c)}">${esc(catLabel(c))}</a> <span style="color:#bbb;font-weight:400">(${rows.length})</span></h2><div class="grid">${rows.map(venueCard).join("")}</div>`;
  }
  const others = otherCities.map(([s, c]) => `<a class="chip" href="/annuaire/${s}">${esc(c.name)}</a>`).join("");
  const body = `${crumb}
<h1>Lieux LGBT-friendly à ${esc(cityName)}</h1>
<p class="lead">Découvrez ${cityRows.length} adresse${cityRows.length > 1 ? "s" : ""} LGBT-friendly à ${esc(cityName)} : bars, restaurants, hébergements, bien-être et sorties accueillant·es pour la communauté LGBT+.</p>
${sections}
${others ? `<h2>Explorer d'autres villes</h2><div class="links">${others}</div>` : ""}
<p style="margin-top:26px"><a class="cta" href="/explore">Voir tous les lieux sur la carte</a></p>`;
  const jsonLd = [breadcrumbLd([["Accueil", SITE + "/"], [cityName, canonical]]), itemListLd(cityRows)];
  return page({ title, description, canonical, noindex: cityRows.length < MIN_CITY, jsonLd, body });
}

function breadcrumbLd(items: [string, string][]): object {
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map(([name, url], i) => ({ "@type": "ListItem", position: i + 1, name, item: url })) };
}
function itemListLd(rows: Est[]): object {
  return { "@context": "https://schema.org", "@type": "ItemList", numberOfItems: rows.length, itemListElement: rows.slice(0, 50).map((e, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE}/establishment/${e.id}`, name: e.name })) };
}

function notFound(): Response {
  return page({ title: "Page introuvable | Pass Navigay", description: "Cette page n'existe pas.", canonical: SITE, noindex: true, jsonLd: [], body: `<h1>Page introuvable</h1><p><a href="/">Retour à l'accueil</a></p>` });
}

// ---------- Sitemap ----------
async function sitemap(): Promise<Response> {
  const all = await allEstablishments();
  const urls: { loc: string; pr: string }[] = [
    { loc: `${SITE}/`, pr: "1.0" }, { loc: `${SITE}/explore`, pr: "0.9" },
    { loc: `${SITE}/events`, pr: "0.7" }, { loc: `${SITE}/promos`, pr: "0.6" }, { loc: `${SITE}/pros`, pr: "0.5" },
  ];
  const byCity = new Map<string, Est[]>();
  for (const e of all) { const s = slugify(e.city); if (!s) continue; const arr = byCity.get(s) || []; arr.push(e); byCity.set(s, arr); }
  for (const [s, rows] of byCity) {
    if (rows.length >= MIN_CITY) urls.push({ loc: `${SITE}/annuaire/${s}`, pr: "0.8" });
    const cats = new Map<string, number>();
    for (const e of rows) cats.set(e.category, (cats.get(e.category) || 0) + 1);
    for (const [c, n] of cats) if (n >= MIN_CITY_CAT) urls.push({ loc: `${SITE}/annuaire/${s}/${slugify(c)}`, pr: "0.7" });
  }
  for (const e of all) urls.push({ loc: `${SITE}/establishment/${e.id}`, pr: "0.6" });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${u.loc}</loc><priority>${u.pr}</priority></url>`).join("\n")}\n</urlset>`;
  return new Response(xml, { status: 200, headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" } });
}

// ---------- Injection meta dans une fiche ----------
async function ficheMeta(id: string, context: any): Promise<Response> {
  const rows = await sb(`establishments?id=eq.${encodeURIComponent(id)}&select=${FIELDS}&limit=1`) as Est[];
  const e = rows[0];
  const res = await context.next();
  if (!e) return res;
  const html = await res.text();

  const title = `${e.name} — ${catLabel(e.category)} LGBT-friendly à ${e.city} | Pass Navigay`;
  const desc = e.description ? snippet(e.description, 155) : `${e.name}, ${catLabel(e.category).toLowerCase()} LGBT-friendly à ${e.city}. Adresse, avis et infos pratiques sur Pass Navigay.`;
  const canonical = `${SITE}/establishment/${e.id}`;
  const img = e.banner_url || `${SITE}/logo-pass-navigay.png`;

  const ld: any = {
    "@context": "https://schema.org", "@type": "LocalBusiness", name: e.name, url: canonical, image: img,
    address: { "@type": "PostalAddress", streetAddress: e.address || undefined, postalCode: e.postal_code || undefined, addressLocality: e.city, addressCountry: "FR" },
  };
  if (e.latitude && e.longitude) ld.geo = { "@type": "GeoCoordinates", latitude: e.latitude, longitude: e.longitude };
  if (e.google_rating && e.google_rating_count) ld.aggregateRating = { "@type": "AggregateRating", ratingValue: e.google_rating, reviewCount: e.google_rating_count };
  if (e.phone) ld.telephone = e.phone;
  if (e.website) ld.sameAs = [e.website];

  const head = `<meta property="og:type" content="business.business">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(canonical)}"><meta property="og:image" content="${esc(img)}"><meta property="og:site_name" content="Pass Navigay">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="${esc(canonical)}">
<script type="application/ld+json">${JSON.stringify(ld)}</script>`;

  const out = html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(desc)}" />`)
    .replace("</head>", `${head}\n</head>`);
  return new Response(out, { status: res.status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=600" } });
}

export default async (request: Request, context: any) => {
  const { pathname } = new URL(request.url);
  try {
    if (pathname === "/sitemap.xml") return await sitemap();
    if (pathname.startsWith("/annuaire/")) {
      const parts = pathname.replace(/^\/annuaire\//, "").replace(/\/$/, "").split("/");
      const citySlug = parts[0];
      if (!citySlug) return notFound();
      return await renderHub(citySlug, parts[1] || null);
    }
    if (pathname.startsWith("/establishment/")) {
      const id = pathname.split("/")[2] || "";
      if (!id) return context.next();
      return await ficheMeta(id, context);
    }
  } catch { /* en cas d'erreur SEO, on laisse passer le SPA */ }
  return context.next();
};
