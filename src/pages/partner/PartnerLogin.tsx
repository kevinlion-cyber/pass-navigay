import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

export default function PartnerLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const { data: est } = await supabase
        .from('establishments')
        .select('id')
        .eq('owner_id', data.user.id)
        .maybeSingle();

      if (est) {
        navigate('/pros/tableau-de-bord');
      } else {
        navigate('/pros/inscription');
      }
    } catch (err: any) {
      toast.error(err.message || 'Email ou mot de passe incorrect');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-dark-surface border border-dark-border rounded-card p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-xl font-bold">
            <span className="text-white">Pass</span>
            <span style={{ color: '#7B2D8B' }}> Navigay</span>
            <span className="text-gray-500 font-normal"> · Espace Partenaire</span>
          </h1>
          <h2 className="text-lg font-semibold text-white mt-4">Connexion</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="input-field bg-dark-bg border-dark-border text-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Mot de passe</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="input-field bg-dark-bg border-dark-border text-white" />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
            {loading && <LoadingSpinner size={16} />} Me connecter
          </button>
        </form>

        <p className="text-center text-sm text-gray-500">
          Pas encore partenaire ?{' '}
          <Link to="/pros/inscription" className="text-primary hover:underline">Inscris-toi</Link>
        </p>
      </div>
    </div>
  );
}
