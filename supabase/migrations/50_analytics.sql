-- Module 5 : analytics first-party (en base, sans cookie ni outil externe).
-- Deux tables : les événements bruts + l'agrégat par session (visiteur).
-- Écriture/lecture réservées au service role (Edge Functions track / analytics) :
-- aucune policy publique → un client anon ne peut NI lire NI écrire directement.

create table if not exists public.analytics_events (
  id               bigint generated always as identity primary key,
  session_id       text not null,
  name             text not null,
  path             text,
  establishment_id uuid references public.establishments(id) on delete set null,
  user_id          uuid references public.profiles(id) on delete set null,
  payload          jsonb not null default '{}'::jsonb,
  referrer         text,
  utm_source       text,
  utm_medium       text,
  utm_campaign     text,
  created_at       timestamptz not null default now()
);

create index if not exists analytics_events_created_idx on public.analytics_events (created_at desc);
create index if not exists analytics_events_name_created_idx on public.analytics_events (name, created_at desc);
create index if not exists analytics_events_est_idx on public.analytics_events (establishment_id, created_at desc) where establishment_id is not null;
create index if not exists analytics_events_session_idx on public.analytics_events (session_id);

create table if not exists public.analytics_identities (
  session_id   text primary key,
  user_id      uuid references public.profiles(id) on delete set null,
  first_seen   timestamptz not null default now(),
  last_seen    timestamptz not null default now(),
  referrer     text,
  utm_source   text,
  utm_medium   text,
  utm_campaign text,
  city         text,
  country      text,
  user_agent   text,
  page_views   integer not null default 0
);

create index if not exists analytics_identities_first_seen_idx on public.analytics_identities (first_seen desc);

alter table public.analytics_events enable row level security;
alter table public.analytics_identities enable row level security;
