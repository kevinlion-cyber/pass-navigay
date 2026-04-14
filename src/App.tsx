import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import AppLayout from './components/layout/AppLayout';
import Landing from './pages/Landing';
import Register from './pages/auth/Register';
import Login from './pages/auth/Login';
import Verify from './pages/auth/Verify';
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
import AdminEstablishments from './pages/admin/AdminEstablishments';
import AdminEvents from './pages/admin/AdminEvents';
import AdminPromotions from './pages/admin/AdminPromotions';
import AdminMembers from './pages/admin/AdminMembers';
import AdminPartners from './pages/admin/AdminPartners';
import AdminSettings from './pages/admin/AdminSettings';

import ProsLanding from './pages/pros/ProsLanding';
import LegalLayout from './pages/legal/LegalLayout';
import LegalMentions from './pages/legal/LegalMentions';
import LegalCgu from './pages/legal/LegalCgu';
import LegalConfidentialite from './pages/legal/LegalConfidentialite';
import LegalContact from './pages/legal/LegalContact';
import AdminLegal from './pages/admin/AdminLegal';
import PartnerLayout from './components/partner/PartnerLayout';
import PartnerDashboard from './pages/partner/PartnerDashboard';
import PartnerEstablishment from './pages/partner/PartnerEstablishment';
import PartnerEvents from './pages/partner/PartnerEvents';
import PartnerPromotions from './pages/partner/PartnerPromotions';
import PartnerGallery from './pages/partner/PartnerGallery';
import PartnerSubscription from './pages/partner/PartnerSubscription';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
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

            <Route element={<AppLayout />}>
              <Route path="/explore" element={<Explore />} />
              <Route path="/events" element={<Events />} />
              <Route path="/events/:eventId" element={<EventDetail />} />
              <Route path="/promos" element={<Promos />} />
              <Route path="/promos/:promoId" element={<PromoDetail />} />
              <Route path="/members" element={<Members />} />
              <Route path="/establishment/new" element={<EstablishmentForm />} />
              <Route path="/establishment/:id/edit" element={<EstablishmentForm />} />
              <Route path="/establishment/:id" element={<EstablishmentDetail />} />
              <Route path="/favorites" element={<Favorites />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/messages/:userId" element={<Conversation />} />
              <Route path="/profile/settings" element={<ProfileSettings />} />
              <Route path="/profile/:userId" element={<ProfilePublic />} />
              <Route path="/pricing" element={<Pricing />} />
            </Route>

            <Route path="/admin" element={<AdminRoot />}>
              <Route index element={<AdminDashboard />} />
              <Route path="establishments" element={<AdminEstablishments />} />
              <Route path="events" element={<AdminEvents />} />
              <Route path="promotions" element={<AdminPromotions />} />
              <Route path="members" element={<AdminMembers />} />
              <Route path="partners" element={<AdminPartners />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="legal" element={<AdminLegal />} />
            </Route>

            <Route path="/legal" element={<LegalLayout />}>
              <Route path="mentions" element={<LegalMentions />} />
              <Route path="cgu" element={<LegalCgu />} />
              <Route path="confidentialite" element={<LegalConfidentialite />} />
              <Route path="contact" element={<LegalContact />} />
            </Route>

            <Route path="/pros" element={<ProsLanding />} />
            <Route path="/pros/register" element={<Navigate to="/pros" replace />} />
            <Route path="/pros/login" element={<Navigate to="/pros" replace />} />
            <Route element={<PartnerLayout />}>
              <Route path="/pros/dashboard" element={<PartnerDashboard />} />
              <Route path="/pros/establishment" element={<PartnerEstablishment />} />
              <Route path="/pros/events" element={<PartnerEvents />} />
              <Route path="/pros/promotions" element={<PartnerPromotions />} />
              <Route path="/pros/gallery" element={<PartnerGallery />} />
              <Route path="/pros/subscription" element={<PartnerSubscription />} />
            </Route>
          </Routes>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
