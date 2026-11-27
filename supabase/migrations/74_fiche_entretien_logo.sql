-- 74 — Fiches préparées en entretien avec le gérant (décision de Kévin, 27/11/2026)
-- Le brouillon peut porter un logo, repris à la publication (fonction fiches-publish).
-- N'ajoute qu'une colonne facultative ; aucune donnée modifiée.
-- Retour arrière : ALTER TABLE public.establishment_drafts DROP COLUMN IF EXISTS logo_url;
ALTER TABLE public.establishment_drafts ADD COLUMN IF NOT EXISTS logo_url text;
