/*
  # 33 — Ajout d'une ville aux profils (filtre membres par ville)
  + mise à jour de la vue public_profiles pour exposer `city`.
*/

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city text;

CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = false) AS
SELECT
  id, username, avatar_url, bio, is_premium, is_admin, premium_expires_at,
  NULL::text AS stripe_customer_id,
  theme, show_onboarding, show_disclaimer, created_at, favorite_categories, last_active_at,
  prenom, nom,
  NULL::text AS phone,
  gender_identity, pronouns, attracted_to, orientation, looking_for,
  relationship_intensity, vibe, evening_energy, green_flags, red_flags,
  community_involvement, community_goals, ideal_type, deal_breaker,
  what_i_bring, if_i_were_vibe, if_i_were_music, if_i_were_energy, late_truth,
  questionnaire_completed, profile_visibility,
  NULL::text AS email,
  is_verified, premium_billing_interval,
  city
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated;
