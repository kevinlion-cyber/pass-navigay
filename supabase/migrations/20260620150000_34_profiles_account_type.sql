/*
  # 34 — Type de compte (user | pro)
  Un compte Pro (créé via le tunnel partenaire) ne doit pas apparaître dans
  l'annuaire des Membres. On marque ces profils account_type = 'pro'.
  + mise à jour de la vue public_profiles.
*/

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'user';

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
  city, account_type
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated;
