interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
  loading?: boolean;
}

export default function ConfirmModal({ open, title, message, confirmLabel = 'Confirmer', onCancel, onConfirm, loading }: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1001] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-dark-surface border border-dark-border rounded-card w-full max-w-sm p-6 space-y-4">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <p className="text-sm text-gray-400">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={loading} className="flex-1 btn-ghost py-2.5 text-sm">
            Annuler
          </button>
          <button onClick={onConfirm} disabled={loading} className="flex-1 bg-alert text-white px-4 py-2.5 rounded-input text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
            {loading ? 'Chargement...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
