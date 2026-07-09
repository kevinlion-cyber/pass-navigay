-- Supprimer un compte (profil) depuis l'admin doit emporter tout ce qui lui est rattaché :
-- ses établissements (et, en cascade, leurs photos/events/promos/avis/favoris), ses avis,
-- ses favoris, ses messages, ses utilisations de promo. Sinon la suppression échoue
-- (establishments_owner_id_fkey, etc. étaient en NO ACTION).

alter table establishments drop constraint establishments_owner_id_fkey;
alter table establishments add constraint establishments_owner_id_fkey
  foreign key (owner_id) references profiles(id) on delete cascade;

alter table favorites drop constraint favorites_user_id_fkey;
alter table favorites add constraint favorites_user_id_fkey
  foreign key (user_id) references profiles(id) on delete cascade;

alter table messages drop constraint messages_sender_id_fkey;
alter table messages add constraint messages_sender_id_fkey
  foreign key (sender_id) references profiles(id) on delete cascade;

alter table messages drop constraint messages_receiver_id_fkey;
alter table messages add constraint messages_receiver_id_fkey
  foreign key (receiver_id) references profiles(id) on delete cascade;

alter table promotion_uses drop constraint promotion_uses_user_id_fkey;
alter table promotion_uses add constraint promotion_uses_user_id_fkey
  foreign key (user_id) references profiles(id) on delete cascade;

alter table reviews drop constraint reviews_user_id_fkey;
alter table reviews add constraint reviews_user_id_fkey
  foreign key (user_id) references profiles(id) on delete cascade;
