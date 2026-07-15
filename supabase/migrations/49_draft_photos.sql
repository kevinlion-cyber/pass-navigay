-- Module 1 : stocker les photos des brouillons dès l'enrichissement (1 seul appel Google/lieu),
-- réutilisées partout (vignette admin, aperçu, publication). Bucket permanent par place_id.

insert into storage.buckets (id, name, public)
values ('place-photos', 'place-photos', true)
on conflict (id) do nothing;

alter table establishment_drafts add column if not exists thumb_url text;
alter table establishment_drafts add column if not exists photo_urls jsonb default '[]'::jsonb;
