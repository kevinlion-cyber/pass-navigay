-- 77 — Favoris privés + comptage pour la page Membres (27/11/2026)
--
-- PROBLÈME : une ancienne règle (migration du 13/04/2026, « Anonymous users can view
-- favorites count ») laissait N'IMPORTE QUEL visiteur non connecté lire TOUTE la table
-- des favoris : quel membre a mis quel lieu en favori (sauna, sex-shop, bar…). Croisé
-- avec le pseudo et la photo visibles publiquement, cela pouvait révéler des habitudes
-- intimes. Aucune page du site n'en a besoin (la page Membres ne montre rien aux
-- visiteurs) : on supprime la règle.
--
-- La page Membres affichait « X lieux favoris » en téléchargeant toute la table. On la
-- remplace par une fonction qui ne renvoie que des NOMBRES, pour 100 membres au plus,
-- et seulement à un membre connecté.

DROP POLICY IF EXISTS "Anonymous users can view favorites count" ON public.favorites;

CREATE OR REPLACE FUNCTION public.member_favorites_counts(p_ids uuid[])
RETURNS TABLE (user_id uuid, n integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT f.user_id, count(*)::integer
  FROM public.favorites f
  WHERE auth.uid() IS NOT NULL
    AND f.user_id = ANY (p_ids[1:100])
  GROUP BY f.user_id;
$$;

REVOKE ALL ON FUNCTION public.member_favorites_counts(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.member_favorites_counts(uuid[]) TO authenticated;

-- Accélère la liste des membres (tri par date d'inscription).
CREATE INDEX IF NOT EXISTS profiles_created_at_idx ON public.profiles (created_at DESC);
