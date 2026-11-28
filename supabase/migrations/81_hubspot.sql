-- 81 — Lien automatique PassNavigay → HubSpot (28/11/2026)
--
-- But : retrouver dans HubSpot (compte IDKL) tous les membres Premium PAYANTS et tous les
-- établissements Pro PAYANTS, à jour (formule, dates, actif / ancien client).
--
-- Fonctionnement :
--   1. Des déclencheurs notent dans `hubspot_sync` chaque changement d'abonnement payant
--      (paiement, renouvellement, résiliation, fin), sans toucher au code des paiements.
--   2. Toutes les 10 minutes, s'il y a quelque chose à envoyer, la tâche `pn-hubspot`
--      appelle la fonction hubspot-sync, qui envoie à HubSpot et réessaie en cas d'échec.
--   3. Suppression d'un compte → demande d'effacement du contact dans HubSpot (RGPD).
--
-- « Payant » = abonnement Stripe : membre avec un client Stripe, établissement avec un
-- abonnement Stripe. Les périodes offertes depuis l'admin seules ne sont pas envoyées.
-- Jamais envoyé : orientation, identité de genre, questionnaire, messages.
-- Lecture : admins seulement. Écriture : déclencheurs et fonction (service_role).

CREATE TABLE IF NOT EXISTS public.hubspot_sync (
  id bigserial PRIMARY KEY,
  cible text NOT NULL CHECK (cible IN ('membre', 'etablissement', 'effacement')),
  cible_id uuid NOT NULL,
  email text,                                -- gardé seulement pour un effacement
  a_faire boolean NOT NULL DEFAULT true,
  tentatives int NOT NULL DEFAULT 0,
  derniere_erreur text,
  demande_le timestamptz NOT NULL DEFAULT now(),
  envoye_le timestamptz,
  hubspot_contact_id text,
  hubspot_company_id text,
  UNIQUE (cible, cible_id)
);
CREATE INDEX IF NOT EXISTS hubspot_sync_a_faire_idx ON public.hubspot_sync (a_faire) WHERE a_faire;

ALTER TABLE public.hubspot_sync ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hubspot_sync FROM anon, authenticated;
GRANT SELECT ON public.hubspot_sync TO authenticated;
DROP POLICY IF EXISTS "Admins lisent la synchro HubSpot" ON public.hubspot_sync;
CREATE POLICY "Admins lisent la synchro HubSpot" ON public.hubspot_sync
  FOR SELECT TO authenticated USING (coalesce(public.is_admin(), false));

-- Mise en file (une ligne par membre / établissement, remise « à faire » à chaque changement).
CREATE OR REPLACE FUNCTION public.pn_hubspot_a_faire(p_cible text, p_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.hubspot_sync (cible, cible_id) VALUES (p_cible, p_id)
  ON CONFLICT (cible, cible_id) DO UPDATE
    SET a_faire = true, tentatives = 0, derniere_erreur = NULL, demande_le = now();
$$;
REVOKE ALL ON FUNCTION public.pn_hubspot_a_faire(text, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.pn_hubspot_trg_membre()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.stripe_customer_id IS NOT NULL
     OR EXISTS (SELECT 1 FROM public.hubspot_sync WHERE cible = 'membre' AND cible_id = NEW.id) THEN
    PERFORM public.pn_hubspot_a_faire('membre', NEW.id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS pn_hubspot_membre ON public.profiles;
CREATE TRIGGER pn_hubspot_membre
  AFTER UPDATE OF is_premium, premium_expires_at, premium_billing_interval, stripe_customer_id ON public.profiles
  FOR EACH ROW
  WHEN (OLD.is_premium IS DISTINCT FROM NEW.is_premium
     OR OLD.premium_expires_at IS DISTINCT FROM NEW.premium_expires_at
     OR OLD.premium_billing_interval IS DISTINCT FROM NEW.premium_billing_interval
     OR OLD.stripe_customer_id IS DISTINCT FROM NEW.stripe_customer_id)
  EXECUTE FUNCTION public.pn_hubspot_trg_membre();

CREATE OR REPLACE FUNCTION public.pn_hubspot_trg_etablissement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.stripe_subscription_id IS NOT NULL
     OR EXISTS (SELECT 1 FROM public.hubspot_sync WHERE cible = 'etablissement' AND cible_id = NEW.id) THEN
    PERFORM public.pn_hubspot_a_faire('etablissement', NEW.id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS pn_hubspot_etablissement ON public.establishments;
CREATE TRIGGER pn_hubspot_etablissement
  AFTER UPDATE OF is_pro, pro_expires_at, pro_billing_interval, stripe_subscription_id ON public.establishments
  FOR EACH ROW
  WHEN (OLD.is_pro IS DISTINCT FROM NEW.is_pro
     OR OLD.pro_expires_at IS DISTINCT FROM NEW.pro_expires_at
     OR OLD.pro_billing_interval IS DISTINCT FROM NEW.pro_billing_interval
     OR OLD.stripe_subscription_id IS DISTINCT FROM NEW.stripe_subscription_id)
  EXECUTE FUNCTION public.pn_hubspot_trg_etablissement();

-- Compte supprimé : si la personne avait été envoyée à HubSpot, on demande l'effacement.
CREATE OR REPLACE FUNCTION public.pn_hubspot_trg_effacement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.email IS NOT NULL AND (
       EXISTS (SELECT 1 FROM public.hubspot_sync WHERE cible = 'membre' AND cible_id = OLD.id)
    OR EXISTS (SELECT 1 FROM public.hubspot_sync s JOIN public.establishments e ON e.id = s.cible_id
               WHERE s.cible = 'etablissement' AND e.owner_id = OLD.id)) THEN
    INSERT INTO public.hubspot_sync (cible, cible_id, email) VALUES ('effacement', OLD.id, lower(OLD.email))
    ON CONFLICT (cible, cible_id) DO UPDATE SET a_faire = true, tentatives = 0, email = EXCLUDED.email, demande_le = now();
    DELETE FROM public.hubspot_sync WHERE cible = 'membre' AND cible_id = OLD.id;
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS pn_hubspot_effacement ON public.profiles;
CREATE TRIGGER pn_hubspot_effacement
  BEFORE DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.pn_hubspot_trg_effacement();

-- Rattrapage (bouton de l'admin) : met en file tous les payants actuels.
CREATE OR REPLACE FUNCTION public.admin_hubspot_rattrapage()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int := 0; r record;
BEGIN
  IF NOT coalesce(public.is_admin(), false) THEN
    RAISE EXCEPTION 'Réservé aux administrateurs' USING errcode = '42501';
  END IF;
  FOR r IN SELECT id FROM public.profiles WHERE is_premium AND stripe_customer_id IS NOT NULL LOOP
    PERFORM public.pn_hubspot_a_faire('membre', r.id); n := n + 1;
  END LOOP;
  FOR r IN SELECT id FROM public.establishments WHERE is_pro AND stripe_subscription_id IS NOT NULL LOOP
    PERFORM public.pn_hubspot_a_faire('etablissement', r.id); n := n + 1;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.admin_hubspot_rattrapage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_hubspot_rattrapage() TO authenticated;

-- Secret de la tâche planifiée (comme pour les comptes inactifs).
CREATE EXTENSION IF NOT EXISTS pg_net;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'pn_hubspot') THEN
    PERFORM vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'pn_hubspot',
      'En-tête x-pn-cron de la fonction hubspot-sync (migration 81)');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.pn_verifier_secret_hubspot(p_secret text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, vault AS $$
  SELECT coalesce(length(p_secret) >= 32 AND p_secret = (
    SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'pn_hubspot' LIMIT 1
  ), false);
$$;
REVOKE ALL ON FUNCTION public.pn_verifier_secret_hubspot(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pn_verifier_secret_hubspot(text) TO service_role;

-- Toutes les 10 minutes, seulement s'il y a quelque chose à envoyer (et au plus 10 essais).
DO $$ BEGIN PERFORM cron.unschedule('pn-hubspot'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'pn-hubspot',
  '*/10 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://fbblzyiotqjmqxexvogs.supabase.co/functions/v1/hubspot-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-pn-cron', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'pn_hubspot' LIMIT 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  )
  WHERE EXISTS (SELECT 1 FROM public.hubspot_sync WHERE a_faire AND tentatives < 10);
  $cron$
);

-- Vérification (une seule ligne : les quatre colonnes à « true »)
SELECT
  (to_regclass('public.hubspot_sync') IS NOT NULL) AS table_file,
  EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'pn_hubspot_membre') AS declencheur_membre,
  EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'pn_hubspot_etablissement') AS declencheur_pro,
  EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pn-hubspot') AS tache_10_min;
