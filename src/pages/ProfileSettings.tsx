import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import AuthGateModal from '../components/ui/AuthGateModal';
import ProfileHeader from './profile/ProfileHeader';
import ProfileFavorites from './profile/ProfileFavorites';
import ProfileEvents from './profile/ProfileEvents';
import ProfilePromos from './profile/ProfilePromos';
import ProfileAccountSettings from './profile/ProfileAccountSettings';

export default function ProfileSettings() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [authGateOpen, setAuthGateOpen] = useState(!user);
  const [profileTimeout, setProfileTimeout] = useState(false);

  useEffect(() => {
    if (user && !profile && !loading) {
      refreshProfile();
      const timer = setTimeout(() => setProfileTimeout(true), 5000);
      return () => clearTimeout(timer);
    }
  }, [user, profile, loading]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size={32} />
      </div>
    );
  }

  if (!user) {
    return (
      <AuthGateModal
        open={authGateOpen}
        onClose={() => { setAuthGateOpen(false); navigate('/explore'); }}
        message="Cree ton compte pour acceder a ton profil."
      />
    );
  }

  if (!profile) {
    if (profileTimeout) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Impossible de charger ton profil.
          </p>
          <button
            onClick={() => { setProfileTimeout(false); refreshProfile(); }}
            className="btn-primary text-sm py-2 px-6"
          >
            Reessayer
          </button>
        </div>
      );
    }
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 pb-24 space-y-8">
      <ProfileHeader profile={profile} />
      <ProfileFavorites userId={user.id} />
      <ProfileEvents userId={user.id} />
      <ProfilePromos userId={user.id} />
      <ProfileAccountSettings profile={profile} />
    </div>
  );
}
