import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal, Flag, Ban, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { REPORT_REASONS, blockMember, reportMember } from '../../lib/moderation';

// Menu « … » sur le profil d'un membre et dans une conversation : Signaler / Bloquer (E4).

interface Props {
  memberId: string;
  memberName: string;
  context: 'profil' | 'conversation';
  onBlocked: () => void;
  className?: string;
}

export default function MemberSafetyMenu({ memberId, memberName, context, onBlocked, className = '' }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  if (!user || user.id === memberId) return null;

  return (
    <div ref={menuRef} className={`relative ${className}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Plus d'options"
        className="p-2 rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
      >
        <MoreHorizontal size={20} />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-48 z-50 rounded-input border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface shadow-lg overflow-hidden">
          <button
            onClick={() => { setOpen(false); setReportOpen(true); }}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left text-gray-700 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5"
          >
            <Flag size={15} /> Signaler
          </button>
          <button
            onClick={() => { setOpen(false); setBlockOpen(true); }}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left text-alert hover:bg-black/5 dark:hover:bg-white/5"
          >
            <Ban size={15} /> Bloquer
          </button>
        </div>
      )}

      {reportOpen && (
        <ReportModal
          memberId={memberId}
          memberName={memberName}
          context={context}
          onClose={() => setReportOpen(false)}
          onBlocked={onBlocked}
        />
      )}
      {blockOpen && (
        <BlockModal
          memberId={memberId}
          memberName={memberName}
          onClose={() => setBlockOpen(false)}
          onBlocked={onBlocked}
        />
      )}
    </div>
  );
}

function ModalShell({ title, onClose, busy, children }: { title: string; onClose: () => void; busy: boolean; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[1001] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card w-full max-w-md p-6 space-y-4 max-h-[90dvh] overflow-y-auto text-left">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
          <button onClick={onClose} disabled={busy} aria-label="Fermer" className="text-gray-400 hover:text-gray-700 dark:hover:text-white">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function BlockModal({ memberId, memberName, onClose, onBlocked }: { memberId: string; memberName: string; onClose: () => void; onBlocked: () => void }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await blockMember(user.id, memberId);
      toast.success(`${memberName} est bloqué·e.`);
      onClose();
      onBlocked();
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <ModalShell title={`Bloquer ${memberName} ?`} onClose={onClose} busy={busy}>
      <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1.5 list-disc pl-5">
        <li>Vous ne pourrez plus vous écrire, et votre conversation sera masquée.</li>
        <li>Vous ne vous verrez plus dans les membres ni sur vos profils.</li>
        <li>{memberName} ne sera pas prévenu·e.</li>
        <li>Tu pourras débloquer à tout moment dans Paramètres → Membres bloqués.</li>
      </ul>
      <div className="flex gap-3">
        <button onClick={onClose} disabled={busy} className="flex-1 btn-ghost py-2.5 text-sm">Annuler</button>
        <button
          onClick={confirm}
          disabled={busy}
          className="flex-1 bg-alert text-white px-4 py-2.5 rounded-input text-sm font-medium hover:opacity-90 disabled:opacity-40 inline-flex items-center justify-center gap-2"
        >
          {busy && <Loader2 size={14} className="animate-spin" />} Bloquer
        </button>
      </div>
    </ModalShell>
  );
}

function ReportModal({ memberId, memberName, context, onClose, onBlocked }: {
  memberId: string; memberName: string; context: 'profil' | 'conversation'; onClose: () => void; onBlocked: () => void;
}) {
  const { user } = useAuth();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!user || !reason) return;
    setBusy(true);
    try {
      await reportMember(memberId, reason, details.trim(), context);
      if (alsoBlock) await blockMember(user.id, memberId);
      toast.success('Merci, ton signalement a bien été envoyé à l’équipe Pass Navigay.', { duration: 5000 });
      onClose();
      if (alsoBlock) onBlocked();
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <ModalShell title={`Signaler ${memberName}`} onClose={onClose} busy={busy}>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Ton signalement est confidentiel : {memberName} ne saura pas qu’il vient de toi.
        {context === 'conversation' && ' Les derniers messages de votre conversation seront joints pour que l’équipe puisse vérifier.'}
      </p>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-gray-900 dark:text-white mb-1">Motif</legend>
        {REPORT_REASONS.map((r) => (
          <label key={r.value} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
            <input type="radio" name="reason" value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} />
            {r.label}
          </label>
        ))}
      </fieldset>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-900 dark:text-white" htmlFor="report-details">Précisions (facultatif)</label>
        <textarea
          id="report-details"
          value={details}
          onChange={(e) => setDetails(e.target.value.slice(0, 1000))}
          rows={3}
          placeholder="Ce qui s’est passé…"
          className="w-full px-3 py-2 rounded-input text-sm bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:border-primary"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
        <input type="checkbox" checked={alsoBlock} onChange={(e) => setAlsoBlock(e.target.checked)} />
        Bloquer aussi {memberName}
      </label>

      <p className="text-xs text-gray-500">En cas de danger immédiat, appelle le 17 (police) ou le 112.</p>

      <div className="flex gap-3">
        <button onClick={onClose} disabled={busy} className="flex-1 btn-ghost py-2.5 text-sm">Annuler</button>
        <button
          onClick={submit}
          disabled={busy || !reason}
          className="flex-1 bg-primary text-white px-4 py-2.5 rounded-input text-sm font-medium hover:opacity-90 disabled:opacity-40 inline-flex items-center justify-center gap-2"
        >
          {busy && <Loader2 size={14} className="animate-spin" />} Envoyer
        </button>
      </div>
    </ModalShell>
  );
}
