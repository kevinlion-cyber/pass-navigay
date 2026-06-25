import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Calendar, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const FEATURES = [
  { icon: MapPin, title: 'Trouve ton lieu ideal', text: 'Decouvre des etablissements inclusifs et bienveillants pres de chez toi.' },
  { icon: Calendar, title: 'Decouvre les evenements', text: 'Soirees, brunches, expos... reste informe des evenements LGBT-friendly.' },
  { icon: Users, title: 'Rejoins la communaute', text: 'Echange avec les autres membres et partage tes coups de coeur.' },
];

export default function Landing() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [countdown, setCountdown] = useState(5);
  const [showCheckbox, setShowCheckbox] = useState(false);
  const [requireSignup, setRequireSignup] = useState(true);

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', 'require_signup').maybeSingle()
      .then(({ data }) => setRequireSignup(data ? data.value === 'true' : true));
  }, []);

  useEffect(() => {
    if (user && profile && !profile.show_onboarding) {
      navigate('/explore', { replace: true });
    }
  }, [user, profile, navigate]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setShowCheckbox(true);
    }
  }, [countdown]);

  const handleExplore = () => {
    navigate('/explore');
  };

  const handleDismiss = async () => {
    if (user) {
      await supabase.from('profiles').update({ show_onboarding: false }).eq('id', user.id);
    }
    navigate('/explore');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-light-bg dark:bg-dark-bg">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="space-y-4">
          <div className="w-20 h-20 rounded-full bg-primary mx-auto flex items-center justify-center">
            <span className="text-white text-3xl font-semibold">P</span>
          </div>
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
            Pass Navigay
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Decouvre les lieux LGBT-friendly pres de chez toi
          </p>
        </div>

        <div className="space-y-6">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex items-start gap-4 text-left">
              <div className="w-10 h-10 rounded-card bg-primary/10 flex items-center justify-center shrink-0">
                <Icon size={20} className="text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">{title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{text}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4 pt-4">
          {!user && requireSignup ? (
            <button onClick={() => navigate('/auth/register')} className="btn-primary w-full text-lg py-4">
              S'inscrire
            </button>
          ) : (
            <button onClick={handleExplore} className="btn-primary w-full text-lg py-4">
              Explorer
            </button>
          )}

          {!showCheckbox && (
            <p className="text-sm text-gray-400 dark:text-gray-500">
              {countdown}s
            </p>
          )}

          {showCheckbox && user && (
            <label className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                onChange={handleDismiss}
                className="rounded border-gray-300 text-primary focus:ring-primary"
              />
              Ne plus afficher ce message
            </label>
          )}
        </div>
      </div>
    </div>
  );
}
