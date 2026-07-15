-- Module 3 : relance propriétaires + parcours « Revendique ta page ».
-- Demandes de revendication (validées par l'admin) + email de contact découvert + suivi relance.

create table if not exists establishment_claims (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references establishments(id) on delete cascade,
  email text not null,
  claimant_profile_id uuid references profiles(id) on delete set null,
  status text not null default 'pending',   -- pending | approved | rejected
  message text default '',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references profiles(id)
);
create index if not exists establishment_claims_status_idx on establishment_claims(status);
create index if not exists establishment_claims_estab_idx on establishment_claims(establishment_id);

-- Email de contact découvert (scraping du site) + suivi de la relance.
alter table establishments add column if not exists contact_email text;
alter table establishments add column if not exists outreach_sent_at timestamptz;

alter table establishment_claims enable row level security;

-- Le proprio (connecté) crée sa demande pour lui-même ; lit les siennes. L'admin voit/gère tout.
drop policy if exists "claims insert own" on establishment_claims;
create policy "claims insert own" on establishment_claims
  for insert to authenticated with check (auth.uid() = claimant_profile_id);
drop policy if exists "claims select own or admin" on establishment_claims;
create policy "claims select own or admin" on establishment_claims
  for select to authenticated using (auth.uid() = claimant_profile_id or public.is_admin());
drop policy if exists "claims admin update" on establishment_claims;
create policy "claims admin update" on establishment_claims
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
