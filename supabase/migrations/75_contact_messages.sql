-- 75 — Formulaire de contact réel (27/11/2026)
--
-- Le formulaire de la page Contact n'envoyait rien (il affichait seulement « Message
-- envoyé »). Désormais la fonction contact-message l'envoie par email à l'équipe et en
-- garde une copie ici, utile si l'email se perd et pour limiter les abus.
-- Lecture réservée aux administrateurs ; écriture par la fonction (service_role) seulement.
-- Conservation : 12 mois (purge nocturne).

CREATE TABLE IF NOT EXISTS public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  email text NOT NULL CHECK (char_length(email) BETWEEN 3 AND 200),
  subject text NOT NULL CHECK (char_length(subject) <= 60),
  message text NOT NULL CHECK (char_length(message) BETWEEN 20 AND 5000),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_hash text,
  email_sent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contact_messages_ip_idx ON public.contact_messages (ip_hash, created_at);
CREATE INDEX IF NOT EXISTS contact_messages_created_idx ON public.contact_messages (created_at);

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read contact messages" ON public.contact_messages;
CREATE POLICY "Admins read contact messages" ON public.contact_messages
  FOR SELECT TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "Admins delete contact messages" ON public.contact_messages;
CREATE POLICY "Admins delete contact messages" ON public.contact_messages
  FOR DELETE TO authenticated USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.purge_old_contact_messages()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.contact_messages WHERE created_at < now() - interval '12 months';
$$;
REVOKE ALL ON FUNCTION public.purge_old_contact_messages() FROM PUBLIC, anon, authenticated;

DO $$ BEGIN PERFORM cron.unschedule('pn-purge-contact'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule('pn-purge-contact', '50 3 * * *', 'SELECT public.purge_old_contact_messages()');
