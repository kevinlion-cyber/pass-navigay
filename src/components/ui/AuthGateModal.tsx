import { useNavigate } from 'react-router-dom';
import { X, UserPlus, LogIn } from 'lucide-react';

interface AuthGateModalProps {
  open: boolean;
  onClose: () => void;
  message?: string;
}

export default function AuthGateModal({ open, onClose, message }: AuthGateModalProps) {
  const navigate = useNavigate();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="card p-6 max-w-sm w-full space-y-5 relative animate-in">
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <X size={20} />
        </button>

        <div className="text-center space-y-2 pt-2">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <UserPlus size={22} className="text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Rejoins la communaute
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
            {message || "Cree ton compte pour profiter de toutes les fonctionnalites."}
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => { onClose(); navigate('/auth/register'); }}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <UserPlus size={16} />
            Creer mon compte
          </button>
          <button
            onClick={() => { onClose(); navigate('/auth/login'); }}
            className="btn-secondary w-full flex items-center justify-center gap-2"
          >
            <LogIn size={16} />
            J'ai deja un compte
          </button>
        </div>
      </div>
    </div>
  );
}
