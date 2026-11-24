-- 68 — M2 : protection de la connexion Facebook / Instagram (paramètre « state »).
-- Avant, n'importe quel compte Facebook passant par l'adresse de retour pouvait
-- remplacer la page connectée de Pass Navigay par la sienne. Désormais l'admin
-- crée un jeton à usage unique avant de partir chez Facebook, et la fonction
-- meta-oauth refuse tout retour sans jeton valide (moins de 15 minutes).

CREATE TABLE IF NOT EXISTS public.oauth_states (
  state text PRIMARY KEY CHECK (length(state) BETWEEN 32 AND 200),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;

-- Seul un admin peut créer un jeton, à son nom. Personne ne peut les relire
-- depuis le navigateur ; la fonction meta-oauth les consomme côté serveur.
CREATE POLICY "admins create oauth states" ON public.oauth_states
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.is_admin());
