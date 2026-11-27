import { useCallback, useEffect, useState } from 'react';
import { Star, Shield, Trash2, Loader2, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import ConfirmModal from './ConfirmModal';

// Avis d'une fiche dans l'admin : suppression d'un avis ou réinitialisation de tous.
// Les suppressions passent par des fonctions de la base réservées aux admins
// (migration 80), qui gardent une copie de chaque avis pendant un an.

interface Avis {
  id: string;
  user_id: string;
  rating: number;
  safety_rating: number | null;
  comment: string | null;
  created_at: string;
}

export default function AdminReviewsSection({ establishmentId, establishmentName }: { establishmentId: string; establishmentName: string }) {
  const [avis, setAvis] = useState<Avis[]>([]);
  const [auteurs, setAuteurs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [aSupprimer, setASupprimer] = useState<Avis | null>(null);
  const [reinitOuvert, setReinitOuvert] = useState(false);
  const [enCours, setEnCours] = useState(false);

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('id, user_id, rating, safety_rating, comment, created_at')
        .eq('establishment_id', establishmentId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const liste = (data || []) as Avis[];
      setAvis(liste);
      const ids = [...new Set(liste.map((a) => a.user_id).filter(Boolean))];
      if (ids.length) {
        const { data: profils } = await supabase.from('profiles').select('id, prenom, username').in('id', ids);
        const noms: Record<string, string> = {};
        (profils || []).forEach((p: { id: string; prenom: string | null; username: string | null }) => {
          noms[p.id] = p.prenom || p.username || 'Membre';
        });
        setAuteurs(noms);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors du chargement des avis');
    }
    setLoading(false);
  }, [establishmentId]);

  useEffect(() => { charger(); }, [charger]);

  const supprimerUn = async () => {
    if (!aSupprimer) return;
    setEnCours(true);
    try {
      const { error } = await supabase.rpc('admin_supprimer_avis', { p_review_id: aSupprimer.id });
      if (error) throw error;
      setAvis((prev) => prev.filter((a) => a.id !== aSupprimer.id));
      toast.success('Avis supprimé');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    }
    setEnCours(false);
    setASupprimer(null);
  };

  const reinitialiser = async () => {
    setEnCours(true);
    try {
      const { data, error } = await supabase.rpc('admin_reinitialiser_avis', { p_establishment_id: establishmentId });
      if (error) throw error;
      setAvis([]);
      toast.success(`${data ?? 0} avis supprimé${(data ?? 0) > 1 ? 's' : ''}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la réinitialisation');
    }
    setEnCours(false);
    setReinitOuvert(false);
  };

  const moyenne = avis.length ? avis.reduce((s, a) => s + (a.rating || 0), 0) / avis.length : 0;

  return (
    <>
      <div className="mb-2 mt-6 flex items-center justify-between">
        <p className="text-[12px] uppercase tracking-[0.5px] text-[#606070] font-medium">
          Avis {avis.length > 0 && `(${avis.length} · ★ ${moyenne.toFixed(1)})`}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-[#606070]" /></div>
      ) : avis.length === 0 ? (
        <p className="text-[13px] text-[#606070] mb-4">Aucun avis sur cette fiche.</p>
      ) : (
        <>
          <ul className="space-y-2 mb-3 max-h-[320px] overflow-y-auto pr-1">
            {avis.map((a) => (
              <li key={a.id} className="flex items-start gap-2 rounded-lg p-2.5" style={{ background: '#0a0a0f', border: '1px solid #2a2a3a' }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-[12px] text-[#a0a0b0]">
                    <span className="font-medium text-white truncate">{auteurs[a.user_id] || 'Membre'}</span>
                    <span className="flex items-center gap-0.5 text-[#d4a017]"><Star size={11} fill="currentColor" />{a.rating}</span>
                    {a.safety_rating ? <span className="flex items-center gap-0.5 text-[#c084f5]"><Shield size={11} />{a.safety_rating}</span> : null}
                    <span className="ml-auto shrink-0 text-[#606070]">{new Date(a.created_at).toLocaleDateString('fr-FR')}</span>
                  </div>
                  {a.comment && <p className="text-[12px] text-[#a0a0b0] mt-1 break-words line-clamp-3">{a.comment}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => setASupprimer(a)}
                  className="shrink-0 p-1.5 rounded text-[#606070] hover:text-[#c0392b] transition-colors"
                  aria-label="Supprimer cet avis"
                  title="Supprimer cet avis"
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setReinitOuvert(true)}
            className="w-full py-2.5 rounded-lg text-[13px] font-medium transition-colors hover:opacity-90 flex items-center justify-center gap-2 mb-4"
            style={{ background: 'transparent', border: '1px solid #c0392b', color: '#e06050' }}
          >
            <RotateCcw size={14} />
            Réinitialiser les avis
          </button>
        </>
      )}

      <ConfirmModal
        open={!!aSupprimer}
        title="Supprimer cet avis ?"
        message={`L'avis de ${aSupprimer ? auteurs[aSupprimer.user_id] || 'ce membre' : ''} sera retiré de la fiche. Une copie est gardée un an en cas d'erreur.`}
        confirmLabel="Supprimer"
        onCancel={() => setASupprimer(null)}
        onConfirm={supprimerUn}
        loading={enCours}
      />

      <ConfirmModal
        open={reinitOuvert}
        title="Réinitialiser tous les avis ?"
        message={`Les ${avis.length} avis de « ${establishmentName} » seront retirés et la note repartira de zéro. Une copie est gardée un an en cas d'erreur.`}
        confirmLabel="Réinitialiser"
        requireText="EFFACER"
        onCancel={() => setReinitOuvert(false)}
        onConfirm={reinitialiser}
        loading={enCours}
      />
    </>
  );
}
