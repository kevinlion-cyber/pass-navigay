import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, X, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { translateAuthError } from '../../lib/authErrors';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);

    if (error) {
      toast.error(error);
    } else {
      toast.success('Connexion reussie !');
      const redirect = searchParams.get('redirect');
      navigate(redirect && redirect.startsWith('/') ? redirect : '/explore');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      toast.error('Entre ton adresse email.');
      return;
    }
    setResetLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    setResetLoading(false);

    if (error) {
      toast.error(translateAuthError(error));
    } else {
      toast.success('Un e-mail de réinitialisation a été envoyé !');
      setForgotMode(false);
    }
  };

  const handleClose = () => {
    navigate(-1);
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) handleClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={handleBackdropClick}
    >
      <div className="relative w-full max-w-[400px] bg-light-surface dark:bg-dark-surface rounded-[16px] p-8 shadow-2xl"
        style={{ animation: 'fadeSlideIn 0.25s ease-out' }}
      >
        <button
          onClick={handleClose}
          aria-label="Fermer"
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <X size={20} />
        </button>

        {!forgotMode ? (
          <>
            <div className="text-center mb-6">
              <div className="flex items-center justify-center gap-1 mb-4">
                <span className="text-xl font-bold text-gray-900 dark:text-white">Pass</span>
                <span className="text-xl font-bold" style={{ color: '#7B2D8B' }}>Navigay</span>
              </div>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Connexion</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Content de te revoir !
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ton@email.com"
                  required
                  className="input-field"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Mot de passe
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Ton mot de passe"
                    required
                    className="input-field pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Masquer' : 'Afficher'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setForgotMode(true)}
                  className="text-xs text-primary hover:underline"
                >
                  Mot de passe oublié ?
                </button>
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
                {loading && <LoadingSpinner size={18} />}
                Connecte-toi
              </button>
            </form>

            <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-5">
              Pas encore de compte ?{' '}
              <Link to="/auth/register" className="text-primary hover:underline font-medium">
                Inscris-toi
              </Link>
            </p>
          </>
        ) : (
          <>
            <div className="text-center mb-6">
              <div className="flex items-center justify-center gap-1 mb-4">
                <span className="text-xl font-bold text-gray-900 dark:text-white">Pass</span>
                <span className="text-xl font-bold" style={{ color: '#7B2D8B' }}>Navigay</span>
              </div>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Mot de passe oublié</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Entre ton email pour recevoir un lien de réinitialisation.
              </p>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label htmlFor="reset-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email
                </label>
                <input
                  id="reset-email"
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="ton@email.com"
                  required
                  className="input-field"
                />
              </div>

              <button type="submit" disabled={resetLoading} className="btn-primary w-full flex items-center justify-center gap-2">
                {resetLoading && <LoadingSpinner size={18} />}
                Envoyer le lien
              </button>
            </form>

            <button
              onClick={() => setForgotMode(false)}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 mt-5 mx-auto transition-colors"
            >
              <ArrowLeft size={14} />
              Retour a la connexion
            </button>
          </>
        )}
      </div>
    </div>
  );
}
