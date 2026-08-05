import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, getAuthenticatedUser, jsonResponse, serviceClient } from "../_shared/auth.ts";
import {
  buildQueries, searchText, passesGate, isRealVenue,
  dfsAuth, dfsPostReviewTasks, dfsFetchReviews, writeDraft,
} from "../_shared/fiches.ts";

// Création d'une ville EN TÂCHE DE FOND (appelée chaque minute par pg_cron).
//
// L'interface ne fait plus que poser une commande dans `city_jobs` : c'est ici
// que le travail avance, morceau par morceau, côté serveur. L'admin peut fermer
// son navigateur, éteindre son ordinateur, la ville continue de se construire.
//
// Un tour = un morceau borné dans le temps (une Edge Function ne tourne pas
// indéfiniment). Le cron rappelle à la minute suivante, le job reprend où il en
// était. Un bail (`locked_until`) évite que deux tours se marchent dessus.

const TICK_MS = 70_000;           // durée max d'un tour, marge sous la limite
const DFS_DEADLINE_MIN = 40;      // au-delà, on écrit avec les 5 avis de Google
const REVIEWS_BATCH = 200;        // relectures d'avis max par tour

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  const started = Date.now();
  const timeLeft = () => TICK_MS - (Date.now() - started);

  try {
    // Appelé soit par le cron (secret partagé), soit par un admin qui veut
    // relancer un tour immédiatement sans attendre la minute suivante.
    const secret = Deno.env.get("SOCIAL_CRON_SECRET");
    const fromCron = !!secret && req.headers.get("x-cron-secret") === secret;
    if (!fromCron) {
      const user = await getAuthenticatedUser(req);
      if (!user) return jsonResponse({ error: "Non authentifié" }, 401);
      const svcCheck = serviceClient();
      const { data: me } = await svcCheck.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
      if (!me?.is_admin) return jsonResponse({ error: "Accès refusé" }, 403);
    }

    const svc = serviceClient();

    // L'interface passe par ici pour poser ou annuler une commande : l'écriture
    // de `city_jobs` reste interdite au client (RLS lecture seule).
    if (!fromCron) {
      const body = await req.json().catch(() => ({}));
      if (body.action === "create") {
        const owner = (Deno.env.get("ANTHROPIC_KEY_OWNER") || "flpower").toLowerCase();
        if (owner !== "kevin") {
          return jsonResponse({ error: `Création bloquée : la clé Claude configurée n'appartient pas à Kevin (ANTHROPIC_KEY_OWNER = "${owner}").` }, 403);
        }
        const { data: running } = await svc.from("city_jobs").select("id,city").in("status", ["queued", "reviews", "writing"]).limit(1);
        if (running?.length) return jsonResponse({ error: `Une création est déjà en cours (${running[0].city}). Attendez qu'elle finisse.` }, 409);

        const { data: created, error } = await svc.from("city_jobs").insert({
          city: String(body.city || "").trim(),
          city_slug: String(body.city_slug || "").trim(),
          params: {
            photos: body.photos, use_dfs: !!body.use_dfs, depth: body.depth,
            min_rating: body.min_rating, min_reviews: body.min_reviews,
          },
        }).select().single();
        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({ job: created });
      }
      if (body.action === "cancel") {
        await svc.from("city_jobs").update({ status: "cancelled", step: "Annulé", locked_until: null, finished_at: new Date().toISOString() }).eq("id", body.job_id);
        await svc.from("city_job_reviews").delete().eq("job_id", body.job_id);
        return jsonResponse({ cancelled: true });
      }
    }

    const placesKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    const model = Deno.env.get("FICHES_MODEL") || "claude-sonnet-5";
    if (!placesKey || !anthropicKey) return jsonResponse({ error: "Clés Places/Anthropic manquantes" }, 500);

    // ── On prend un job en attente et on pose un bail ────────────────────────
    const now = new Date().toISOString();
    const { data: jobs } = await svc.from("city_jobs")
      .select("*")
      .in("status", ["queued", "reviews", "writing"])
      .or(`locked_until.is.null,locked_until.lt.${now}`)
      .order("created_at", { ascending: true })
      .limit(1);
    const job = jobs?.[0];
    if (!job) return jsonResponse({ idle: true });

    const lease = new Date(Date.now() + 5 * 60_000).toISOString();
    await svc.from("city_jobs").update({ locked_until: lease }).eq("id", job.id);

    const save = (patch: Record<string, unknown>) =>
      svc.from("city_jobs").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", job.id);

    const params = job.params || {};
    const photos = Math.max(0, Math.min(Number(params.photos ?? 3), 5));
    const useDfs = !!params.use_dfs;
    const depth = Math.max(10, Math.min(Number(params.depth ?? 100), 1000));

    // ── 1) Découverte des lieux ──────────────────────────────────────────────
    if (job.status === "queued") {
      await save({ status: "queued", step: `Recherche des lieux à ${job.city}…` });

      const seen = new Set<string>();
      const est = await svc.from("establishments").select("place_id");
      for (const e of est.data || []) if (e.place_id) seen.add(e.place_id);
      const dr = await svc.from("establishment_drafts").select("place_id").neq("status", "rejected");
      for (const d of dr.data || []) if (d.place_id) seen.add(d.place_id);

      const byId = new Map<string, Record<string, unknown>>();
      for (const q of buildQueries(job.city, null)) {
        if (timeLeft() < 8_000) break; // on reprendra au tour suivant si besoin
        let places: Record<string, unknown>[] = [];
        try { places = await searchText(placesKey, q.textQuery, 60); } catch { continue; }
        for (const p of places) {
          const pid = p.place_id as string;
          if (!pid || byId.has(pid) || seen.has(pid)) continue;
          if (!isRealVenue(p.primary_type as string)) continue;
          if (!passesGate(p, Number(params.min_rating ?? 4), Number(params.min_reviews ?? 20))) continue;
          byId.set(pid, { ...p, category: q.category, discovery_query: `${q.query} @ ${job.city}` });
        }
      }

      const candidates = [...byId.values()].sort(
        (a, b) => ((b.google_rating_count as number) ?? 0) - ((a.google_rating_count as number) ?? 0),
      );
      if (!candidates.length) {
        await save({ status: "failed", error: "Aucun lieu trouvé avec ces filtres.", step: "Terminé sans résultat", locked_until: null, finished_at: new Date().toISOString() });
        return jsonResponse({ job: job.id, result: "aucun lieu" });
      }

      await save({
        candidates,
        total: candidates.length,
        cursor: 0,
        status: useDfs ? "reviews" : "writing",
        step: useDfs ? `${candidates.length} lieux trouvés. Demande des avis…` : `${candidates.length} lieux trouvés. Rédaction…`,
        locked_until: null,
      });
      return jsonResponse({ job: job.id, found: candidates.length });
    }

    const candidates: Record<string, unknown>[] = job.candidates || [];

    // ── 2) Avis en profondeur (DataForSEO) ───────────────────────────────────
    if (job.status === "reviews") {
      const auth = dfsAuth();
      if (!auth) {
        await save({ status: "writing", step: "Identifiants DataForSEO absents : rédaction avec les avis de Google.", locked_until: null });
        return jsonResponse({ job: job.id, note: "dfs indisponible" });
      }

      let tasks: Record<string, string> = job.dfs_tasks || {};

      // Première fois : on pose toutes les tâches (le helper découpe par 100).
      if (!params.dfs_posted) {
        tasks = await dfsPostReviewTasks(auth, candidates.map((c) => ({ place_id: c.place_id as string })), depth);
        await save({
          dfs_tasks: tasks,
          params: { ...params, dfs_posted: true },
          step: `Avis demandés pour ${Object.keys(tasks).length} lieux. Comptez 10 à 15 min.`,
          locked_until: null,
        });
        return jsonResponse({ job: job.id, posted: Object.keys(tasks).length });
      }

      // On relit ce qui est prêt, dans la limite du temps du tour.
      let collected = 0;
      const entries = Object.entries(tasks);
      for (const [placeId, taskId] of entries.slice(0, REVIEWS_BATCH)) {
        if (timeLeft() < 5_000) break;
        const reviews = await dfsFetchReviews(auth, taskId);
        if (!reviews) continue;
        await svc.from("city_job_reviews").upsert({ job_id: job.id, place_id: placeId, reviews });
        delete tasks[placeId];
        collected++;
      }

      const tropVieux = Date.now() - new Date(job.created_at).getTime() > DFS_DEADLINE_MIN * 60_000;
      const reste = Object.keys(tasks).length;
      if (reste === 0 || tropVieux) {
        await save({
          dfs_tasks: {},
          status: "writing",
          shallow: reste, // ceux qui n'ont jamais répondu : 5 avis de Google
          step: reste ? `Rédaction… (${reste} lieux sans avis en profondeur)` : "Tous les avis sont là. Rédaction…",
          locked_until: null,
        });
      } else {
        await save({ dfs_tasks: tasks, step: `Récupération des avis… ${candidates.length - reste}/${candidates.length}`, locked_until: null });
      }
      return jsonResponse({ job: job.id, collected, pending: reste });
    }

    // ── 3) Rédaction des fiches ──────────────────────────────────────────────
    if (job.status === "writing") {
      let cursor = job.cursor || 0;
      let done = job.done || 0;
      let failed = job.failed || 0;

      while (cursor < candidates.length && timeLeft() > 15_000) {
        const it = candidates[cursor];
        const placeId = it.place_id as string;
        try {
          const { data: rev } = await svc.from("city_job_reviews")
            .select("reviews").eq("job_id", job.id).eq("place_id", placeId).maybeSingle();
          await writeDraft(svc, { placesKey, anthropicKey, model }, it, {
            photos,
            citySlug: job.city_slug,
            deepReviews: (rev?.reviews as unknown[]) ?? null,
          });
          if (rev) await svc.from("city_job_reviews").delete().eq("job_id", job.id).eq("place_id", placeId);
          done++;
        } catch {
          failed++; // on n'arrête pas toute la ville pour un lieu
        }
        cursor++;
        await save({ cursor, done, failed, step: `Rédaction des fiches… ${done}/${candidates.length}` });
      }

      if (cursor >= candidates.length) {
        await svc.from("city_job_reviews").delete().eq("job_id", job.id);
        await save({
          status: "done",
          step: `${done} fiches créées${failed ? `, ${failed} en échec` : ""}. À publier dans « Fiches auto ».`,
          candidates: [], // on n'a plus besoin de garder la liste
          locked_until: null,
          finished_at: new Date().toISOString(),
        });
      } else {
        await save({ locked_until: null });
      }
      return jsonResponse({ job: job.id, done, failed, cursor, total: candidates.length });
    }

    await save({ locked_until: null });
    return jsonResponse({ job: job.id, status: job.status });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Erreur" }, 500);
  }
});
