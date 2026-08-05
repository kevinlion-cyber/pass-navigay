-- Création d'une ville EN TÂCHE DE FOND.
--
-- Jusqu'ici tout le travail était piloté par le navigateur de l'admin : fermer
-- l'onglet arrêtait la création au milieu. Pour une ville de 350 lieux, c'est
-- 30 à 45 minutes de fenêtre à ne pas fermer, plus l'attente des avis. Ici on
-- pose une commande en base, et un worker appelé par pg_cron la fait avancer
-- morceau par morceau, côté serveur. L'interface ne fait plus que suivre.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists city_jobs (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  city_slug text not null,
  -- photos par fiche, avis DataForSEO ou non, profondeur, filtres qualité
  params jsonb not null default '{}'::jsonb,
  -- queued → searching → reviews (si avis) → writing → done | failed | cancelled
  status text not null default 'queued',
  step text not null default 'En attente de démarrage',
  total int not null default 0,
  done int not null default 0,
  failed int not null default 0,
  -- fiches écrites avec les 5 avis de Google faute d'avis en profondeur à temps
  shallow int not null default 0,
  candidates jsonb not null default '[]'::jsonb,
  -- place_id -> id de tâche DataForSEO, vidé au fur et à mesure
  dfs_tasks jsonb not null default '{}'::jsonb,
  cursor int not null default 0,
  error text,
  -- bail pris par un tour de worker, pour que deux tours ne se marchent pas dessus
  locked_until timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists city_jobs_status_idx on city_jobs (status, created_at);

-- Avis récupérés en attendant d'être consommés par la rédaction. Table à part :
-- stockés dans la ligne du job, plusieurs centaines de lieux × 100 avis
-- feraient une ligne énorme réécrite à chaque tour.
create table if not exists city_job_reviews (
  job_id uuid not null references city_jobs(id) on delete cascade,
  place_id text not null,
  reviews jsonb not null default '[]'::jsonb,
  primary key (job_id, place_id)
);

alter table city_jobs enable row level security;
alter table city_job_reviews enable row level security;

-- Lecture réservée aux admins (l'interface suit l'avancement) ; l'écriture passe
-- exclusivement par le service_role des Edge Functions.
drop policy if exists "city_jobs admin read" on city_jobs;
create policy "city_jobs admin read" on city_jobs for select using (public.is_admin());
drop policy if exists "city_job_reviews admin read" on city_job_reviews;
create policy "city_job_reviews admin read" on city_job_reviews for select using (public.is_admin());

comment on table city_jobs is
  'Création d''une ville en tâche de fond : avance par pg_cron même navigateur fermé.';
