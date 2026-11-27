-- 78 — Suppression des comptes inactifs depuis 3 ans (décision de Kévin, 27/11/2026)
--
-- RGPD : les données ne doivent pas être gardées sans limite. Règle retenue :
--   * un compte sans aucune visite depuis 3 ans est supprimé ;
--   * le membre est prévenu par e-mail 30 jours avant ; une visite annule tout.
-- Jamais concernés : administrateurs, membres Premium en cours, propriétaires d'une
-- fiche Pro, comptes ayant un abonnement Stripe actif (vérifié par la fonction).
-- Les fiches d'établissement d'un compte supprimé restent dans l'annuaire, sans
-- propriétaire (comme pour une suppression volontaire avec « garder mes fiches »).
--
-- « Dernière visite » = la plus récente de : création du compte, dernière connexion,
-- dernière visite enregistrée par l'appli (un membre qui reste connecté des mois ne
-- se « reconnecte » jamais : sans ce repère il passerait pour inactif). Ce repère est
-- privé : il n'apparaît pas dans les profils visibles par les autres membres.

-- 1. Repère privé de dernière visite (mis à jour au plus toutes les 12 h).
CREATE TABLE IF NOT EXISTS public.activite_comptes (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  derniere_visite timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.activite_comptes ENABLE ROW LEVEL SECURITY;
-- Aucune politique : ni lecture ni écriture directes ; seule la fonction ci-dessous écrit.

CREATE OR REPLACE FUNCTION public.pn_marquer_visite()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.activite_comptes (user_id, derniere_visite)
  SELECT auth.uid(), now() WHERE auth.uid() IS NOT NULL
  ON CONFLICT (user_id) DO UPDATE SET derniere_visite = now()
    WHERE public.activite_comptes.derniere_visite < now() - interval '12 hours';
$$;
REVOKE ALL ON FUNCTION public.pn_marquer_visite() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pn_marquer_visite() TO authenticated;

-- 2. Avertissements envoyés (preuve + délai de 30 jours).
CREATE TABLE IF NOT EXISTS public.inactivite_avis (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  averti_le timestamptz NOT NULL DEFAULT now(),
  suppression_prevue_le timestamptz NOT NULL
);
ALTER TABLE public.inactivite_avis ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins lisent les avis d'inactivite" ON public.inactivite_avis;
CREATE POLICY "Admins lisent les avis d'inactivite" ON public.inactivite_avis
  FOR SELECT TO authenticated USING (public.is_admin());

-- 3. Liste des comptes à prévenir / à supprimer (réservée au service_role).
CREATE OR REPLACE FUNCTION public.pn_comptes_inactifs(p_etape text, p_limite integer DEFAULT 50)
RETURNS TABLE (user_id uuid, email text, prenom text, derniere_visite timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Un membre revenu depuis son avertissement n'est plus concerné.
  DELETE FROM public.inactivite_avis a
  USING auth.users u
  LEFT JOIN public.activite_comptes ac ON ac.user_id = u.id
  WHERE a.user_id = u.id
    AND greatest(u.last_sign_in_at, ac.derniere_visite, u.created_at) > a.averti_le;

  RETURN QUERY
  WITH c AS (
    SELECT u.id, u.email::text AS email, p.prenom,
           greatest(u.last_sign_in_at, ac.derniere_visite, u.created_at) AS dv
    FROM auth.users u
    JOIN public.profiles p ON p.id = u.id
    LEFT JOIN public.activite_comptes ac ON ac.user_id = u.id
    WHERE coalesce(p.is_admin, false) = false
      AND NOT (coalesce(p.is_premium, false) AND (p.premium_expires_at IS NULL OR p.premium_expires_at > now()))
      AND NOT EXISTS (SELECT 1 FROM public.establishments e WHERE e.owner_id = u.id AND e.is_pro)
      AND u.email IS NOT NULL
  )
  SELECT c.id, c.email, c.prenom, c.dv
  FROM c
  WHERE CASE p_etape
    -- Prévenir : inactif depuis 3 ans moins 30 jours, pas encore prévenu.
    WHEN 'avertir' THEN c.dv < now() - interval '3 years' + interval '30 days'
      AND NOT EXISTS (SELECT 1 FROM public.inactivite_avis a WHERE a.user_id = c.id)
    -- Supprimer : prévenu il y a 30 jours au moins, et inactif depuis 3 ans.
    WHEN 'supprimer' THEN c.dv < now() - interval '3 years'
      AND EXISTS (SELECT 1 FROM public.inactivite_avis a WHERE a.user_id = c.id AND a.averti_le < now() - interval '30 days')
    ELSE false
  END
  ORDER BY c.dv
  LIMIT least(greatest(p_limite, 1), 200);
END;
$$;
REVOKE ALL ON FUNCTION public.pn_comptes_inactifs(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pn_comptes_inactifs(text, integer) TO service_role;

-- 4. Secret de l'appel automatique (même principe que la migration 73).
CREATE EXTENSION IF NOT EXISTS pg_net;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'pn_comptes_inactifs') THEN
    PERFORM vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'pn_comptes_inactifs',
      'En-tête x-pn-cron de la fonction comptes-inactifs (migration 78)'
    );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.pn_verifier_secret_inactifs(p_secret text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT coalesce(length(p_secret) >= 32 AND p_secret = (
    SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'pn_comptes_inactifs' LIMIT 1
  ), false);
$$;
REVOKE ALL ON FUNCTION public.pn_verifier_secret_inactifs(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pn_verifier_secret_inactifs(text) TO service_role;

-- 5. Passage quotidien à 4 h 10 UTC.
DO $$ BEGIN PERFORM cron.unschedule('pn-comptes-inactifs'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'pn-comptes-inactifs',
  '10 4 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://fbblzyiotqjmqxexvogs.supabase.co/functions/v1/comptes-inactifs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-pn-cron', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'pn_comptes_inactifs' LIMIT 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $cron$
);
