# CLAUDE.md — PASS NAVIGAY

## ⚡ À LIRE EN PREMIER (mis à jour le 24/11/2026)

* **Sécurité** : un audit complet a été réalisé et corrigé le 24/11/2026 (demandes GitHub #1 à #12,
  migrations 64 à 69). Avant toute modification touchant aux droits, aux profils, aux paiements ou aux
  données sensibles, lire la section **« 13. SÉCURITÉ — ÉTAT AU 24/11/2026 »** en bas de ce fichier.
* **Données intimes** : orientation, identité de genre, pronoms, attirance et « ce que je recherche » ne
  sont enregistrés et montrés qu'avec un consentement explicite (RGPD, migration 69). Ne jamais lire la
  table `profiles` pour afficher un autre membre : passer par la vue `public_profiles`.
* **Fonctions Supabase** : la plupart sont désormais autonomes (pas d'import `../_shared`) pour pouvoir
  être redéployées depuis le tableau de bord. Conserver ce principe.
* Note historique : l'ancien prestataire utilisait un dossier mémoire sur sa propre machine
  (`C:\Users\magic\...`) et un fichier `REPRISE-NOUVEAU-COMPTE.md`. Ni l'un ni l'autre n'est disponible
  dans ce dépôt ni sur le poste de Kévin : ne pas les chercher.


Document de contexte projet pour Claude Code. À placer à la racine du projet. Ce fichier décrit l'intégralité du projet Pass Navigay : architecture, stack, base de données, fonctionnalités, design et règles métier.

## 1. VUE D'ENSEMBLE

Pass Navigay est un annuaire web LGBT-friendly couvrant la France, accessible à l'adresse passnavigay.com. La plateforme permet de découvrir des établissements, événements et promotions inclusifs, d'échanger avec une communauté et d'accéder à des offres exclusives.

Le projet comporte trois espaces distincts :

1. L'application publique/utilisateur (`/`) — mobile-first, tutoiement, ton chaleureux et communautaire
2. L'espace partenaire (`/pros`) — pour les établissements, vouvoiement, ton professionnel
3. L'espace administrateur (`/admin`) — gestion complète, protégé par mot de passe

Le projet a été initialement développé avec Bolt.new puis migré vers Claude Code pour la suite du développement.

## 2. STACK TECHNIQUE

* Framework : React + TypeScript + Vite
* Styling : Tailwind CSS + CSS variables custom
* Routing : React Router v7
* Base de données + Auth + Storage : Supabase (PostgreSQL)
* Temps réel : Supabase Realtime (messagerie, validations de promos)
* Paiements : Stripe (abonnements récurrents via Stripe Billing + webhooks)
* Cartographie : Google Maps JavaScript API (Maps, Places, Geocoding, Directions)
* Emails : Resend (via Supabase Edge Functions)
* Versioning : GitHub
* Hébergement : Netlify (CI/CD depuis GitHub)
* Crop d'images : react-easy-crop
* Graphiques admin : recharts
* Notifications : react-hot-toast

### Variables d'environnement

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_STRIPE_PUBLISHABLE_KEY=
VITE_GOOGLE_MAPS_KEY=
# Côté serveur / Edge Functions
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
RESEND_API_KEY=
APP_URL=
```

## 3. DESIGN SYSTEM

### Couleurs

```css
--purple: #7B2D8B;          /* couleur principale */
--purple-light: #c084f5;    /* accents, mode sombre */
--purple-dark: #2d0d3d;
--purple-glow: rgba(123, 45, 139, 0.25);
--light-secondary: #f3e8f8;
--gold: #d4a017;            /* badges Premium/Pro, étoiles */
--success: #1a7a3a;
--alert: #c0392b;

/* Mode sombre */
--bg-dark: #0a0a0f;
--bg-dark-secondary: #0f0f17;
--surface-dark: #14141e / #16161f;
--border-dark: #1e1e2e / #2a2a35;

/* Mode clair */
--bg-light: #f7f5f0;
--surface-light: #ffffff;
--border-light: #e5e0da;
```

### Thèmes

L'app utilisateur propose deux thèmes : sombre (défaut) et clair. Le choix est sauvegardé dans `profiles.theme` et dans localStorage. Implémenté via une classe `dark` sur `<html>`.

### Typographie

Police Inter hébergée sur le site (`public/fonts`, fichier variable 100–900, licence OFL ; plus de Google Fonts depuis le 27/11/2026). Design plat, pas de gradients lourds.

### Composants UI

* Border-radius : 12px (cartes), 20px (pills/badges), 8px (inputs)
* Pills de filtre : hauteur 28px, font-size 12px
* Boutons primaires : fond violet, hover plus clair
* Badges : Pro/Premium en violet ou doré, Gratuit en gris

## 4. SCHÉMA DE BASE DE DONNÉES (SUPABASE)

### Table `profiles`

Extension de `auth.users`.

```
id uuid PK (ref auth.users)
username text unique
prenom text
nom text
phone text
email text
avatar_url text
bio text
is_premium boolean default false
premium_expires_at timestamptz
is_admin boolean default false
stripe_customer_id text
theme text default 'dark'
show_onboarding boolean default true
show_disclaimer boolean default true
created_at timestamptz

-- Questionnaire Premium
gender_identity text
pronouns text
attracted_to text[]
orientation text
looking_for text[]
relationship_intensity text
vibe text
evening_energy text
green_flags text[]
red_flags text[]
community_involvement text
community_goals text[]
ideal_type text
deal_breaker text
what_i_bring text
if_i_were_vibe text
if_i_were_music text
if_i_were_energy text
late_truth text
questionnaire_completed boolean default false
profile_visibility jsonb
```

### Table `establishments`

```
id uuid PK
owner_id uuid (ref profiles) -- null si créé par admin
name text
address text
city text
postal_code text
latitude float
longitude float
category text -- 'se_loger'|'shopping'|'manger'|'soiree'|'bien_etre'|'culture'
subcategory text
description text
phone text
website text
is_pro boolean default false
pro_expires_at timestamptz
stripe_subscription_id text
stripe_customer_id text
banner_url text
logo_url text
is_sponsor boolean default false  -- gardé en base, plus exposé dans l'UI
is_verified boolean default false -- gardé en base, plus exposé dans l'UI
created_at timestamptz
```

### Table `establishment_photos`

```
id uuid PK
establishment_id uuid (ref establishments, cascade)
url text
caption text
order_index int default 0
created_at timestamptz
```

### Table `events`

```
id uuid PK
establishment_id uuid (ref establishments, cascade)
title text
description text
event_date timestamptz
end_date timestamptz
address text
latitude float
longitude float
theme text
price numeric(10,2) default 0
is_free boolean default true
image_url text
is_featured boolean default false
created_at timestamptz
```

### Table `promotions`

```
id uuid PK
establishment_id uuid (ref establishments, cascade)
title text
description text
promo_type text -- 'percentage'|'fixed'|'offer'
value numeric(10,2)
image_url text
valid_from timestamptz
valid_until timestamptz
is_recurring boolean default false
recurrence_rule text -- ex: 'WEEKLY:TUESDAY,FRIDAY'
max_uses int
current_uses int default 0
created_at timestamptz
```

### Table `promotion_uses`

```
id uuid PK
promotion_id uuid (ref promotions, cascade)
user_id uuid (ref profiles)
used_at timestamptz default now()
UNIQUE(promotion_id, user_id)
```

### Table `messages`

```
id uuid PK
sender_id uuid (ref profiles)
receiver_id uuid (ref profiles)
content text
is_read boolean default false
created_at timestamptz
```

### Table `favorites`

```
id uuid PK
user_id uuid (ref profiles)
establishment_id uuid (ref establishments)
created_at timestamptz
UNIQUE(user_id, establishment_id)
```

### Table `reviews`

```
id uuid PK
user_id uuid (ref profiles)
establishment_id uuid (ref establishments)
rating int (1-5)
comment text
created_at timestamptz
UNIQUE(user_id, establishment_id)
```

### Table `admin_gifts`

```
id uuid PK
recipient_id uuid
recipient_type text -- 'user'|'establishment'
gift_type text -- 'premium'|'pro'
days_added int
new_expiry timestamptz
note text
created_at timestamptz
```

### Table `app_settings`

```
key text PK
value text
updated_at timestamptz
```

Clés : `disclaimer_text`, `onboarding_title`, `onboarding_text`, `maintenance_mode`, `legal_mentions`, `legal_cgu`, `legal_confidentialite`, `legal_contact_text`.

### Storage buckets (tous publics en lecture)

`avatars`, `establishment-logos`, `establishment-banners`, `establishment-photos`, `event-images`, `promo-images`.

### RLS

RLS activé sur toutes les tables. La table `profiles` n'est lisible que par son propriétaire et les admins ; les autres lisent la vue `public_profiles`, qui filtre selon qui regarde (voir section 13). Messages lisibles uniquement par expéditeur et destinataire (et masqués entre membres bloqués). Établissements lisibles publiquement, modifiables par leur owner.

## 5. MODÈLE ÉCONOMIQUE

* Utilisateur Gratuit : profil basique, consultation annuaire et événements. Pas d'accès aux promos, pas de messagerie.
* Utilisateur Premium — 6,69 € TTC/mois ou 69 € TTC/an : accès aux promotions, messagerie entre membres Premium, profil enrichi avec questionnaire, filtres avancés.
* Établissement Gratuit : fiche basique (nom, adresse, type) dans l'annuaire.
* Établissement Pro — 69 € TTC/mois ou 690 € TTC/an : bannière, galerie, événements, promotions, visibilité renforcée.
* Cases légales (27/11/2026) : âge 18+ et CGU à l'inscription (preuve dans les métadonnées du compte), demande d'exécution immédiate avant paiement Premium, acceptation des conditions de vente avant paiement Pro (preuve dans les métadonnées de l'abonnement Stripe). Composant `CaseConsentement`.
* Sponsors : établissements mis en avant et intercalés dans les résultats (géré côté admin).

## 6. APPLICATION UTILISATEUR (`/`)

Ton : tutoiement, chaleureux, inclusif, communautaire.

### Routes

```
/                    → Onboarding / Landing
/explore             → Interface principale (carte + liste)
/establishment/:id   → Fiche établissement
/establishment/new   → Créer un établissement
/establishment/:id/edit
/events              → Liste des événements
/events/:id          → Détail événement
/promos              → Liste des promotions
/promos/:id          → Détail promotion
/members             → Liste des membres
/profile/:userId     → Profil public d'un membre
/profile/settings    → Paramètres du compte
/messages            → Conversations DM
/messages/:userId    → Conversation
/legal/mentions, /legal/cgu, /legal/confidentialite, /legal/contact
```

### Navigation

* Bottom nav mobile (4 onglets) : Lieux · Événements · Promos · Membres
* Top bar : logo "Pass Navigay" bicolore (Pass blanc/noir, Navigay violet) à gauche ; à droite, si connecté : cloche notifications messages + avatar (→ profil) ; si non connecté : bouton "Connexion"

### Onboarding

Page d'accueil explicative (affichée tant que `show_onboarding = true`), countdown 5s avant la case "Ne plus afficher". Bouton "Explorer" → accès direct à `/explore` SANS inscription obligatoire.

### Inscription (tunnel en modale, 3 étapes)

* Étape 0 : choix du plan (tableau comparatif Gratuit vs Premium). Bouton "Créer mon compte" (jamais "gratuit").
* Étape 1 : infos perso (prénom, nom, email, téléphone, mot de passe avec indicateur de force, confirmation)
* Étape 2 : vérification email OTP (Supabase)
* Si plan Premium choisi → Stripe Checkout après inscription
* Disclaimer sécurité affiché en modale à la première connexion

### Page Explore `/explore`

Ordre vertical des éléments (IMPORTANT) :

1. Bandeau événements featured (scrollable horizontal, tout en haut)
2. Barre de recherche (filtre nom/ville/adresse/description, debounce 300ms)
3. Filtres catégories (dropdowns, pas de sliders) : Tout, Se loger, Shopping, Manger, Soirée, Bien-être, Culture + sous-catégories en dropdown
4. Carte Google Maps + liste

Carte : centre par défaut Montpellier `[3.8767, 43.6119]` zoom 13. Markers violets (normaux) et dorés (sponsors). Sur mobile : carte hauteur 40dvh + liste scrollable dessous (les deux visibles). Au clic sur un pin : popup riche (photo, nom, badges, note, promo active, événement à venir, bouton "Voir la fiche"). Les markers NE DOIVENT PAS bouger au survol (anchor center, pas de transition CSS).

Catégories (refonte du 27/11/2026, migration 79 — clés inchangées, noms à touche LGBT ; la liste en ligne
est modifiable dans Admin → Catégories, `app_settings.categories_config`) :

```
se_loger   Dormir safe            : Maison d'hôtes, Hôtel, Location entre particuliers, Gîte, Camping, Auberge de jeunesse
manger     Se régaler             : Restaurant, Brunch, Café, Salon de thé, Fast-food, Boulangerie & pâtisserie, Traiteur
soiree     Sortir & faire la fête : Bar gay, Bar lesbien, Bar queer & inclusif, Bar chill, Bar musical, Bar à cocktails, Bar à vins, Club & boîte de nuit, Cabaret & drag, Karaoké
shopping   Shopping & pépites     : Mode & vêtements, Friperie & seconde main, Chaussures, Bijoux & accessoires, Déco & maison, Art & créateurs, Librairie, Fleuriste, Jeux
bien_etre  Prendre soin de soi    : Spa & hammam, Sauna, Massage, Esthétique, Coiffure & barbier
culture    Culture & spectacles   : Musée, Galerie d'art, Théâtre, Cinéma, Concert & spectacle, Visite guidée, Festival, Autres
communaute Communauté & santé     : Centre LGBT, Association, Santé sexuelle & dépistage, Écoute & soutien
services   Pros safe              : Tatouage & piercing, Photographe, Avocat & juriste, Psy & thérapeute, Agence voyage & mariage, Autres services
sport      Sport & plein air      : Club sportif LGBT, Salle de sport, Danse, Yoga, Escalade, Plage, Plage naturiste, Rando & nature
adulte     Coquin 18+             : Sauna gay, Sex-shop & lingerie, Bar cruising & fetish, Club sexe & backroom, Club libertin, Cinéma adulte
```
Ne jamais renommer une sous-catégorie dans l'admin sans reclasser les fiches (le nom est stocké tel quel sur
chaque fiche). Coquin 18+ : aucune image explicite (art. 227-24 du Code pénal).

### Fiche établissement

* Gratuit : nom, type, adresse + mini-carte, avis/notes, favoris, partage
* Pro : + bannière, galerie (lightbox), description, coordonnées, événements, promotions, boutons partage réseaux sociaux
* Itinéraire via Google Maps Directions (à pied/voiture/transports/vélo)
* Événements et promos cliquables → pages détail dédiées (données chargées via l'ID, jamais en state)

### Promotions

* Utilisateur gratuit : promos floutées avec overlay "Réservé aux membres Premium"
* Utilisateur Premium : bouton "Utiliser cette promotion" → modale de confirmation (avertissement : être sur place, action irréversible) → validation enregistrée dans `promotion_uses`, bouton remplacé par badge "Utilisée le [date]"

### Membres

Liste avec photos (i.pravatar / vraies photos), prénom, badge Premium, centres d'intérêt en pills, dernière activité. Profil public riche pour les Premium (sections du questionnaire selon `profile_visibility`). Bouton "Envoyer un message" (sticky) → réservé Premium.

### Messagerie

Supabase Realtime. Réservée aux membres Premium.

### Profil `/profile/settings`

Page scrollable verticale (pas d'onglets) avec sections : photo (crop 1:1), infos, Mes favoris, Mes événements, Mes promos, Paramètres (thème, abonnement Stripe, déconnexion, suppression compte). Bouton "Modifier mon questionnaire" pour les Premium.

### Questionnaire Premium (style chat)

S'affiche après paiement Premium. 10 sections (identité, radar à crush, intentions, vibe, green flags, red flags, communauté, compatibilité, questions fun, vérité). Interface chat avec typing indicator, bulles, boutons de choix cliquables. Sauvegarde progressive à chaque réponse. Ton décalé, inclusif, sans jugement.

## 7. ESPACE PARTENAIRE (`/pros`)

Ton : vouvoiement, professionnel.

### Routes

```
/pros                    → Landing marketing
/pros/inscription        → Modale 3 étapes
/pros/connexion          → Modale
/pros/tableau-de-bord
/pros/mon-etablissement  → Infos + logo + bannière + galerie intégrée
/pros/evenements
/pros/promotions
/pros/abonnement
```

### Layout

Header minimal (56px) + sidebar fixe gauche 240px (drawer sur mobile). Items : Tableau de bord, Mon établissement, Événements, Promotions, ─── , Abonnement, Se déconnecter (bas). Badges de notification (nb événements, nb promos). En-tête sidebar : logo établissement + badge Pro/Gratuit.

### Landing `/pros`

Marketing statique (vouvoiement) : hero avec image, chiffres clés, "Pourquoi nous rejoindre", comparatif Gratuit/Pro 69€, témoignages, CTA. Footer avec liens légaux fonctionnels. NE PAS mentionner Montpellier (couverture France entière).

### Inscription partenaire (modale 3 étapes)

* Étape 1 : infos perso (prénom, nom, email pro, téléphone, mot de passe)
* Étape 2 : établissement (nom, catégorie/sous-catégorie dynamique, adresse Google Places autocomplete, ville, CP, téléphone, site, description 500 car.)
* Étape 3 : logo (crop 1:1), bannière (crop 16:9), galerie jusqu'à 5 photos (crop 4:3)
* Soumission séquentielle : Auth → profil → logos → établissement → photos → redirect dashboard

### Mon établissement

Page complète : infos générales, coordonnées, visuels (logo + bannière), galerie intégrée (jusqu'à 20 photos, légendes éditables debounce, suppression immédiate, upload au save). Un seul bouton "Enregistrer".

### Événements & Promotions

Formulaires complets en modale. Événement : photo 3:2, titre, description, thème, dates, lieu, tarif, places, demande mise en avant. Promo : visuel 4:3, titre, description, type (% / fixe / offre en boutons radio), valeur, dates, récurrence (jours de semaine), limite d'utilisations. Vue des utilisations récentes avec temps réel (Supabase Realtime) sur chaque promo.

### Abonnement

Si Gratuit : page de vente Pro. Si Pro : statut, barre de progression période, gestion Stripe Customer Portal, zone de résiliation.

## 8. ESPACE ADMIN (`/admin`)

Ton : neutre professionnel. Accès réservé aux comptes Supabase avec `profiles.is_admin = true` (vérifié en base ; l'ancien mot de passe `admin2025` n'existe plus).

### Layout

Header + sidebar gauche. Items : Tableau de bord, Établissements, Événements, Promotions, Membres, Partenaires, Cadeaux offerts, Paramètres, Contenu légal.

### Pages

* Tableau de bord : 4 metric cards (membres, établissements, événements, promos), graphique inscriptions 30j (recharts), derniers inscrits, derniers établissements
* Établissements : tableau, filtres (catégorie/statut Gratuit-Pro), statut = badge unique Pro ou Gratuit. Actions : ✏️ Modifier (sidebar avec galerie + photos + crop + toggles Pro/Sponsor) · 🔗 Voir · 🗑 Supprimer. Export CSV. Pagination 20/page.
* Événements : tableau, toggle featured inline, ✏️ Modifier (sidebar) · 👁 Voir · 🗑 Supprimer
* Promotions : tableau, ✏️ Modifier (sidebar) · 🗑 Supprimer
* Membres : tableau avec colonne email. Actions : 👁 Voir (sidebar riche : bio, activité, favoris, bouton "Offrir Premium", bouton supprimer) · 🗑 Supprimer
* Partenaires : établissements avec owner, revenu mensuel estimé (nb Pro × 69€)
* Cadeaux offerts `/admin/gifts` : log des périodes Premium/Pro offertes
* Paramètres : disclaimer, onboarding, mode maintenance
* Contenu légal : 4 onglets éditables (mentions, CGU, confidentialité, contact) → écrit dans `app_settings`, lu par les pages `/legal/*`

### Offrir une période Premium/Pro

Bouton dans la sidebar membre (Premium) ou établissement (Pro). Modale : durée (raccourcis 7j/14j/1mois/3mois/6mois/1an/perso) + aperçu date + note interne. La durée s'incrémente depuis la date d'expiration actuelle si elle est dans le futur, sinon depuis aujourd'hui. Loggé dans `admin_gifts`.

## 9. STRIPE — WEBHOOKS

Destination Stripe « PassNavigay – Supabase » (créée le 24/11/2026) vers l'Edge Function `stripe-webhook`
(déployée **sans** vérification JWT ; sécurité = signature Stripe vérifiée avec `constructEventAsync`).
Événements écoutés :

* `checkout.session.completed` → active Premium (`metadata.userId`) ou Pro (`metadata.establishmentId`)
* `invoice.paid` → renouvellement : nouvelle date de fin lue sur l'abonnement Stripe
* `customer.subscription.updated` → résiliation en fin de période, impayé, changement de formule
* `customer.subscription.deleted` → désactive

La date de fin d'accès est toujours celle de la période payée chez Stripe. En cas d'échec d'écriture, la
fonction répond 500 pour que Stripe réessaie. Secret : `STRIPE_WEBHOOK_SECRET`.
Les Premium / Pro échus depuis plus de 3 jours repassent en gratuit chaque nuit (`expire_offers`, pg_cron).

## 10. RÈGLES & CONVENTIONS DU PROJET

1. Tutoiement dans l'app utilisateur. Vouvoiement dans `/pros` (landing + espace partenaire). Ton neutre dans l'admin.
2. Toutes les données dynamiques viennent de Supabase. Jamais de données mockées présentées comme réelles. (Les chiffres marketing de la landing `/pros` sont volontairement statiques.)
3. Copyright / IP : code cédé au client après paiement intégral.
4. Gestion d'erreurs : try/catch sur tous les appels Supabase, toasts (vert succès / rouge erreur).
5. Loading states : skeleton loaders sur listes et tableaux, spinners sur les actions.
6. Responsive : mobile-first. Breakpoints mobile < 768px, tablette 768-1024px, desktop > 1024px.
7. Confirmation avant suppression : modale "Es-tu sûr ?" pour toute action irréversible.
8. Accents et caractères français corrects partout (é, è, ê, ô, û, î, ç…).
9. Crop d'images : composant réutilisable `ImageUploadWithCrop` (react-easy-crop) avec ratios imposés : logo 1:1, bannière 16:9, événement 3:2, promo 4:3, galerie 4:3, avatar 1:1.
10. Pas de localStorage/sessionStorage pour les données métier — sauf le flag admin et le thème.
11. Sécurité : les contraintes UNIQUE en base (promotion_uses, favorites, reviews) sont la vraie protection, pas les vérifs côté client.

## 11. ÉTAT D'AVANCEMENT & POINTS À VÉRIFIER

Le projet est fonctionnel et déployé en preview. Points à valider ou potentiellement encore en cours lors de la migration :

* Vouvoiement complet sur `/pros` (demandé tardivement)
* Validation des promos avec temps réel côté pro
* Offre de périodes Premium/Pro depuis l'admin
* Migration de Mapbox vers Google Maps (le client a demandé Google Maps pour les itinéraires)
* Configuration des comptes de production (Supabase, Stripe, Resend, Google Maps, Netlify, domaine) gérés par le client

Toujours vérifier l'état réel du code avant d'implémenter — certaines fonctionnalités listées peuvent être partiellement faites.

## 12. INFOS CONTRACTUELLES

* Prestataire : FL POWER (SASU), Frédéric Lemonnier
* Client : IDKL (SASU), Kévin Lion
* Domaine : passnavigay.com
* Hébergement et services tiers : entièrement gérés par le client
* Garantie : correction des bugs pendant 1 mois (à partir du 15 juin 2026). Les nouvelles fonctionnalités sont facturées séparément.

## 13. SÉCURITÉ — ÉTAT AU 24/11/2026

Rapport d'audit complet : document « Audit initial PassNavigay » (Claude Docs). Résumé des protections en place :

* **Droits** : déclencheurs qui empêchent un utilisateur de se donner `is_admin`, `is_premium`, `is_pro`,
  `is_verified`, `is_sponsor` ou des dates d'abonnement, à la création (migration 64) comme à la
  modification (migration 31). Seuls un admin ou le `service_role` le peuvent.
* **Profils** : vue `public_profiles` (migrations 65, 66, 69) — visiteur / gratuit / pro : pseudo, prénom,
  initiale du nom, photo, badges ; Premium : bio, ville, galerie, et réponses du questionnaire seulement si
  le membre les a rendues visibles ET a consenti pour les données sensibles ; le membre lui-même et les
  admins : tout. Membres bloqués invisibles l'un pour l'autre.
* **Blocage / signalement** (migration 66) : `user_blocks`, `user_reports`, `report_member()` (preuves
  capturées côté serveur), alerte email `report-alert` (secret `ADMIN_ALERT_EMAIL`), page Admin → Signalements.
* **Messages** : seule la colonne `is_read` est modifiable (migration 67) ; push uniquement pour un vrai
  message récent (`send-message-push`).
* **Promotions** : limite, date et statut vérifiés par la base ; compteur tenu par déclencheurs (migration 67).
* **Suppression de compte** : fonction `delete-account` (abonnements Stripe arrêtés ou fin de période,
  fichiers supprimés, compte de connexion supprimé ; fiches pro supprimées ou gardées sans propriétaire).
* **Emails** : `send-welcome-email` uniquement vers l'adresse du compte connecté, une fois, sous 24 h.
  La clé Resend existe à DEUX endroits : secret `RESEND_API_KEY` (fonctions) et mot de passe SMTP de
  Supabase Auth (codes de vérification). Penser aux deux en cas de changement.
* **RGPD** (migration 69) : consentement explicite aux données sensibles (`give_sensitive_consent`,
  `withdraw_sensitive_consent` = effacement) ; purge nocturne `purge_old_data` (statistiques 13 mois,
  questionnaire public 2 ans, signalements clos 1 an). Bandeau de consentement aux statistiques : sans
  accord, statistiques anonymes (identifiant limité à l'onglet, jamais relié au compte).
  Appareils de l'équipe : aucune mesure dès qu'un admin s'y est connecté (`pn_ne_pas_compter`, réglable
  dans Admin → Statistiques).
* **Pages SEO** (`netlify/edge-functions/seo.ts`) : JSON-LD échappé avec `jsonForScript` (ne jamais
  réinsérer `JSON.stringify` brut dans une balise `<script>`).
* **Adresses** : `geocode` interroge d'abord la Géoplateforme IGN (Base Adresse Nationale, gratuite) ;
  les champs d'adresse utilisent `geocodeSuggest` (une requête après la frappe).
* **Proxys Google** : `fiches-photo` réservé aux admins (jeton dans l'adresse).
* **Connexion Meta** : jeton `state` à usage unique (`oauth_states`, migration 68).
* **Réseaux sociaux** (28/11/2026) : app Meta de Kévin « PassNavigay Publication » (configuration Facebook
  Login for Business). `social-daily` (autonome) prépare des **brouillons** ; seule une action d'admin
  (aal2) publie, après relecture dans Admin → Réseaux sociaux. Fiches `adulte` jamais proposées.
* **En-têtes** : `netlify.toml` (anti-iframe, nosniff, HSTS, Referrer-Policy, Permissions-Policy, CSP minimale).

* **Rétractation Premium** (migration 76, 27/11/2026) : « Renoncer au contrat ici » dans le profil pendant
  14 jours (art. L221-21). Fonction `retractation-premium` (JWT activé) : arrête l'abonnement Stripe, garde la
  preuve dans `retractations`, accusé de réception au membre, alerte à `ADMIN_ALERT_EMAIL` avec le montant
  au prorata. Remboursement fait à la main dans Stripe, puis statut `rembourse`. Purge à 5 ans.

* **Favoris privés** (migration 77, 27/11/2026) : suppression de la règle qui laissait tout visiteur lire
  la table `favorites`. Comptage pour la page Membres via `member_favorites_counts(uuid[])` (nombres seuls,
  100 ids max, membres connectés). La page Membres charge 30 profils à la fois, filtrés par la base, et rien
  pour un visiteur ou un membre gratuit (seulement le total).
* **Contrôle automatique** : `.github/workflows/verification.yml` (types, ESLint erreurs, construction) sur
  chaque pull request. Ne pas fusionner une demande marquée d'une croix rouge.

* **Comptes inactifs** (migration 78, 27/11/2026) : suppression après 3 ans sans visite, e-mail 30 jours avant
  (`comptes-inactifs`, JWT désactivé, appelée chaque nuit par `pn-comptes-inactifs` avec le secret Vault
  `pn_comptes_inactifs`). Exclus : admins, Premium en cours, propriétaires d'une fiche Pro, abonnement Stripe
  actif. Fiches gardées sans propriétaire. Repère privé de visite `activite_comptes` (`pn_marquer_visite`).
* **Avis** (migration 80, 27/11/2026) : un admin peut supprimer un avis ou tous les avis d'une fiche
  (`admin_supprimer_avis`, `admin_reinitialiser_avis`, depuis la fiche dans Admin → Établissements). Copie
  gardée un an dans `avis_supprimes`. Ne jamais supprimer d'avis directement dans la table.
* **HubSpot** (migration 81, 28/11/2026) : membres Premium et établissements Pro **payants** envoyés au compte
  HubSpot IDKL (file `hubspot_sync`, tâche `pn-hubspot` toutes les 10 min, fonction autonome `hubspot-sync`,
  secret `HUBSPOT_TOKEN`). Jamais de données intimes ni de montants. Compte supprimé → effacement HubSpot.
* **Prix Stripe fixes** (27/11/2026) : mensuels repérés par `lookup_key` (`pn_premium_mensuel`,
  `pn_pro_mensuel`), annuels par identifiant ; montant vérifié avant chaque paiement (refus si différent).
* **Recherche** : `src/lib/recherche.ts` (`motifRecherche`) pour tout filtre `or(...)` construit avec un texte tapé.

Tâches planifiées (pg_cron) : `pn-expire-offres` (3 h 15 UTC), `pn-purge-rgpd` (3 h 45 UTC), `pn-purge-avis-supprimes` (3 h 50 UTC), `pn-hubspot` (toutes les 10 min, si besoin).

Restent à traiter : relecture juridique de la politique de confidentialité et des conditions de vente,
analyse d'impact (AIPD) et registre des traitements, médiateur de la consommation,
tests automatiques des parcours clés. (Double authentification des admins : en place, `is_admin()` exige aal2.)

