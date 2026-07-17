-- Demandes Kevin (juillet 2026) :
--  1) OUVRIR les avis à tout le monde en lecture ET écriture (gratuit + Premium).
--     → annule la restriction Premium posée par la migration 37 (migration corrective, on ne modifie pas la 37).
--  2) RÉSERVER la galerie photo aux établissements Pro (aujourd'hui n'importe quel
--     propriétaire, même gratuit, peut ajouter des photos).

-- 1) Avis : tout membre connecté peut écrire/modifier SON avis (la lecture était déjà publique).
drop policy if exists "Premium users can insert their own reviews" on public.reviews;
create policy "Members can insert their own reviews" on public.reviews
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Premium users can update their own reviews" on public.reviews;
create policy "Members can update their own reviews" on public.reviews
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2) Galerie photo : ajout/modif réservés aux propriétaires d'un établissement PRO.
--    (La suppression reste ouverte au propriétaire : un Pro expiré doit pouvoir retirer ses photos.)
drop policy if exists "Establishment owners can insert photos" on public.establishment_photos;
create policy "Pro owners can insert photos" on public.establishment_photos
  for insert to authenticated with check (
    exists (
      select 1 from public.establishments e
      where e.id = establishment_photos.establishment_id
        and e.owner_id = auth.uid()
        and e.is_pro = true
    )
  );

drop policy if exists "Establishment owners can update photos" on public.establishment_photos;
create policy "Pro owners can update photos" on public.establishment_photos
  for update to authenticated using (
    exists (
      select 1 from public.establishments e
      where e.id = establishment_photos.establishment_id
        and e.owner_id = auth.uid()
        and e.is_pro = true
    )
  ) with check (
    exists (
      select 1 from public.establishments e
      where e.id = establishment_photos.establishment_id
        and e.owner_id = auth.uid()
        and e.is_pro = true
    )
  );
