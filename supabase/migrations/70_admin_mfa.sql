-- 70 — Double authentification obligatoire pour les administrateurs (24/11/2026).
-- Les pouvoirs d'administration dans la base (règles d'accès, protections des
-- droits, vues) ne sont accordés qu'à une session validée par le code de
-- l'application d'authentification (niveau « aal2 » de Supabase Auth).
-- Un mot de passe admin volé ne suffit donc plus pour lire ou modifier les données.
--
-- ⚠️ À appliquer APRÈS la mise en ligne du site qui demande le code (demande
-- GitHub « double authentification ») et après avoir activé TOTP dans
-- Supabase → Authentication → Multi-Factor.
-- Récupération si un admin perd son téléphone : Supabase → Authentication →
-- Users → l'utilisateur → supprimer son facteur MFA ; il en recréera un.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
     AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true);
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM public;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;

-- Les anciennes règles « admin » de la table profiles testaient is_admin en direct
-- (sans passer par is_admin()) : on les aligne pour qu'elles exigent aussi le code.
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile" ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete any profile" ON public.profiles;
CREATE POLICY "Admins can delete any profile" ON public.profiles FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
CREATE POLICY "Admins can insert profiles" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR auth.uid() = id);
