# Suivi des modifications — demandes Kevin (Pass Navigay)

Consolidé depuis les 3 emails de Kevin (notes initiales + modifs finales). Statuts : ⬜ À faire · 🟡 En cours · ✅ Fait · 🔵 À décider (Fred/Kevin) · ❓ Question/clarif.

_Dernière mise à jour : 2026-06-20._

## A. Mobile / PWA
| # | Demande | Statut |
|---|---------|--------|
| A1 | Icône + nom de l'app (logo au lieu de « PN ») à l'installation sur mobile (PWA) | ⬜ |
| A2 | Logo plus gros dans l'app | ⬜ |

## B. Accès & inscription
| # | Demande | Statut |
|---|---------|--------|
| B1 | Bloquer l'accès au site sans connexion : écran connexion / création de compte avant d'entrer dans l'app | ❌ NON RETENU (décision Fred 2026-06-20 : on garde « explorer sans compte ») |
| B2 | Inscription : proposer le choix Gratuit / Mensuel / Annuel | ⬜ |
| B3 | Créer un compte Pro ne doit PAS créer un membre automatiquement | ✅ profils marqués `account_type='pro'` à l'inscription pro → exclus de l'annuaire Membres (migration 34) |

## C. Tarifs & contenu Premium
| # | Demande | Statut |
|---|---------|--------|
| C1 | Prix Premium harmonisés : **mensuel 6,69 €/mois** (correction Fred), **annuel 69 €/an** (≈ 5,75 €/mois). Montant Stripe mensuel mis à 669 + front aligné. | ✅ |
| C2 | « support prioritaire » et « filtres avancés » = inventions Bolt → **supprimés** des listes d'avantages (décision Fred). | ✅ |

## D. Thème (clair/sombre)
| # | Demande | Statut |
|---|---------|--------|
| D1 | Mode clair : corriger les textes peu lisibles (contraste) | ⬜ |
| D2 | Proposer le choix sombre/clair aussi sur Admin et Pro | ⬜ |

## E. Carte / Explore
| # | Demande | Statut |
|---|---------|--------|
| E1 | Recherche par ville KO + carte ne s'affiche pas (Paris) ; afficher la ville même sans établissement | ✅ La recherche géocode désormais la ville (Edge Function OSM) et centre la carte même sans résultat ; ne vole plus vers des coords (0,0). |
| E2 | Popup aperçu établissement sur le pin + highlight/zoom du pin au survol de la liste | 🟡 Popup au clic sur le pin = déjà là. Highlight du pin au survol de la liste = enhancement à ajouter (mineur). |
| E3 | Établissement créé (Paris 02) n'apparaît pas sur la carte | ✅ **Cause racine** : clé Google restreinte par référent → géocodage refusé → établissements créés à (0,0). Corrigé : géocodage déplacé côté serveur (Edge Function `geocode` OSM, déployée) + tunnel pro branché dessus + les 2 établissements existants (Paris, Montpellier) recoordonnés en base. |

## F. Événements
| # | Demande | Statut |
|---|---------|--------|
| F1 | Bandeau « à ne pas manquer » : roulement (loop) de tous les événements, 4–5 cases en affichage PC, 0 impact mobile | ⬜ |
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
| K2 | Gestion des avis côté partenaire : voir et répondre aux avis | ⬜ (feature à part — colonne reply + page partenaire) |
| K3 | Remplacer la photo principale / bandeau par un **placeholder** (garder la galerie). (décision Fred 2026-06-20) | ✅ fiche établissement affiche toujours le placeholder (bandeau perso retiré) |
| K4 | Ajouter un **toggle** style « Même adresse que mon établissement » (capture) — périmètre exact à reconfirmer avec Kevin | ❓ Fred : « un truc du genre » |

## L. Admin
| # | Demande | Statut |
|---|---------|--------|
| L1 | Tableau de bord : Membres inscrits / Premium / promos actives / promos utilisées ; Établissements inscrits / Premium / Événements à venir / taux de conversion | ⬜ |
| L2 | Admin peut gérer lui-même les filtres & catégories de pros (sur l'app et l'admin) | ⬜ |
| L3 | Paramètres admin / changer le mot de passe | ⚠️ Note : l'accès admin est désormais un vrai compte Supabase (`is_admin`), il n'y a plus de mot de passe `admin2025`. À expliquer à Kevin. |
| L4 | Offrir une période Pro depuis l'admin (Kevin dit ne pas l'avoir) | ✅ existe déjà : Admin → Établissements → ✏️ Modifier → bouton « Offrir une période Pro ». (à montrer à Kevin) |

## M. Filtre Ville transversal
| # | Demande | Statut |
|---|---------|--------|
| M1 | Filtre par Ville PARTOUT : événements, promos, membres — sur l'app ET l'admin | 🟡 App : events ✅, promos ✅, membres ✅. Admin : reste à faire. |

## N. Légal
| # | Demande | Statut |
|---|---------|--------|
| N1 | « Made in Bolt » : à retirer complètement (décision Fred) | ✅ Aucun badge « Made in Bolt » dans le code (ni index.html ni src) — il n'apparaît que sur l'aperçu bolt.new, PAS sur le site Netlify. Dossier `.bolt` supprimé du repo. Rien à afficher en prod. |

## O. Contenus éditables / wording
| # | Demande | Statut |
|---|---------|--------|
| O1 | Rendre éditable le message « Aucun établissement trouvé… / Enregistre-toi pour être first Safe place » | ⬜ |

## P. Questions / réponses (pas du dev)
| # | Question de Kevin | Réponse |
|---|---------|--------|
| P1 | « API ? » | Probablement Google Maps API — déjà en place (carte + géocodage). À confirmer ce qu'il vise. |
| P2 | Où trouver les paramètres administrateur ? | Voir L3 (compte Supabase `is_admin`). |
