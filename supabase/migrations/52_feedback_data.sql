-- Récupérer « ce que les gens pensent » (cahier des charges) :
--  1) les commentaires laissés sur NOS posts Facebook / Instagram
--  2) les avis Google des lieux (jusqu'ici récupérés à l'enrichissement puis JETÉS)

-- 1) Commentaires sur nos publications sociales.
create table if not exists public.social_comments (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid references public.social_posts(id) on delete cascade,
  platform     text not null,                 -- facebook | instagram
  comment_id   text not null unique,          -- id Meta (dédup)
  author       text,
  text         text,
  commented_at timestamptz,
  fetched_at   timestamptz not null default now()
);
create index if not exists social_comments_post_idx on public.social_comments(post_id, commented_at desc);
create index if not exists social_comments_date_idx on public.social_comments(commented_at desc);

alter table public.social_comments enable row level security;
drop policy if exists "social_comments admin read" on public.social_comments;
create policy "social_comments admin read" on public.social_comments
  for select to authenticated using (public.is_admin());

-- 2) Avis Google conservés (on arrête de les jeter).
alter table public.establishment_drafts add column if not exists google_reviews jsonb default '[]'::jsonb;
alter table public.establishments      add column if not exists google_reviews jsonb default '[]'::jsonb;
