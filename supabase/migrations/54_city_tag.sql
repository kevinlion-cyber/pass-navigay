-- Ville de rattachement, indépendante de l'adresse.
--
-- Jusqu'ici on déduisait la « ville » d'un lieu de son adresse (colonne `city`),
-- ce qui donnait autant de villes que de communes : Lattes, Pérols,
-- Castelnau-le-Lez, Sète… apparaissaient comme des villes distinctes alors que
-- ce sont des lieux DE Montpellier du point de vue du guide.
--
-- On sépare donc les deux notions :
--   `city`      → l'adresse réelle, inchangée et toujours exacte (« Lattes »)
--   `city_slug` → la ville du guide à laquelle le lieu est rattaché (« montpellier »)
--
-- C'est `city_slug` qui pilote l'annuaire et les pages SEO /annuaire/:ville.
-- Un sauna à Lattes est un lieu de Montpellier : il apparaît sur la page
-- Montpellier, tout en affichant sa vraie adresse.

alter table establishments add column if not exists city_slug text;
alter table establishment_drafts add column if not exists city_slug text;

-- Tout l'existant appartient à Montpellier (l'annuaire n'a couvert que cette
-- agglomération jusqu'à présent, communes limitrophes comprises).
update establishments set city_slug = 'montpellier' where city_slug is null;
update establishment_drafts set city_slug = 'montpellier' where city_slug is null;

create index if not exists establishments_city_slug_idx on establishments (city_slug);
create index if not exists establishment_drafts_city_slug_idx on establishment_drafts (city_slug);

comment on column establishments.city_slug is
  'Ville du guide à laquelle le lieu est rattaché (ex. "montpellier"), indépendante de l''adresse. Pilote /annuaire/:ville.';
comment on column establishment_drafts.city_slug is
  'Ville du guide à laquelle le brouillon est rattaché, reprise depuis la ville balayée.';
