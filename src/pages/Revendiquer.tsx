import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { BadgeCheck, Loader2, MapPin, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { track } from '../lib/analytics';

// Parcours « Revendique ta page » : le propriétaire (connecté, email vérifié à l'inscription)
// demande la revendication de sa fiche. L'admin valide, puis il gère sa fiche + passe Pro.
export default function Revendiquer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [estab, setEstab] = useState<{ id: string; name: string; city: string; owner_id: string | null; banner_url: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [existingClaim, setExistingClaim] = useState<{ status: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Analytics : entrée sur le parcours de revendication (étape entonnoir).
  useEffect(() => { if (id) track('claim_start', {}, id); }, [id]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await supabase.from('establishments').select('id,name,city,owner_id,banner_url').eq('id', id).maybeSingle();
      setEstab(data as typeof estab);
      if (user) {
        const { data: c } = await supabase.from('establishment_claims').select('status').eq('establishment_id', id).eq('claimant_profile_id', user.id).maybeSingle();
        setExistingClaim(c as { status: string } | null);
      }
      setLoading(false);
    })();
  }, [id, user]);

  const submit = async () => {
    if (!user || !estab) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('establishment_claims').insert({
        establishment_id: estab.id,
        email: profile?.email || user.email || '',
        claimant_profile_id: user.id,
      });
      if (error) throw error;
      track('claim_submit', {}, estab.id);
      setDone(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
    setSubmitting(false);
  };

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingSpinner size={28} /></div>;
  if (!estab) return <div className="max-w-md mx-auto p-6 text-center text-gray-500">Établissement introuvable.</div>;

  const alreadyOwned = !!estab.owner_id;

  return (
    <div className="max-w-md mx-auto p-4 py-8">
      <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card overflow-hidden">
        <div className="h-32 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-dark-border dark:to-dark-bg overflow-hidden">
          {estab.banner_url && <img src={estab.banner_url} alt="" className="w-full h-full object-cover" />}
        </div>
        <div className="p-6 space-y-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{estab.name}</h1>
            <p className="text-sm text-gray-500 flex items-center gap-1"><MapPin size={13} /> {estab.city}</p>
          </div>

          {alreadyOwned ? (
            <div className="text-center py-4 space-y-2">
              <BadgeCheck size={36} className="mx-auto text-primary" />
              <p className="text-sm text-gray-600 dark:text-gray-400">Cette fiche a déjà un propriétaire. Si c'est une erreur, contactez-nous.</p>
            </div>
          ) : done || existingClaim?.status === 'pending' ? (
            <div className="text-center py-4 space-y-2">
              <ShieldCheck size={36} className="mx-auto text-primary" />
              <p className="font-medium text-gray-900 dark:text-white">Demande envoyée</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Notre équipe vérifie votre demande. Vous serez averti·e par e-mail une fois votre fiche validée.</p>
            </div>
          ) : existingClaim?.status === 'rejected' ? (
            <p className="text-sm text-alert text-center py-4">Votre demande a été refusée. Contactez-nous pour en savoir plus.</p>
          ) : !user ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                C'est votre établissement ? Connectez-vous (ou créez un compte) pour le revendiquer et le gérer.
              </p>
              <div className="flex flex-col gap-2">
                <Link to={`/auth/login?redirect=/revendiquer/${estab.id}`} className="btn-primary w-full text-center">Se connecter</Link>
                <Link to={`/auth/register?redirect=/revendiquer/${estab.id}`} className="w-full text-center text-sm text-primary hover:underline py-2">Créer un compte</Link>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                En revendiquant cette fiche, vous en deviendrez le gestionnaire après validation par notre équipe (via votre e-mail <strong>{profile?.email || user.email}</strong>).
              </p>
              <button onClick={submit} disabled={submitting} className="btn-primary w-full flex items-center justify-center gap-2">
                {submitting && <Loader2 size={16} className="animate-spin" />} Revendiquer cette fiche
              </button>
            </div>
          )}

          <button onClick={() => navigate(`/establishment/${estab.id}`)} className="w-full text-center text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white pt-2">
            Voir la fiche
          </button>
        </div>
      </div>
    </div>
  );
}
