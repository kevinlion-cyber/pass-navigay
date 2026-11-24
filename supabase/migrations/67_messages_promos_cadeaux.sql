-- 67 — Points moyens de l'audit (validés par Kévin le 24/11/2026)
--   M5 : un message reçu ne peut plus être réécrit (seul « lu » peut changer).
--   M6 : la limite d'utilisations d'une promotion est appliquée par la base.
--   M7 : les Premium / Pro arrivés à échéance repassent en gratuit chaque nuit
--        (3 jours de grâce, pour ne pas pénaliser un renouvellement Stripe en retard).

-- ============================================================
-- M5 — messages : seule la colonne is_read peut être modifiée
-- ============================================================
CREATE OR REPLACE FUNCTION public.protect_message_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
  IF (to_jsonb(NEW) - 'is_read') IS DISTINCT FROM (to_jsonb(OLD) - 'is_read') THEN
    RAISE EXCEPTION 'Seul le statut « lu » d''un message peut être modifié';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_protect_message_update ON public.messages;
CREATE TRIGGER trg_protect_message_update
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.protect_message_update();

-- ============================================================
-- M6 — promotions : compteur tenu par la base + limite appliquée
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_promotion_use()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p record;
BEGIN
  -- Verrou sur la promotion : deux utilisations simultanées ne dépassent pas la limite.
  SELECT max_uses, current_uses, valid_until, is_active INTO p
  FROM promotions WHERE id = NEW.promotion_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROMO_INTROUVABLE'; END IF;
  IF p.is_active = false THEN RAISE EXCEPTION 'PROMO_INACTIVE'; END IF;
  IF p.valid_until IS NOT NULL AND p.valid_until < now() THEN RAISE EXCEPTION 'PROMO_EXPIREE'; END IF;
  IF p.max_uses IS NOT NULL AND p.max_uses > 0 AND coalesce(p.current_uses, 0) >= p.max_uses THEN
    RAISE EXCEPTION 'PROMO_LIMITE_ATTEINTE';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_check_promotion_use ON public.promotion_uses;
CREATE TRIGGER trg_check_promotion_use
  BEFORE INSERT ON public.promotion_uses
  FOR EACH ROW EXECUTE FUNCTION public.check_promotion_use();

CREATE OR REPLACE FUNCTION public.count_promotion_use()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE promotions SET current_uses = coalesce(current_uses, 0) + 1 WHERE id = NEW.promotion_id;
  ELSE
    UPDATE promotions SET current_uses = greatest(coalesce(current_uses, 0) - 1, 0) WHERE id = OLD.promotion_id;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_count_promotion_use ON public.promotion_uses;
CREATE TRIGGER trg_count_promotion_use
  AFTER INSERT OR DELETE ON public.promotion_uses
  FOR EACH ROW EXECUTE FUNCTION public.count_promotion_use();

-- Remise à niveau des compteurs existants (ils n'avaient jamais été incrémentés).
UPDATE public.promotions pr
SET current_uses = sub.n
FROM (
  SELECT p.id, count(u.id)::int AS n
  FROM public.promotions p LEFT JOIN public.promotion_uses u ON u.promotion_id = p.id
  GROUP BY p.id
) sub
WHERE sub.id = pr.id AND coalesce(pr.current_uses, 0) <> sub.n;

-- ============================================================
-- M7 — expiration automatique des Premium / Pro (offerts ou Stripe en retard)
-- ============================================================
CREATE OR REPLACE FUNCTION public.expire_offers()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  n_prem int;
  n_pro int;
BEGIN
  -- Les protections des colonnes privilégiées (migrations 31 / 64) laissent passer
  -- le service_role : on s'identifie comme tel pour cette tâche planifiée.
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);

  UPDATE profiles SET is_premium = false
  WHERE is_premium = true AND premium_expires_at IS NOT NULL
    AND premium_expires_at < now() - interval '3 days';
  GET DIAGNOSTICS n_prem = ROW_COUNT;

  UPDATE establishments SET is_pro = false
  WHERE is_pro = true AND pro_expires_at IS NOT NULL
    AND pro_expires_at < now() - interval '3 days';
  GET DIAGNOSTICS n_pro = ROW_COUNT;

  RETURN jsonb_build_object('premium_expires', n_prem, 'pro_expires', n_pro);
END;
$$;
REVOKE ALL ON FUNCTION public.expire_offers() FROM public, anon, authenticated;

-- Tâche planifiée : chaque nuit à 3 h 15 (heure du serveur, UTC).
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'pn-expire-offres';
SELECT cron.schedule('pn-expire-offres', '15 3 * * *', 'SELECT public.expire_offers();');
