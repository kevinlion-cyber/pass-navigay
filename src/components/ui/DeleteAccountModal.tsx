import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

// Suppression de compte (faille E3 de l'audit) : passe par l'Edge Function
// `delete-account`, qui arrête les abonnements Stripe, supprime les fichiers et le
// compte de connexion. Avant, le bouton n'effaçait que le profil : le compte
// renaissait à la connexion suivante et Stripe continuait de prélever.
//
// Parcours validé par Kévin (24/11/2026) :
//  - abonné payant : choix « rester en gratuit à la fin de l'abonnement »
//    ou « tout supprimer » (arrêt immédiat, sans remboursement) ;
//  - pro : choix de supprimer ses fiches ou de les laisser dans l'annuaire en gratuit.

type Tone = 'tu' | 'vous';

interface SubInfo {
  id: string;
  kind: 'premium' | 'pro';
  label: string;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

interface Status {
  isAdmin: boolean;
  subscriptions: SubInfo[];
  establishments: { id: string; name: string }[];
}

const CONFIRM_WORD = 'SUPPRIMER';

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

const TXT = {
  tu: {
    title: 'Supprimer mon compte',
    loading: 'Vérification de ton compte…',
    admin: "Un compte administrateur ne peut pas être supprimé depuis l'application.",
    subIntro: 'Tu as un abonnement en cours. Que souhaites-tu faire ?',
    alreadyEnding: (d: string) => `Ton abonnement s'arrêtera déjà le ${d}.`,
    downgrade: (d: string) => `Rester en gratuit à la fin de mon abonnement${d ? ` (le ${d})` : ''}`,
    downgradeHint: 'Ton compte est conservé. Tu gardes tes avantages jusqu’à cette date, puis tu repasses en gratuit. Plus aucun prélèvement.',
    deleteAll: 'Tout supprimer maintenant',
    deleteAllHint: 'Ton abonnement est arrêté immédiatement, sans remboursement de la période en cours.',
    estQuestion: 'Que deviennent tes fiches d’établissement ?',
    estDelete: 'Les supprimer avec mon compte',
    estKeep: 'Les laisser dans l’annuaire en version gratuite (sans photos, événements ni promotions)',
    warn: 'Ton profil, tes photos, tes messages, tes favoris et tes avis seront définitivement supprimés. Cette action est irréversible.',
    type: 'Tape',
    toConfirm: 'pour confirmer.',
    confirm: 'Supprimer définitivement',
    back: 'Retour',
    cancel: 'Annuler',
    downgradeDone: (d: string) => `C’est noté : ton abonnement s’arrêtera${d ? ` le ${d}` : ' à la fin de la période'}, sans nouveau prélèvement.`,
    deleted: 'Ton compte a été supprimé.',
  },
  vous: {
    title: 'Supprimer mon compte professionnel',
    loading: 'Vérification de votre compte…',
    admin: "Un compte administrateur ne peut pas être supprimé depuis l'application.",
    subIntro: 'Vous avez un abonnement en cours. Que souhaitez-vous faire ?',
    alreadyEnding: (d: string) => `Votre abonnement s'arrêtera déjà le ${d}.`,
    downgrade: (d: string) => `Rester en gratuit à la fin de mon abonnement${d ? ` (le ${d})` : ''}`,
    downgradeHint: 'Votre compte est conservé. Vous gardez vos avantages jusqu’à cette date, puis vous repassez en gratuit. Plus aucun prélèvement.',
    deleteAll: 'Tout supprimer maintenant',
    deleteAllHint: 'Votre abonnement est arrêté immédiatement, sans remboursement de la période en cours.',
    estQuestion: 'Que deviennent vos fiches d’établissement ?',
    estDelete: 'Les supprimer avec mon compte',
    estKeep: 'Les laisser dans l’annuaire en version gratuite (sans photos, événements ni promotions)',
    warn: 'Votre compte, vos visuels, vos événements, vos promotions et vos messages seront définitivement supprimés. Cette action est irréversible.',
    type: 'Saisissez',
    toConfirm: 'pour confirmer.',
    confirm: 'Supprimer définitivement',
    back: 'Retour',
    cancel: 'Annuler',
    downgradeDone: (d: string) => `C’est noté : votre abonnement s’arrêtera${d ? ` le ${d}` : ' à la fin de la période'}, sans nouveau prélèvement.`,
    deleted: 'Votre compte a été supprimé.',
  },
};

async function callDeleteAccount(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('delete-account', { body });
  if (error) {
    // Le message utile est dans le corps de la réponse d'erreur.
    let msg = 'Une erreur est survenue. Réessaie plus tard.';
    try {
      const ctx = (error as { context?: Response }).context;
      const parsed = ctx ? await ctx.json() : null;
      if (parsed?.error) msg = parsed.error;
    } catch { /* message par défaut */ }
    throw new Error(msg);
  }
  return data;
}

interface Props {
  open: boolean;
  tone: Tone;
  onClose: () => void;
}

export default function DeleteAccountModal({ open, tone, onClose }: Props) {
  const t = TXT[tone];
  const navigate = useNavigate();
  const { signOut, refreshProfile } = useAuth();
  const [status, setStatus] = useState<Status | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState<'choice' | 'confirm'>('choice');
  const [keepEst, setKeepEst] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStatus(null); setLoadError(null); setTyped(''); setKeepEst(false); setBusy(false);
    callDeleteAccount({ action: 'status' })
      .then((s: Status) => {
        setStatus(s);
        const live = s.subscriptions.filter((x) => !x.cancelAtPeriodEnd);
        setStep(live.length > 0 ? 'choice' : 'confirm');
      })
      .catch((e: Error) => setLoadError(e.message));
  }, [open]);

  if (!open) return null;

  const liveSubs = status?.subscriptions.filter((s) => !s.cancelAtPeriodEnd) ?? [];
  const endingSubs = status?.subscriptions.filter((s) => s.cancelAtPeriodEnd) ?? [];
  const firstEnd = fmt(liveSubs[0]?.periodEnd ?? null);

  const handleDowngrade = async () => {
    setBusy(true);
    try {
      const res = await callDeleteAccount({ action: 'downgrade' });
      const end = fmt(res?.subscriptions?.[0]?.periodEnd ?? null);
      toast.success(t.downgradeDone(end), { duration: 6000 });
      await refreshProfile();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await callDeleteAccount({ action: 'delete', keepEstablishments: keepEst });
      await signOut();
      toast.success(t.deleted);
      onClose();
      navigate('/');
    } catch (e) {
      toast.error((e as Error).message, { duration: 6000 });
      setBusy(false);
    }
  };

  const canConfirm = typed.trim().toUpperCase() === CONFIRM_WORD && !busy;

  return (
    <div className="fixed inset-0 z-[1001] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card w-full max-w-md p-6 space-y-4 max-h-[90dvh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t.title}</h3>
          <button onClick={onClose} disabled={busy} aria-label={t.cancel} className="text-gray-400 hover:text-gray-700 dark:hover:text-white">
            <X size={18} />
          </button>
        </div>

        {!status && !loadError && (
          <p className="text-sm text-gray-500 flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> {t.loading}</p>
        )}

        {loadError && <p className="text-sm text-alert">{loadError}</p>}

        {status?.isAdmin && <p className="text-sm text-gray-600 dark:text-gray-400">{t.admin}</p>}

        {status && !status.isAdmin && step === 'choice' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-400">{t.subIntro}</p>
            <button
              onClick={handleDowngrade}
              disabled={busy}
              className="w-full text-left p-4 rounded-input border border-light-border dark:border-dark-border hover:border-primary transition-colors disabled:opacity-50"
            >
              <span className="block text-sm font-medium text-gray-900 dark:text-white">{t.downgrade(firstEnd)}</span>
              <span className="block text-xs text-gray-500 mt-1">{t.downgradeHint}</span>
            </button>
            <button
              onClick={() => setStep('confirm')}
              disabled={busy}
              className="w-full text-left p-4 rounded-input border border-alert/40 hover:border-alert transition-colors disabled:opacity-50"
            >
              <span className="block text-sm font-medium text-alert">{t.deleteAll}</span>
              <span className="block text-xs text-gray-500 mt-1">{t.deleteAllHint}</span>
            </button>
            {busy && <p className="text-xs text-gray-500 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> …</p>}
          </div>
        )}

        {status && !status.isAdmin && step === 'confirm' && (
          <div className="space-y-4">
            {(endingSubs.length > 0 || liveSubs.length > 0) && (
              <p className="text-xs text-gray-500">
                {endingSubs.length > 0 && liveSubs.length === 0 ? `${t.alreadyEnding(fmt(endingSubs[0].periodEnd))} ` : ''}
                {t.deleteAllHint}
              </p>
            )}

            {status.establishments.length > 0 && (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-gray-900 dark:text-white mb-1">{t.estQuestion}</legend>
                <p className="text-xs text-gray-500">{status.establishments.map((e) => e.name).join(', ')}</p>
                <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                  <input type="radio" name="est" checked={!keepEst} onChange={() => setKeepEst(false)} className="mt-1" />
                  {t.estDelete}
                </label>
                <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                  <input type="radio" name="est" checked={keepEst} onChange={() => setKeepEst(true)} className="mt-1" />
                  {t.estKeep}
                </label>
              </fieldset>
            )}

            <p className="text-sm text-gray-600 dark:text-gray-400">{t.warn}</p>

            <div className="space-y-1.5">
              <p className="text-xs text-gray-500">
                {t.type} <span className="font-bold text-gray-900 dark:text-white tracking-wide">{CONFIRM_WORD}</span> {t.toConfirm}
              </p>
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={CONFIRM_WORD}
                className="w-full px-3 py-2 rounded-input text-sm bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:border-alert transition-colors"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => (liveSubs.length > 0 ? setStep('choice') : onClose())}
                disabled={busy}
                className="flex-1 btn-ghost py-2.5 text-sm"
              >
                {liveSubs.length > 0 ? t.back : t.cancel}
              </button>
              <button
                onClick={handleDelete}
                disabled={!canConfirm}
                className="flex-1 bg-alert text-white px-4 py-2.5 rounded-input text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {busy && <Loader2 size={14} className="animate-spin" />}
                {t.confirm}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
