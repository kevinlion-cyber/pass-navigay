-- P4 : la création/possession d'un établissement fait d'un profil un compte Pro,
-- qui ne doit PAS apparaître dans l'annuaire des Membres (déjà filtré par account_type='pro').
-- On garantit que tout propriétaire d'établissement est bien taggé 'pro', quel que soit
-- le chemin de création (inscription pro OU ajout d'établissement depuis l'app).

-- 1) Backfill : les propriétaires actuels taggés 'user' passent 'pro'.
update profiles p
set account_type = 'pro'
where exists (select 1 from establishments e where e.owner_id = p.id)
  and coalesce(p.account_type, '') <> 'pro';

-- 2) Trigger : tout nouvel établissement tague son propriétaire en 'pro'.
create or replace function public.mark_owner_as_pro()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update profiles
  set account_type = 'pro'
  where id = new.owner_id
    and coalesce(account_type, '') <> 'pro';
  return new;
end;
$$;

drop trigger if exists trg_mark_owner_as_pro on establishments;
create trigger trg_mark_owner_as_pro
  after insert on establishments
  for each row
  execute function public.mark_owner_as_pro();
