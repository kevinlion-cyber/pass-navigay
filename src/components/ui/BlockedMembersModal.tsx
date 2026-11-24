import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { listMyBlocks, unblockMember, type BlockedMember } from '../../lib/moderation';

// Liste des membres que j'ai bloqués, avec déblocage (E4).
export default function BlockedMembersModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [items, setItems] = useState<BlockedMember[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setItems(null);
    listMyBlocks().then(setItems).catch((e: Error) => { toast.error(e.message); setItems([]); });
  }, [open]);

  if (!open) return null;

  const unblock = async (m: BlockedMember) => {
    if (!user) return;
    setBusyId(m.blocked_id);
    try {
      await unblockMember(user.id, m.blocked_id);
      setItems((prev) => (prev || []).filter((x) => x.blocked_id !== m.blocked_id));
      toast.success(`${m.prenom || m.username || 'Ce membre'} est débloqué·e.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[1001] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card w-full max-w-md p-6 space-y-4 max-h-[90dvh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Membres bloqués</h3>
          <button onClick={onClose} aria-label="Fermer" className="text-gray-400 hover:text-gray-700 dark:hover:text-white"><X size={18} /></button>
        </div>
        {items === null && <p className="text-sm text-gray-500 flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Chargement…</p>}
        {items && items.length === 0 && <p className="text-sm text-gray-500">Tu n’as bloqué personne.</p>}
        {items && items.length > 0 && (
          <ul className="divide-y divide-light-border dark:divide-dark-border">
            {items.map((m) => (
              <li key={m.blocked_id} className="flex items-center gap-3 py-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 overflow-hidden flex items-center justify-center shrink-0">
                  {m.avatar_url
                    ? <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />
                    : <span className="text-primary text-sm font-medium">{(m.prenom || m.username || '?').charAt(0).toUpperCase()}</span>}
                </div>
                <span className="flex-1 text-sm text-gray-900 dark:text-white truncate">{m.prenom || m.username}</span>
                <button
                  onClick={() => unblock(m)}
                  disabled={busyId === m.blocked_id}
                  className="text-xs px-3 py-1.5 rounded-input border border-light-border dark:border-dark-border text-gray-600 dark:text-gray-300 hover:border-primary disabled:opacity-50"
                >
                  {busyId === m.blocked_id ? '…' : 'Débloquer'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
