-- 65 — C2 : la vue publique des profils n'expose plus les données intimes.
-- Mêmes colonnes, même ordre (le site continue de fonctionner sans changement),
-- mais leur CONTENU dépend de qui regarde :
--   • visiteur / membre gratuit / pro : pseudo, prénom, initiale du nom, photo,
--     badges, catégories favorites. Tout le reste = vide.
--   • membre Premium : en plus bio, ville, galerie, dernière activité, et les
--     réponses au questionnaire UNIQUEMENT si le membre a coché « visible ».
--   • le membre lui-même et les admins : tout (sauf email/téléphone/Stripe,
--     toujours lus depuis la table privée).
-- Jamais exposés à autrui : nom complet, statut admin, dates d'abonnement,
-- attirance, intensité, red flags, engagement, type idéal, deal breaker.

CREATE OR REPLACE FUNCTION public.viewer_is_premium()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_premium = true);
$$;
REVOKE ALL ON FUNCTION public.viewer_is_premium() FROM public;
GRANT EXECUTE ON FUNCTION public.viewer_is_premium() TO authenticated, anon;

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
  CASE WHEN v.full OR (v.prem AND p.profile_visibility->>'gender_identity' = 'true') THEN p.gender_identity END AS gender_identity,
  CASE WHEN v.full OR (v.prem AND p.profile_visibility->>'pronouns'        = 'true') THEN p.pronouns        END AS pronouns,
  CASE WHEN v.full THEN p.attracted_to END                                    AS attracted_to,
  CASE WHEN v.full OR (v.prem AND p.profile_visibility->>'orientation'     = 'true') THEN p.orientation     END AS orientation,
  CASE WHEN v.full OR (v.prem AND p.profile_visibility->>'looking_for'     = 'true') THEN p.looking_for     END AS looking_for,
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
) v;

GRANT SELECT ON public.public_profiles TO anon, authenticated;
