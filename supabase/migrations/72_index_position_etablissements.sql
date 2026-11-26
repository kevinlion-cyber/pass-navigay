-- 72 — Index sur la position des établissements (optimisation du 26/11/2026)
--
-- La carte demande à chaque mouvement « les lieux dont la latitude et la longitude
-- sont dans le cadre visible ». Sans index, la base parcourt tous les établissements.
-- Cet index ne modifie aucune donnée ; il accélère seulement ces recherches.
-- Retour arrière : DROP INDEX IF EXISTS public.establishments_position_idx;

CREATE INDEX IF NOT EXISTS establishments_position_idx
  ON public.establishments (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Notes de la liste : la recherche par établissement est déjà indexée
-- (idx_reviews_establishment). Rien à ajouter.
