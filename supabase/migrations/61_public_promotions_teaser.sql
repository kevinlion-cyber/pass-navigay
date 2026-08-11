-- Les promotions deviennent une vitrine : tout le monde voit CE QU'IL Y A À GAGNER,
-- et il faut un compte pour en profiter (le détail, le bouton « utiliser »).
--
-- Avant, la vue publique masquait à la fois la valeur de la réduction ET la
-- description : la liste était floutée en entier derrière « réservé aux membres ».
-- Personne ne pouvait avoir envie de quelque chose qu'il ne voyait pas.
--
-- On expose donc `value` (le « -20 % », c'est l'accroche) et on garde `description`
-- masquée : c'est le contenu du détail, ce qui explique comment en profiter, donc
-- ce qui reste derrière le compte.
CREATE OR REPLACE VIEW public_promotions AS
SELECT
  id,
  establishment_id,
  title,
  NULL::text AS description,   -- le détail reste réservé
  promo_type,
  -- La réduction devient visible : c'est ce qui donne envie. Le cast garde le type
  -- exact de la vue existante (`numeric` sans précision, la colonne étant
  -- numeric(10,2)) : sans lui, on ne peut pas remplacer la vue en place.
  value::numeric AS value,
  image_url,
  valid_from,
  valid_until,
  is_recurring,
  recurrence_rule,
  max_uses,
  current_uses,
  created_at,
  is_active,
  is_permanent
FROM promotions;
