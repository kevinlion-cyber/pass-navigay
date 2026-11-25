import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import BienvenueContenu from '../BienvenueContenu';
import { useUserPlans } from '../../lib/userPlans';

interface InscriptionGateModalProps {
  open: boolean;
  onClose: () => void;
  /** Page où revenir après l'inscription ou la connexion. */
  redirect?: string;
  /** Remplace le texte d'accueil (ex. « Tu as découvert 3 lieux… »). */
  intro?: string;
}

/**
 * Invitation à créer un compte GRATUIT, sans aucun prix (demande de Kévin, 25/11/2026).
 * Reprend le mot de bienvenue (logo, textes de l'administration, atouts). Les prix ne
 * sont montrés que devant une fonction Premium (PremiumUpgradeModal).
 */
export default function InscriptionGateModal({ open, onClose, redirect, intro }: InscriptionGateModalProps) {
  const navigate = useNavigate();
  // Les avantages de la formule Gratuite cochés « inclus » dans Admin → Tarifs.
  const { freeFeatures } = useUserPlans();
  const avantages = freeFeatures.filter((f) => f.included).map((f) => f.label);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const suite = redirect ? `?redirect=${encodeURIComponent(redirect)}` : '';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gate-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-card bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border p-6 sm:p-7 space-y-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="absolute right-3 top-3 w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-light-bg dark:hover:bg-dark-bg transition-colors"
        >
          <X size={18} />
        </button>

        <BienvenueContenu titreId="gate-title" intro={intro} avantages={avantages} />

        <div className="space-y-3">
          <button onClick={() => { onClose(); navigate(`/inscription${suite}`); }} className="btn-primary w-full py-3">
            Créer mon compte
          </button>
          <button
            onClick={() => { onClose(); navigate(`/connexion${suite}`); }}
            className="w-full py-3 rounded-input border border-light-border dark:border-dark-border text-gray-700 dark:text-gray-300 hover:border-primary hover:text-primary transition-colors"
          >
            J'ai déjà un compte
          </button>
          <button onClick={onClose} className="w-full py-2 text-sm text-gray-500 hover:text-primary transition-colors">
            Plus tard
          </button>
        </div>
      </div>
    </div>
  );
}
