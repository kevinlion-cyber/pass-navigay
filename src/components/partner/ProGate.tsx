import { Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ProGate({ feature }: { feature: string }) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
        <Lock size={28} className="text-primary" />
      </div>
      <h2 className="text-lg font-semibold text-white">Fonctionnalite Pro</h2>
      <p className="text-sm text-gray-400 max-w-sm">
        Passe au profil Pro pour {feature}.
      </p>
      <button onClick={() => navigate('/pros/abonnement')} className="btn-primary">
        Passer Pro
      </button>
    </div>
  );
}
