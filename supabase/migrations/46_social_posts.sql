-- Module 2 (Pack Évolution) : machine de contenu social quotidien.
-- Journal des posts générés/publiés + suivi de la rotation (ne pas remettre en avant
-- toujours les mêmes lieux). Publication auto quotidienne sur Instagram + Facebook.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists social_posts (
  id uuid primary key default gen_random_uuid(),
  kind text not null,                       -- 'establishment' | 'event'
  establishment_id uuid references establishments(id) on delete set null,
  event_id uuid references events(id) on delete set null,
  caption text default '',
  image_url text,                           -- visuel publié
  link_url text,                            -- lien tracké (CTA avis) vers la fiche
  platforms jsonb default '[]'::jsonb,      -- ['instagram','facebook']
  ig_media_id text,
  fb_post_id text,
  status text not null default 'generated', -- generated | posted | partial | failed
  error text default '',
  created_at timestamptz not null default now(),
  posted_at timestamptz
);

create index if not exists social_posts_created_idx on social_posts(created_at desc);

-- Rotation : dernière mise en avant sociale par lieu / événement.
alter table establishments add column if not exists last_social_at timestamptz;
alter table events add column if not exists last_social_at timestamptz;

-- RLS : lecture admin, écriture service_role (le cron/Edge Function).
alter table social_posts enable row level security;
drop policy if exists "social admin read" on social_posts;
create policy "social admin read" on social_posts for select to authenticated using (public.is_admin());
