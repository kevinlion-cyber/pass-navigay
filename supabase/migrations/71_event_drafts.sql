-- 71 — Événements à valider (collecte hebdomadaire, décision de Kévin du 26/11/2026)
--
-- Chaque semaine, une tâche planifiée de Claude recense les événements LGBT et
-- LGBT-friendly de l'Hérault et produit un fichier. L'admin l'importe ici : les
-- événements arrivent « en attente » et ne sont publiés dans l'agenda qu'après
-- validation par un administrateur. Rien n'est publié automatiquement.
--
-- Sécurité : table réservée aux administrateurs (is_admin(), qui exige la double
-- authentification depuis la migration 70). Aucune lecture publique.

CREATE TABLE IF NOT EXISTS public.event_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Clé anti-doublon : titre normalisé + jour + ville. Un événement rejeté garde
  -- sa clé : il ne sera pas reproposé les semaines suivantes.
  dedupe_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'rejected')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 5000),
  event_date timestamptz NOT NULL,
  end_date timestamptz,
  venue_name text CHECK (char_length(venue_name) <= 200),
  address text CHECK (char_length(address) <= 300),
  city text CHECK (char_length(city) <= 100),
  latitude double precision,
  longitude double precision,
  theme text CHECK (char_length(theme) <= 60),
  is_free boolean NOT NULL DEFAULT true,
  price numeric(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  source_url text CHECK (source_url ~* '^https?://'),
  source_name text CHECK (char_length(source_name) <= 120),
  ticket_url text CHECK (ticket_url ~* '^https?://'),
  lgbt_reason text CHECK (char_length(lgbt_reason) <= 1000),
  establishment_id uuid REFERENCES public.establishments(id) ON DELETE SET NULL,
  published_event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  import_batch text,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS event_drafts_status_date_idx ON public.event_drafts (status, event_date);

ALTER TABLE public.event_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage event drafts" ON public.event_drafts;
CREATE POLICY "Admins manage event drafts" ON public.event_drafts
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Lien vers l'annonce d'origine sur l'événement publié : mention de la source
-- (exigée par les licences ouvertes OpenAgenda / DATAtourisme) et accès à la
-- billetterie. Facultatif pour les événements saisis à la main.
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS source_url text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS source_name text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS ticket_url text;

DO $$ BEGIN
  ALTER TABLE public.events ADD CONSTRAINT events_source_url_http CHECK (source_url IS NULL OR source_url ~* '^https?://');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.events ADD CONSTRAINT events_ticket_url_http CHECK (ticket_url IS NULL OR ticket_url ~* '^https?://');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Purge : les brouillons rejetés ou publiés de plus d'un an, et les brouillons
-- en attente dont la date est passée depuis 30 jours (ajouté à la purge nocturne).
CREATE OR REPLACE FUNCTION public.purge_old_event_drafts()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.event_drafts
  WHERE (status <> 'pending' AND coalesce(decided_at, created_at) < now() - interval '1 year')
     OR (status = 'pending' AND coalesce(end_date, event_date) < now() - interval '30 days');
$$;
REVOKE ALL ON FUNCTION public.purge_old_event_drafts() FROM PUBLIC, anon, authenticated;

DO $$ BEGIN
  PERFORM cron.unschedule('pn-purge-brouillons-evenements');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule('pn-purge-brouillons-evenements', '55 3 * * *', 'SELECT public.purge_old_event_drafts()');
