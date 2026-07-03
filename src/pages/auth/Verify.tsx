import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

export default function Verify() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { verifyOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      toast.error('Le code doit contenir 6 chiffres.');
      return;
    }

    setLoading(true);
    const { error } = await verifyOtp(email, code);
    setLoading(false);

    if (error) {
      toast.error(error);
    } else {
      toast.success('Bienvenue ! Tu peux des maintenant explorer des lieux, rejoindre des evenements et echanger avec la communaute.');
      navigate('/explore');
    }
  };

  if (!email) {
    navigate('/auth/register', { replace: true });
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-light-bg dark:bg-dark-bg">
      <div className="card p-8 w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-primary mx-auto flex items-center justify-center mb-4">
            <span className="text-white text-lg font-semibold">P</span>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Vérification</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Un code à 6 chiffres a été envoyé à <strong className="text-gray-700 dark:text-gray-300">{email}</strong>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Code de verification
            </label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              required
              className="input-field text-center text-2xl tracking-[0.5em] font-mono"
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
            {loading && <LoadingSpinner size={18} />}
            Valider
          </button>
        </form>
      </div>
    </div>
  );
}
