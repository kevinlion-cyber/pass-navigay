import { useState } from 'react';
import toast from 'react-hot-toast';

interface AdminAuthGateProps {
  onAuthenticated: () => void;
}

export default function AdminAuthGate({ onAuthenticated }: AdminAuthGateProps) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (password === 'admin2025') {
      sessionStorage.setItem('adminAuth', 'true');
      onAuthenticated();
    } else {
      toast.error('Mot de passe incorrect');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">
            <span className="text-white">Pass</span>
            <span style={{ color: '#7B2D8B' }}> Navigay</span>
            <span className="text-gray-400 font-normal"> · Admin</span>
          </h1>
        </div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mot de passe"
          className="input-field bg-dark-surface border-dark-border text-white"
          autoFocus
        />
        <button type="submit" disabled={loading} className="btn-primary w-full">
          Acceder
        </button>
      </form>
    </div>
  );
}
