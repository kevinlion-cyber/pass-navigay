import { useState } from 'react';
import { ShieldCheck, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import {
  CONSENT_TITLE, CONSENT_POINTS, CONSENT_CHECKBOX, hasSensitiveData,
  giveSensitiveConsent, withdrawSensitiveConsent,
} from '../../lib/consent';
import type { Profile } from '../../lib/types';

// RGPD (migration 69). Deux éléments :
//  - SensitiveConsentPrompt : fenêtre à la connexion pour les membres qui avaient
//    déjà répondu au questionnaire sans case de consentement (leurs réponses sont
//    masquées aux autres en attendant) ;
//  - SensitiveDataSettings : état de l'accord dans Paramètres, avec retrait
//    (= effacement immédiat des réponses sensibles).

const LATER_KEY = 'pn_consent_later';

export function SensitiveConsentPrompt() {
  const { profile, refreshProfile } = useAuth();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState<'' | 'accept' | 'erase'>('');
  const [later, setLater] = useState(() => {
    try { return sessionStorage.getItem(LATER_KEY) === '1'; } catch { return false; }
  });

  const p = profile as (Profile & Record<string, unknown>) | null;
  if (!p || later || p.sensitive_consent_at || !hasSensitiveData(p)) return null;

  const accept = async () => {
    setBusy('accept');
    try {
      await giveSensitiveConsent();
      await refreshProfile();
      toast.success('Merci, ton accord est enregistré.');
    } catch (e) { toast.error((e as Error).message); }
    setBusy('');
  };
  const erase = async () => {
    setBusy('erase');
    try {
      await withdrawSensitiveConsent();
      await refreshProfile();
      toast.success('Tes réponses sensibles ont été effacées.');
    } catch (e) { toast.error((e as Error).message); }
    setBusy('');
  };
  const postpone = () => {
    try { sessionStorage.setItem(LATER_KEY, '1'); } catch { /* stockage indisponible */ }
    setLater(true);
  };

  return (
    <div className="fixed inset-0 z-[1001] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card w-full max-w-md p-6 space-y-4 max-h-[90dvh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <ShieldCheck size={20} className="text-primary" /> {CONSENT_TITLE}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Tu as déjà répondu à certaines de ces questions. Pour mieux te protéger, nous avons besoin de ton accord
          explicite. En attendant, ces réponses ne sont <strong>plus montrées</strong> aux autres membres.
        </p>
        <ul className="space-y-2 list-disc pl-5 text-sm text-gray-600 dark:text-gray-400">
          {CONSENT_POINTS.slice(1).map((t) => <li key={t}>{t}</li>)}
        </ul>
        <label className="flex items-start gap-2 text-sm text-gray-800 dark:text-gray-200 cursor-pointer">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-1" />
          {CONSENT_CHECKBOX}
        </label>
        <div className="flex flex-col gap-2">
          <button onClick={accept} disabled={!checked || !!busy} className="btn-primary py-2.5 text-sm disabled:opacity-40 inline-flex items-center justify-center gap-2">
            {busy === 'accept' && <Loader2 size={14} className="animate-spin" />} J’accepte
          </button>
          <button onClick={erase} disabled={!!busy} className="py-2.5 text-sm rounded-input border border-light-border dark:border-dark-border text-gray-700 dark:text-gray-300 hover:border-alert inline-flex items-center justify-center gap-2">
            {busy === 'erase' && <Loader2 size={14} className="animate-spin" />} Non, effacer ces réponses
          </button>
          <button onClick={postpone} disabled={!!busy} className="py-2 text-xs text-gray-500 hover:text-gray-800 dark:hover:text-white">
            Plus tard (elles restent masquées)
          </button>
        </div>
      </div>
    </div>
  );
}

export function SensitiveDataSettings({ profile }: { profile: Profile }) {
  const { refreshProfile } = useAuth();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const p = profile as Profile & Record<string, unknown>;
  const hasData = hasSensitiveData(p);
  const consentAt = profile.sensitive_consent_at;

  if (!consentAt && !hasData) return null;

  const withdraw = async () => {
    setBusy(true);
    try {
      await withdrawSensitiveConsent();
      await refreshProfile();
      toast.success('Accord retiré : tes réponses sensibles ont été effacées.');
      setConfirmOpen(false);
    } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  };
  const accept = async () => {
    setBusy(true);
    try {
      await giveSensitiveConsent();
      await refreshProfile();
      toast.success('Merci, ton accord est enregistré.');
    } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  };

  return (
    <section>
      <h2 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
        <ShieldCheck size={18} className="text-primary" /> Données sensibles
      </h2>
      <div className="card p-4 space-y-3 text-sm text-gray-700 dark:text-gray-300">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Identité de genre, pronoms, orientation, attirance et ce que tu recherches.
        </p>
        {consentAt ? (
          <>
            <p>Tu as donné ton accord le {new Date(consentAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}.</p>
            {!confirmOpen ? (
              <button onClick={() => setConfirmOpen(true)} className="text-xs text-gray-500 hover:text-alert underline">
                Retirer mon accord et effacer ces réponses
              </button>
            ) : (
              <div className="space-y-2 rounded-input p-3 border border-alert/40">
                <p className="text-xs">Tes réponses sensibles seront <strong>effacées définitivement</strong>. Le reste de ton profil est conservé. Tu pourras répondre à nouveau plus tard.</p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmOpen(false)} disabled={busy} className="btn-ghost text-xs py-1.5 px-3">Annuler</button>
                  <button onClick={withdraw} disabled={busy} className="bg-alert text-white text-xs py-1.5 px-3 rounded-input disabled:opacity-50">
                    {busy ? '…' : 'Retirer et effacer'}
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <p>Tes réponses sont enregistrées mais <strong>masquées</strong> aux autres membres, car tu n’as pas encore donné ton accord.</p>
            <label className="flex items-start gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5" />
              {CONSENT_CHECKBOX}
            </label>
            <div className="flex gap-2 flex-wrap">
              <button onClick={accept} disabled={!checked || busy} className="btn-primary text-xs py-1.5 px-3 disabled:opacity-40">Donner mon accord</button>
              <button onClick={withdraw} disabled={busy} className="text-xs py-1.5 px-3 rounded-input border border-light-border dark:border-dark-border hover:border-alert">Effacer ces réponses</button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
