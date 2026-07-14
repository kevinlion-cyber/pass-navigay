import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowLeft, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

// Page cible du lien « mot de passe oublié ». GoTrue redirige ici avec un token de
// récupération dans le fragment d'URL ; supabase-js (detectSessionInUrl) ouvre une
// session temporaire → on peut appeler updateUser({ password }).
export default function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Lien invalide/expiré : GoTrue renvoie #error=...&error_description=...
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    if (hash.get('error')) {
      setUrlError(hash.get('error_description')?.replace(/\+/g, ' ') || 'Ce lien est invalide ou a expiré.');
      return;
    }
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { toast.error('8 caractères minimum.'); return; }
    if (password !== confirm) { toast.error('Les deux mots de passe ne correspondent pas.'); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Mot de passe mis à jour !');
    navigate('/explore');
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="relative w-full max-w-[400px] bg-light-surface dark:bg-dark-surface rounded-[16px] p-8 shadow-2xl">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-1 mb-4">
            <span className="text-xl font-bold text-gray-900 dark:text-white">Pass</span>
            <span className="text-xl font-bold" style={{ color: '#7B2D8B' }}>Navigay</span>
          </div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Nouveau mot de passe</h1>
        </div>

        {urlError ? (
          <div className="text-center space-y-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">{urlError}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Demandez un nouveau lien depuis la page de connexion.</p>
            <button onClick={() => navigate('/auth/login')} className="btn-primary w-full">Retour à la connexion</button>
          </div>
        ) : !ready ? (
          <div className="flex flex-col items-center gap-3 py-6 text-gray-500 dark:text-gray-400">
            <LoadingSpinner size={22} />
            <p className="text-sm">Vérification du lien…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 justify-center mb-2">
              <ShieldCheck size={16} style={{ color: '#7B2D8B' }} /> Choisissez votre nouveau mot de passe
            </div>
            <div>
              <label htmlFor="pw" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mot de passe</label>
              <div className="relative">
                <input id="pw" type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8 caractères minimum" required className="input-field pr-12" />
                <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Masquer' : 'Afficher'} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="pw2" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirmer</label>
              <input id="pw2" type={show ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Retapez le mot de passe" required className="input-field" />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading && <LoadingSpinner size={18} />} Enregistrer
            </button>
          </form>
        )}

        {!urlError && (
          <button onClick={() => navigate('/auth/login')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 mt-5 mx-auto transition-colors">
            <ArrowLeft size={14} /> Retour à la connexion
          </button>
        )}
      </div>
    </div>
  );
}
