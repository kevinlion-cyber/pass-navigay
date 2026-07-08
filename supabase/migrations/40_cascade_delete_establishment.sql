-- Supprimer un établissement doit supprimer ses avis et favoris liés (comme photos/events/promos
-- qui cascadaient déjà). Sinon la suppression échoue sur reviews_establishment_id_fkey / favorites.

alter table reviews drop constraint reviews_establishment_id_fkey;
alter table reviews add constraint reviews_establishment_id_fkey
  foreign key (establishment_id) references establishments(id) on delete cascade;

alter table favorites drop constraint favorites_establishment_id_fkey;
alter table favorites add constraint favorites_establishment_id_fkey
  foreign key (establishment_id) references establishments(id) on delete cascade;
