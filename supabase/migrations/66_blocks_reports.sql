-- 66 — E4 : bloquer et signaler un membre.
-- Décisions de Kévin (24/11/2026) :
--   • bloquer = plus de messages ET invisibles l'un pour l'autre (annuaire, profil,
--     conversations) ; le membre bloqué n'est pas prévenu ;
--   • signaler un membre (depuis son profil ou une conversation), avec un motif ;
--   • alerte par email + rubrique « Signalements » dans l'admin.
-- À appliquer APRÈS la 65 (la vue public_profiles ci-dessous reprend la 65).

-- ============================================================
-- 1. Blocages
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
CREATE INDEX IF NOT EXISTS user_blocks_blocked_idx ON public.user_blocks (blocked_id);
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

-- Chacun ne voit et ne gère que SES blocages (le bloqué ne sait pas qu'il l'est).
CREATE POLICY "own blocks select" ON public.user_blocks FOR SELECT TO authenticated
  USING (blocker_id = auth.uid());
CREATE POLICY "own blocks insert" ON public.user_blocks FOR INSERT TO authenticated
  WITH CHECK (blocker_id = auth.uid());
CREATE POLICY "own blocks delete" ON public.user_blocks FOR DELETE TO authenticated
  USING (blocker_id = auth.uid());

-- Vrai si l'un des deux a bloqué l'autre (lecture interne, sans exposer qui a bloqué qui).
CREATE OR REPLACE FUNCTION public.is_blocked_between(a uuid, b uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT a IS NOT NULL AND b IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE (blocker_id = a AND blocked_id = b) OR (blocker_id = b AND blocked_id = a)
  );
$$;
REVOKE ALL ON FUNCTION public.is_blocked_between(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_blocked_between(uuid, uuid) TO authenticated, anon;

-- Liste de MES blocages avec pseudo et photo (la vue publique ne les montre plus).
CREATE OR REPLACE FUNCTION public.list_my_blocks()
RETURNS TABLE (blocked_id uuid, username text, prenom text, avatar_url text, created_at timestamptz)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT b.blocked_id, p.username, p.prenom, p.avatar_url, b.created_at
  FROM public.user_blocks b JOIN public.profiles p ON p.id = b.blocked_id
  WHERE b.blocker_id = auth.uid()
  ORDER BY b.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.list_my_blocks() FROM public;
GRANT EXECUTE ON FUNCTION public.list_my_blocks() TO authenticated;

-- Messages : plus d'envoi ni de lecture entre deux membres bloqués.
DROP POLICY IF EXISTS "Premium members can send messages" ON public.messages;
CREATE POLICY "Premium members can send messages" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND (
      public.is_admin()
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_premium = true)
    )
    AND NOT public.is_blocked_between(sender_id, receiver_id)
  );

DROP POLICY IF EXISTS "Users can view their own messages" ON public.messages;
CREATE POLICY "Users can view their own messages" ON public.messages
  FOR SELECT TO authenticated
  USING (
    (auth.uid() = sender_id OR auth.uid() = receiver_id)
    AND NOT public.is_blocked_between(sender_id, receiver_id)
  );

-- Vue publique des profils : identique à la 65, + masquage des membres bloqués.
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
) v
-- Blocage (E4) : deux membres qui se sont bloqués ne se voient plus.
WHERE NOT public.is_blocked_between(auth.uid(), p.id);

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- ============================================================
-- 2. Signalements
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reported_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason text NOT NULL CHECK (reason IN ('harcelement','contenu_sexuel','faux_profil','haine','mineur','autre')),
  details text CHECK (details IS NULL OR length(details) <= 1000),
  evidence jsonb,              -- derniers messages échangés, capturés par le serveur
  context text CHECK (context IN ('profil','conversation')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  admin_note text,
  alerted_at timestamptz,
  handled_at timestamptz,
  handled_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_reports_status_idx ON public.user_reports (status, created_at DESC);
ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

-- Lecture et traitement : admins uniquement. Création : seulement via report_member().
CREATE POLICY "reports admin select" ON public.user_reports FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY "reports admin update" ON public.user_reports FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Signaler un membre. Les preuves (10 derniers messages entre les deux) sont
-- capturées ici, côté serveur : elles ne peuvent pas être inventées par le navigateur.
-- Limites : pas soi-même ; un seul signalement ouvert par couple ; 10 par jour.
CREATE OR REPLACE FUNCTION public.report_member(
  p_reported uuid, p_reason text, p_details text DEFAULT NULL, p_context text DEFAULT 'profil'
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
  existing uuid;
  new_id uuid;
  ev jsonb;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
  IF p_reported IS NULL OR p_reported = me THEN RAISE EXCEPTION 'Signalement invalide'; END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_reported) THEN RAISE EXCEPTION 'Membre introuvable'; END IF;

  SELECT id INTO existing FROM user_reports
  WHERE reporter_id = me AND reported_id = p_reported AND status = 'open' LIMIT 1;
  IF existing IS NOT NULL THEN RETURN existing; END IF;

  IF (SELECT count(*) FROM user_reports WHERE reporter_id = me AND created_at > now() - interval '1 day') >= 10 THEN
    RAISE EXCEPTION 'Trop de signalements aujourd''hui. Réessaie demain ou écris-nous.';
  END IF;

  SELECT coalesce(jsonb_agg(m ORDER BY m.created_at), '[]'::jsonb) INTO ev FROM (
    SELECT CASE WHEN sender_id = me THEN 'signaleur' ELSE 'signale' END AS auteur,
           left(content, 1000) AS contenu, created_at
    FROM messages
    WHERE (sender_id = me AND receiver_id = p_reported) OR (sender_id = p_reported AND receiver_id = me)
    ORDER BY created_at DESC LIMIT 10
  ) m;

  INSERT INTO user_reports (reporter_id, reported_id, reason, details, evidence, context)
  VALUES (me, p_reported, p_reason, nullif(left(btrim(coalesce(p_details, '')), 1000), ''), ev,
          CASE WHEN p_context = 'conversation' THEN 'conversation' ELSE 'profil' END)
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;
REVOKE ALL ON FUNCTION public.report_member(uuid, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.report_member(uuid, text, text, text) TO authenticated;
