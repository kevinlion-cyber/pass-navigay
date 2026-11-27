-- 73 — Import automatique des événements de la semaine (décision de Kévin, 27/11/2026)
--
-- Le lundi, la tâche planifiée de Claude dépose le fichier des événements dans GitHub ;
-- pg_cron appelle ensuite la fonction import-evenements-hebdo, qui l'ajoute EN ATTENTE
-- dans « Événements à valider ». Rien n'est publié sans un administrateur.
--
-- Secret : une valeur aléatoire est créée dans le coffre Supabase (Vault). pg_cron
-- l'envoie dans l'en-tête x-pn-cron ; la fonction la vérifie via
-- pn_verifier_secret_import() (réservée au service_role). Personne n'a à la copier.

CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'pn_import_evenements') THEN
    PERFORM vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'pn_import_evenements',
      'En-tête x-pn-cron de la fonction import-evenements-hebdo (migration 73)'
    );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.pn_verifier_secret_import(p_secret text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT coalesce(length(p_secret) >= 32 AND p_secret = (
    SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'pn_import_evenements' LIMIT 1
  ), false);
$$;
REVOKE ALL ON FUNCTION public.pn_verifier_secret_import(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pn_verifier_secret_import(text) TO service_role;

-- Lundi 7 h 15 et 10 h 15 UTC (8 h 15 et 11 h 15 en hiver à Paris) : le second passage
-- rattrape un fichier déposé en retard ; un événement déjà importé n'est pas dupliqué.
DO $$ BEGIN
  PERFORM cron.unschedule('pn-import-evenements');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'pn-import-evenements',
  '15 7,10 * * 1',
  $cron$
  SELECT net.http_post(
    url := 'https://fbblzyiotqjmqxexvogs.supabase.co/functions/v1/import-evenements-hebdo',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-pn-cron', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'pn_import_evenements' LIMIT 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $cron$
);
