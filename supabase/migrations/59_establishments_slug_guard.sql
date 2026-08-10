-- Garde-fou : une fiche ne peut plus naître sans adresse de page (slug) ni sans
-- ville de rattachement (city_slug).
--
-- Pourquoi : il existe plusieurs façons de créer un établissement (interface
-- d'administration, parcours d'inscription des pros, formulaire de création,
-- fonctions Edge, ajout direct en base). Chacune devait penser à fabriquer le
-- slug, et deux d'entre elles l'oubliaient : la fiche était créée mais sa page
-- renvoyait « Établissement non trouvé ». Le parcours des pros oubliait en plus
-- la ville de rattachement, donc la fiche n'apparaissait sur aucune page de ville.
--
-- Plutôt que de corriger chaque écran (c'est cet éparpillement qui a créé le
-- trou), la garantie est posée une seule fois, en base : quel que soit le chemin,
-- présent ou futur, le slug et la ville de rattachement sont remplis s'ils manquent.

-- Normalise un texte en identifiant d'URL : « Le Bulle Dingue » → « le-bulle-dingue ».
-- On translittère les accents à la main pour ne dépendre d'aucune extension.
CREATE OR REPLACE FUNCTION public.pn_slugify(src text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT btrim(
           regexp_replace(
             lower(translate(
               coalesce(src, ''),
               'ÀÁÂÃÄÅàáâãäåÇçÈÉÊËèéêëÌÍÎÏìíîïÑñÒÓÔÕÖØòóôõöøÙÚÛÜùúûüÝŸýÿ',
               'AAAAAAaaaaaaCcEEEEeeeeIIIIiiiiNnOOOOOOooooooUUUUuuuuYYyy'
             )),
             '[^a-z0-9]+', '-', 'g'
           ),
           '-'
         );
$$;

CREATE OR REPLACE FUNCTION public.establishments_fill_slugs()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  base text;
  candidate text;
  i integer := 2;
BEGIN
  -- Ville de rattachement : sans elle, la fiche n'apparaît sur aucune page de
  -- l'annuaire. On reprend la ville de l'adresse, et si cette commune est déjà
  -- rattachée à une ville couverte (Lattes rattaché à Montpellier, par exemple),
  -- on reprend ce rattachement plutôt que d'ouvrir une ville pour un seul lieu.
  IF NEW.city_slug IS NULL OR btrim(NEW.city_slug) = '' THEN
    SELECT e.city_slug INTO NEW.city_slug
    FROM establishments e
    WHERE e.city_slug IS NOT NULL
      AND public.pn_slugify(e.city) = public.pn_slugify(NEW.city)
      AND public.pn_slugify(NEW.city) <> ''
    GROUP BY e.city_slug
    ORDER BY count(*) DESC
    LIMIT 1;

    IF NEW.city_slug IS NULL OR btrim(NEW.city_slug) = '' THEN
      NEW.city_slug := nullif(public.pn_slugify(NEW.city), '');
    END IF;
  END IF;

  -- Adresse de page. Unicité garantie : on suffixe en cas de collision, et en
  -- dernier recours on colle un morceau de l'identifiant (jamais d'échec).
  IF NEW.slug IS NULL OR btrim(NEW.slug) = '' THEN
    base := public.pn_slugify(coalesce(NEW.name, '') || ' ' || coalesce(NEW.city, ''));
    IF base = '' THEN
      base := public.pn_slugify(coalesce(NEW.name, ''));
    END IF;
    IF base = '' THEN
      base := 'lieu-' || left(replace(NEW.id::text, '-', ''), 8);
    END IF;
    base := left(base, 80);

    candidate := base;
    WHILE EXISTS (SELECT 1 FROM establishments e WHERE e.slug = candidate AND e.id <> NEW.id) LOOP
      candidate := left(base, 76) || '-' || i;
      i := i + 1;
      IF i > 50 THEN
        candidate := left(base, 70) || '-' || left(replace(NEW.id::text, '-', ''), 8);
        EXIT;
      END IF;
    END LOOP;

    NEW.slug := candidate;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_establishments_fill_slugs ON establishments;
CREATE TRIGGER trg_establishments_fill_slugs
  BEFORE INSERT OR UPDATE ON establishments
  FOR EACH ROW
  EXECUTE FUNCTION public.establishments_fill_slugs();

-- Répare les fiches déjà créées sans adresse de page (la fiche créée à la main
-- avant le correctif). Le trigger fait le travail au passage.
UPDATE establishments SET slug = NULL WHERE slug IS NULL OR btrim(slug) = '';
