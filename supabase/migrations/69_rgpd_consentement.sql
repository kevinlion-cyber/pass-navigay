-- 69 — RGPD : consentement explicite pour les données sensibles + durées de conservation.
-- Décisions de Kévin (24/11/2026), à faire confirmer par un juriste :
--   • orientation, identité de genre, pronoms, attirance et « ce que je recherche »
--     ne sont recueillis et montrés qu'avec un consentement explicite (art. 9 RGPD) ;
--   • les réponses déjà données sans consentement sont MASQUÉES aux autres membres
--     (pas effacées) jusqu'à l'accord de la personne ;
--   • retrait du consentement = effacement immédiat de ces réponses ;
--   • questionnaire public : consentement obligatoire si la question sur
--     l'orientation est remplie ;
--   • conservation : statistiques 13 mois, questionnaire public 2 ans,
--     signalements clos 1 an.
-- À appliquer APRÈS la 66 (la vue public_profiles ci-dessous reprend la 66).

-- ============================================================
-- 1. Consentement sur les profils
-- ============================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sensitive_consent_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sensitive_consent_version text;

-- Pas de donnée sensible enregistrée sans consentement (sauf admin / serveur).
CREATE OR REPLACE FUNCTION public.require_sensitive_consent()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.is_admin() THEN RETURN NEW; END IF;
  IF NEW.sensitive_consent_at IS NULL AND (
       (NEW.gender_identity IS NOT NULL AND NEW.gender_identity IS DISTINCT FROM (CASE WHEN TG_OP = 'UPDATE' THEN OLD.gender_identity END))
    OR (NEW.pronouns        IS NOT NULL AND NEW.pronouns        IS DISTINCT FROM (CASE WHEN TG_OP = 'UPDATE' THEN OLD.pronouns END))
    OR (NEW.attracted_to    IS NOT NULL AND NEW.attracted_to    IS DISTINCT FROM (CASE WHEN TG_OP = 'UPDATE' THEN OLD.attracted_to END))
    OR (NEW.orientation     IS NOT NULL AND NEW.orientation     IS DISTINCT FROM (CASE WHEN TG_OP = 'UPDATE' THEN OLD.orientation END))
    OR (NEW.looking_for     IS NOT NULL AND NEW.looking_for     IS DISTINCT FROM (CASE WHEN TG_OP = 'UPDATE' THEN OLD.looking_for END))
  ) THEN
    RAISE EXCEPTION 'CONSENTEMENT_REQUIS';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_require_sensitive_consent ON public.profiles;
CREATE TRIGGER trg_require_sensitive_consent
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.require_sensitive_consent();

-- Donner son consentement (horodaté par le serveur, avec la version du texte accepté).
CREATE OR REPLACE FUNCTION public.give_sensitive_consent(p_version text)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ts timestamptz := now();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
  UPDATE profiles SET sensitive_consent_at = ts, sensitive_consent_version = left(coalesce(p_version, ''), 40)
  WHERE id = auth.uid();
  RETURN ts;
END;
$$;
REVOKE ALL ON FUNCTION public.give_sensitive_consent(text) FROM public;
GRANT EXECUTE ON FUNCTION public.give_sensitive_consent(text) TO authenticated;

-- Retirer son consentement : effacement immédiat des réponses sensibles.
CREATE OR REPLACE FUNCTION public.withdraw_sensitive_consent()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
  UPDATE profiles SET
    gender_identity = NULL, pronouns = NULL, attracted_to = NULL, orientation = NULL, looking_for = NULL,
    sensitive_consent_at = NULL, sensitive_consent_version = NULL,
    profile_visibility = coalesce(profile_visibility, '{}'::jsonb)
      || '{"gender_identity": false, "pronouns": false, "orientation": false, "looking_for": false}'::jsonb
  WHERE id = auth.uid();
END;
$$;
REVOKE ALL ON FUNCTION public.withdraw_sensitive_consent() FROM public;
GRANT EXECUTE ON FUNCTION public.withdraw_sensitive_consent() TO authenticated;

-- Vue publique : identique à la 66, mais les réponses sensibles ne sont montrées
-- aux autres membres que si la personne a donné son consentement.
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = false) AS
SELECT
  p.id,
  p.username,
  p.avatar_url,
  CASE WHEN v.full OR v.prem THEN p.bio END                                   AS bio,
  p.is_premium,
  CASE WHEN v.full THEN p.is_admin ELSE false END                             AS is_admin,
  CASE WHEN v.full THEN p.premium_expires_at END                              AS premium_expires_at,
  NULL::text                                                                  AS stripe_customer_id,
  CASE WHEN v.full THEN p.theme END                                           AS theme,
  CASE WHEN v.full THEN p.show_onboarding END                                 AS show_onboarding,
  CASE WHEN v.full THEN p.show_disclaimer END                                 AS show_disclaimer,
  p.created_at,
  p.favorite_categories,
  CASE WHEN v.full OR v.prem THEN p.last_active_at END                        AS last_active_at,
  p.prenom,
  CASE WHEN v.full THEN p.nom ELSE left(p.nom, 1) END                         AS nom,
  NULL::text                                                                  AS phone,
  CASE WHEN v.full OR (v.prem AND p.sensitive_consent_at IS NOT NULL AND p.profile_visibility->>'gender_identity' = 'true') THEN p.gender_identity END AS gender_identity,
  CASE WHEN v.full OR (v.prem AND p.sensitive_consent_at IS NOT NULL AND p.profile_visibility->>'pronouns'        = 'true') THEN p.pronouns        END AS pronouns,
  CASE WHEN v.full THEN p.attracted_to END                                    AS attracted_to,
  CASE WHEN v.full OR (v.prem AND p.sensitive_consent_at IS NOT NULL AND p.profile_visibility->>'orientation'     = 'true') THEN p.orientation     END AS orientation,
  CASE WHEN v.full OR (v.prem AND p.sensitive_consent_at IS NOT NULL AND p.profile_visibility->>'looking_for'     = 'true') THEN p.looking_for     END AS looking_for,
  CASE WHEN v.full THEN p.relationship_intensity END                          AS relationship_intensity,
  CASE WHEN v.full OR (v.prem AND p.profile_visibility->>'vibe'            = 'true') THEN p.vibe            END AS vibe,
  CASE WHEN v.full OR (v.prem AND p.profile_visibility->>'evening_energy'  = 'true') THEN p.evening_energy  END AS evening_energy,
  CASE WHEN v.full OR (v.prem AND p.profile_visibility->>'green_flags'     = 'true') THEN p.green_flags     END AS green_flags,
  CASE WHEN v.full THEN p.red_flags END                                       AS red_flags,
  CASE WHEN v.full THEN p.community_involvement END                           AS community_involvement,
  CASE WHEN v.full THEN p.community_goals END                                 AS community_goals,
  CASE WHEN v.full THEN p.ideal_type END                                      AS ideal_type,
  CASE WHEN v.full THEN p.deal_breaker END                                    AS deal_breaker,
  CASE WHEN v.full OR (v.prem AND p.profile_visibility->>'what_i_bring'    = 'true') THEN p.what_i_bring    END AS what_i_bring,
  CASE WHEN v.full OR (v.prem AND p.profile_visibility->>'if_i_were_vibe'  = 'true') THEN p.if_i_were_vibe  END AS if_i_were_vibe,
  CASE WHEN v.full OR (v.prem AND p.profile_visibility->>'if_i_were_music' = 'true') THEN p.if_i_were_music END AS if_i_were_music,
  CASE WHEN v.full THEN p.if_i_were_energy END                                AS if_i_were_energy,
  CASE WHEN v.full OR (v.prem AND p.profile_visibility->>'late_truth'      = 'true') THEN p.late_truth      END AS late_truth,
  p.questionnaire_completed,
  CASE WHEN v.full OR v.prem THEN p.profile_visibility END                    AS profile_visibility,
  NULL::text                                                                  AS email,
  p.is_verified,
  CASE WHEN v.full THEN p.premium_billing_interval END                        AS premium_billing_interval,
  CASE WHEN v.full OR v.prem THEN p.city END                                  AS city,
  p.account_type,
  CASE WHEN v.full OR v.prem THEN p.gallery_urls END                          AS gallery_urls
FROM public.profiles p
CROSS JOIN LATERAL (
  SELECT (p.id = auth.uid() OR public.is_admin()) AS full,
         public.viewer_is_premium()               AS prem
) v
-- Blocage (E4) : deux membres qui se sont bloqués ne se voient plus.
WHERE NOT public.is_blocked_between(auth.uid(), p.id);

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- ============================================================
-- 2. Questionnaire public : consentement si la question sur l'orientation est remplie
-- ============================================================
ALTER TABLE public.survey_responses ADD COLUMN IF NOT EXISTS sensitive_consent boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.survey_require_consent()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF coalesce(btrim(NEW.answers->>'identite'), '') <> '' AND NOT NEW.sensitive_consent THEN
    RAISE EXCEPTION 'CONSENTEMENT_REQUIS';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_survey_require_consent ON public.survey_responses;
CREATE TRIGGER trg_survey_require_consent
  BEFORE INSERT ON public.survey_responses
  FOR EACH ROW EXECUTE FUNCTION public.survey_require_consent();

-- ============================================================
-- 3. Durées de conservation (purge chaque nuit)
-- ============================================================
CREATE OR REPLACE FUNCTION public.purge_old_data()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a int; b int; c int; d int; e int;
BEGIN
  DELETE FROM analytics_events WHERE created_at < now() - interval '13 months'; GET DIAGNOSTICS a = ROW_COUNT;
  DELETE FROM analytics_identities WHERE last_seen < now() - interval '13 months'; GET DIAGNOSTICS b = ROW_COUNT;
  DELETE FROM survey_responses WHERE created_at < now() - interval '2 years'; GET DIAGNOSTICS c = ROW_COUNT;
  DELETE FROM user_reports WHERE status IN ('resolved', 'dismissed')
    AND coalesce(handled_at, created_at) < now() - interval '1 year'; GET DIAGNOSTICS d = ROW_COUNT;
  DELETE FROM oauth_states WHERE created_at < now() - interval '1 day'; GET DIAGNOSTICS e = ROW_COUNT;
  RETURN jsonb_build_object('statistiques', a, 'visiteurs', b, 'questionnaire_public', c, 'signalements', d, 'jetons', e);
END;
$$;
REVOKE ALL ON FUNCTION public.purge_old_data() FROM public, anon, authenticated;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'pn-purge-rgpd';
SELECT cron.schedule('pn-purge-rgpd', '45 3 * * *', 'SELECT public.purge_old_data();');
