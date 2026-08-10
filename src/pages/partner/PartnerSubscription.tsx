import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Check, Lock, Image, CalendarDays, Tag, TrendingUp, Palette, Headphones, Loader2 } from 'lucide-react';
import type { Establishment } from '../../lib/types';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import ConfirmModal from '../../components/admin/ConfirmModal';
import toast from 'react-hot-toast';
// Prix : même source que la landing Pros (app_settings.pros_landing, éditable dans
// /admin/tarifs). Ils étaient écrits en dur ici, donc les deux écrans pouvaient
// annoncer des tarifs différents — et la remise « -20 % » affichée était fausse.
import { useProsContent } from '../pros/useProsContent';
import { yearlySavings } from '../pros/prosContent';

// Formatage euro identique à la grille tarifaire publique (ProsPricing).
const fmtEur = (n: number) =>
  Number.isInteger(n) ? `${n}€` : `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€`;

interface PartnerContext {
  establishment: Establishment;
}

const PRO_FEATURES = [
  { icon: Palette, label: 'Bannière personnalisée dans l\'annuaire' },
  { icon: Image, label: 'Galerie photos' },
  { icon: CalendarDays, label: 'Création d\'événements' },
  { icon: Tag, label: 'Système de promotions / couponing' },
  { icon: TrendingUp, label: 'Visibilité renforcée dans les résultats' },
  { icon: Headphones, label: 'Support prioritaire' },
];

export default function PartnerSubscription() {
  const { establishment } = useOutletContext<PartnerContext>();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [manageLoading, setManageLoading] = useState(false);

  const expiresAt = establishment.pro_expires_at ? new Date(establishment.pro_expires_at) : null;
  const createdAt = new Date(establishment.created_at);

  const daysRemaining = expiresAt
    ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const progressPercent = expiresAt
    ? Math.min(100, Math.max(0, Math.round(((Date.now() - createdAt.getTime()) / (expiresAt.getTime() - createdAt.getTime())) * 100)))
    : 0;

  const formatDate = (d: Date) =>
    d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  // Ouvre l'espace de facturation Stripe (portail client). C'est le seul endroit où
  // l'abonnement se gère et se résilie : on n'annule jamais un abonnement nous-mêmes.
  const openBillingPortal = async () => {
    if (!establishment.stripe_customer_id) {
      toast.error('Aucun abonnement Stripe trouvé pour cet établissement.');
      return;
    }
    setManageLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-portal-session`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({
          establishmentId: establishment.id,
          returnUrl: window.location.href,
        }),
      });
      const data = await res.json();
      if (data?.url) {
        window.open(data.url, '_blank');
        return;
      }
      toast.error(data?.error || "L'espace de facturation n'a pas pu être ouvert. Réessayez dans un instant.");
    } catch {
      toast.error('Erreur de connexion. Vérifiez votre connexion et réessayez.');
    } finally {
      setManageLoading(false);
    }
  };

  if (!establishment.is_pro) {
    return <FreeView establishment={establishment} />;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Abonnement</h1>

      <div className="rounded-card p-6" style={{ background: 'rgba(123,45,139,0.1)', border: '1px solid rgba(123,45,139,0.4)' }}>
        <div className="flex items-center justify-between mb-4">
          <span className="inline-flex items-center gap-2 text-sm font-bold" style={{ color: '#7B2D8B' }}>
            <Check size={16} /> Profil Pro actif
          </span>
          {expiresAt && (
            <span className="text-xs text-gray-400">Renouvellement le {formatDate(expiresAt)}</span>
          )}
        </div>
        <p className="text-sm text-gray-900 dark:text-white mb-4">
          Votre profil Pro est actif. Toutes les fonctionnalités sont débloquées.
        </p>

        {expiresAt && (
          <div className="mb-2">
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(123,45,139,0.2)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${progressPercent}%`, background: '#7B2D8B' }} />
            </div>
            <p className="text-xs text-gray-500 mt-2">{daysRemaining} jour{daysRemaining > 1 ? 's' : ''} restant{daysRemaining > 1 ? 's' : ''} sur votre période en cours.</p>
          </div>
        )}
      </div>

      <button
        onClick={openBillingPortal}
        disabled={manageLoading}
        className="w-full py-3.5 rounded-input text-sm font-semibold transition-colors hover:opacity-90 flex items-center justify-center gap-2"
        style={{ background: 'transparent', border: '1px solid #7B2D8B', color: '#7B2D8B' }}
      >
        {manageLoading && <Loader2 size={16} className="animate-spin" />}
        Gérer mon abonnement
      </button>

      <div className="rounded-card p-6" style={{ background: 'var(--pn-surface)', border: '1px solid var(--pn-border2)' }}>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Ce que vous avez débloqué</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PRO_FEATURES.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-input flex items-center justify-center shrink-0"
                style={{ background: 'rgba(26,122,58,0.1)' }}>
                <Icon size={15} style={{ color: '#1a7a3a' }} />
              </div>
              <span className="text-sm text-gray-300">{label}</span>
              <Check size={14} className="ml-auto shrink-0" style={{ color: '#1a7a3a' }} />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-input p-5" style={{ background: 'rgba(192,57,43,0.05)', border: '1px solid rgba(192,57,43,0.2)' }}>
        <h3 className="text-sm font-medium mb-2" style={{ color: '#c0392b' }}>Résilier mon abonnement</h3>
        <p className="text-xs text-gray-500 mb-4 leading-relaxed">
          La résiliation se fait dans votre espace de facturation sécurisé Stripe.
          Votre profil repassera en Gratuit à la fin de votre période en cours :
          vous perdrez alors l'accès à la galerie, aux événements et aux promotions.
        </p>
        <button onClick={() => setCancelOpen(true)}
          className="py-2.5 px-5 rounded-input text-sm font-medium transition-colors hover:opacity-90"
          style={{ background: 'transparent', border: '1px solid rgba(192,57,43,0.4)', color: '#c0392b' }}>
          Résilier mon abonnement
        </button>
      </div>

      {/* La résiliation elle-même se fait dans le portail Stripe : ce bouton n'annulait
          rien, le gérant croyait avoir résilié. Il ouvre désormais l'espace de facturation. */}
      <ConfirmModal
        open={cancelOpen}
        title="Résilier mon abonnement"
        message={`La résiliation se fait dans votre espace de facturation sécurisé Stripe, qui va s'ouvrir dans un nouvel onglet. Vous y trouverez le bouton pour arrêter votre abonnement. Vos avantages Pro restent actifs${expiresAt ? ` jusqu'au ${formatDate(expiresAt)}` : ''}.`}
        confirmLabel="Ouvrir mon espace de facturation"
        loading={manageLoading}
        onCancel={() => setCancelOpen(false)}
        onConfirm={async () => {
          await openBillingPortal();
          setCancelOpen(false);
        }}
      />
    </div>
  );
}

function FreeView({ establishment }: { establishment: Establishment }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('yearly');
  const { content } = useProsContent();

  // Tarifs réels (configurables) : l'économie et la remise sont calculées, jamais
  // écrites en dur, pour qu'elles ne puissent plus contredire le prix affiché.
  const { proMonthly, proYearly } = content.pricing;
  const savings = yearlySavings(proMonthly, proYearly);
  const perMonthYearly = proYearly / 12;
  const discountPercent = proMonthly > 0 ? Math.round((1 - proYearly / (proMonthly * 12)) * 100) : 0;

  const handleSubscribe = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-pro-checkout`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({
          establishmentId: establishment.id,
          billingInterval,
        }),
      });
      const data = await res.json();
      if (data?.url) {
        window.open(data.url, '_blank');
        return;
      }
      toast.error(data?.error || 'Le paiement n\'a pas pu être créé. Réessayez dans un instant.');
    } catch {
      toast.error('Erreur de connexion. Vérifiez votre connexion et réessayez.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="rounded-card text-center py-12 px-8 mb-6"
        style={{ background: 'linear-gradient(135deg, #1a0028, var(--pn-bg))', border: '1px solid rgba(123,45,139,0.2)' }}>
        <h1 className="text-[28px] font-bold text-gray-900 dark:text-white mb-2">Passez au profil Pro</h1>
        <p className="text-sm text-gray-400 mb-6">Débloquez toutes les fonctionnalités pour développer votre visibilité.</p>

        {/* Billing toggle */}
        <div className="inline-flex items-center gap-1 p-1 rounded-full mb-8" style={{ background: 'var(--pn-border)' }}>
          <button
            onClick={() => setBillingInterval('monthly')}
            className={`px-4 py-2 rounded-full text-[13px] font-medium transition-all ${
              billingInterval === 'monthly'
                ? 'bg-[#7B2D8B] text-white'
                : 'text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Mensuel
          </button>
          <button
            onClick={() => setBillingInterval('yearly')}
            className={`px-4 py-2 rounded-full text-[13px] font-medium transition-all ${
              billingInterval === 'yearly'
                ? 'bg-[#7B2D8B] text-white'
                : 'text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {discountPercent > 0 ? `Annuel (-${discountPercent} %)` : 'Annuel'}
          </button>
        </div>

        <div className="mb-4">
          {billingInterval === 'yearly' ? (
            <>
              <span className="text-[56px] font-bold" style={{ color: '#7B2D8B' }}>{fmtEur(proYearly)}</span>
              <span className="text-xl text-gray-500">/an</span>
            </>
          ) : (
            <>
              <span className="text-[56px] font-bold" style={{ color: '#7B2D8B' }}>{fmtEur(proMonthly)}</span>
              <span className="text-xl text-gray-500">/mois</span>
            </>
          )}
        </div>
        <p className="text-sm text-gray-400 mb-8">
          {billingInterval === 'yearly'
            ? `Soit ${fmtEur(perMonthYearly)}/mois${savings > 0 ? ` \u00B7 vous \u00E9conomisez ${fmtEur(savings)}/an` : ''}`
            : 'Sans engagement \u00B7 r\u00E9siliable \u00E0 tout moment'}
        </p>

        <button
          onClick={handleSubscribe}
          disabled={loading}
          className="py-4 px-10 rounded-card text-base font-bold transition-all hover:opacity-90 mb-4 inline-flex items-center gap-2"
          style={{ background: '#fff', color: '#7B2D8B' }}
        >
          {loading && <Loader2 size={18} className="animate-spin" />}
          Souscrire au profil Pro &rarr;
        </button>

        <p className="text-xs text-gray-600 flex items-center justify-center gap-1.5">
          <Lock size={12} /> Paiement sécurisé par Stripe &middot; facture disponible
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 max-w-[500px] mx-auto">
        {PRO_FEATURES.map(({ label }) => (
          <div key={label} className="flex items-center gap-2.5 p-3 rounded-input"
            style={{ background: 'var(--pn-surface)', border: '1px solid var(--pn-border2)' }}>
            <Check size={14} style={{ color: '#7B2D8B' }} className="shrink-0" />
            <span className="text-sm text-gray-900 dark:text-white">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
