/*
  # 31 — Durcissement sécurité (audit du 2026-06-20)

  Migration CORRECTIVE : ne modifie aucune migration déjà appliquée (règle projet).
  À appliquer sur la base Supabase (accès DDL requis : `supabase db push` ou éditeur SQL).

  Corrige :
    1. Escalade de privilèges : un utilisateur pouvait se mettre is_admin/is_premium
       (profiles) ou is_pro (establishments) via l'API. → triggers de protection.
    2. app_settings : écriture ouverte à tout authentifié (DoS + défacement légal). → admin only.
    3. messages : envoi non réservé aux Premium en base. → check Premium.
    4. promotion_uses : utilisation non réservée aux Premium en base. → check Premium.
    5. admin_gifts : lecture/écriture ouvertes à tout authentifié. → admin only.
    6. policies admin manquantes (events/promotions/photos/establishments).
    7. Storage : update/delete d'objets d'autrui (défacement). → cloisonné par propriétaire/admin.

  NON inclus ici (à traiter sur staging, voir SECURITY-TODO en bas) :
    - Exposition PII des profils (email/téléphone/questionnaire) en lecture anon.
    - Contenu intégral des promotions lisible par tous (paywall = flou CSS).
*/

-- ============================================================
-- Helper : is_admin() en SECURITY DEFINER (bypass RLS → pas de récursion)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM public;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;

-- ============================================================
-- 1. profiles : empêcher l'auto-attribution de privilèges
--    (seuls un admin ou le service_role peuvent toucher ces colonnes)
-- ============================================================
CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role (webhook Stripe, Edge Functions) : autorisé
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF (NEW.is_admin                 IS DISTINCT FROM OLD.is_admin)
     OR (NEW.is_premium            IS DISTINCT FROM OLD.is_premium)
     OR (NEW.premium_expires_at    IS DISTINCT FROM OLD.premium_expires_at)
     OR (NEW.premium_billing_interval IS DISTINCT FROM OLD.premium_billing_interval)
     OR (NEW.stripe_customer_id    IS DISTINCT FROM OLD.stripe_customer_id)
  THEN
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Modification non autorisée de champs privilégiés (profiles)';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_privileges ON public.profiles;
CREATE TRIGGER trg_protect_profile_privileges
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileges();

-- ============================================================
-- 2. establishments : mêmes protections (is_pro, expirations, stripe, sponsor, verified)
-- ============================================================
CREATE OR REPLACE FUNCTION public.protect_establishment_privileges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF (NEW.is_pro                   IS DISTINCT FROM OLD.is_pro)
     OR (NEW.pro_expires_at        IS DISTINCT FROM OLD.pro_expires_at)
     OR (NEW.pro_billing_interval  IS DISTINCT FROM OLD.pro_billing_interval)
     OR (NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id)
     OR (NEW.stripe_customer_id    IS DISTINCT FROM OLD.stripe_customer_id)
     OR (NEW.is_sponsor            IS DISTINCT FROM OLD.is_sponsor)
     OR (NEW.is_verified           IS DISTINCT FROM OLD.is_verified)
  THEN
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Modification non autorisée de champs privilégiés (establishments)';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_establishment_privileges ON public.establishments;
CREATE TRIGGER trg_protect_establishment_privileges
  BEFORE UPDATE ON public.establishments
  FOR EACH ROW EXECUTE FUNCTION public.protect_establishment_privileges();

-- ============================================================
-- 3. app_settings : écriture réservée aux admins (la lecture publique reste inchangée)
-- ============================================================
DROP POLICY IF EXISTS "authenticated_insert_app_settings" ON app_settings;
DROP POLICY IF EXISTS "authenticated_update_app_settings" ON app_settings;

CREATE POLICY "Admins can insert app settings" ON app_settings
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update app settings" ON app_settings
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins can delete app settings" ON app_settings
  FOR DELETE TO authenticated USING (public.is_admin());

-- ============================================================
-- 4. messages : envoi réservé aux membres Premium (ou admin)
-- ============================================================
DROP POLICY IF EXISTS "Users can send messages" ON messages;
CREATE POLICY "Premium members can send messages" ON messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND (
      public.is_admin()
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_premium = true)
    )
  );

-- ============================================================
-- 5. promotion_uses : utilisation réservée aux membres Premium
-- ============================================================
DROP POLICY IF EXISTS "Users can insert own promotion uses" ON promotion_uses;
CREATE POLICY "Premium users can insert own promotion uses" ON promotion_uses
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_premium = true)
  );

-- ============================================================
-- 6. admin_gifts : lecture/écriture réservées aux admins
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can read admin_gifts" ON admin_gifts;
DROP POLICY IF EXISTS "Authenticated users can insert admin_gifts" ON admin_gifts;
CREATE POLICY "Admins can read admin_gifts" ON admin_gifts
  FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can insert admin_gifts" ON admin_gifts
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

-- ============================================================
-- 7. Policies admin manquantes : l'admin édite via l'app (sinon échec sur
--    les établissements ayant un owner). Les policies owner restent en place.
-- ============================================================
CREATE POLICY "Admins manage establishments" ON establishments
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins manage events" ON events
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins manage promotions" ON promotions
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins manage establishment_photos" ON establishment_photos
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- 8. Storage : cloisonnement des écritures (UPDATE/DELETE) par propriétaire/admin.
--    Le dossier (storage.foldername(name))[1] vaut :
--      - establishment-* : l'id de l'établissement
--      - event-images    : id établissement (partenaire) OU id événement (admin)
--      - promo-images    : id établissement (partenaire) OU id promotion (admin)
--    INSERT laissé ouvert (création de nouvel établissement = ligne pas encore créée).
--    L'overwrite (upsert) passe par UPDATE et est donc cloisonné.
-- ============================================================

-- establishment-logos
DROP POLICY IF EXISTS "Auth users can update establishment logos" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can delete establishment logos" ON storage.objects;
CREATE POLICY "Owner/admin update establishment logos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'establishment-logos' AND (public.is_admin()
    OR EXISTS (SELECT 1 FROM establishments e WHERE e.id::text = (storage.foldername(name))[1] AND e.owner_id = auth.uid())))
  WITH CHECK (bucket_id = 'establishment-logos' AND (public.is_admin()
    OR EXISTS (SELECT 1 FROM establishments e WHERE e.id::text = (storage.foldername(name))[1] AND e.owner_id = auth.uid())));
CREATE POLICY "Owner/admin delete establishment logos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'establishment-logos' AND (public.is_admin()
    OR EXISTS (SELECT 1 FROM establishments e WHERE e.id::text = (storage.foldername(name))[1] AND e.owner_id = auth.uid())));

-- establishment-banners
DROP POLICY IF EXISTS "Auth users can update establishment banners" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can delete establishment banners" ON storage.objects;
CREATE POLICY "Owner/admin update establishment banners" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'establishment-banners' AND (public.is_admin()
    OR EXISTS (SELECT 1 FROM establishments e WHERE e.id::text = (storage.foldername(name))[1] AND e.owner_id = auth.uid())))
  WITH CHECK (bucket_id = 'establishment-banners' AND (public.is_admin()
    OR EXISTS (SELECT 1 FROM establishments e WHERE e.id::text = (storage.foldername(name))[1] AND e.owner_id = auth.uid())));
CREATE POLICY "Owner/admin delete establishment banners" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'establishment-banners' AND (public.is_admin()
    OR EXISTS (SELECT 1 FROM establishments e WHERE e.id::text = (storage.foldername(name))[1] AND e.owner_id = auth.uid())));

-- establishment-photos
DROP POLICY IF EXISTS "Auth users can update establishment photos" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can delete establishment photos" ON storage.objects;
CREATE POLICY "Owner/admin update establishment photos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'establishment-photos' AND (public.is_admin()
    OR EXISTS (SELECT 1 FROM establishments e WHERE e.id::text = (storage.foldername(name))[1] AND e.owner_id = auth.uid())))
  WITH CHECK (bucket_id = 'establishment-photos' AND (public.is_admin()
    OR EXISTS (SELECT 1 FROM establishments e WHERE e.id::text = (storage.foldername(name))[1] AND e.owner_id = auth.uid())));
CREATE POLICY "Owner/admin delete establishment photos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'establishment-photos' AND (public.is_admin()
    OR EXISTS (SELECT 1 FROM establishments e WHERE e.id::text = (storage.foldername(name))[1] AND e.owner_id = auth.uid())));

-- event-images (dossier = id établissement OU id événement)
DROP POLICY IF EXISTS "Auth users can update event images" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can delete event images" ON storage.objects;
CREATE POLICY "Owner/admin update event images" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'event-images' AND (public.is_admin()
    OR EXISTS (SELECT 1 FROM establishments e WHERE e.id::text = (storage.foldername(name))[1] AND e.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM events ev JOIN establishments e ON e.id = ev.establishment_id WHERE ev.id::text = (storage.foldername(name))[1] AND e.owner_id = auth.uid())))
  WITH CHECK (bucket_id = 'event-images' AND (public.is_admin()
    OR EXISTS (SELECT 1 FROM establishments e WHERE e.id::text = (storage.foldername(name))[1] AND e.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM events ev JOIN establishments e ON e.id = ev.establishment_id WHERE ev.id::text = (storage.foldername(name))[1] AND e.owner_id = auth.uid())));
CREATE POLICY "Owner/admin delete event images" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'event-images' AND (public.is_admin()
    OR EXISTS (SELECT 1 FROM establishments e WHERE e.id::text = (storage.foldername(name))[1] AND e.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM events ev JOIN establishments e ON e.id = ev.establishment_id WHERE ev.id::text = (storage.foldername(name))[1] AND e.owner_id = auth.uid())));

-- promo-images (dossier = id établissement OU id promotion)
DROP POLICY IF EXISTS "Auth users can update promo images" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can delete promo images" ON storage.objects;
CREATE POLICY "Owner/admin update promo images" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'promo-images' AND (public.is_admin()
    OR EXISTS (SELECT 1 FROM establishments e WHERE e.id::text = (storage.foldername(name))[1] AND e.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM promotions pr JOIN establishments e ON e.id = pr.establishment_id WHERE pr.id::text = (storage.foldername(name))[1] AND e.owner_id = auth.uid())))
  WITH CHECK (bucket_id = 'promo-images' AND (public.is_admin()
    OR EXISTS (SELECT 1 FROM establishments e WHERE e.id::text = (storage.foldername(name))[1] AND e.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM promotions pr JOIN establishments e ON e.id = pr.establishment_id WHERE pr.id::text = (storage.foldername(name))[1] AND e.owner_id = auth.uid())));
CREATE POLICY "Owner/admin delete promo images" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'promo-images' AND (public.is_admin()
    OR EXISTS (SELECT 1 FROM establishments e WHERE e.id::text = (storage.foldername(name))[1] AND e.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM promotions pr JOIN establishments e ON e.id = pr.establishment_id WHERE pr.id::text = (storage.foldername(name))[1] AND e.owner_id = auth.uid())));

/*
  ─────────────────────────────────────────────────────────────
  SECURITY-TODO (Phase 2 — à valider sur un environnement de staging,
  car ces changements touchent des lectures utilisées partout dans le front
  et un déploiement à l'aveugle pourrait casser la prod) :

  A. PII des profils : aujourd'hui `profiles` (email, phone, questionnaire,
     orientation…) est lisible par anon + tout authentifié (USING true).
     Correctif recommandé : restreindre la table aux SELECT du propriétaire
     + admin, et exposer une VUE `public_profiles` (colonnes publiques
     uniquement : username, avatar_url, bio, catégories) → router les lectures
     "membres / profil public" du front vers cette vue.

  B. Promotions : contenu lisible par tous (le flou est CSS). Correctif :
     restreindre `promotions` SELECT aux Premium + owner + admin, et exposer
     une VUE `public_promotions` (titre, dates, image — sans value/description)
     pour le teaser des non-Premium.
  ─────────────────────────────────────────────────────────────
*/
