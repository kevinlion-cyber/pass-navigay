-- Publication automatique en fin de création de ville.
--
-- Créer une ville puis devoir aller sur une autre page pour la publier n'a pas
-- de sens : la commande peut aller jusqu'au bout toute seule. Ces deux compteurs
-- suivent la mise en ligne, distincte de la rédaction (`done` / `failed`).

alter table city_jobs add column if not exists published int not null default 0;
alter table city_jobs add column if not exists publish_failed int not null default 0;

comment on column city_jobs.published is
  'Fiches mises en ligne quand la publication automatique est demandée.';
comment on column city_jobs.publish_failed is
  'Fiches dont la publication a échoué : elles restent « à valider » et sont reprises.';
