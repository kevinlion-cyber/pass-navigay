import { useEffect, useState } from 'react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  requireText?: string; // si défini, l'utilisateur doit taper ce texte pour activer le bouton
  onCancel: () => void;
  onConfirm: () => void;
  loading?: boolean;
}

export default function ConfirmModal({ open, title, message, confirmLabel = 'Confirmer', requireText, onCancel, onConfirm, loading }: ConfirmModalProps) {
  const [typed, setTyped] = useState('');

  useEffect(() => { if (!open) setTyped(''); }, [open]);

  if (!open) return null;

  const canConfirm = !requireText || typed.trim().toUpperCase() === requireText.toUpperCase();

  return (
    <div className="fixed inset-0 z-[1001] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      {/* La fenêtre suit le thème : en dur en sombre, elle apparaissait comme une
          boîte noire au milieu d'une page blanche pour qui utilise le thème clair. */}
      <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card w-full max-w-sm p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">{message}</p>

        {requireText && (
          <div className="space-y-1.5">
            <p className="text-xs text-gray-500">
              Saisissez <span className="font-bold text-gray-900 dark:text-white tracking-wide">{requireText}</span> pour confirmer.
            </p>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={requireText}
              autoFocus
              className="w-full px-3 py-2 rounded-input text-sm bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:border-alert transition-colors"
            />
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onCancel} disabled={loading} className="flex-1 btn-ghost py-2.5 text-sm">
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={loading || !canConfirm}
            className="flex-1 bg-alert text-white px-4 py-2.5 rounded-input text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'En cours…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
