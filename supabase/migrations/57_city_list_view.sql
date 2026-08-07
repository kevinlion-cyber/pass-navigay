-- Liste des villes couvertes, pour le filtre de l'annuaire public.
--
-- On ne peut pas la deviner côté client : lire toutes les fiches pour en tirer
-- les villes coûterait des milliers de lignes (et PostgREST plafonne à 1000).
-- Cette vue agrège par ville de rattachement et par commune, ce qui fait
-- quelques dizaines de lignes, avec le centre géographique pour recentrer la
-- carte quand on choisit une ville.
--
-- `security_invoker` : la vue applique les droits de celui qui la lit, donc la
-- RLS de `establishments` continue de s'appliquer normalement.

create or replace view public_city_list
with (security_invoker = true) as
select
  city_slug,
  city,
  count(*)::int as n,
  avg(latitude)::float8 as lat,
  avg(longitude)::float8 as lng
from establishments
where city_slug is not null
  and city_slug <> ''
  and latitude is not null
  and longitude is not null
group by city_slug, city;

grant select on public_city_list to anon, authenticated;

comment on view public_city_list is
  'Villes couvertes par l''annuaire (une ligne par commune), pour le filtre public et le recentrage de la carte.';
