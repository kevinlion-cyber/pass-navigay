-- Galerie photos pour les utilisateurs Premium (comme les pros).
-- Stockée sur profiles.gallery_urls (tableau d'URLs publiques du bucket avatars/{uid}/gallery/).

alter table profiles add column if not exists gallery_urls text[] not null default '{}';

-- Recrée la vue publique en y ajoutant gallery_urls (galerie visible sur le profil public).
create or replace view public.public_profiles
with (security_invoker = false) as
 select id, username, avatar_url, bio, is_premium, is_admin, premium_expires_at,
   NULL::text as stripe_customer_id, theme, show_onboarding, show_disclaimer, created_at,
   favorite_categories, last_active_at, prenom, nom, NULL::text as phone, gender_identity,
   pronouns, attracted_to, orientation, looking_for, relationship_intensity, vibe, evening_energy,
   green_flags, red_flags, community_involvement, community_goals, ideal_type, deal_breaker,
   what_i_bring, if_i_were_vibe, if_i_were_music, if_i_were_energy, late_truth, questionnaire_completed,
   profile_visibility, NULL::text as email, is_verified, premium_billing_interval, city, account_type,
   gallery_urls
 from profiles;
