-- Module 2 : intégration Meta (Instagram + Facebook) connectée en 1 clic via OAuth.
-- Ligne unique : les identifiants de publication de Pass Navigay, remplis par le
-- callback OAuth. Le token n'est jamais lu côté client (seulement par la fonction cron).

create table if not exists social_integrations (
  id integer primary key default 1,
  provider text not null default 'meta',
  page_id text,
  page_name text,
  page_access_token text,
  ig_user_id text,
  ig_username text,
  connected_at timestamptz,
  connected_by uuid references profiles(id),
  constraint social_integrations_single check (id = 1)
);

alter table social_integrations enable row level security;
-- Lecture admin autorisée, MAIS le front ne sélectionne jamais page_access_token.
drop policy if exists "integrations admin read" on social_integrations;
create policy "integrations admin read" on social_integrations for select to authenticated using (public.is_admin());
