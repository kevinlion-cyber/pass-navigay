-- Supprimer l'utilisateur d'authentification doit supprimer son profil (et, en cascade,
-- tout ce qui lui est rattaché). profiles.id -> auth.users passe en ON DELETE CASCADE
-- (comportement standard Supabase). Permet une suppression de compte 100% propre.
alter table profiles drop constraint profiles_id_fkey;
alter table profiles add constraint profiles_id_fkey
  foreign key (id) references auth.users(id) on delete cascade;
