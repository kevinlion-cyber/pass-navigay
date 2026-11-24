import { useEffect, useState, type ReactNode } from 'react';
import { Loader2, ShieldCheck, Smartphone } from 'lucide-react';
import { supabase } from '../../lib/supabase';

// Double authentification obligatoire pour l'administration (24/11/2026).
// - Admin sans application d'authentification : écran de configuration (QR code).
// - Admin déjà équipé : code à 6 chiffres à chaque nouvelle session.
// La base n'accorde les pouvoirs admin qu'aux sessions ainsi validées (« aal2 »,
// migration 70) : cet écran n'est pas la seule protection.

type Stage = 'checking' | 'ok' | 'enroll' | 'verify' | 'error';

export default function AdminMfaGate({ children }: { children: ReactNode }) {
  const [stage, setStage] = useState<Stage>('checking');
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const check = async () => {
    setStage('checking');
    setMessage(null);
    try {
      const { data: aal, error: aalErr } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalErr) throw aalErr;
      if (aal.currentLevel === 'aal2') { setStage('ok'); return; }

      const { data: factors, error: fErr } = await supabase.auth.mfa.listFactors();
      if (fErr) throw fErr;
      const verified = factors.totp.find((f) => f.status === 'verified');
      if (verified) {
        setFactorId(verified.id);
        setStage('verify');
        return;
      }
      // Pas encore d'application : on nettoie un éventuel essai inachevé, puis on en crée une.
      for (const f of factors.all.filter((x) => x.factor_type === 'totp' && x.status !== 'verified')) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data: enrolled, error: eErr } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `Pass Navigay admin ${new Date().toISOString().slice(0, 10)}`,
      });
      if (eErr) throw eErr;
      setFactorId(enrolled.id);
      setQr(enrolled.totp.qr_code);
      setSecret(enrolled.totp.secret);
      setStage('enroll');
    } catch (e) {
      setMessage((e as Error).message || 'Erreur inconnue');
      setStage('error');
    }
  };

  useEffect(() => { check(); }, []);

  const submit = async () => {
    if (!factorId || code.trim().length !== 6) return;
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    setBusy(false);
    if (error) {
      setMessage('Code incorrect ou expiré. Réessayez avec le code affiché en ce moment dans votre application.');
      setCode('');
      return;
    }
    setStage('ok');
  };

  if (stage === 'ok') return <>{children}</>;

  return (
    <div className="min-h-screen bg-light-bg dark:bg-dark-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck size={22} style={{ color: '#7B2D8B' }} />
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Double authentification</h1>
        </div>

        {stage === 'checking' && (
          <p className="text-sm text-gray-500 flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Vérification…</p>
        )}

        {stage === 'error' && (
          <>
            <p className="text-sm text-alert">La double authentification n’a pas pu être préparée : {message}</p>
            <p className="text-xs text-gray-500">Vérifiez qu’elle est activée dans Supabase (Authentication → Multi-Factor → TOTP), puis réessayez.</p>
            <button onClick={check} className="btn-primary w-full py-2.5 text-sm">Réessayer</button>
          </>
        )}

        {stage === 'enroll' && (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Pour protéger l’administration, chaque connexion demande désormais un code temporaire, en plus du mot de passe.
            </p>
            <ol className="text-sm text-gray-600 dark:text-gray-400 list-decimal pl-5 space-y-1">
              <li>Installez une application d’authentification sur votre téléphone (Google Authenticator, Microsoft Authenticator, 2FAS…).</li>
              <li>Dans l’application, ajoutez un compte en scannant ce QR code.</li>
              <li>Saisissez ci-dessous le code à 6 chiffres affiché.</li>
            </ol>
            {qr && (
              <div className="flex justify-center bg-white rounded-input p-3">
                <img src={qr} alt="QR code de configuration" className="w-44 h-44" />
              </div>
            )}
            {secret && (
              <p className="text-[11px] text-gray-500 break-all">
                Impossible de scanner ? Clé à saisir dans l’application : <span className="font-mono text-gray-800 dark:text-gray-200">{secret}</span>
              </p>
            )}
          </>
        )}

        {stage === 'verify' && (
          <p className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2">
            <Smartphone size={16} className="mt-0.5 shrink-0" />
            Ouvrez votre application d’authentification et saisissez le code à 6 chiffres de Pass Navigay.
          </p>
        )}

        {(stage === 'enroll' || stage === 'verify') && (
          <>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              autoFocus
              className="w-full px-3 py-3 rounded-input text-center text-xl tracking-[0.4em] font-mono bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border text-gray-900 dark:text-white outline-none focus:border-primary"
            />
            {message && <p className="text-xs text-alert">{message}</p>}
            <button onClick={submit} disabled={busy || code.length !== 6} className="btn-primary w-full py-2.5 text-sm disabled:opacity-50 inline-flex items-center justify-center gap-2">
              {busy && <Loader2 size={14} className="animate-spin" />} Valider
            </button>
            <p className="text-[11px] text-gray-500">
              Téléphone perdu ? Un autre administrateur, ou le tableau de bord Supabase (Authentication → Users), peut réinitialiser votre double authentification.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
