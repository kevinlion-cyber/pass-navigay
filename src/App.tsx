import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { CategoriesProvider } from './contexts/CategoriesContext';
import AppLayout from './components/layout/AppLayout';
import Landing from './pages/Landing';
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
            <Route path="/" element={<Landing />} />
            <Route path="/auth/register" element={<Register />} />
            <Route path="/auth/login" element={<Login />} />
            <Route path="/auth/verify" element={<Verify />} />
            <Route path="/auth/reset-password" element={<ResetPassword />} />

            <Route element={<AppLayout />}>
              <Route path="/explore" element={<Explore />} />
              <Route path="/events" element={<Events />} />
              <Route path="/events/:eventId" element={<EventDetail />} />
              <Route path="/promos" element={<Promos />} />
              <Route path="/promos/:promoId" element={<PromoDetail />} />
              <Route path="/members" element={<Members />} />
              <Route path="/establishment/new" element={<EstablishmentForm />} />
              <Route path="/establishment/:id/edit" element={<EstablishmentForm />} />
              <Route path="/lieu/:slug" element={<EstablishmentDetail />} />
              <Route path="/establishment/:id" element={<EstablishmentDetail />} />
              <Route path="/favorites" element={<Favorites />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/messages/:userId" element={<Conversation />} />
              <Route path="/profile/settings" element={<ProfileSettings />} />
              <Route path="/profile/:userId" element={<ProfilePublic />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/revendiquer/:id" element={<Revendiquer />} />
            </Route>

            <Route path="/admin" element={<AdminRoot />}>
              <Route index element={<AdminDashboard />} />
              <Route path="analytics" element={<AdminAnalytics />} />
              <Route path="utilisateurs" element={<AdminUsers />} />
              <Route path="seo" element={<AdminSeo />} />
              <Route path="establishments" element={<AdminEstablishments />} />
              <Route path="drafts" element={<AdminDrafts />} />
              <Route path="social" element={<AdminSocial />} />
              <Route path="claims" element={<AdminClaims />} />
              <Route path="events" element={<AdminEvents />} />
              <Route path="promotions" element={<AdminPromotions />} />
              <Route path="members" element={<AdminMembers />} />
              <Route path="partners" element={<AdminPartners />} />
              <Route path="gifts" element={<AdminGifts />} />
              <Route path="categories" element={<AdminCategories />} />
              <Route path="pros-landing" element={<AdminProsLanding />} />
              <Route path="tarifs" element={<AdminTarifs />} />
              <Route path="account" element={<AdminAccount />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="legal" element={<AdminLegal />} />
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
