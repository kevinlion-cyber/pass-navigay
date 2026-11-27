import { useEffect, useState } from 'react';
import { X, Loader2, Undo2, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

/**
 * « Renoncer au contrat ici » (art. L221-21 du Code de la consommation, depuis le
 * 19/06/2026) : visible par un membre Premium pendant les 14 jours qui suivent sa
 * souscription. Le serveur (fonction retractation-premium) décide seul si la
 * rétractation est possible, arrête l'abonnement et envoie l'accusé de réception.
 */

interface Statut {
  eligible: boolean;
  reference?: string;
  souscrit_le?: string;
  jusquau?: string;
}

function dateLongue(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function RetractationPremium() {
  const { user, profile, refreshProfile } = useAuth();
  const [statut, setStatut] = useState<Statut | null>(null);
  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [fait, setFait] = useState<{ remboursement: number } | null>(null);

  useEffect(() => {
    if (!profile?.is_premium) return;
    let annule = false;
    supabase.functions
      .invoke('retractation-premium', { body: { action: 'statut' } })
      .then(({ data }) => { if (!annule && data) setStatut(data as Statut); })
      .catch(() => { /* pas de bouton si le serveur ne répond pas */ });
    return () => { annule = true; };
  }, [profile?.is_premium]);

  useEffect(() => {
    if (ouvert && !nom) setNom([profile?.prenom, profile?.nom].filter(Boolean).join(' '));
  }, [ouvert, nom, profile?.prenom, profile?.nom]);

  if (fait) {
    return (
      <>
      <div className="border-t border-light-border dark:border-dark-border" />
      <div className="flex items-start gap-3 py-1 text-sm text-gray-700 dark:text-gray-300">
        <CheckCircle size={16} className="text-success shrink-0 mt-0.5" />
        <span>
          Ta rétractation est enregistrée et ton abonnement est arrêté. Un accusé de réception t'a été envoyé par e-mail.
          {fait.remboursement > 0 && ` Tu seras remboursé·e de ${(fait.remboursement / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} sous 14 jours au plus tard.`}
        </span>
      </div>
      </>
    );
  }

  if (!statut?.eligible) return null;

  const confirmer = async () => {
    if (nom.trim().length < 2) {
      toast.error('Indique ton prénom et ton nom.');
      return;
    }
    setEnvoi(true);
    try {
      const { data, error } = await supabase.functions.invoke('retractation-premium', {
        body: { action: 'confirmer', nom: nom.trim() },
      });
      if (error || !data?.success) {
        const raison = (data as { raison?: string } | null)?.raison;
        toast.error(
          raison === 'deja_demandee' ? 'Ta rétractation a déjà été enregistrée.'
            : raison === 'delai_depasse' ? 'Le délai de 14 jours est dépassé.'
              : (data as { error?: string } | null)?.error || "La demande n'a pas pu être envoyée. Réessaie dans un instant.",
        );
        return;
      }
      setOuvert(false);
      setFait({ remboursement: data.montant_a_rembourser_centimes ?? 0 });
      await refreshProfile();
    } catch {
      toast.error('Erreur de connexion. Vérifie ta connexion et réessaie.');
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <>
      <div className="border-t border-light-border dark:border-dark-border" />
      <button onClick={() => setOuvert(true)} className="flex items-center gap-3 w-full text-left py-1">
        <Undo2 size={16} className="text-gray-400" />
        <span className="text-sm text-gray-700 dark:text-gray-300">
          Renoncer au contrat ici
          <span className="block text-xs text-gray-500 dark:text-gray-400">
            Rétractation possible jusqu'au {dateLongue(statut.jusquau)}
          </span>
        </span>
      </button>

      {ouvert && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4" onClick={() => !envoi && setOuvert(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="retractation-titre"
            className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white dark:bg-dark-surface border border-light-border dark:border-dark-border p-5 space-y-4 max-h-[90dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id="retractation-titre" className="text-lg font-semibold text-gray-900 dark:text-white">Te rétracter de ton abonnement Premium</h2>
              <button onClick={() => setOuvert(false)} disabled={envoi} aria-label="Fermer" className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1.5 list-disc pl-5">
              <li>Ton abonnement est arrêté tout de suite et ton Premium prend fin.</li>
              <li>Tu es remboursé·e sous 14 jours, moins la période déjà utilisée (tu as demandé à profiter du Premium dès le paiement).</li>
              <li>Ton compte gratuit reste actif.</li>
            </ul>

            <div className="space-y-3">
              <div>
                <label htmlFor="retractation-nom" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Prénom et nom</label>
                <input id="retractation-nom" className="input-field" value={nom} onChange={(e) => setNom(e.target.value)} maxLength={120} autoComplete="name" />
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                <p>Accusé de réception envoyé à : <strong className="text-gray-700 dark:text-gray-200">{user?.email}</strong></p>
                <p>Référence de l'abonnement : <span className="font-mono">{statut.reference}</span></p>
                <p>Souscrit le {dateLongue(statut.souscrit_le)}</p>
              </div>
            </div>

            <button onClick={confirmer} disabled={envoi} className="btn-primary w-full flex items-center justify-center gap-2">
              {envoi && <Loader2 size={16} className="animate-spin" />}
              Confirmer la rétractation
            </button>
          </div>
        </div>
      )}
    </>
  );
}
