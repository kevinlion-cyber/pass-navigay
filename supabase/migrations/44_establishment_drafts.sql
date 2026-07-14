-- Module 1 (Pack Évolution) : moteur de fiches auto.
-- Table des CANDIDATS découverts automatiquement (Google Places) puis enrichis par l'IA.
-- Règle absolue : un draft n'est JAMAIS public. Il devient un establishment uniquement
-- après validation admin explicite. RLS admin-only ; le pipeline écrit en service_role.

create table if not exists establishment_drafts (
  id uuid primary key default gen_random_uuid(),
  place_id text not null unique,              -- identifiant Google Places (dédup)

  -- Données brutes issues de Google Places
  name text not null,
  address text default '',
  city text default '',
  postal_code text default '',
  latitude double precision,
  longitude double precision,
  phone text default '',
  website text default '',
  google_rating double precision,
  google_rating_count integer,
  google_primary_type text default '',
  google_reviews jsonb default '[]'::jsonb,   -- jusqu'à 5 avis renvoyés par l'API officielle
  raw jsonb default '{}'::jsonb,              -- payload Places complet (traçabilité)

  -- Catégorie PN visée par la requête de découverte
  category text not null,
  discovery_query text default '',            -- la requête ville×catégorie qui l'a trouvé

  -- Champs générés par l'IA (null tant que non enrichi)
  ai_description text,
  ai_subcategory text,
  ai_tags text[] default '{}',
  gay_friendly jsonb,                         -- { signal, score, citations[], vigilance, confidence }
  ai_model text,
  ai_generated_at timestamptz,

  -- Workflow de validation
  status text not null default 'pending',     -- pending | enriched | approved | rejected
  reject_reason text default '',
  published_establishment_id uuid references establishments(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists establishment_drafts_status_idx on establishment_drafts(status);
create index if not exists establishment_drafts_city_idx on establishment_drafts(city);

-- Dédup côté establishments : on garde le place_id des fiches déjà en ligne
-- pour ne jamais re-proposer un lieu déjà présent au catalogue.
alter table establishments add column if not exists place_id text;
create index if not exists establishments_place_id_idx on establishments(place_id) where place_id is not null;

-- RLS : lecture/écriture réservées à l'admin (le pipeline passe en service_role et bypass RLS).
alter table establishment_drafts enable row level security;

drop policy if exists "drafts admin select" on establishment_drafts;
create policy "drafts admin select" on establishment_drafts
  for select to authenticated using (public.is_admin());

drop policy if exists "drafts admin insert" on establishment_drafts;
create policy "drafts admin insert" on establishment_drafts
  for insert to authenticated with check (public.is_admin());

drop policy if exists "drafts admin update" on establishment_drafts;
create policy "drafts admin update" on establishment_drafts
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "drafts admin delete" on establishment_drafts;
create policy "drafts admin delete" on establishment_drafts
  for delete to authenticated using (public.is_admin());

-- Maintien de updated_at
create or replace function public.touch_establishment_drafts()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_establishment_drafts on establishment_drafts;
create trigger trg_touch_establishment_drafts
  before update on establishment_drafts
  for each row execute function public.touch_establishment_drafts();
