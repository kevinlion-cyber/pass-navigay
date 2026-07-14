import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { translateAuthError } from '../../lib/authErrors';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

interface ProsLoginModalProps {
  onClose: () => void;
  onSwitchToRegister: () => void;
}

export default function ProsLoginModal({ onClose, onSwitchToRegister }: ProsLoginModalProps) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(translateAuthError(error));
      setLoading(false);
      return;
    }
    toast.success('Connexion réussie !');
    onClose();
    navigate('/pros/tableau-de-bord');
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-0 md:p-4"
      style={{ zIndex: 1000, background: 'rgba(0,0,0,0.75)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full h-full md:w-full md:max-w-[560px] md:h-auto md:max-h-[90vh] md:rounded-2xl overflow-y-auto flex flex-col"
        style={{ background: '#0f0f17', border: '1px solid #1e1e2e', boxShadow: '0 25px 60px rgba(0,0,0,0.7)' }}
      >
        <div
          className="sticky top-0 z-10 flex items-center justify-center px-6 py-5 shrink-0"
          style={{ background: '#14141e', borderBottom: '1px solid #1e1e2e' }}
        >
          <span className="text-[14px] font-bold">
            <span className="text-white">Pass</span>{' '}
            <span style={{ color: '#7B2D8B' }}>Navigay</span>
            <span style={{ color: '#606070' }}> · Espace Partenaire</span>
          </span>
          <button
            onClick={onClose}
            className="absolute top-4 right-5 p-1 transition-colors"
            style={{ color: '#606070', fontSize: 20 }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#606070')}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-8 py-7 md:px-8 md:py-7 flex-1" style={{ padding: '28px 32px' }}>
          <h2 className="text-[22px] font-bold text-white text-center">Bon retour !</h2>
          <p className="text-[14px] text-center mt-2 mb-7" style={{ color: '#a0a0b0' }}>
            Connectez-vous à votre espace partenaire.
          </p>

          <div className="space-y-5">
            <div>
              <label className="block text-[13px] font-medium text-[#c0c0d0] mb-1.5">Votre email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-[10px] text-[14px] text-white outline-none transition-colors focus:border-[#7B2D8B]"
                style={{ background: '#0a0a0f', border: '1px solid #2a2a3a' }}
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[#c0c0d0] mb-1.5">Votre mot de passe</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 pr-11 rounded-[10px] text-[14px] text-white outline-none transition-colors focus:border-[#7B2D8B]"
                  style={{ background: '#0a0a0f', border: '1px solid #2a2a3a' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: '#606070' }}
                >
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <div className="flex justify-end mt-1.5">
                <button
                  type="button"
                  onClick={() => toast('Fonctionnalité disponible prochainement.')}
                  className="text-[12px] font-medium transition-colors hover:underline"
                  style={{ color: '#7B2D8B' }}
                >
                  Mot de passe oublié ?
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-[10px] text-[15px] font-semibold text-white transition-colors flex items-center justify-center gap-2"
              style={{ background: '#7B2D8B' }}
            >
              {loading && <LoadingSpinner size={16} />}
              Me connecter
            </button>
          </div>

          <p className="text-center text-[13px] mt-6" style={{ color: '#606070' }}>
            Pas encore partenaire ?{' '}
            <button
              type="button"
              onClick={onSwitchToRegister}
              className="font-medium transition-colors hover:underline"
              style={{ color: '#7B2D8B' }}
            >
              Créez votre profil gratuitement &rarr;
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
