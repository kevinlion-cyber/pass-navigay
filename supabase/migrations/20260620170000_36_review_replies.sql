/*
  # 36 — Réponses des partenaires aux avis (K2)
  Ajoute reply / reply_at à reviews + une RPC sécurisée pour que le propriétaire
  de l'établissement réponde (sans pouvoir modifier la note).
*/

ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS reply text;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS reply_at timestamptz;

CREATE OR REPLACE FUNCTION public.set_review_reply(p_review_id uuid, p_reply text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM reviews r
    JOIN establishments e ON e.id = r.establishment_id
    WHERE r.id = p_review_id AND e.owner_id = auth.uid()
  ) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Non autorisé à répondre à cet avis';
  END IF;

  UPDATE reviews
  SET reply = NULLIF(btrim(p_reply), ''),
      reply_at = CASE WHEN NULLIF(btrim(p_reply), '') IS NULL THEN NULL ELSE now() END
  WHERE id = p_review_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_review_reply(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.set_review_reply(uuid, text) TO authenticated;
