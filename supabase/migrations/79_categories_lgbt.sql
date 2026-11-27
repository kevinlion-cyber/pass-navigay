-- 79 — Refonte des catégories et sous-catégories (validée par Kévin, 27/11/2026)
--
-- * Nouvelle liste : 10 catégories (6 renommées avec une touche LGBT + Communauté & santé,
--   Pros safe, Sport & plein air, Coquin 18+), sous-catégories claires et accentuées.
-- * Les CLÉS ne changent pas (se_loger, manger…) : adresses des pages, icônes et
--   référencement restent valables. Seuls les noms affichés changent.
-- * Les fiches existantes sont reclassées avec la table de correspondance ci-dessous
--   (« Vetements » → « Mode & vêtements », bars à vins → Sortir, sex-shops → Coquin 18+…),
--   pour qu'aucune ne sorte des filtres. Comparaison sans accents ni majuscules.
-- * Une sauvegarde de l'ancien classement est gardée (table categories_avant_79) pour
--   pouvoir revenir en arrière.
-- * À la fin, deux listes s'affichent : les fiches au nom de sous-catégorie inconnu
--   (à reclasser à la main) et les saunas (à déplacer ou non dans « Coquin 18+ »).

-- 0. Sauvegarde
CREATE TABLE IF NOT EXISTS public.categories_avant_79 AS
  SELECT 'establishments'::text AS source, id, category, subcategory FROM public.establishments
  UNION ALL
  SELECT 'establishment_drafts', id, category, ai_subcategory FROM public.establishment_drafts;
ALTER TABLE public.categories_avant_79 ENABLE ROW LEVEL SECURITY;
INSERT INTO public.app_settings (key, value, updated_at)
SELECT 'categories_config_avant_79', value, now() FROM public.app_settings WHERE key = 'categories_config'
ON CONFLICT (key) DO NOTHING;

-- 1. Nouvelle liste (Admin → Catégories la reprend et permet de l'ajuster ensuite)
INSERT INTO public.app_settings (key, value, updated_at)
VALUES ('categories_config', '{"se_loger": {"label": "Dormir safe", "subcategories": ["Maison d''hôtes", "Hôtel", "Location entre particuliers", "Gîte", "Camping", "Auberge de jeunesse"]}, "manger": {"label": "Se régaler", "subcategories": ["Restaurant", "Brunch", "Café", "Salon de thé", "Fast-food", "Boulangerie & pâtisserie", "Traiteur"]}, "soiree": {"label": "Sortir & faire la fête", "subcategories": ["Bar gay", "Bar lesbien", "Bar queer & inclusif", "Bar chill", "Bar musical", "Bar à cocktails", "Bar à vins", "Club & boîte de nuit", "Cabaret & drag", "Karaoké"]}, "shopping": {"label": "Shopping & pépites", "subcategories": ["Mode & vêtements", "Friperie & seconde main", "Chaussures", "Bijoux & accessoires", "Déco & maison", "Art & créateurs", "Librairie", "Fleuriste", "Jeux"]}, "bien_etre": {"label": "Prendre soin de soi", "subcategories": ["Spa & hammam", "Sauna", "Massage", "Esthétique", "Coiffure & barbier"]}, "culture": {"label": "Culture & spectacles", "subcategories": ["Musée", "Galerie d''art", "Théâtre", "Cinéma", "Concert & spectacle", "Visite guidée", "Festival", "Autres"]}, "communaute": {"label": "Communauté & santé", "subcategories": ["Centre LGBT", "Association", "Santé sexuelle & dépistage", "Écoute & soutien"]}, "services": {"label": "Pros safe", "subcategories": ["Tatouage & piercing", "Photographe", "Avocat & juriste", "Psy & thérapeute", "Agence voyage & mariage", "Autres services"]}, "sport": {"label": "Sport & plein air", "subcategories": ["Club sportif LGBT", "Salle de sport", "Danse", "Yoga", "Escalade", "Plage", "Plage naturiste", "Rando & nature"]}, "adulte": {"label": "Coquin 18+", "subcategories": ["Sauna gay", "Sex-shop & lingerie", "Bar cruising & fetish", "Club sexe & backroom", "Club libertin", "Cinéma adulte"]}}', now())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- 2. Reclassement des fiches existantes
UPDATE public.establishments e
SET category = m.cat, subcategory = m.sous
FROM (VALUES
  ('se_loger','maison d''hotes','se_loger','Maison d''hôtes'),
  ('se_loger','hotel','se_loger','Hôtel'),
  ('se_loger','location particuliere','se_loger','Location entre particuliers'),
  ('shopping','vetements','shopping','Mode & vêtements'),
  ('shopping','deco','shopping','Déco & maison'),
  ('shopping','art','shopping','Art & créateurs'),
  ('shopping','chaussures','shopping','Chaussures'),
  ('shopping','sex-shop','adulte','Sex-shop & lingerie'),
  ('shopping','jeux','shopping','Jeux'),
  ('manger','restaurant','manger','Restaurant'),
  ('manger','fast-food','manger','Fast-food'),
  ('manger','brunch','manger','Brunch'),
  ('manger','salon de the','manger','Salon de thé'),
  ('manger','bar a vins','soiree','Bar à vins'),
  ('soiree','bar tranquille','soiree','Bar chill'),
  ('soiree','bar musical','soiree','Bar musical'),
  ('soiree','boite de nuit','soiree','Club & boîte de nuit'),
  ('bien_etre','sauna','bien_etre','Sauna'),
  ('bien_etre','massage','bien_etre','Massage'),
  ('bien_etre','esthetique','bien_etre','Esthétique'),
  ('culture','musee','culture','Musée'),
  ('culture','visite guidee','culture','Visite guidée'),
  ('culture','concert','culture','Concert & spectacle'),
  ('culture','cinema','culture','Cinéma'),
  ('culture','autres','culture','Autres')
) AS m(ancienne_cat, ancienne_sous, cat, sous)
WHERE e.category = m.ancienne_cat AND lower(trim(translate(coalesce(e.subcategory, ''), 'àâäáéèêëíîïóôöúùûüçÀÂÄÁÉÈÊËÍÎÏÓÔÖÚÙÛÜÇ', 'aaaaeeeeiiiioooouuuucAAAAEEEEIIIIOOOOUUUUC'))) = m.ancienne_sous;

UPDATE public.establishment_drafts d
SET category = m.cat, ai_subcategory = m.sous
FROM (VALUES
  ('se_loger','maison d''hotes','se_loger','Maison d''hôtes'),
  ('se_loger','hotel','se_loger','Hôtel'),
  ('se_loger','location particuliere','se_loger','Location entre particuliers'),
  ('shopping','vetements','shopping','Mode & vêtements'),
  ('shopping','deco','shopping','Déco & maison'),
  ('shopping','art','shopping','Art & créateurs'),
  ('shopping','chaussures','shopping','Chaussures'),
  ('shopping','sex-shop','adulte','Sex-shop & lingerie'),
  ('shopping','jeux','shopping','Jeux'),
  ('manger','restaurant','manger','Restaurant'),
  ('manger','fast-food','manger','Fast-food'),
  ('manger','brunch','manger','Brunch'),
  ('manger','salon de the','manger','Salon de thé'),
  ('manger','bar a vins','soiree','Bar à vins'),
  ('soiree','bar tranquille','soiree','Bar chill'),
  ('soiree','bar musical','soiree','Bar musical'),
  ('soiree','boite de nuit','soiree','Club & boîte de nuit'),
  ('bien_etre','sauna','bien_etre','Sauna'),
  ('bien_etre','massage','bien_etre','Massage'),
  ('bien_etre','esthetique','bien_etre','Esthétique'),
  ('culture','musee','culture','Musée'),
  ('culture','visite guidee','culture','Visite guidée'),
  ('culture','concert','culture','Concert & spectacle'),
  ('culture','cinema','culture','Cinéma'),
  ('culture','autres','culture','Autres')
) AS m(ancienne_cat, ancienne_sous, cat, sous)
WHERE d.category = m.ancienne_cat AND lower(trim(translate(coalesce(d.ai_subcategory, ''), 'àâäáéèêëíîïóôöúùûüçÀÂÄÁÉÈÊËÍÎÏÓÔÖÚÙÛÜÇ', 'aaaaeeeeiiiioooouuuucAAAAEEEEIIIIOOOOUUUUC'))) = m.ancienne_sous;

-- 3. Contrôle (une seule liste, affichée dans le SQL Editor) :
--    « À reclasser » = sous-catégorie absente de la nouvelle liste ;
--    « Sauna à vérifier » = dites à Claude lesquels sont des saunas gays (→ Coquin 18+).
--    Liste vide = tout est bien classé.
SELECT 'À reclasser à la main' AS controle, e.name, e.city, e.category, e.subcategory
FROM public.establishments e
WHERE NOT EXISTS (
  SELECT 1 FROM jsonb_each((SELECT value::jsonb FROM public.app_settings WHERE key = 'categories_config')) c(k, v),
       jsonb_array_elements_text(c.v->'subcategories') s
  WHERE c.k = e.category AND s = e.subcategory
)
UNION ALL
SELECT 'Sauna à vérifier', e.name, e.city, e.category, e.subcategory
FROM public.establishments e
WHERE e.subcategory = 'Sauna'
ORDER BY 1, 4, 5, 2;
