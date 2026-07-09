-- Notifications push web : abonnements par appareil + préférence utilisateur.
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;

drop policy if exists "own push subs select" on push_subscriptions;
create policy "own push subs select" on push_subscriptions for select to authenticated using (auth.uid() = user_id);
drop policy if exists "own push subs insert" on push_subscriptions;
create policy "own push subs insert" on push_subscriptions for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "own push subs delete" on push_subscriptions;
create policy "own push subs delete" on push_subscriptions for delete to authenticated using (auth.uid() = user_id);

-- Préférence : recevoir (ou non) les notifications de messages. Activé par défaut.
alter table profiles add column if not exists notify_messages boolean not null default true;

-- Rafraichissement d un abonnement existant (upsert).
drop policy if exists "own push subs update" on push_subscriptions;
create policy "own push subs update" on push_subscriptions for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
