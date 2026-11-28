import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, UploadCloud } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';

// Suivi du lien PassNavigay → HubSpot (migration 81, fonction hubspot-sync).
// Les envois se font tout seuls toutes les 10 minutes ; cette carte montre l'état
// et permet d'envoyer tous les payants actuels d'un coup (rattrapage).

interface Ligne { cible: string; a_faire: boolean; tentatives: number; derniere_erreur: string | null; envoye_le: string | null }

export default function HubspotSyncCard() {
  const [lignes, setLignes] = useState<Ligne[] | null>(null);
  const [enCours, setEnCours] = useState(false);

  const charger = useCallback(async () => {
    const { data, error } = await supabase.from('hubspot_sync').select('cible,a_faire,tentatives,derniere_erreur,envoye_le');
    setLignes(error ? [] : (data as Ligne[]));
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const envoyer = async (rattrapage: boolean) => {
    setEnCours(true);
    try {
      if (rattrapage) {
        const { data: n, error } = await supabase.rpc('admin_hubspot_rattrapage');
        if (error) throw error;
        toast.success(`${n ?? 0} fiche${(n ?? 0) > 1 ? 's' : ''} mise${(n ?? 0) > 1 ? 's' : ''} en file`);
      }
      const { data, error } = await supabase.functions.invoke('hubspot-sync', { body: {} });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data.erreurs) toast.error(`${data.envoyes} envoyé(s), ${data.erreurs} en erreur (nouvel essai automatique)`);
      else toast.success(`${data.envoyes} envoyé(s) à HubSpot`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
    setEnCours(false);
    charger();
  };

  const synchro = (lignes || []).filter((l) => l.cible !== 'effacement');
  const envoyes = synchro.filter((l) => !l.a_faire && l.envoye_le).length;
  const attente = (lignes || []).filter((l) => l.a_faire && l.tentatives < 10).length;
  const erreurs = (lignes || []).filter((l) => l.a_faire && l.tentatives > 0);
  const derniere = erreurs[0]?.derniere_erreur;

  return (
    <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card p-4 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">HubSpot</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Les membres Premium et établissements Pro payants sont envoyés automatiquement (toutes les 10 minutes) : formule,
          dates, actif ou ancien client. Aucune donnée intime n'est envoyée. Un compte supprimé est effacé de HubSpot.
        </p>
      </div>
      {lignes === null ? (
        <div className="skeleton h-10 rounded-input" />
      ) : (
        <div className="flex gap-4 text-sm flex-wrap">
          <span className="text-gray-700 dark:text-gray-300"><strong>{envoyes}</strong> envoyé{envoyes > 1 ? 's' : ''}</span>
          <span className="text-gray-700 dark:text-gray-300"><strong>{attente}</strong> en attente</span>
          {erreurs.length > 0 && <span className="text-[#c0392b]"><strong>{erreurs.length}</strong> en erreur</span>}
        </div>
      )}
      {derniere && <p className="text-xs text-[#c0392b] break-words">Dernière erreur : {derniere}</p>}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => envoyer(true)} disabled={enCours} className="btn-primary text-sm flex items-center gap-1.5 py-2 px-4 disabled:opacity-60">
          {enCours ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />} Envoyer tous les payants actuels
        </button>
        <button onClick={() => envoyer(false)} disabled={enCours || attente === 0}
          className="text-sm flex items-center gap-1.5 py-2 px-4 rounded-input border border-light-border dark:border-dark-border text-gray-700 dark:text-gray-200 hover:opacity-80 disabled:opacity-50">
          <RefreshCw size={15} /> Envoyer les mises à jour maintenant
        </button>
      </div>
    </div>
  );
}
