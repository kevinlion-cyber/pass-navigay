-- Les avis sont réservés aux membres Premium (ou admin).
-- Verrou serveur (RLS) en complément du garde-fou front. Non contournable via l'API.

-- Helper SECURITY DEFINER : l'utilisateur courant peut-il laisser un avis ?
create or replace function public.current_user_can_review()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from profiles p
    where p.id = auth.uid()
      and (p.is_premium = true or p.is_admin = true)
  );
$$;

revoke all on function public.current_user_can_review() from public, anon;
grant execute on function public.current_user_can_review() to authenticated;

-- INSERT : soi-même ET premium/admin
drop policy if exists "Users can insert their own reviews" on reviews;
drop policy if exists "Premium users can insert their own reviews" on reviews;
create policy "Premium users can insert their own reviews" on reviews
  for insert to authenticated
  with check (auth.uid() = user_id and public.current_user_can_review());

-- UPDATE : soi-même ET premium/admin
drop policy if exists "Users can update their own reviews" on reviews;
drop policy if exists "Premium users can update their own reviews" on reviews;
create policy "Premium users can update their own reviews" on reviews
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and public.current_user_can_review());
