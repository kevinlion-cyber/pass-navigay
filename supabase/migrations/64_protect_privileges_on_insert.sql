-- 64 — C1 + E2 : empêcher l'auto-attribution de droits À LA CRÉATION
-- (la migration 31 ne protégeait que les modifications).
-- Comportement : pour un utilisateur ordinaire, les champs privilégiés sont
-- remis à leur valeur par défaut au lieu de faire échouer l'inscription.
-- Admins et service_role (webhook Stripe, fonctions serveur) : inchangé.
-- Ne modifie aucune donnée existante.

CREATE OR REPLACE FUNCTION public.protect_profile_privileges_on_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.is_admin() THEN
    RETURN NEW;
  END IF;
  NEW.is_admin                 := false;
  NEW.is_premium               := false;
  NEW.premium_expires_at       := NULL;
  NEW.premium_billing_interval := NULL;
  NEW.stripe_customer_id       := NULL;
  NEW.is_verified              := false;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_privileges_insert ON public.profiles;
CREATE TRIGGER trg_protect_profile_privileges_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileges_on_insert();

CREATE OR REPLACE FUNCTION public.protect_establishment_privileges_on_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.is_admin() THEN
    RETURN NEW;
  END IF;
  NEW.is_pro                 := false;
  NEW.pro_expires_at         := NULL;
  NEW.pro_billing_interval   := NULL;
  NEW.stripe_subscription_id := NULL;
  NEW.stripe_customer_id     := NULL;
  NEW.is_sponsor             := false;
  NEW.is_verified            := false;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_establishment_privileges_insert ON public.establishments;
CREATE TRIGGER trg_protect_establishment_privileges_insert
  BEFORE INSERT ON public.establishments
  FOR EACH ROW EXECUTE FUNCTION public.protect_establishment_privileges_on_insert();
