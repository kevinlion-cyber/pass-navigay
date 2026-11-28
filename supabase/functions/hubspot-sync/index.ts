import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";

// hubspot-sync — fonction AUTONOME (pas d'import ../_shared), JWT désactivé.
// Envoie à HubSpot les membres Premium payants et les établissements Pro payants notés
// dans la file `hubspot_sync` (migration 81), et efface les contacts des comptes supprimés.
//
// Appelée par la tâche `pn-hubspot` (en-tête x-pn-cron) ou par un admin (double authentification).
// Secret nécessaire : HUBSPOT_TOKEN (app privée HubSpot, droits contacts + entreprises + propriétés).
// Jamais envoyé : orientation, identité de genre, questionnaire, messages.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE = Deno.env.get("PUBLIC_SITE_URL") || "https://passnavigay.com";
const HS = "https://api.hubapi.com";
const LOT = 40;
const BASE_MARKETING = "Client — intérêt légitime (offres similaires), désinscription possible à tout moment";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Pn-Cron",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const CATEGORIES: Record<string, string> = {
  se_loger: "Dormir safe", manger: "Se régaler", soiree: "Sortir & faire la fête", shopping: "Shopping & pépites",
  bien_etre: "Prendre soin de soi", culture: "Culture & spectacles", communaute: "Communauté & santé",
  services: "Pros safe", sport: "Sport & plein air", adulte: "Coquin 18+",
};

// ---------- Accès ----------
function aal2(authHeader: string): boolean {
  try {
    const part = authHeader.slice(7).split(".")[1];
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
    return JSON.parse(atob(b64)).aal === "aal2";
  } catch {
    return false;
  }
}
async function autorise(req: Request, svc: SupabaseClient): Promise<boolean> {
  const cron = req.headers.get("x-pn-cron");
  if (cron) {
    const { data } = await svc.rpc("pn_verifier_secret_hubspot", { p_secret: cron });
    if (data === true) return true;
  }
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return false;
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return false;
  const { data: me } = await svc.from("profiles").select("is_admin").eq("id", data.user.id).maybeSingle();
  return !!me?.is_admin && aal2(auth);
}

// ---------- HubSpot ----------
let TOKEN = "";
async function hs(method: string, path: string, body?: unknown): Promise<{ status: number; data: any }> {
  const r = await fetch(`${HS}${path}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: r.status, data };
}
function erreurHs(quoi: string, res: { status: number; data: any }): Error {
  const msg = typeof res.data === "object" && res.data?.message ? res.data.message : String(res.data).slice(0, 200);
  return new Error(`${quoi} (HubSpot ${res.status}) : ${msg}`);
}

const opt = (labels: string[]) => labels.map((l, i) => ({ label: l, value: l, displayOrder: i }));
const PROPRIETES: Record<"contacts" | "companies", Record<string, unknown>[]> = {
  contacts: [
    { name: "pn_membre_id", label: "PassNavigay – Identifiant membre", type: "string", fieldType: "text" },
    { name: "pn_premium_statut", label: "PassNavigay – Premium", type: "enumeration", fieldType: "select", options: opt(["Actif", "Ancien client"]) },
    { name: "pn_premium_formule", label: "PassNavigay – Formule Premium", type: "enumeration", fieldType: "select", options: opt(["Mensuel", "Annuel"]) },
    { name: "pn_premium_fin", label: "PassNavigay – Fin de la période Premium", type: "date", fieldType: "date" },
    { name: "pn_gerant_pro", label: "PassNavigay – Gérant d'un établissement Pro", type: "enumeration", fieldType: "select", options: opt(["Oui", "Ancien client"]) },
    { name: "pn_base_marketing", label: "PassNavigay – Base des e-mails marketing", type: "string", fieldType: "text" },
  ],
  companies: [
    { name: "pn_etablissement_id", label: "PassNavigay – Identifiant fiche", type: "string", fieldType: "text", hasUniqueValue: true },
    { name: "pn_pro_statut", label: "PassNavigay – Pro", type: "enumeration", fieldType: "select", options: opt(["Actif", "Ancien client"]) },
    { name: "pn_pro_formule", label: "PassNavigay – Formule Pro", type: "enumeration", fieldType: "select", options: opt(["Mensuel", "Annuel"]) },
    { name: "pn_pro_fin", label: "PassNavigay – Fin de la période Pro", type: "date", fieldType: "date" },
    { name: "pn_categorie", label: "PassNavigay – Catégorie", type: "string", fieldType: "text" },
    { name: "pn_fiche_url", label: "PassNavigay – Fiche", type: "string", fieldType: "text" },
  ],
};

// Crée le groupe « PassNavigay » et les champs s'ils n'existent pas encore (une fois par appel).
async function preparerChamps() {
  for (const objet of ["contacts", "companies"] as const) {
    const g = await hs("POST", `/crm/v3/properties/${objet}/groups`, { name: "passnavigay", label: "PassNavigay", displayOrder: -1 });
    if (g.status >= 400 && g.status !== 409) throw erreurHs(`groupe ${objet}`, g);
    const existants = await hs("GET", `/crm/v3/properties/${objet}?properties=name`);
    if (existants.status >= 400) throw erreurHs(`lecture des champs ${objet}`, existants);
    const noms = new Set((existants.data?.results || []).map((p: { name: string }) => p.name));
    for (const p of PROPRIETES[objet]) {
      if (noms.has(p.name as string)) continue;
      const c = await hs("POST", `/crm/v3/properties/${objet}`, { ...p, groupName: "passnavigay" });
      if (c.status >= 400 && c.status !== 409) throw erreurHs(`champ ${p.name}`, c);
    }
  }
}

const jour = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : "");
const formule = (i: string | null | undefined) => (i === "monthly" ? "Mensuel" : i === "yearly" ? "Annuel" : "");
const actif = (flag: boolean, fin: string | null) => !!flag && !!fin && new Date(fin).getTime() > Date.now();

// Les valeurs vides ne sont pas envoyées : on n'efface jamais un champ déjà rempli dans HubSpot.
const sansVides = (o: Record<string, string>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== ""));

async function upsertContact(email: string, props: Record<string, string>): Promise<string> {
  props = sansVides(props);
  const res = await hs("POST", "/crm/v3/objects/contacts/batch/upsert", {
    inputs: [{ idProperty: "email", id: email.toLowerCase(), properties: { email: email.toLowerCase(), ...props } }],
  });
  if (res.status >= 300 || !res.data?.results?.[0]?.id) throw erreurHs("contact", res);
  return res.data.results[0].id;
}

// ---------- Traitements ----------
type Ligne = { id: number; cible: string; cible_id: string; email: string | null; hubspot_contact_id: string | null };

async function envoyerMembre(svc: SupabaseClient, l: Ligne) {
  const { data: p } = await svc.from("profiles")
    .select("id,email,prenom,nom,is_premium,premium_expires_at,premium_billing_interval,stripe_customer_id")
    .eq("id", l.cible_id).maybeSingle();
  if (!p || !p.email) return { ignore: "membre introuvable ou sans e-mail" };
  if (!p.stripe_customer_id && !l.hubspot_contact_id) return { ignore: "jamais payant" };
  const enCours = actif(p.is_premium, p.premium_expires_at);
  const contact = await upsertContact(p.email, {
    firstname: p.prenom || "", lastname: p.nom || "", pn_membre_id: p.id,
    pn_premium_statut: enCours ? "Actif" : "Ancien client",
    pn_premium_formule: formule(p.premium_billing_interval),
    pn_premium_fin: jour(p.premium_expires_at),
    pn_base_marketing: BASE_MARKETING,
  });
  return { contact };
}

async function envoyerEtablissement(svc: SupabaseClient, l: Ligne) {
  const { data: e } = await svc.from("establishments")
    .select("id,name,city,phone,website,category,owner_id,is_pro,pro_expires_at,pro_billing_interval,stripe_subscription_id")
    .eq("id", l.cible_id).maybeSingle();
  if (!e) return { ignore: "établissement introuvable" };
  const enCours = actif(e.is_pro, e.pro_expires_at);
  const res = await hs("POST", "/crm/v3/objects/companies/batch/upsert", {
    inputs: [{
      idProperty: "pn_etablissement_id", id: e.id,
      properties: sansVides({
        pn_etablissement_id: e.id, name: e.name || "", city: e.city || "", phone: e.phone || "", website: e.website || "",
        pn_categorie: CATEGORIES[e.category] || e.category || "", pn_fiche_url: `${SITE}/establishment/${e.id}`,
        pn_pro_statut: enCours ? "Actif" : "Ancien client",
        pn_pro_formule: formule(e.pro_billing_interval), pn_pro_fin: jour(e.pro_expires_at),
      }),
    }],
  });
  if (res.status >= 300 || !res.data?.results?.[0]?.id) throw erreurHs("entreprise", res);
  const company: string = res.data.results[0].id;

  let contact: string | undefined;
  if (e.owner_id) {
    const { data: o } = await svc.from("profiles").select("id,email,prenom,nom").eq("id", e.owner_id).maybeSingle();
    if (o?.email) {
      contact = await upsertContact(o.email, {
        firstname: o.prenom || "", lastname: o.nom || "", pn_membre_id: o.id,
        pn_gerant_pro: enCours ? "Oui" : "Ancien client", pn_base_marketing: BASE_MARKETING,
      });
      const a = await hs("PUT", `/crm/v4/objects/contacts/${contact}/associations/default/companies/${company}`);
      if (a.status >= 300) throw erreurHs("lien contact ↔ entreprise", a);
    }
  }
  return { contact, company };
}

async function effacer(l: Ligne) {
  if (!l.email) return { ignore: "pas d'e-mail" };
  const res = await hs("POST", "/crm/v3/objects/contacts/gdpr-delete", { idProperty: "email", objectId: l.email });
  if (res.status >= 300 && res.status !== 404) throw erreurHs("effacement", res);
  return {};
}

async function traiter(svc: SupabaseClient) {
  const { data: lignes, error } = await svc.from("hubspot_sync")
    .select("id,cible,cible_id,email,hubspot_contact_id").eq("a_faire", true).lt("tentatives", 10)
    .order("demande_le", { ascending: true }).limit(LOT);
  if (error) throw new Error(error.message);
  if (!lignes?.length) return { envoyes: 0, ignores: 0, erreurs: 0 };

  await preparerChamps();
  let envoyes = 0, ignores = 0, erreurs = 0;
  for (const l of lignes as Ligne[]) {
    try {
      const r: { ignore?: string; contact?: string; company?: string } =
        l.cible === "membre" ? await envoyerMembre(svc, l)
        : l.cible === "etablissement" ? await envoyerEtablissement(svc, l)
        : await effacer(l);
      if (l.cible === "effacement") {
        await svc.from("hubspot_sync").delete().eq("id", l.id); // plus besoin de garder l'e-mail
      } else {
        await svc.from("hubspot_sync").update({
          a_faire: false, envoye_le: r.ignore ? null : new Date().toISOString(), derniere_erreur: r.ignore ? `ignoré : ${r.ignore}` : null,
          ...(r.contact ? { hubspot_contact_id: r.contact } : {}), ...(r.company ? { hubspot_company_id: r.company } : {}),
        }).eq("id", l.id);
      }
      if (r.ignore) ignores++; else envoyes++;
    } catch (e) {
      erreurs++;
      const { data: cur } = await svc.from("hubspot_sync").select("tentatives").eq("id", l.id).maybeSingle();
      await svc.from("hubspot_sync").update({
        tentatives: (cur?.tentatives ?? 0) + 1, derniere_erreur: (e instanceof Error ? e.message : "erreur").slice(0, 500),
      }).eq("id", l.id);
    }
  }
  return { envoyes, ignores, erreurs };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    if (!(await autorise(req, svc))) return json({ error: "Accès refusé" }, 403);
    TOKEN = Deno.env.get("HUBSPOT_TOKEN") ?? "";
    if (!TOKEN) return json({ error: "Secret HUBSPOT_TOKEN manquant dans Supabase" }, 500);
    return json(await traiter(svc));
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Erreur" }, 500);
  }
});
