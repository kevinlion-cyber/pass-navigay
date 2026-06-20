/*
  # 32 — Vues publiques (PII profils + contenu promos) — Phase 2 de l'audit 2026-06-20

  Objectif :
    - profiles : email / téléphone / stripe_customer_id ne doivent plus être lisibles
      par les autres utilisateurs ni en anonyme (RGPD). La table de base passe en
      lecture "propriétaire + admin" ; le public lit la VUE `public_profiles`
      (mêmes colonnes, champs sensibles à NULL).
    - promotions : la value/description (le contenu derrière le paywall) ne doit plus
      être lisible par les non-Premium. Base en lecture "Premium + owner + admin" ;
      le public/teaser lit la VUE `public_promotions` (value/description à NULL).

  Les vues sont en SECURITY DEFINER (security_invoker=false) : elles s'exécutent avec
  les droits du propriétaire (postgres) et contournent donc la RLS de la table de base,
  tout en n'exposant que des colonnes sûres.
*/

-- ============================================================
-- VUE public_profiles (email / phone / stripe_customer_id masqués)
-- ============================================================
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
  is_verified, premium_billing_interval
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- Lecture de la table de base : propriétaire + admin uniquement
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Anonymous users can view profiles" ON public.profiles;
CREATE POLICY "Owners and admins can view profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.is_admin());

-- ============================================================
-- VUE public_promotions (value / description masqués)
-- ============================================================
CREATE OR REPLACE VIEW public.public_promotions
WITH (security_invoker = false) AS
SELECT
  id, establishment_id, title,
  NULL::text AS description,
  promo_type,
  NULL::numeric AS value,
  image_url, valid_from, valid_until, is_recurring, recurrence_rule,
  max_uses, current_uses, created_at, is_active, is_permanent
FROM public.promotions;

GRANT SELECT ON public.public_promotions TO anon, authenticated;

-- Lecture de la table de base : Premium + propriétaire + admin
DROP POLICY IF EXISTS "Anyone can view promotions" ON public.promotions;
DROP POLICY IF EXISTS "Anon can view promotions" ON public.promotions;
CREATE POLICY "Premium owner admin can view promotions" ON public.promotions
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_premium = true)
    OR EXISTS (SELECT 1 FROM public.establishments e WHERE e.id = promotions.establishment_id AND e.owner_id = auth.uid())
  );
