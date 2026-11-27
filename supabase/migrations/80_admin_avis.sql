-- 80 — Admin : supprimer un avis ou réinitialiser tous les avis d'une fiche (27/11/2026)
--
-- Aujourd'hui seul l'auteur d'un avis peut le supprimer. On ajoute deux fonctions
-- réservées aux admins (is_admin() exige la double authentification) :
--   admin_supprimer_avis(id)            → supprime un avis
--   admin_reinitialiser_avis(fiche_id)  → supprime tous les avis d'une fiche
-- Chaque avis supprimé est d'abord copié dans `avis_supprimes` (filet de sécurité,
-- lisible par les admins seulement, purgé au bout d'un an).
-- Aucune donnée n'est modifiée par cette migration elle-même.

create table if not exists public.avis_supprimes (
  id uuid primary key,                -- identifiant d'origine de l'avis
  user_id uuid,
  establishment_id uuid,
  rating int,
  safety_rating int,
  comment text,
  created_at timestamptz,
  supprime_le timestamptz not null default now(),
  supprime_par uuid,
  motif text                          -- 'avis' ou 'reinitialisation'
);

alter table public.avis_supprimes enable row level security;
revoke all on public.avis_supprimes from anon, authenticated;
grant select on public.avis_supprimes to authenticated;
drop policy if exists "Admins lisent les avis supprimés" on public.avis_supprimes;
create policy "Admins lisent les avis supprimés" on public.avis_supprimes
  for select to authenticated using (coalesce(public.is_admin(), false));

create or replace function public.admin_supprimer_avis(p_review_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Réservé aux administrateurs' using errcode = '42501';
  end if;
  insert into public.avis_supprimes (id, user_id, establishment_id, rating, safety_rating, comment, created_at, supprime_par, motif)
    select r.id, r.user_id, r.establishment_id, r.rating, r.safety_rating, r.comment, r.created_at, auth.uid(), 'avis'
    from public.reviews r where r.id = p_review_id
  on conflict (id) do nothing;
  delete from public.reviews where id = p_review_id;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.admin_reinitialiser_avis(p_establishment_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Réservé aux administrateurs' using errcode = '42501';
  end if;
  insert into public.avis_supprimes (id, user_id, establishment_id, rating, safety_rating, comment, created_at, supprime_par, motif)
    select r.id, r.user_id, r.establishment_id, r.rating, r.safety_rating, r.comment, r.created_at, auth.uid(), 'reinitialisation'
    from public.reviews r where r.establishment_id = p_establishment_id
  on conflict (id) do nothing;
  delete from public.reviews where establishment_id = p_establishment_id;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.admin_supprimer_avis(uuid) from public, anon;
revoke all on function public.admin_reinitialiser_avis(uuid) from public, anon;
grant execute on function public.admin_supprimer_avis(uuid) to authenticated;
grant execute on function public.admin_reinitialiser_avis(uuid) to authenticated;

-- Purge des copies au bout d'un an (ajoutée à la tâche nocturne existante si elle est là).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'pn-purge-avis-supprimes';
    perform cron.schedule('pn-purge-avis-supprimes', '50 3 * * *',
      $c$delete from public.avis_supprimes where supprime_le < now() - interval '1 year'$c$);
  end if;
end $$;

-- Vérification (une seule ligne de résultat attendue : les trois colonnes à « true »)
select
  (to_regclass('public.avis_supprimes') is not null)::text as table_sauvegarde,
  (to_regprocedure('public.admin_supprimer_avis(uuid)') is not null)::text as fonction_un_avis,
  (to_regprocedure('public.admin_reinitialiser_avis(uuid)') is not null)::text as fonction_reinitialiser;
