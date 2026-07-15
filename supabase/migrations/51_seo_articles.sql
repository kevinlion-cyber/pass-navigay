-- Module 4 (SEO) — couche de contenu éditorial. Articles/guides evergreen rédigés
-- à la main (pas d'IA), servis en SSR par l'edge function, maillés au silo.
create table if not exists public.seo_articles (
  slug              text primary key,
  type              text not null default 'guide',   -- guide | info
  title             text not null,                    -- <title> SEO
  h1                text,                             -- titre affiché (défaut = title court)
  meta_description  text,
  excerpt           text,                             -- résumé (carte d'index)
  hero_emoji        text,
  body_html         text not null,
  related_category  text,                             -- clé catégorie → lien hub
  related_city      text,                             -- ville → lien hub
  sort              integer not null default 0,
  published         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.seo_articles enable row level security;
drop policy if exists "seo_articles public read" on public.seo_articles;
create policy "seo_articles public read" on public.seo_articles for select using (published = true);
