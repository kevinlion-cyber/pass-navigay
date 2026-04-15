import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Check, Lock, Image, CalendarDays, Tag, TrendingUp, Palette, Headphones } from 'lucide-react';
import type { Establishment } from '../../lib/types';
import ConfirmModal from '../../components/admin/ConfirmModal';

interface PartnerContext {
  establishment: Establishment;
}

const PRO_FEATURES = [
  { icon: Palette, label: 'Bannière personnalisée dans l\'annuaire' },
  { icon: Image, label: 'Galerie photos illimitée' },
  { icon: CalendarDays, label: 'Création d\'événements' },
  { icon: Tag, label: 'Système de promotions / couponing' },
  { icon: TrendingUp, label: 'Visibilité renforcée dans les résultats' },
  { icon: Headphones, label: 'Support prioritaire' },
];

export default function PartnerSubscription() {
  const { establishment } = useOutletContext<PartnerContext>();
  const [cancelOpen, setCancelOpen] = useState(false);

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

  if (!establishment.is_pro) {
    return <FreeView />;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-white">Abonnement</h1>

      {/* Status card */}
      <div className="rounded-card p-6" style={{ background: 'rgba(123,45,139,0.1)', border: '1px solid rgba(123,45,139,0.4)' }}>
        <div className="flex items-center justify-between mb-4">
          <span className="inline-flex items-center gap-2 text-sm font-bold" style={{ color: '#7B2D8B' }}>
            <Check size={16} /> Profil Pro actif
          </span>
          {expiresAt && (
            <span className="text-xs text-gray-400">Renouvellement le {formatDate(expiresAt)}</span>
          )}
        </div>
        <p className="text-sm text-white mb-4">
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

      {/* Manage button */}
      <button className="w-full py-3.5 rounded-input text-sm font-semibold transition-colors hover:opacity-90"
        style={{ background: 'transparent', border: '1px solid #7B2D8B', color: '#7B2D8B' }}>
        Gérer mon abonnement
      </button>

      {/* Features unlocked */}
      <div className="rounded-card p-6" style={{ background: '#16161f', border: '1px solid #2a2a35' }}>
        <h2 className="text-sm font-semibold text-white mb-4">Ce que vous avez débloqué</h2>
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

      {/* Cancel section */}
      <div className="rounded-input p-5" style={{ background: 'rgba(192,57,43,0.05)', border: '1px solid rgba(192,57,43,0.2)' }}>
        <h3 className="text-sm font-medium mb-2" style={{ color: '#c0392b' }}>Résilier mon abonnement</h3>
        <p className="text-xs text-gray-500 mb-4 leading-relaxed">
          Si vous résiliez, votre profil repassera en Gratuit à la fin de votre période en cours.
          Vous perdrez l'accès à la galerie, aux événements et aux promotions.
        </p>
        <button onClick={() => setCancelOpen(true)}
          className="py-2.5 px-5 rounded-input text-sm font-medium transition-colors hover:opacity-90"
          style={{ background: 'transparent', border: '1px solid rgba(192,57,43,0.4)', color: '#c0392b' }}>
          Résilier mon abonnement
        </button>
      </div>

      <ConfirmModal
        open={cancelOpen}
        title="Confirmer la résiliation"
        message={`Êtes-vous sûr de vouloir résilier ? Vous perdrez vos avantages Pro le ${expiresAt ? formatDate(expiresAt) : ''}.`}
        confirmLabel="Confirmer la résiliation"
        onCancel={() => setCancelOpen(false)}
        onConfirm={() => setCancelOpen(false)}
      />
    </div>
  );
}

function FreeView() {
  return (
    <div className="max-w-2xl mx-auto">
      {/* Hero */}
      <div className="rounded-card text-center py-12 px-8 mb-6"
        style={{ background: 'linear-gradient(135deg, #1a0028, #0f0f17)', border: '1px solid rgba(123,45,139,0.2)' }}>
        <h1 className="text-[28px] font-bold text-white mb-2">Passez au profil Pro</h1>
        <p className="text-sm text-gray-400 mb-8">Débloquez toutes les fonctionnalités pour développer votre visibilité.</p>

        <div className="mb-8">
          <span className="text-[56px] font-bold" style={{ color: '#7B2D8B' }}>69€</span>
          <span className="text-xl text-gray-500">/mois</span>
          <p className="text-xs text-gray-600 mt-2">Sans engagement · Résiliation à tout moment</p>
        </div>

        <button className="py-4 px-10 rounded-card text-base font-bold transition-all hover:opacity-90 mb-4"
          style={{ background: '#fff', color: '#7B2D8B' }}>
          Souscrire au profil Pro →
        </button>

        <p className="text-xs text-gray-600 flex items-center justify-center gap-1.5">
          <Lock size={12} /> Paiement sécurisé par Stripe · SSL · Données protégées
        </p>
      </div>

      {/* Features grid */}
      <div className="grid grid-cols-2 gap-3 max-w-[500px] mx-auto">
        {PRO_FEATURES.map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-2.5 p-3 rounded-input"
            style={{ background: '#16161f', border: '1px solid #2a2a35' }}>
            <Check size={14} style={{ color: '#7B2D8B' }} className="shrink-0" />
            <span className="text-sm text-white">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
