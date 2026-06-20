/*
  # 35 — Lecture admin des promotion_uses (KPI « Promos utilisées » du tableau de bord)
*/
CREATE POLICY "Admins can read promotion_uses" ON public.promotion_uses
  FOR SELECT TO authenticated USING (public.is_admin());
