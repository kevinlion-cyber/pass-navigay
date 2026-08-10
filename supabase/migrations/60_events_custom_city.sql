-- Ville d'un événement organisé hors établissement.
--
-- Le formulaire du gérant (et celui de l'administration) proposait un champ
-- « Ville » pour un événement sans établissement rattaché, mais la table n'avait
-- aucune colonne pour l'accueillir : la saisie était silencieusement jetée à
-- l'enregistrement. Un champ qui perd ce qu'on y écrit est pire que pas de champ.
--
-- La ville de rattachement d'un événement reste, quand il y a un établissement,
-- celle de l'établissement (`establishments.city_slug`). Cette colonne ne sert
-- qu'aux événements autonomes, pour qu'ils apparaissent dans le filtre Ville de
-- l'agenda au lieu de n'être visibles nulle part.
ALTER TABLE events ADD COLUMN IF NOT EXISTS custom_city text;

COMMENT ON COLUMN events.custom_city IS
  'Ville saisie pour un événement sans établissement rattaché. Sinon, la ville vient de establishments.city_slug.';
