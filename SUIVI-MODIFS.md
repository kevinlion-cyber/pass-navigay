# Suivi des modifications — demandes Kevin (Pass Navigay)

Consolidé depuis les 3 emails de Kevin (notes initiales + modifs finales). Statuts : ⬜ À faire · 🟡 En cours · ✅ Fait · 🔵 À décider (Fred/Kevin) · ❓ Question/clarif.

_Dernière mise à jour : 2026-11-24._

## A. Mobile / PWA
| # | Demande | Statut |
|---|---------|--------|
| A1 | Icône + nom de l'app (logo au lieu de « PN ») à l'installation sur mobile (PWA) | ✅ icon.svg régénéré avec le logo embarqué (fond de marque) ; manifest déjà en place |
| A2 | Logo plus gros dans l'app | ✅ logo header agrandi (h-9 → h-12) |

## B. Accès & inscription
| # | Demande | Statut |
|---|---------|--------|
| B1 | Bloquer l'accès au site sans connexion : écran connexion / création de compte avant d'entrer dans l'app | ❌ NON RETENU (décision Fred 2026-06-20 : on garde « explorer sans compte ») |
| B2 | Inscription : proposer le choix Gratuit / Mensuel / Annuel | ✅ sélecteur Mensuel (6,69€) / Annuel (69€) à l'étape plan Premium, transmis au checkout Stripe |
| B3 | Créer un compte Pro ne doit PAS créer un membre automatiquement | ✅ profils marqués `account_type='pro'` à l'inscription pro → exclus de l'annuaire Membres (migration 34) |

## C. Tarifs & contenu Premium
| # | Demande | Statut |
|---|---------|--------|
| C1 | Prix Premium harmonisés : **mensuel 6,69 €/mois** (correction Fred), **annuel 69 €/an** (≈ 5,75 €/mois). Montant Stripe mensuel mis à 669 + front aligné. | ✅ |
| C2 | « support prioritaire » et « filtres avancés » = inventions Bolt → **supprimés** des listes d'avantages (décision Fred). | ✅ |

## D. Thème (clair/sombre)
| # | Demande | Statut |
|---|---------|--------|
| D1 | Mode clair : corriger les textes peu lisibles (contraste) | 🟡 Audit front fait : **ProfilePublic** (entièrement conçu sombre, texte blanc invisible en clair) → fond sombre autonome (lisible 2 thèmes) ; **PremiumBanner** (titre blanc + gris clair invisibles en clair) → theme-aware. Autres `text-white`/gris clairs = boutons colorés ou modales sombres autonomes (OK). Si Kevin a un autre endroit précis, me l'indiquer. |
| D2 | Proposer le choix sombre/clair aussi sur Admin et Pro | ✅ Admin déjà OK. Pro : palette passée en variables CSS clair/sombre (`.partner-scope`), classes dark-only rendues theme-aware, **bouton bascule** ajouté au header Pro. ⚠️ À QA visuellement en mode clair : quelques contrastes à peaufiner (textes gris très clairs, certains boutons colorés multi-lignes). |

## E. Carte / Explore
| # | Demande | Statut |
|---|---------|--------|
| E1 | Recherche par ville KO + carte ne s'affiche pas (Paris) ; afficher la ville même sans établissement | ✅ La recherche géocode désormais la ville (Edge Function OSM) et centre la carte même sans résultat ; ne vole plus vers des coords (0,0). |
| E2 | Popup aperçu établissement sur le pin + highlight/zoom du pin au survol de la liste | ✅ popup au clic (déjà là) + le pin correspondant se met en surbrillance et zoome quand on survole sa carte dans la liste. |
| E3 | Établissement créé (Paris 02) n'apparaît pas sur la carte | ✅ **Cause racine** : clé Google restreinte par référent → géocodage refusé → établissements créés à (0,0). Corrigé : géocodage déplacé côté serveur (Edge Function `geocode` OSM, déployée) + tunnel pro branché dessus + les 2 établissements existants (Paris, Montpellier) recoordonnés en base. |

## F. Événements
| # | Demande | Statut |
|---|---------|--------|
| F1 | Bandeau « à ne pas manquer » : roulement (loop) de tous les événements, 4–5 cases en affichage PC, 0 impact mobile | ✅ bandeau montre tous les événements à venir (featured d'abord), auto‑défilement en boucle sur PC (pause au survol), cartes plus larges sur PC. **Bug corrigé** : le clic menait vers `/event/` (404) → `/events/`. |
| F2 | Onglet Événements : filtres Ville + Date (arrivée / départ) | ✅ filtres Ville + plage de dates ajoutés (app) |

## G. Promotions
| # | Demande | Statut |
|---|---------|--------|
| G1 | Onglet Promotions : ajouter filtre Ville | ✅ |

## H. Membres
| # | Demande | Statut |
|---|---------|--------|
| H1 | Free user : flouter les données membres + message « réservé aux membres Premium » (comme les promos) | ✅ liste membres floutée + overlay « Réservé aux membres Premium » + bouton Passer Premium pour les non-Premium |
| H2 | Filtres recherche membres : par ville, par type (il/elle/iel…) | ✅ Filtre type/pronoms + filtre Ville (colonne `city` ajoutée aux profils + champ dans les réglages profil + vue publique mise à jour). |

## I. Fiche établissement
| # | Demande | Statut |
|---|---------|--------|
| I1 | Horaires en bas de page (sous photos / événements / promotions) | ✅ bloc horaires déplacé sous événements + promotions (avant les avis) |
| I2 | Bug avis : étoiles + note + bouclier | 🟡 Étoiles **fonctionnent** quand il y a des avis (22 avis en base, code+couleur OK) → le « pas d'étoiles » vient d'établissements SANS avis (ex. Paris 02 de Kevin). Bouclier **ajouté** à la carte de listing + calcul moyenne sécurité. ⚠️ `safety_rating` vide partout (personne n'a noté la sécurité) → bouclier ne s'affiche que quand des notes sécurité existent. À confirmer avec Kevin. |

## J. Page profil
| # | Demande | Statut |
|---|---------|--------|
| J1 | Optimiser la page profil (argument de vente clé) | 🔵 (cadrer ce qu'on veut) |

## K. Espace Pro (partenaire)
| # | Demande | Statut |
|---|---------|--------|
| K1 | Dashboard Pro : KPI « Promos utilisées » + nb d'utilisations des promotions | ✅ carte « Promos utilisées » (total des validations) ajoutée au dashboard Pro |
| K2 | Gestion des avis côté partenaire : voir et répondre aux avis | ✅ page « Avis » dans l'espace Pro (liste + réponse via RPC sécurisée `set_review_reply`) ; réponses affichées sur la fiche publique (migration 36) |
| K3 | Remplacer la photo principale / bandeau par un **placeholder** (garder la galerie). (décision Fred 2026-06-20) | ✅ fiche établissement affiche toujours le placeholder (bandeau perso retiré) |
| K4 | Ajouter un **toggle** style « Même adresse que mon établissement » (capture) — périmètre exact à reconfirmer avec Kevin | ❓ Fred : « un truc du genre » |

## L. Admin
| # | Demande | Statut |
|---|---------|--------|
| L1 | Tableau de bord : Membres inscrits / Premium / promos actives / promos utilisées ; Établissements inscrits / Premium / Événements à venir / taux de conversion | ✅ KPI « Promos utilisées » ajouté (les autres existaient) ; comptage membres exclut désormais les comptes Pro |
| L2 | Admin peut gérer lui-même les filtres & catégories de pros (sur l'app et l'admin) | ✅ Catégories rendues dynamiques : contexte `CategoriesContext` (config en base `app_settings.categories_config`, fallback code), écran **Admin → Catégories** pour renommer les catégories + ajouter/supprimer/renommer les sous-catégories (types). 12 fichiers migrés (filtres, formulaires, affichage). NB : les 6 clés top-level restent fixes (icônes/colonne DB) ; ajout de nouvelles catégories top-level = évolution future. |
| L3 | Paramètres admin / changer le mot de passe | ⚠️ Note : l'accès admin est désormais un vrai compte Supabase (`is_admin`), il n'y a plus de mot de passe `admin2025`. À expliquer à Kevin. |
| L4 | Offrir une période Pro depuis l'admin (Kevin dit ne pas l'avoir) | ✅ existe déjà : Admin → Établissements → ✏️ Modifier → bouton « Offrir une période Pro ». (à montrer à Kevin) |

## M. Filtre Ville transversal
| # | Demande | Statut |
|---|---------|--------|
| M1 | Filtre par Ville PARTOUT : événements, promos, membres — sur l'app ET l'admin | ✅ App : events, promos, membres. Admin : établissements, membres, événements, promotions (events/promos filtrés via la ville de l'établissement). |

## N. Légal
| # | Demande | Statut |
|---|---------|--------|
| N1 | « Made in Bolt » : à retirer complètement (décision Fred) | ✅ Aucun badge « Made in Bolt » dans le code (ni index.html ni src) — il n'apparaît que sur l'aperçu bolt.new, PAS sur le site Netlify. Dossier `.bolt` supprimé du repo. Rien à afficher en prod. |

## O. Contenus éditables / wording
| # | Demande | Statut |
|---|---------|--------|
| O1 | Rendre éditable le message « Aucun établissement trouvé… » | ✅ champ éditable dans Admin → Paramètres (`explore_empty_text`), lu par la page Explorer (fallback au texte par défaut) |

## P. Questions / réponses (pas du dev)
| # | Question de Kevin | Réponse |
|---|---------|--------|
| P1 | « API ? » | Probablement Google Maps API — déjà en place (carte + géocodage). À confirmer ce qu'il vise. |
| P2 | Où trouver les paramètres administrateur ? | Voir L3 (compte Supabase `is_admin`). |

## Q. Audit sécurité et corrections du 24/11/2026 (agent CTO, validé par Kévin)
| # | Point | Statut |
|---|---------|--------|
| Q1 | C1 — un utilisateur pouvait se donner les droits admin / Premium à la création de sa fiche | ✅ migration 64 (appliquée en base) |
| Q2 | C2 — orientation, identité, nom complet de tous les membres lisibles sans connexion | ✅ migration 65 puis 66/69 |
| Q3 | C3 — clé Resend dans l'historique GitHub | ✅ clés remplacées (fonctions + SMTP Auth) |
| Q4 | E1 — code piégé possible dans les pages SEO des lieux | ✅ #1 |
| Q5 | E2 — établissement créé directement en Pro | ✅ migration 64 |
| Q6 | E3 — « Supprimer mon compte » incomplet (Stripe continuait de prélever) | ✅ #2, fonction delete-account |
| Q7 | Suggestions d'adresse en panne (inscription pro bloquée) | ✅ #3, Base Adresse Nationale |
| Q8 | E5 / M1 — emails de bienvenue et notifications push abusables | ✅ #4 |
| Q9 | M4 — webhook Stripe inopérant (aucune destination + vérification synchrone impossible sous Deno) | ✅ #5, destination créée — premier paiement réel à vérifier |
| Q10 | E4 — bloquer et signaler un membre | ✅ #6, #7, migration 66 |
| Q11 | M5 / M6 / M7 — messages modifiables, limite des promos, cadeaux sans fin | ✅ #8, migration 67 |
| Q12 | M8 / M9 — dépendances, en-têtes de sécurité | ✅ #9 |
| Q13 | M2 / M3 — connexion Meta sans « state », proxy photos Google public | ✅ #10, migration 68 |
| Q14 | RGPD — consentement aux données sensibles, durées de conservation | ✅ #11, migration 69 |
| Q15 | Points faibles — bandeau statistiques, redirection après connexion, mots de passe 8 caractères | ✅ #12 |
| Q16 | Double authentification admin, relecture juridique, AIPD, comptes inactifs | ⬜ à faire |


## R. Évolutions demandées par Kévin (25-26/11/2026)

| # | Évolution | État |
|---|-----------|------|
| R1 | Visuels promo / événement affichés en entier (plus rognés) | ✅ #16 |
| R2 | Pastilles de regroupement de la carte en bleu turquoise | ✅ #17 |
| R3 | La ville et la liste suivent la carte (centre à moins de 15 km d'une ville) | ✅ #18 |
| R4 | Inscription progressive : plus de prix à l'arrivée, 3 fiches libres puis invitation, prix devant les fonctions Premium | ✅ #19, #20, #21 |
| R5 | Icône de catégorie sur la carte | ✅ #22 + #24 (fichier oublié, build Netlify en échec 25 min) |
| R6 | Menu admin rangé par rubriques | ✅ #23 |
| R7 | Événements à valider : collecte hebdomadaire (tâche planifiée Claude, Hérault), import, validation avant publication | migration 71 + demande en cours |

Leçon R5 : toujours `git add -A` et vérifier la construction depuis une copie propre de la branche avant d'ouvrir une demande.

### R8 — Liens légaux pour tous + « Gérer mes cookies » (27/11/2026)
- Nouveau `src/components/layout/LiensLegaux.tsx` : Mentions légales · CGU · Confidentialité · Contact · Gérer mes cookies.
- Affiché en bas des onglets (`AppLayout`), au bas de la liste des lieux (`Explore`, page à hauteur fixe), pas dans une conversation.
- Pages légales : bouton « Gérer mes cookies » dans le menu ; « Retour » ramène à la page précédente (avant : toujours vers /pros).
- Pourquoi : mentions légales facilement accessibles (LCEN) ; retrait du consentement aussi simple que l'accord (CNIL).
- Tests : typecheck, lint (0 erreur), build, captures mobile (Lieux, Promos, bandeau rouvert). Aucun coût, poids négligeable.
- Retour arrière : annuler le commit de cette PR.

### R9 — Résiliation Premium en ligne + plus de double abonnement (27/11/2026)
- Problème : « Gérer mon abonnement Premium » menait à la page Tarifs, qui proposait « Souscrire Premium » (2e paiement) et aucune résiliation. Obligation légale (art. L215-1-1 Code conso, depuis le 01/06/2023) non respectée.
- `src/lib/abonnementPremium.ts` : ouvre l'espace Stripe du membre (fonction existante `create-portal-session`, client Stripe retrouvé côté serveur). Premium offert (sans paiement) : message explicatif.
- Profil : bouton « Gérer ou résilier mon abonnement Premium » + date de fin d'accès. Tarifs : « Tu es déjà Premium » + bouton de gestion à la place de « Souscrire ». Fenêtre Premium : ouvre la gestion si déjà Premium.
- Serveur `create-premium-checkout` : refuse (409) si le client Stripe du membre a déjà un abonnement en cours. Version autonome à coller dans Supabase : `audit/autonomes/create-premium-checkout.ts`.
- Tests : fonction serveur avec faux Stripe (abonnement actif → refus ; résilié / aucun / sans client → paiement) ; écrans Premium et gratuit (captures, clic → espace Stripe ou paiement) ; typecheck, lint, build.
- Retour arrière : annuler le commit ; recoller l'ancienne version de la fonction (historique Git).
