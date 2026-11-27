import { createClient } from "npm:@supabase/supabase-js@2.57.4";

// Import automatique des événements de la semaine (décision de Kévin, 27/11/2026).
//
// Chaque lundi, la tâche planifiée de Claude dépose le fichier des événements LGBT et
// LGBT-friendly de l'Hérault dans le dépôt GitHub (branche « evenements-hebdo »,
// fichier evenements/semaine.json). Cette fonction, lancée par pg_cron (migration 73),
// le récupère, le contrôle comme l'import manuel (src/lib/importEvenements.ts) et
// l'ajoute EN ATTENTE dans « Événements à valider ». Rien n'est publié : seul un
// administrateur publie, depuis l'admin.
//
// Sécurité :
// - appel accepté seulement avec l'en-tête x-pn-cron égal au secret rangé dans le
//   coffre Supabase (vérifié par la fonction SQL pn_verifier_secret_import) ;
// - n'écrit que dans event_drafts (statut « pending »), ne lit aucune donnée de membre ;
// - source fixe (aucune adresse fournie par l'appelant).
// Fichier autonome : peut être déployé depuis l'éditeur du tableau de bord Supabase,
// avec « Verify JWT » désactivé (la protection est l'en-tête secret).

const SOURCE = "https://raw.githubusercontent.com/kevinlion-cyber/pass-navigay/evenements-hebdo/evenements/semaine.json";
const FORMAT = "passnavigay-evenements-v1";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const normaliser = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const jourParis = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
const texte = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};
const lien = (v: unknown): string | null => {
  const t = texte(v, 1000);
  if (!t) return null;
  try {
    const u = new URL(t);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
};
const nombre = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const dateIso = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const secret = req.headers.get("x-pn-cron") || "";
  if (secret.length < 32) return json({ error: "forbidden" }, 403);
  const { data: ok, error: errSecret } = await admin.rpc("pn_verifier_secret_import", { p_secret: secret });
  if (errSecret || ok !== true) return json({ error: "forbidden" }, 403);

  // 1. Le fichier de la semaine
  const rep = await fetch(`${SOURCE}?t=${Date.now()}`, { headers: { "Cache-Control": "no-cache" } });
  if (rep.status === 404) return json({ ok: true, ajoutes: 0, message: "aucun fichier cette semaine" });
  if (!rep.ok) return json({ error: `github ${rep.status}` }, 502);
  const brut = await rep.text();
  if (brut.length > 2_000_000) return json({ error: "fichier trop lourd" }, 413);

  let racine: { format?: unknown; genere_le?: unknown; evenements?: unknown };
  try {
    racine = JSON.parse(brut);
  } catch {
    return json({ error: "JSON illisible" }, 422);
  }
  if (racine?.format !== FORMAT || !Array.isArray(racine.evenements)) return json({ error: "format inattendu" }, 422);
  const genere = dateIso(racine.genere_le);
  if (genere && Date.now() - new Date(genere).getTime() > 10 * 86_400_000) {
    return json({ ok: true, ajoutes: 0, message: "fichier de plus de 10 jours, ignoré" });
  }

  // 2. Contrôles ligne par ligne (mêmes règles que l'import manuel)
  const maintenant = Date.now();
  const vus = new Set<string>();
  const ecartes: string[] = [];
  const valides: Record<string, unknown>[] = [];
  for (const [i, b] of (racine.evenements as unknown[]).slice(0, 500).entries()) {
    const e = (b ?? {}) as Record<string, unknown>;
    const titre = texte(e.titre, 200);
    const debut = dateIso(e.debut);
    const ville = texte(e.ville, 100);
    const source = lien(e.lien_source);
    const fin = dateIso(e.fin);
    const raison = !titre ? "titre" : !debut ? "date" : !ville ? "ville" : !source ? "source"
      : new Date(fin ?? debut).getTime() < maintenant ? "passé" : null;
    if (raison) { ecartes.push(`ligne ${i + 1} : ${raison}`); continue; }
    const cle = `${normaliser(titre!)}|${jourParis(debut!)}|${normaliser(ville!)}`;
    if (vus.has(cle)) { ecartes.push(`ligne ${i + 1} : doublon`); continue; }
    vus.add(cle);
    const lat = nombre(e.latitude), lng = nombre(e.longitude);
    const coordsOk = lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
    const gratuit = e.gratuit !== false;
    valides.push({
      dedupe_key: cle,
      title: titre,
      description: texte(e.description, 5000) ?? "",
      event_date: debut,
      end_date: fin && new Date(fin) > new Date(debut!) ? fin : null,
      venue_name: texte(e.lieu, 200),
      address: texte(e.adresse, 300),
      city: ville,
      latitude: coordsOk ? lat : null,
      longitude: coordsOk ? lng : null,
      theme: texte(e.theme, 60),
      is_free: gratuit,
      price: gratuit ? 0 : Math.round(Math.max(0, nombre(e.prix) ?? 0) * 100) / 100,
      source_url: source,
      source_name: texte(e.nom_source, 120),
      ticket_url: lien(e.lien_billetterie),
      lgbt_reason: texte(e.raison_lgbt, 1000),
      _etablissement: texte(e.etablissement_nom, 200),
    });
  }

  // 3. Déjà dans l'agenda (même titre, même jour) : ignoré
  let dejaAgenda = 0;
  let aGarder = valides;
  if (valides.length) {
    const dates = valides.map((v) => v.event_date as string).sort();
    const { data: existants } = await admin
      .from("events")
      .select("title, event_date")
      .gte("event_date", new Date(new Date(dates[0]).getTime() - 86_400_000).toISOString())
      .lte("event_date", new Date(new Date(dates[dates.length - 1]).getTime() + 86_400_000).toISOString());
    const connus = new Set((existants || []).map((x) => `${normaliser(x.title)}|${jourParis(x.event_date)}`));
    aGarder = valides.filter((v) => {
      const d = connus.has(`${normaliser(v.title as string)}|${jourParis(v.event_date as string)}`);
      if (d) dejaAgenda += 1;
      return !d;
    });
  }

  // 4. Rattachement à une fiche de l'annuaire si une seule correspondance
  const lignes = [];
  for (const v of aGarder) {
    const { _etablissement, ...ligne } = v;
    let establishment_id: string | null = null;
    if (typeof _etablissement === "string") {
      const { data: cand } = await admin
        .from("establishments")
        .select("id")
        .ilike("name", _etablissement.replace(/[%_]/g, ""))
        .ilike("city", `%${String(v.city).replace(/[%_]/g, "")}%`)
        .limit(2);
      if (cand && cand.length === 1) establishment_id = cand[0].id;
    }
    lignes.push({ ...ligne, status: "pending", establishment_id, import_batch: `auto ${jourParis(new Date().toISOString())}` });
  }

  // 5. Ajout en attente ; un événement déjà connu (en attente, publié ou rejeté) est ignoré
  let ajoutes = 0;
  if (lignes.length) {
    const { data, error } = await admin
      .from("event_drafts")
      .upsert(lignes, { onConflict: "dedupe_key", ignoreDuplicates: true })
      .select("id");
    if (error) return json({ error: error.message }, 500);
    ajoutes = data?.length || 0;
  }

  const bilan = { ok: true, ajoutes, deja_connus: lignes.length - ajoutes + dejaAgenda, ecartes: ecartes.length };
  console.log("import-evenements-hebdo", JSON.stringify({ ...bilan, details_ecartes: ecartes.slice(0, 20) }));
  return json(bilan);
});
