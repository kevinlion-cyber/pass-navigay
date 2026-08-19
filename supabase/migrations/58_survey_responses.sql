-- Réponses au questionnaire de Kevin (page publique /questionnaire).
--
-- Les réponses sont stockées telles quelles dans un objet JSON, une clé par
-- question : on peut ajouter ou reformuler des questions plus tard sans casser
-- ce qui a déjà été répondu, et sans migration à chaque fois.

create table if not exists survey_responses (
  id uuid primary key default gen_random_uuid(),
  answers jsonb not null default '{}'::jsonb,
  -- Sorti du JSON pour pouvoir lister les gens à recontacter d'un coup d'œil.
  email text,
  recontact boolean not null default false,
  -- Rattache la réponse au parcours du visiteur dans les statistiques du site.
  session_id text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists survey_responses_created_idx on survey_responses (created_at desc);

alter table survey_responses enable row level security;

-- Tout le monde peut répondre (le questionnaire est public et anonyme)…
drop policy if exists "survey insert public" on survey_responses;
create policy "survey insert public" on survey_responses
  for insert to anon, authenticated with check (true);

-- …mais personne ne peut relire les réponses des autres, sauf un administrateur.
drop policy if exists "survey read admin" on survey_responses;
create policy "survey read admin" on survey_responses
  for select using (public.is_admin());

comment on table survey_responses is
  'Réponses au questionnaire public. Écriture ouverte, lecture réservée aux administrateurs.';
