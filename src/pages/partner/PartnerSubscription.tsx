import { useOutletContext } from 'react-router-dom';
import { Check, Image, CalendarDays, Tag, TrendingUp, Palette } from 'lucide-react';
import type { Establishment } from '../../lib/types';

interface PartnerContext {
  establishment: Establishment;
}

const PRO_FEATURES = [
  { icon: Palette, label: 'Banniere personnalisee dans l\'annuaire' },
  { icon: Image, label: 'Galerie photos illimitee' },
  { icon: CalendarDays, label: 'Creation d\'evenements' },
  { icon: Tag, label: 'Systeme de promotions / couponing' },
  { icon: TrendingUp, label: 'Visibilite renforcee dans les resultats' },
];

export default function PartnerSubscription() {
  const { establishment } = useOutletContext<PartnerContext>();

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-xl font-bold text-white">Abonnement</h1>

      <div className="bg-dark-surface border border-dark-border rounded-card p-6">
        <h2 className="text-sm font-semibold text-white mb-2">Statut actuel</h2>
        {establishment.is_pro ? (
          <div>
            <p className="text-sm text-gray-400">
              Profil Pro actif — expire le{' '}
              <span className="text-white font-medium">{new Date(establishment.pro_expires_at || '').toLocaleDateString('fr-FR')}</span>.
              Renouvellement automatique.
            </p>
          </div>
        ) : (
          <p className="text-sm text-gray-400">
            Ton profil est actuellement gratuit. Tu apparais dans l'annuaire mais sans galerie, evenements ni promotions.
          </p>
        )}
      </div>

      {!establishment.is_pro && (
        <div className="bg-dark-surface border border-primary/20 rounded-card p-6 space-y-5">
          <div>
            <h2 className="text-lg font-bold text-white">Profil Pro</h2>
            <p className="text-sm text-gray-400 mt-1">Debloquez tout le potentiel de ta fiche etablissement.</p>
          </div>

          <div className="space-y-3">
            {PRO_FEATURES.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-input bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon size={16} className="text-primary" />
                </div>
                <span className="text-sm text-gray-300">{label}</span>
                <Check size={16} className="text-success ml-auto shrink-0" />
              </div>
            ))}
          </div>

          <div className="border-t border-dark-border pt-4">
            <p className="text-3xl font-bold text-white">69 EUR<span className="text-sm font-normal text-gray-500">/mois</span></p>
          </div>

          <button className="btn-primary w-full">
            Souscrire au profil Pro
          </button>
          <p className="text-xs text-gray-600 text-center">
            Paiement securise via Stripe. Annulable a tout moment.
          </p>
        </div>
      )}

      {establishment.is_pro && (
        <div className="space-y-3">
          <button className="btn-secondary w-full">
            Gerer mon abonnement
          </button>
          <p className="text-xs text-gray-500 text-center">
            Prochain renouvellement : {new Date(establishment.pro_expires_at || '').toLocaleDateString('fr-FR')}
          </p>
        </div>
      )}
    </div>
  );
}
