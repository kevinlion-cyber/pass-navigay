/*
  # Insert legal page content into app_settings + allow anonymous reads

  1. New Data
    - `legal_mentions` - Full content for the Mentions légales page
    - `legal_cgu` - Full content for the CGU page
    - `legal_confidentialite` - Full content for the Politique de confidentialité page
    - `legal_contact_text` - Text content for the Contact page

  2. Security Changes
    - Add SELECT policy for anonymous users on app_settings
      so legal pages are accessible without login
*/

-- Allow anonymous users to read app_settings (for legal pages)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'app_settings'
      AND policyname = 'Anonymous users can read app settings'
  ) THEN
    CREATE POLICY "Anonymous users can read app settings"
      ON app_settings
      FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;

INSERT INTO app_settings (key, value) VALUES
('legal_mentions', '# Mentions légales

## Éditeur du site

Raison sociale : [NOM DE LA SOCIÉTÉ À COMPLÉTER]
Forme juridique : [FORME JURIDIQUE À COMPLÉTER]
Capital social : [CAPITAL À COMPLÉTER]
Siège social : [ADRESSE À COMPLÉTER]
SIRET : [NUMÉRO SIRET À COMPLÉTER]
Numéro de TVA intracommunautaire : [TVA À COMPLÉTER]

Directeur de la publication : [NOM DU DIRIGEANT À COMPLÉTER]
Contact : [EMAIL DE CONTACT À COMPLÉTER]

## Hébergement

Le site passnavigay.fr est hébergé par :
Netlify, Inc.
512 2nd Street, Suite 200
San Francisco, CA 94107, États-Unis
https://www.netlify.com

La base de données est hébergée par :
Supabase, Inc.
970 Toa Payoh North, #07-04
Singapore 318992
https://supabase.com

## Propriété intellectuelle

L''ensemble du contenu du site passnavigay.fr (textes, images, graphismes, logo, icônes, etc.) est la propriété exclusive de [NOM DE LA SOCIÉTÉ À COMPLÉTER], sauf mention contraire. Toute reproduction, représentation, modification, publication ou adaptation de tout ou partie des éléments du site, quel que soit le moyen ou le procédé utilisé, est interdite sans l''autorisation écrite préalable de [NOM DE LA SOCIÉTÉ À COMPLÉTER].

## Données personnelles

Le traitement de vos données personnelles est détaillé dans notre Politique de confidentialité.

## Cookies

Ce site utilise des cookies techniques nécessaires à son fonctionnement. Aucun cookie publicitaire ou de tracking tiers n''est utilisé sans votre consentement.

## Droit applicable

Les présentes mentions légales sont soumises au droit français. En cas de litige, les tribunaux français seront seuls compétents.

*Dernière mise à jour : avril 2026*'),

('legal_cgu', '# Conditions Générales d''Utilisation

*Dernière mise à jour : avril 2026*

## Article 1 — Objet

Les présentes Conditions Générales d''Utilisation (CGU) régissent l''utilisation du service Pass Navigay, accessible à l''adresse passnavigay.fr, édité par [NOM DE LA SOCIÉTÉ À COMPLÉTER].

En accédant à la plateforme, vous acceptez sans réserve les présentes CGU. Si vous n''acceptez pas ces conditions, vous devez cesser d''utiliser le service.

## Article 2 — Description du service

Pass Navigay est un annuaire en ligne référençant des lieux, établissements, événements et promotions LGBT-friendly en France. La plateforme permet aux utilisateurs de découvrir des lieux inclusifs, d''entrer en contact avec d''autres membres et d''accéder à des offres exclusives.

## Article 3 — Accès au service

L''accès aux fonctionnalités de base (consultation de l''annuaire, visualisation des événements et promotions) est libre et gratuit, sans inscription.

L''accès aux fonctionnalités avancées (messagerie, favoris, filtres Premium) nécessite la création d''un compte utilisateur.

L''inscription implique la fourniture d''informations exactes et sincères. L''utilisateur est responsable de la confidentialité de ses identifiants.

## Article 4 — Compte utilisateur

Chaque utilisateur ne peut disposer que d''un seul compte. La création de comptes multiples est interdite.

L''utilisateur s''engage à ne pas utiliser le service à des fins illicites, à ne pas diffuser de contenu offensant, discriminatoire ou portant atteinte aux droits des tiers.

[NOM DE LA SOCIÉTÉ À COMPLÉTER] se réserve le droit de suspendre ou supprimer tout compte en cas de violation des présentes CGU.

## Article 5 — Offre Premium utilisateur

L''offre Premium est proposée au tarif de 6,69 € par mois. Le paiement est géré par Stripe. L''abonnement est renouvelé automatiquement chaque mois jusqu''à résiliation par l''utilisateur.

La résiliation prend effet à la fin de la période en cours. Aucun remboursement partiel n''est effectué.

## Article 6 — Établissements partenaires

Les établissements peuvent s''inscrire gratuitement sur la plateforme. L''offre Pro est proposée au tarif de 69 € par mois, avec les mêmes conditions de renouvellement et résiliation que l''offre Premium.

[NOM DE LA SOCIÉTÉ À COMPLÉTER] se réserve le droit de refuser ou supprimer toute fiche ne respectant pas les valeurs inclusives et bienveillantes de la plateforme.

## Article 7 — Responsabilité

[NOM DE LA SOCIÉTÉ À COMPLÉTER] s''efforce de maintenir la plateforme disponible 24h/24 mais ne peut garantir une disponibilité sans interruption. [NOM DE LA SOCIÉTÉ À COMPLÉTER] ne saurait être tenu responsable des contenus publiés par les utilisateurs ou les établissements partenaires.

## Article 8 — Modification des CGU

[NOM DE LA SOCIÉTÉ À COMPLÉTER] se réserve le droit de modifier les présentes CGU à tout moment. Les utilisateurs seront informés de toute modification significative. La poursuite de l''utilisation du service après notification vaut acceptation des nouvelles CGU.

## Article 9 — Droit applicable

Les présentes CGU sont soumises au droit français. Tout litige relatif à leur interprétation ou exécution relève de la compétence exclusive des tribunaux français.

## Article 10 — Contact

Pour toute question relative aux présentes CGU : [EMAIL DE CONTACT À COMPLÉTER]'),

('legal_confidentialite', '# Politique de confidentialité

*Dernière mise à jour : avril 2026*

## 1. Responsable du traitement

[NOM DE LA SOCIÉTÉ À COMPLÉTER]
[ADRESSE À COMPLÉTER]
[EMAIL DPO À COMPLÉTER]

## 2. Données collectées

Dans le cadre de l''utilisation de Pass Navigay, nous collectons les données suivantes :

**Données d''inscription :**
- Adresse email
- Mot de passe (chiffré, non accessible en clair)
- Prénom / pseudo

**Données de profil (facultatives) :**
- Photo de profil
- Biographie
- Centres d''intérêt

**Données d''utilisation :**
- Établissements consultés et mis en favoris
- Messages échangés avec d''autres membres
- Localisation approximative (si autorisée, pour la géolocalisation)

**Données de paiement :**
Les paiements sont gérés exclusivement par Stripe. Nous ne stockons aucune donnée bancaire. Seul un identifiant client Stripe est conservé dans notre base de données.

## 3. Finalités du traitement

Vos données sont utilisées pour :
- Gérer votre compte et vous authentifier
- Vous permettre d''utiliser les fonctionnalités de la plateforme
- Vous envoyer des emails transactionnels (confirmation d''inscription, réinitialisation de mot de passe)
- Améliorer le service (statistiques anonymisées)
- Respecter nos obligations légales

## 4. Base légale

Le traitement de vos données repose sur :
- Votre consentement (données de profil facultatives, géolocalisation)
- L''exécution du contrat (données d''inscription et de paiement)
- Notre intérêt légitime (amélioration du service, sécurité)

## 5. Durée de conservation

- Données de compte : conservées pendant toute la durée de votre inscription + 3 ans après résiliation
- Messages : conservés pendant 2 ans
- Données de paiement : selon les obligations légales (10 ans)

## 6. Partage des données

Vos données ne sont jamais vendues à des tiers. Elles peuvent être partagées avec :
- **Supabase** (hébergement et base de données)
- **Stripe** (traitement des paiements)
- **Netlify** (hébergement du site)
- **Mapbox** (affichage des cartes)

Ces sous-traitants sont soumis à des obligations strictes de confidentialité.

## 7. Vos droits

Conformément au RGPD, vous disposez des droits suivants :
- **Droit d''accès** : obtenir une copie de vos données
- **Droit de rectification** : corriger vos données inexactes
- **Droit à l''effacement** : demander la suppression de vos données
- **Droit à la portabilité** : recevoir vos données dans un format lisible
- **Droit d''opposition** : vous opposer à certains traitements
- **Droit de retrait du consentement** : à tout moment pour les traitements basés sur votre consentement

Pour exercer ces droits : [EMAIL DPO À COMPLÉTER]

Vous disposez également du droit d''introduire une réclamation auprès de la CNIL (www.cnil.fr).

## 8. Cookies

Ce site utilise uniquement des cookies techniques nécessaires au fonctionnement du service (session, authentification). Aucun cookie publicitaire ou de tracking tiers n''est déposé.

## 9. Sécurité

Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour protéger vos données : chiffrement des communications (HTTPS), chiffrement des mots de passe (bcrypt), accès restreint aux données.

## 10. Contact et réclamations

Pour toute question relative à cette politique : [EMAIL DE CONTACT À COMPLÉTER]
CNIL — 3 Place de Fontenoy, 75007 Paris — www.cnil.fr'),

('legal_contact_text', '## Nous contacter

Pour toute question, suggestion ou demande d''information, tu peux nous contacter via le formulaire ci-dessous ou directement par email.

**[EMAIL DE CONTACT À COMPLÉTER]**
**[EMAIL PARTENARIATS À COMPLÉTER]**
**[EMAIL SUPPORT À COMPLÉTER]**

## Tu es un établissement ?

Si tu souhaites référencer ton établissement sur Pass Navigay ou en savoir plus sur l''offre Pro, rendez-vous sur notre espace dédié : passnavigay.fr/pros

## Tu as un problème avec ton compte ?

Connecte-toi à ton compte et accède aux paramètres puis "Contacter le support".')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();