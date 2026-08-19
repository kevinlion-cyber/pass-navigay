import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { CategoriesProvider } from './contexts/CategoriesContext';
import AppLayout from './components/layout/AppLayout';
import WelcomeModal from './components/WelcomeModal';
import Survey from './pages/Survey';
import Register from './pages/auth/Register';
import Login from './pages/auth/Login';
import Verify from './pages/auth/Verify';
import ResetPassword from './pages/auth/ResetPassword';
import Revendiquer from './pages/Revendiquer';
import Explore from './pages/Explore';
import EstablishmentDetail from './pages/EstablishmentDetail';
import EstablishmentForm from './pages/EstablishmentForm';
import Favorites from './pages/Favorites';
import Messages from './pages/Messages';
import Conversation from './pages/Conversation';
import ProfilePublic from './pages/ProfilePublic';
import ProfileSettings from './pages/ProfileSettings';
import Events from './pages/Events';
import EventDetail from './pages/EventDetail';
import Promos from './pages/Promos';
import PromoDetail from './pages/PromoDetail';
import Pricing from './pages/Pricing';
import Members from './pages/Members';

import AdminRoot from './pages/Admin';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminAnalytics from './pages/admin/AdminAnalytics';
import AdminUsers from './pages/admin/AdminUsers';
import AdminSeo from './pages/admin/AdminSeo';
import AdminEstablishments from './pages/admin/AdminEstablishments';
import AdminDrafts from './pages/admin/AdminDrafts';
import AdminSurvey from './pages/admin/AdminSurvey';
import AdminCities from './pages/admin/AdminCities';
import AdminSocial from './pages/admin/AdminSocial';
import AdminClaims from './pages/admin/AdminClaims';
import AdminEvents from './pages/admin/AdminEvents';
import AdminPromotions from './pages/admin/AdminPromotions';
import AdminMembers from './pages/admin/AdminMembers';
import AdminPartners from './pages/admin/AdminPartners';
import AdminGifts from './pages/admin/AdminGifts';
import AdminSettings from './pages/admin/AdminSettings';
import AdminCategories from './pages/admin/AdminCategories';
import AdminProsLanding from './pages/admin/AdminProsLanding';
import AdminPopups from './pages/admin/AdminPopups';
import AdminTarifs from './pages/admin/AdminTarifs';
import AdminAccount from './pages/admin/AdminAccount';

import ProsLanding from './pages/pros/ProsLanding';
import LegalLayout from './pages/legal/LegalLayout';
import LegalMentions from './pages/legal/LegalMentions';
import LegalCgu from './pages/legal/LegalCgu';
import LegalConfidentialite from './pages/legal/LegalConfidentialite';
import LegalContact from './pages/legal/LegalContact';
import LegalCustomPage from './pages/legal/LegalCustomPage';
import AdminLegal from './pages/admin/AdminLegal';
import PartnerLayout from './components/partner/PartnerLayout';
import PartnerDashboard from './pages/partner/PartnerDashboard';
import PartnerEstablishment from './pages/partner/PartnerEstablishment';
import PartnerEvents from './pages/partner/PartnerEvents';
import PartnerPromotions from './pages/partner/PartnerPromotions';
import PartnerReviews from './pages/partner/PartnerReviews';
import PartnerSubscription from './pages/partner/PartnerSubscription';
import PwaInstallPrompt from './components/ui/PwaInstallPrompt';
import RouteTracker from './components/analytics/RouteTracker';
import LegacyRedirect from './components/LegacyRedirect';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
        <CategoriesProvider>
          <RouteTracker />
          <Toaster
            position="top-center"
            toastOptions={{
              duration: 3000,
              style: {
                background: 'var(--toast-bg, #16161f)',
                color: 'var(--toast-color, #f3f3f3)',
                borderRadius: '8px',
                fontSize: '14px',
              },
            }}
          />
          <Routes>
            <Route path="/auth/verify" element={<Verify />} />
            <Route path="/auth/reset-password" element={<ResetPassword />} />

            <Route element={<AppLayout />}>
              {/*
                L'accueil, c'est le site lui-même : on arrive directement dans
                l'annuaire, et le mot de bienvenue s'affiche PAR-DESSUS. Avant,
                `/` était un écran d'accueil séparé sans aucun contenu, donc
                invisible pour Google et sans issue pour un visiteur non inscrit.
              */}
              <Route path="/" element={<><Explore /><WelcomeModal /></>} />
              {/*
                Inscription et connexion sont déjà des modales (`fixed inset-0`).
                On les rend DANS la coquille du site, avec l'annuaire derrière :
                en route de premier niveau, il n'y avait rien dessous, on quittait
                donc le site pour un formulaire plein écran. Ici on reste dedans,
                et fermer la modale rend simplement la main à l'annuaire.
              */}
              <Route path="/inscription" element={<><Explore /><Register /></>} />
              <Route path="/connexion" element={<><Explore /><Login /></>} />
              <Route path="/explorer" element={<Explore />} />
              <Route path="/agenda" element={<Events />} />
              <Route path="/agenda/:eventId" element={<EventDetail />} />
              <Route path="/promotions" element={<Promos />} />
              <Route path="/promotions/:promoId" element={<PromoDetail />} />
              <Route path="/lieu/:slug" element={<EstablishmentDetail />} />
              <Route path="/tarifs" element={<Pricing />} />
              {/* Questionnaire de Kevin : page publique, anonyme. */}
              <Route path="/questionnaire" element={<Survey />} />
              <Route path="/questionnaire-pass-navigay" element={<LegacyRedirect to="/questionnaire" />} />
              <Route path="/revendiquer/:id" element={<Revendiquer />} />

              {/*
                Anciennes adresses anglaises : conservées en redirection pour ne
                casser aucun lien déjà partagé (favoris, réseaux sociaux, Google).
                `/establishment/:id` reste servie par la fiche elle-même, qui
                redirige ensuite vers l'URL propre `/lieu/<nom-ville>`.
              */}
              <Route path="/establishment/:id" element={<EstablishmentDetail />} />
              <Route path="/auth/register" element={<LegacyRedirect to="/inscription" />} />
              <Route path="/auth/login" element={<LegacyRedirect to="/connexion" />} />
              <Route path="/explore" element={<LegacyRedirect to="/explorer" />} />
              <Route path="/events" element={<LegacyRedirect to="/agenda" />} />
              <Route path="/events/:eventId" element={<LegacyRedirect to="/agenda/:eventId" />} />
              <Route path="/promos" element={<LegacyRedirect to="/promotions" />} />
              <Route path="/promos/:promoId" element={<LegacyRedirect to="/promotions/:promoId" />} />
              <Route path="/pricing" element={<LegacyRedirect to="/tarifs" />} />

              {/*
                Membres : la page reste ACCESSIBLE sans compte. Elle était derrière la
                garde, donc un visiteur curieux était renvoyé à l'accueil avec une
                fenêtre d'inscription, sans jamais voir de quoi on parle. Elle explique
                maintenant ce qu'on y trouve, sans montrer un seul profil : c'est la
                page elle-même qui gère le verrou (réservé aux membres Premium).
              */}
              <Route path="/membres" element={<Members />} />
              <Route path="/members" element={<LegacyRedirect to="/membres" />} />
            </Route>

            {/* Espace membre : demande un compte, quel que soit le réglage. */}
            <Route element={<AppLayout requireAuth />}>
              <Route path="/ajouter-un-lieu" element={<EstablishmentForm />} />
              <Route path="/lieu/:id/modifier" element={<EstablishmentForm />} />
              <Route path="/favoris" element={<Favorites />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/messages/:userId" element={<Conversation />} />
              <Route path="/profil/parametres" element={<ProfileSettings />} />
              <Route path="/profil/:userId" element={<ProfilePublic />} />

              {/* Anciennes adresses anglaises de l'espace membre. */}
              <Route path="/members" element={<LegacyRedirect to="/membres" />} />
              <Route path="/establishment/new" element={<LegacyRedirect to="/ajouter-un-lieu" />} />
              <Route path="/establishment/:id/edit" element={<LegacyRedirect to="/lieu/:id/modifier" />} />
              <Route path="/favorites" element={<LegacyRedirect to="/favoris" />} />
              <Route path="/profile/settings" element={<LegacyRedirect to="/profil/parametres" />} />
              <Route path="/profile/:userId" element={<LegacyRedirect to="/profil/:userId" />} />
            </Route>

            <Route path="/admin" element={<AdminRoot />}>
              <Route index element={<AdminDashboard />} />
              <Route path="statistiques" element={<AdminAnalytics />} />
              <Route path="utilisateurs" element={<AdminUsers />} />
              <Route path="referencement" element={<AdminSeo />} />
              <Route path="etablissements" element={<AdminEstablishments />} />
              <Route path="fiches-auto" element={<AdminDrafts />} />
              <Route path="villes" element={<AdminCities />} />
              <Route path="questionnaire" element={<AdminSurvey />} />
              <Route path="reseaux-sociaux" element={<AdminSocial />} />
              <Route path="revendications" element={<AdminClaims />} />
              <Route path="evenements" element={<AdminEvents />} />
              <Route path="promotions" element={<AdminPromotions />} />
              <Route path="membres" element={<AdminMembers />} />
              <Route path="partenaires" element={<AdminPartners />} />
              <Route path="cadeaux" element={<AdminGifts />} />
              <Route path="categories" element={<AdminCategories />} />
              <Route path="page-pros" element={<AdminProsLanding />} />
              <Route path="fenetres" element={<AdminPopups />} />
              <Route path="tarifs" element={<AdminTarifs />} />
              <Route path="mon-compte" element={<AdminAccount />} />
              <Route path="parametres" element={<AdminSettings />} />
              <Route path="contenu-legal" element={<AdminLegal />} />

              {/* Anciennes adresses anglaises de l'administration (favoris de Kevin). */}
              <Route path="analytics" element={<LegacyRedirect to="/admin/statistiques" />} />
              <Route path="seo" element={<LegacyRedirect to="/admin/referencement" />} />
              <Route path="establishments" element={<LegacyRedirect to="/admin/etablissements" />} />
              <Route path="drafts" element={<LegacyRedirect to="/admin/fiches-auto" />} />
              <Route path="social" element={<LegacyRedirect to="/admin/reseaux-sociaux" />} />
              <Route path="claims" element={<LegacyRedirect to="/admin/revendications" />} />
              <Route path="events" element={<LegacyRedirect to="/admin/evenements" />} />
              <Route path="members" element={<LegacyRedirect to="/admin/membres" />} />
              <Route path="partners" element={<LegacyRedirect to="/admin/partenaires" />} />
              <Route path="gifts" element={<LegacyRedirect to="/admin/cadeaux" />} />
              <Route path="pros-landing" element={<LegacyRedirect to="/admin/page-pros" />} />
              <Route path="popups" element={<LegacyRedirect to="/admin/fenetres" />} />
              <Route path="account" element={<LegacyRedirect to="/admin/mon-compte" />} />
              <Route path="settings" element={<LegacyRedirect to="/admin/parametres" />} />
              <Route path="legal" element={<LegacyRedirect to="/admin/contenu-legal" />} />
            </Route>

            <Route path="/legal" element={<LegalLayout />}>
              <Route path="mentions" element={<LegalMentions />} />
              <Route path="cgu" element={<LegalCgu />} />
              <Route path="confidentialite" element={<LegalConfidentialite />} />
              <Route path="contact" element={<LegalContact />} />
              <Route path="p/:slug" element={<LegalCustomPage />} />
            </Route>

            <Route path="/pros" element={<ProsLanding />} />
            <Route path="/pros/inscription" element={<Navigate to="/pros" replace />} />
            <Route path="/pros/connexion" element={<Navigate to="/pros" replace />} />
            <Route element={<PartnerLayout />}>
              <Route path="/pros/tableau-de-bord" element={<PartnerDashboard />} />
              <Route path="/pros/mon-etablissement" element={<PartnerEstablishment />} />
              <Route path="/pros/evenements" element={<PartnerEvents />} />
              <Route path="/pros/promotions" element={<PartnerPromotions />} />
              <Route path="/pros/avis" element={<PartnerReviews />} />
              <Route path="/pros/abonnement" element={<PartnerSubscription />} />
            </Route>
          </Routes>
          <PwaInstallPrompt />
        </CategoriesProvider>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
