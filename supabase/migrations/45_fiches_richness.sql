-- Module 1 : enrichir les fiches (horaires, niveau de prix, équipements) depuis Google.
-- Stockés d'abord sur le brouillon (capturés à l'enrichissement), copiés sur l'établissement à la publication.

alter table establishment_drafts add column if not exists opening_hours jsonb default '{}'::jsonb;
alter table establishment_drafts add column if not exists price_level integer;
alter table establishment_drafts add column if not exists amenities jsonb default '[]'::jsonb;

-- establishments.opening_hours existe déjà (migration horaires). On ajoute prix + équipements.
alter table establishments add column if not exists price_level integer;
alter table establishments add column if not exists amenities jsonb default '[]'::jsonb;
