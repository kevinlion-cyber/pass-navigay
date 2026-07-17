// SEO programmatique server-rendered (module 4) — Netlify Edge Function (Deno).
// Architecture HUB & SPOKE (silo), zéro IA (tout templaté), données lues via l'API
// publique Supabase (clé anon, lecture seule) :
//
//   /annuaire ............................ RACINE du silo (index villes + catégories)
//   /lieux/:categorie .................... PILIER catégorie (France) — ex. "Restaurants LGBT-friendly en France"
//   /annuaire/:ville ..................... PILIER ville — "Lieux LGBT-friendly à {Ville}"
//   /annuaire/:ville/:categorie .......... SATELLITE ville×catégorie — "Meilleurs bars gays à {Ville}"
//   /establishment/:id ................... LEAF (fiche) : injection meta + JSON-LD LocalBusiness
//   /sitemap.xml ......................... sitemap dynamique (pages au-dessus du seuil)
//
// Maillage : racine → piliers → satellites → fiches, + liens latéraux (frères) et
// remontants (fil d'Ariane). Garde anti-contenu-mince : noindex + hors sitemap sous seuil.

const SITE = "https://passnavigay.com";
const SUPA = "https://fbblzyiotqjmqxexvogs.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiYmx6eWlvdHFqbXF4ZXh2b2dzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwNzcyOTUsImV4cCI6MjA5MTY1MzI5NX0.VXvs4Zgfuf47UZu5mvGxd2kuJngN6ly91FwYt6O5wCU";

const MIN_CITY = 3;       // pilier ville indexable à partir de N lieux
const MIN_CITY_CAT = 2;   // satellite ville×catégorie indexable à partir de N lieux
const MIN_CAT = 3;        // pilier catégorie indexable à partir de N lieux

const CAT_LABEL: Record<string, string> = {
  se_loger: "Hébergements", shopping: "Shopping", manger: "Restaurants",
  soiree: "Bars & soirées", bien_etre: "Bien-être", culture: "Culture & sorties",
};
// Synonymes intégrés à la copy (couverture de mots-clés sans pages dupliquées).
const CAT_SYN: Record<string, string> = {
  se_loger: "hôtels, chambres d'hôtes et hébergements gay-friendly",
  shopping: "boutiques et commerces gay-friendly",
  manger: "restaurants et tables gay-friendly",
  soiree: "bars gays, boîtes et soirées LGBT",
  bien_etre: "saunas, spas et bien-être gay-friendly",
  culture: "lieux culturels et sorties LGBT",
};
// Requête « tête » réellement tapée par catégorie (intention transactionnelle) —
// utilisée dans les titres/H1/metas des pages ville×catégorie et piliers catégorie.
const CAT_KW: Record<string, string> = {
  se_loger: "Hôtels gay-friendly", shopping: "Boutiques gay-friendly", manger: "Restaurants gay-friendly",
  soiree: "Bars gays", bien_etre: "Saunas gays", culture: "Sorties LGBT",
};
const catLabel = (k: string) => CAT_LABEL[k] || k.replace(/_/g, " ");
const catKw = (k: string) => CAT_KW[k] || (catLabel(k) + " gay-friendly");
const catSyn = (k: string) => CAT_SYN[k] || (catLabel(k).toLowerCase() + " LGBT-friendly");

function slugify(s: string): string {
  return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function snippet(desc: string | null, n = 155): string {
  if (!desc) return "";
  const c = desc.replace(/\s+/g, " ").trim();
  return c.length > n ? c.slice(0, n).replace(/\s\S*$/, "") + "…" : c;
}

interface Est {
  id: string; slug: string | null; name: string; category: string; subcategory: string | null; city: string;
  address: string | null; postal_code: string | null; description: string | null; banner_url: string | null;
  is_pro: boolean; is_sponsor: boolean; latitude: number | null; longitude: number | null;
  website: string | null; phone: string | null; created_at: string | null;
}

async function sb(query: string): Promise<any[]> {
  try {
    const r = await fetch(`${SUPA}/rest/v1/${query}`, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } });
    return r.ok ? await r.json() : [];
  } catch { return []; }
}
const FIELDS = "id,slug,name,category,subcategory,city,address,postal_code,description,banner_url,is_pro,is_sponsor,latitude,longitude,website,phone,created_at";
const ficheUrl = (e: { slug: string | null; id: string }) => `/lieu/${e.slug || e.id}`;
const allEstablishments = () => sb(`establishments?select=${FIELDS}&order=is_sponsor.desc,created_at.desc&limit=5000`) as Promise<Est[]>;

// citySlug -> { name, rows }
function groupCities(all: Est[]): Map<string, { name: string; rows: Est[] }> {
  const m = new Map<string, { name: string; rows: Est[] }>();
  for (const e of all) { const s = slugify(e.city); if (!s) continue; const g = m.get(s) || { name: e.city, rows: [] }; g.rows.push(e); m.set(s, g); }
  return m;
}

// ---------- Layout commun ----------
function page(o: { title: string; description: string; canonical: string; noindex: boolean; jsonLd: object[]; body: string }): Response {
  const ld = o.jsonLd.map((x) => `<script type="application/ld+json">${JSON.stringify(x)}</script>`).join("\n");
  const html = `<!doctype html><html lang="fr"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.description)}">
<link rel="canonical" href="${esc(o.canonical)}">
<meta name="robots" content="${o.noindex ? "noindex,follow" : "index,follow"}">
<meta property="og:type" content="website"><meta property="og:title" content="${esc(o.title)}">
<meta property="og:description" content="${esc(o.description)}"><meta property="og:url" content="${esc(o.canonical)}">
<meta property="og:site_name" content="Pass Navigay"><meta property="og:image" content="${SITE}/logo-pass-navigay.png">
<link rel="icon" type="image/png" href="/favicon-32.png">
${ld}
<style>
:root{--p:#7B2D8B}*{box-sizing:border-box}body{margin:0;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a2e;background:#faf8fc;line-height:1.6}
a{color:var(--p);text-decoration:none}a:hover{text-decoration:underline}
header{background:#fff;border-bottom:1px solid #eee;padding:14px 20px}header .wrap{max-width:980px;margin:0 auto;display:flex;align-items:center;gap:16px}
.logo{font-weight:800;font-size:19px}.logo span{color:var(--p)}nav.top a{font-size:14px;color:#555;margin-left:14px}
main{max-width:980px;margin:0 auto;padding:24px 20px 48px}
.crumb{font-size:13px;color:#888;margin-bottom:14px}.crumb a{color:#888}
h1{font-size:28px;margin:.2em 0 .3em}.lead{color:#555;font-size:16px;margin:0 0 22px;max-width:760px}
h2{font-size:20px;margin:30px 0 12px;border-bottom:2px solid #f0e8f4;padding-bottom:6px}
h2 a{color:#1a1a2e}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:14px}
.card{background:#fff;border:1px solid #eee;border-radius:12px;overflow:hidden;display:flex;flex-direction:column}
.card .ph{height:120px;background:#f0e8f4 center/cover no-repeat}
.card .bd{padding:12px 14px}.card h3{margin:0 0 4px;font-size:16px}.card .meta{font-size:12px;color:#999;margin:0 0 6px}
.card .addr{font-size:12px;color:#888;margin:0}.card .snip{font-size:13px;color:#555;margin:6px 0 0}
.links{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 18px}
.chip{display:inline-block;background:#fff;border:1px solid #e6d8ee;color:var(--p);border-radius:20px;padding:6px 14px;font-size:13.5px;font-weight:500}
.chip b{color:#999;font-weight:400}
.cta{display:inline-block;background:var(--p);color:#fff;border-radius:10px;padding:11px 22px;font-weight:600;margin-top:8px}.cta:hover{text-decoration:none;opacity:.92}
footer{border-top:1px solid #eee;padding:24px 20px;color:#999;font-size:13px}footer .wrap{max-width:980px;margin:0 auto}footer a{color:#777}
.article{max-width:740px;font-size:16px}.article h2{font-size:20px}.article p{margin:0 0 14px}.article ul{padding-left:22px;margin:0 0 14px}.article li{margin:5px 0}.article strong{color:#1a1a2e}
</style></head><body>
<header><div class="wrap"><a class="logo" href="/">Pass <span>Navigay</span></a><nav class="top"><a href="/annuaire">Annuaire</a><a href="/guides">Guides</a><a href="/explore">Carte</a><a href="/events">Événements</a></nav></div></header>
<main>${o.body}</main>
<footer><div class="wrap">Pass Navigay — l'annuaire des lieux LGBT-friendly en France. <a href="/annuaire">Annuaire complet</a> · <a href="/">Accueil</a> · <a href="/explore">Explorer la carte</a></div></footer>
</body></html>`;
  return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600" } });
}

function card(e: Est): string {
  const ph = e.banner_url ? ` style="background-image:url('${esc(e.banner_url)}')"` : "";
  const u = ficheUrl(e);
  return `<div class="card"><a href="${u}"><div class="ph"${ph}></div></a>
<div class="bd"><h3><a href="${u}">${esc(e.name)}</a></h3>
<p class="meta">${esc(catLabel(e.category))}${e.subcategory ? " · " + esc(e.subcategory) : ""} · ${esc(e.city)}</p>
${e.address ? `<p class="addr">${esc(e.address)}</p>` : ""}
${e.description ? `<p class="snip">${esc(snippet(e.description))}</p>` : ""}</div></div>`;
}
interface Article { slug: string; type: string; title: string; h1: string | null; meta_description: string | null; excerpt: string | null; hero_emoji: string | null; body_html: string; related_category: string | null; related_city: string | null; }
const allArticles = () => sb(`seo_articles?select=slug,type,title,h1,meta_description,excerpt,hero_emoji,body_html,related_category,related_city,sort&published=eq.true&order=sort.desc`) as Promise<Article[]>;

const breadcrumbLd = (items: [string, string][]): object => ({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map(([name, url], i) => ({ "@type": "ListItem", position: i + 1, name, item: url })) });
const itemListLd = (rows: Est[]): object => ({ "@context": "https://schema.org", "@type": "ItemList", numberOfItems: rows.length, itemListElement: rows.slice(0, 50).map((e, i) => ({ "@type": "ListItem", position: i + 1, url: SITE + ficheUrl(e), name: e.name })) });

// ---------- RACINE /annuaire ----------
async function renderIndex(): Promise<Response> {
  const all = await allEstablishments();
  const cities = [...groupCities(all).entries()].sort((a, b) => b[1].rows.length - a[1].rows.length);
  const cats = new Map<string, number>();
  for (const e of all) cats.set(e.category, (cats.get(e.category) || 0) + 1);
  const catList = [...cats.entries()].sort((a, b) => b[1] - a[1]);

  const cityChips = cities.map(([s, g]) => `<a class="chip" href="/annuaire/${s}">${esc(g.name)} <b>(${g.rows.length})</b></a>`).join("");
  const catChips = catList.map(([c, n]) => `<a class="chip" href="/lieux/${slugify(c)}">${esc(catLabel(c))} <b>(${n})</b></a>`).join("");
  const arts = (await allArticles()).filter((a) => a.type !== "city");
  const guideChips = arts.slice(0, 10).map((a) => `<a class="chip" href="/guides/${a.slug}">${a.hero_emoji ? a.hero_emoji + " " : ""}${esc(a.h1 || a.title)}</a>`).join("");

  const body = `<nav class="crumb"><a href="/">Accueil</a> › Annuaire</nav>
<h1>Annuaire des lieux LGBT-friendly en France</h1>
<p class="lead">Pass Navigay recense les bars, restaurants, hébergements, saunas, lieux culturels et boutiques accueillants pour la communauté LGBT+, partout en France. Parcourez l'annuaire par ville ou par catégorie.</p>
<h2>Par catégorie</h2><div class="links">${catChips || "<span style='color:#999'>Bientôt disponible</span>"}</div>
<h2>Par ville</h2><div class="links">${cityChips || "<span style='color:#999'>Bientôt disponible</span>"}</div>
<h2><a href="/guides">Guides & conseils</a></h2>
<div class="links">${guideChips || `<a class="chip" href="/guides">Voir tous les guides</a>`}</div>
<p style="margin-top:20px"><a class="cta" href="/explore">Explorer tous les lieux sur la carte</a></p>`;
  const jsonLd = [breadcrumbLd([["Accueil", SITE + "/"], ["Annuaire", `${SITE}/annuaire`]])];
  return page({ title: "Annuaire des lieux LGBT-friendly en France | Pass Navigay", description: "L'annuaire Pass Navigay : bars, restaurants, hébergements, saunas et sorties LGBT-friendly ville par ville, partout en France.", canonical: `${SITE}/annuaire`, noindex: all.length === 0, jsonLd, body });
}

// ---------- PILIER catégorie /lieux/:cat ----------
async function renderCategoryPillar(catSlug: string): Promise<Response> {
  const all = await allEstablishments();
  const catKey = Object.keys(CAT_LABEL).find((k) => slugify(k) === catSlug || slugify(CAT_LABEL[k]) === catSlug)
    || [...new Set(all.map((e) => e.category))].find((c) => slugify(c) === catSlug);
  if (!catKey) return notFound();
  const rows = all.filter((e) => e.category === catKey);
  if (rows.length === 0) return notFound();
  const label = catLabel(catKey);
  const canonical = `${SITE}/lieux/${slugify(catKey)}`;

  const byCity = groupCities(rows);
  const cityCount = byCity.size;
  let sections = "";
  for (const [s, g] of [...byCity.entries()].sort((a, b) => b[1].rows.length - a[1].rows.length)) {
    sections += `<h2><a href="/annuaire/${s}/${slugify(catKey)}">${esc(label)} à ${esc(g.name)}</a> <span style="color:#bbb;font-weight:400">(${g.rows.length})</span></h2><div class="grid">${g.rows.map(card).join("")}</div>`;
  }
  const otherCats = Object.keys(CAT_LABEL).filter((c) => c !== catKey && all.some((e) => e.category === c))
    .map((c) => `<a class="chip" href="/lieux/${slugify(c)}">${esc(catLabel(c))}</a>`).join("");

  const body = `<nav class="crumb"><a href="/">Accueil</a> › <a href="/annuaire">Annuaire</a> › ${esc(label)}</nav>
<h1>${esc(catKw(catKey))} en France</h1>
<p class="lead">Tous les ${esc(catSyn(catKey))} recommandés par la communauté Pass Navigay : ${rows.length} adresse${rows.length > 1 ? "s" : ""} dans ${cityCount} ville${cityCount > 1 ? "s" : ""}. Sélection, avis et infos pratiques.</p>
${sections}
${otherCats ? `<h2>Autres catégories</h2><div class="links">${otherCats}</div>` : ""}
<p style="margin-top:20px"><a class="cta" href="/annuaire">Voir tout l'annuaire</a></p>`;
  const jsonLd = [breadcrumbLd([["Accueil", SITE + "/"], ["Annuaire", `${SITE}/annuaire`], [label, canonical]]), itemListLd(rows)];
  return page({ title: `${catKw(catKey)} en France : le guide par ville | Pass Navigay`, description: `Les meilleurs ${catSyn(catKey)} en France : ${rows.length} adresses dans ${cityCount} villes, avec avis et infos pratiques.`, canonical, noindex: rows.length < MIN_CAT, jsonLd, body });
}

// ---------- PILIER ville + SATELLITE ville×catégorie ----------
async function renderHub(citySlug: string, catSlug: string | null): Promise<Response> {
  const all = await allEstablishments();
  const cities = groupCities(all);
  const g = cities.get(citySlug);
  // City guide éditorial (intro rédigée main) → rend le pilier ville riche + indexable même sans lieux.
  const arts = await allArticles();
  const cityArt = arts.find((a) => a.type === "city" && slugify(a.related_city || "") === citySlug);
  if (!g && !cityArt) return notFound();
  const cityName = g?.name || (cityArt!.related_city as string);
  const cityRows = g?.rows || [];
  const catsInCity = [...new Set(cityRows.map((e) => e.category))];
  const otherCities = [...cities.entries()].filter(([s]) => s !== citySlug).sort((a, b) => b[1].rows.length - a[1].rows.length).slice(0, 12);
  const otherCitiesChips = otherCities.map(([s, c]) => `<a class="chip" href="/annuaire/${s}">${esc(c.name)}</a>`).join("");

  if (catSlug) {
    const catKey = catsInCity.find((c) => slugify(c) === catSlug) || Object.keys(CAT_LABEL).find((k) => slugify(k) === catSlug);
    const rows = catKey ? cityRows.filter((e) => e.category === catKey) : [];
    if (!catKey || rows.length === 0) return notFound();
    const label = catLabel(catKey);
    const canonical = `${SITE}/annuaire/${citySlug}/${slugify(catKey)}`;
    const crumb = `<nav class="crumb"><a href="/">Accueil</a> › <a href="/annuaire">Annuaire</a> › <a href="/annuaire/${citySlug}">${esc(cityName)}</a> › ${esc(label)}</nav>`;
    const siblings = catsInCity.filter((c) => c !== catKey).map((c) => `<a class="chip" href="/annuaire/${citySlug}/${slugify(c)}">${esc(catLabel(c))} à ${esc(cityName)}</a>`).join("");
    const body = `${crumb}
<h1>${esc(catKw(catKey))} à ${esc(cityName)}</h1>
<p class="lead">Les ${esc(catSyn(catKey))} à ${esc(cityName)} : ${rows.length} adresse${rows.length > 1 ? "s" : ""} sélectionnée${rows.length > 1 ? "s" : ""} par la communauté Pass Navigay. Adresses, avis et bons plans.</p>
<div class="grid">${rows.map(card).join("")}</div>
${siblings ? `<h2>Autres catégories à ${esc(cityName)}</h2><div class="links">${siblings}</div>` : ""}
<h2>${esc(label)} dans d'autres villes</h2><div class="links"><a class="chip" href="/lieux/${slugify(catKey)}">${esc(label)} en France</a>${otherCitiesChips}</div>
<p style="margin-top:20px"><a class="cta" href="/annuaire/${citySlug}">Tous les lieux à ${esc(cityName)}</a></p>`;
    const jsonLd = [breadcrumbLd([["Accueil", SITE + "/"], ["Annuaire", `${SITE}/annuaire`], [cityName, `${SITE}/annuaire/${citySlug}`], [label, canonical]]), itemListLd(rows)];
    return page({ title: `${catKw(catKey)} à ${cityName} — les meilleures adresses | Pass Navigay`, description: `${catKw(catKey)} à ${cityName} : ${rows.length} adresse${rows.length > 1 ? "s" : ""} (${catSyn(catKey)}), avis et infos pratiques sur Pass Navigay.`, canonical, noindex: rows.length < MIN_CITY_CAT, jsonLd, body });
  }

  // Pilier ville.
  const canonical = `${SITE}/annuaire/${citySlug}`;
  const crumb = `<nav class="crumb"><a href="/">Accueil</a> › <a href="/annuaire">Annuaire</a> › ${esc(cityName)}</nav>`;
  const intro = cityArt ? `<div class="article" style="margin-bottom:8px">${cityArt.body_html}</div>` : "";
  let sections = "";
  for (const c of catsInCity) {
    const rows = cityRows.filter((e) => e.category === c);
    sections += `<h2><a href="/annuaire/${citySlug}/${slugify(c)}">${esc(catLabel(c))} à ${esc(cityName)}</a> <span style="color:#bbb;font-weight:400">(${rows.length})</span></h2><div class="grid">${rows.map(card).join("")}</div>`;
  }
  if (!sections) sections = `<p style="color:#777">Les premières adresses LGBT-friendly de ${esc(cityName)} arrivent bientôt sur Pass Navigay. Vous en connaissez une&nbsp;? <a href="/pros">Ajoutez-la</a> ou parlez-nous-en.</p>`;
  const body = `${crumb}
<h1>${cityArt ? esc(cityArt.h1 || `Vie LGBT à ${cityName}`) : `Lieux LGBT-friendly à ${esc(cityName)}`}</h1>
${intro || `<p class="lead">Découvrez ${cityRows.length} adresse${cityRows.length > 1 ? "s" : ""} LGBT-friendly à ${esc(cityName)} : bars gays, restaurants, hébergements, saunas, bien-être et sorties accueillant·es pour la communauté LGBT+.</p>`}
${cityRows.length ? `<h2>Les adresses à ${esc(cityName)}</h2>` : ""}
${sections}
<h2>Explorer d'autres villes</h2><div class="links">${otherCitiesChips}</div>
<p style="margin-top:20px"><a class="cta" href="/explore">Voir tous les lieux sur la carte</a></p>`;
  const jsonLd = [breadcrumbLd([["Accueil", SITE + "/"], ["Annuaire", `${SITE}/annuaire`], [cityName, canonical]]), itemListLd(cityRows)];
  const title = cityArt?.title || `Lieux LGBT-friendly à ${cityName} — bars, restaurants, sorties | Pass Navigay`;
  const description = cityArt?.meta_description || `${cityRows.length} lieux LGBT-friendly à ${cityName} : ${catsInCity.map(catLabel).slice(0, 4).join(", ")}. Adresses, avis et communauté sur Pass Navigay.`;
  return page({ title, description, canonical, noindex: !cityArt && cityRows.length < MIN_CITY, jsonLd, body });
}

function notFound(): Response {
  return page({ title: "Page introuvable | Pass Navigay", description: "Cette page n'existe pas.", canonical: SITE, noindex: true, jsonLd: [], body: `<h1>Page introuvable</h1><p><a href="/annuaire">Voir l'annuaire</a></p>` });
}

// ---------- GUIDES (contenu éditorial) ----------
function guideCard(a: Article): string {
  return `<a class="card" href="/guides/${esc(a.slug)}" style="text-decoration:none;color:inherit">
<div class="bd"><h3 style="color:var(--p)">${a.hero_emoji ? a.hero_emoji + " " : ""}${esc(a.h1 || a.title)}</h3>
${a.excerpt ? `<p class="snip">${esc(a.excerpt)}</p>` : ""}</div></a>`;
}
async function renderGuidesIndex(): Promise<Response> {
  const arts = await allArticles();
  const guides = arts.filter((a) => a.type === "guide");
  const infos = arts.filter((a) => a.type === "info");
  const body = `<nav class="crumb"><a href="/">Accueil</a> › Guides</nav>
<h1>Guides & conseils LGBT-friendly</h1>
<p class="lead">Nos guides pour sortir, voyager, s'installer et profiter en toute sérénité quand on est LGBT+, et pour mieux comprendre la communauté. Des conseils clairs, bienveillants et gratuits.</p>
${guides.length ? `<h2>Guides pratiques</h2><div class="grid">${guides.map(guideCard).join("")}</div>` : ""}
${infos.length ? `<h2>Comprendre</h2><div class="grid">${infos.map(guideCard).join("")}</div>` : ""}
<p style="margin-top:22px"><a class="cta" href="/annuaire">Explorer l'annuaire des lieux</a></p>`;
  const jsonLd = [breadcrumbLd([["Accueil", SITE + "/"], ["Guides", `${SITE}/guides`]])];
  return page({ title: "Guides & conseils LGBT-friendly | Pass Navigay", description: "Sortir, voyager, s'installer et comprendre la communauté LGBT+ : tous nos guides pratiques et bienveillants, gratuits, sur Pass Navigay.", canonical: `${SITE}/guides`, noindex: arts.length === 0, jsonLd, body });
}
async function renderGuide(slug: string): Promise<Response> {
  const arts = await allArticles();
  const a = arts.find((x) => x.slug === slug);
  if (!a || a.type === "city") return notFound();
  const canonical = `${SITE}/guides/${a.slug}`;
  const h1 = a.h1 || a.title;

  // Maillage : lien vers le hub lié (ville/catégorie) + 3 autres guides.
  const relChips: string[] = [];
  if (a.related_city) relChips.push(`<a class="chip" href="/annuaire/${slugify(a.related_city)}">Lieux à ${esc(a.related_city)}</a>`);
  if (a.related_category) relChips.push(`<a class="chip" href="/lieux/${slugify(a.related_category)}">${esc(catLabel(a.related_category))} en France</a>`);
  relChips.push(`<a class="chip" href="/annuaire">Tout l'annuaire</a>`);
  const others = arts.filter((x) => x.slug !== a.slug).slice(0, 3).map((x) => `<a class="chip" href="/guides/${x.slug}">${x.hero_emoji ? x.hero_emoji + " " : ""}${esc(x.h1 || x.title)}</a>`).join("");

  const body = `<nav class="crumb"><a href="/">Accueil</a> › <a href="/guides">Guides</a> › ${esc(h1)}</nav>
<article><h1>${a.hero_emoji ? a.hero_emoji + " " : ""}${esc(h1)}</h1>
<div class="article">${a.body_html}</div></article>
<h2>Pour aller plus loin</h2><div class="links">${relChips.join("")}</div>
${others ? `<h2>Autres guides</h2><div class="links">${others}</div>` : ""}`;
  const jsonLd = [
    breadcrumbLd([["Accueil", SITE + "/"], ["Guides", `${SITE}/guides`], [h1, canonical]]),
    { "@context": "https://schema.org", "@type": "Article", headline: h1, description: a.meta_description || a.excerpt || "", author: { "@type": "Organization", name: "Pass Navigay" }, publisher: { "@type": "Organization", name: "Pass Navigay", logo: { "@type": "ImageObject", url: `${SITE}/logo-pass-navigay.png` } }, mainEntityOfPage: canonical },
  ];
  return page({ title: a.title, description: a.meta_description || a.excerpt || h1, canonical, noindex: false, jsonLd, body });
}

// ---------- SITEMAP ----------
async function sitemap(): Promise<Response> {
  const all = await allEstablishments();
  const urls: { loc: string; pr: string }[] = [
    { loc: `${SITE}/`, pr: "1.0" }, { loc: `${SITE}/annuaire`, pr: "0.9" }, { loc: `${SITE}/explore`, pr: "0.8" },
    { loc: `${SITE}/events`, pr: "0.6" }, { loc: `${SITE}/promos`, pr: "0.5" }, { loc: `${SITE}/pros`, pr: "0.5" },
  ];
  const cats = new Map<string, number>();
  for (const e of all) cats.set(e.category, (cats.get(e.category) || 0) + 1);
  for (const [c, n] of cats) if (n >= MIN_CAT) urls.push({ loc: `${SITE}/lieux/${slugify(c)}`, pr: "0.8" });
  for (const [s, g] of groupCities(all)) {
    if (g.rows.length >= MIN_CITY) urls.push({ loc: `${SITE}/annuaire/${s}`, pr: "0.8" });
    const cc = new Map<string, number>();
    for (const e of g.rows) cc.set(e.category, (cc.get(e.category) || 0) + 1);
    for (const [c, n] of cc) if (n >= MIN_CITY_CAT) urls.push({ loc: `${SITE}/annuaire/${s}/${slugify(c)}`, pr: "0.7" });
  }
  for (const e of all) urls.push({ loc: SITE + ficheUrl(e), pr: "0.6" });
  const arts = await allArticles();
  const editorial = arts.filter((a) => a.type !== "city");
  if (editorial.length) urls.push({ loc: `${SITE}/guides`, pr: "0.8" });
  for (const a of editorial) urls.push({ loc: `${SITE}/guides/${a.slug}`, pr: "0.7" });
  // Piliers ville dotés d'un city guide éditorial (indexables même sans lieux) — dédupe.
  const seenCity = new Set([...groupCities(all).keys()].filter((s) => (groupCities(all).get(s)!.rows.length) >= MIN_CITY));
  for (const a of arts.filter((x) => x.type === "city")) { const s = slugify(a.related_city || ""); if (s && !seenCity.has(s)) { urls.push({ loc: `${SITE}/annuaire/${s}`, pr: "0.8" }); seenCity.add(s); } }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${u.loc}</loc><priority>${u.pr}</priority></url>`).join("\n")}\n</urlset>`;
  return new Response(xml, { status: 200, headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" } });
}

// ---------- LEAF /lieu/:slug (injection meta) ----------
async function ficheMeta(key: string, byId: boolean, context: any): Promise<Response> {
  const col = byId ? "id" : "slug";
  const rows = await sb(`establishments?${col}=eq.${encodeURIComponent(key)}&select=${FIELDS}&limit=1`) as Est[];
  const e = rows[0];
  if (!e) return context.next();
  // Ancienne URL /establishment/:id → 301 vers l'URL propre /lieu/:slug.
  if (byId && e.slug) return Response.redirect(SITE + ficheUrl(e), 301);
  const res = await context.next();
  const html = await res.text();
  const title = `${e.name} — ${catLabel(e.category)} LGBT-friendly à ${e.city} | Pass Navigay`;
  const desc = e.description ? snippet(e.description) : `${e.name}, ${catLabel(e.category).toLowerCase()} LGBT-friendly à ${e.city}. Adresse, avis et infos pratiques sur Pass Navigay.`;
  const canonical = SITE + ficheUrl(e);
  const img = e.banner_url || `${SITE}/logo-pass-navigay.png`;
  const ld: any = {
    "@context": "https://schema.org", "@type": "LocalBusiness", name: e.name, url: canonical, image: img,
    address: { "@type": "PostalAddress", streetAddress: e.address || undefined, postalCode: e.postal_code || undefined, addressLocality: e.city, addressCountry: "FR" },
  };
  if (e.latitude && e.longitude) ld.geo = { "@type": "GeoCoordinates", latitude: e.latitude, longitude: e.longitude };
  if (e.phone) ld.telephone = e.phone;
  if (e.website) ld.sameAs = [e.website];
  const head = `<meta property="og:type" content="business.business">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(canonical)}"><meta property="og:image" content="${esc(img)}"><meta property="og:site_name" content="Pass Navigay">
<meta name="twitter:card" content="summary_large_image"><link rel="canonical" href="${esc(canonical)}">
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
    if (pathname === "/guides" || pathname === "/guides/") return await renderGuidesIndex();
    if (pathname.startsWith("/guides/")) return await renderGuide(pathname.split("/")[2] || "");
    if (pathname === "/annuaire" || pathname === "/annuaire/") return await renderIndex();
    if (pathname.startsWith("/lieux/")) return await renderCategoryPillar(pathname.split("/")[2] || "");
    if (pathname.startsWith("/annuaire/")) {
      const parts = pathname.replace(/^\/annuaire\//, "").replace(/\/$/, "").split("/");
      if (!parts[0]) return await renderIndex();
      return await renderHub(parts[0], parts[1] || null);
    }
    if (pathname.startsWith("/lieu/")) {
      const slug = pathname.split("/")[2] || "";
      if (!slug) return context.next();
      return await ficheMeta(slug, false, context);
    }
    if (pathname.startsWith("/establishment/") && !pathname.endsWith("/edit")) {
      const id = pathname.split("/")[2] || "";
      if (!id) return context.next();
      return await ficheMeta(id, true, context);
    }
  } catch { /* fallback SPA en cas d'erreur */ }
  return context.next();
};
