-- Le détail d'une promotion devient visible par tout le monde. Ce qui reste réservé
-- aux membres Premium, c'est le BOUTON pour en profiter (décision Kevin) : on peut
-- regarder l'offre en entier, mais pas l'utiliser sans le pass.
--
-- La vue masquait encore `description`, donc la page de détail était vide de son
-- contenu pour un visiteur : rien n'expliquait ce qu'il gagnerait à s'abonner.
--
-- Aucune donnée sensible dans cette table : pas de code de réduction, pas de
-- coordonnées. La vue expose donc tout, et sert simplement de porte de lecture
-- publique (la table, elle, reste réservée par ses propres règles).
CREATE OR REPLACE VIEW public_promotions AS
SELECT
  id,
  establishment_id,
  title,
  description,
  promo_type,
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
