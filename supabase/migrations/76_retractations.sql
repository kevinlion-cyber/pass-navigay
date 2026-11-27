-- 76 — Rétractation en ligne des abonnements Premium (27/11/2026)
--
-- Depuis le 19 juin 2026 (art. L221-21 du Code de la consommation), un abonnement
-- souscrit en ligne par un particulier doit offrir une fonction « Renoncer au contrat
-- ici » pendant les 14 jours du délai de rétractation, avec accusé de réception.
--
-- Chaque demande est gardée ici comme preuve (déclaration, date et heure, montants).
-- Écriture : uniquement par la fonction retractation-premium (service_role).
-- Lecture : le membre voit ses propres demandes ; les admins voient et mettent à jour
-- (marquer « remboursé »).
-- Conservation : 5 ans (délai de prescription commerciale), puis purge nocturne.

CREATE TABLE IF NOT EXISTS public.retractations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  stripe_subscription_id text NOT NULL UNIQUE,
  stripe_customer_id text,
  nom text NOT NULL CHECK (char_length(nom) BETWEEN 1 AND 120),
  email text NOT NULL CHECK (char_length(email) BETWEEN 3 AND 200),
  formule text,                                   -- 'monthly' | 'yearly'
  souscrit_le timestamptz NOT NULL,
  demande_le timestamptz NOT NULL DEFAULT now(),
  montant_paye_centimes integer NOT NULL DEFAULT 0,
  montant_du_centimes integer NOT NULL DEFAULT 0, -- période utilisée (art. L221-25)
  montant_a_rembourser_centimes integer NOT NULL DEFAULT 0,
  statut text NOT NULL DEFAULT 'a_rembourser' CHECK (statut IN ('a_rembourser', 'rembourse', 'rien_a_rembourser')),
  rembourse_le timestamptz,
  accuse_envoye boolean NOT NULL DEFAULT false,
  note text
);
CREATE INDEX IF NOT EXISTS retractations_user_idx ON public.retractations (user_id);
CREATE INDEX IF NOT EXISTS retractations_demande_idx ON public.retractations (demande_le);

ALTER TABLE public.retractations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Membre lit ses retractations" ON public.retractations;
CREATE POLICY "Membre lit ses retractations" ON public.retractations
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins lisent les retractations" ON public.retractations;
CREATE POLICY "Admins lisent les retractations" ON public.retractations
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Admins mettent a jour les retractations" ON public.retractations;
CREATE POLICY "Admins mettent a jour les retractations" ON public.retractations
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Aucune politique INSERT / DELETE : seule la fonction (service_role) écrit.

CREATE OR REPLACE FUNCTION public.purge_old_retractations()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.retractations WHERE demande_le < now() - interval '5 years';
$$;
REVOKE ALL ON FUNCTION public.purge_old_retractations() FROM PUBLIC, anon, authenticated;

DO $$ BEGIN PERFORM cron.unschedule('pn-purge-retractations'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule('pn-purge-retractations', '55 3 * * *', 'SELECT public.purge_old_retractations()');
