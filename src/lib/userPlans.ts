import { useEffect, useState } from 'react';
import { supabase } from './supabase';

// Listes d'avantages des formules UTILISATEUR (Gratuit + Premium), éditables en admin.
// Kevin ne gère PAS les prix (liés à Stripe), seulement la liste des avantages.
// Stocké en JSON dans app_settings.key = 'user_plans_features'.

export interface FreeFeature {
  label: string;
  included: boolean;
}

export interface UserPlans {
  freeFeatures: FreeFeature[];
  premiumFeatures: string[];
}

export const USER_PLANS_KEY = 'user_plans_features';

export const DEFAULT_USER_PLANS: UserPlans = {
  freeFeatures: [
    { label: 'Profil avec nom, prénom, photo', included: true },
    { label: 'Visualisation des événements', included: true },
    { label: "Accès à l'annuaire des lieux", included: true },
    { label: 'Accès aux promotions', included: false },
    { label: 'Messagerie entre membres', included: false },
    { label: 'Profil enrichi et questionnaire', included: false },
  ],
  premiumFeatures: [
    "Accès à l'annuaire des lieux",
    'Accès aux promotions exclusives',
    'Messagerie entre membres Premium',
    'Galerie photos sur ton profil',
    'Laisse des avis (qualité & Safe place) sur les établissements',
    'Profil enrichi et questionnaire',
    'Badge Premium sur le profil',
  ],
};

export function mergeUserPlans(raw: unknown): UserPlans {
  const d = DEFAULT_USER_PLANS;
  const s = (raw && typeof raw === 'object' ? raw : {}) as Partial<UserPlans>;
  return {
    freeFeatures: Array.isArray(s.freeFeatures)
      ? s.freeFeatures.filter((f) => f && typeof f.label === 'string').map((f) => ({ label: f.label, included: !!f.included }))
      : d.freeFeatures,
    premiumFeatures: Array.isArray(s.premiumFeatures)
      ? s.premiumFeatures.filter((x) => typeof x === 'string')
      : d.premiumFeatures,
  };
}

export function useUserPlans() {
  const [plans, setPlans] = useState<UserPlans>(DEFAULT_USER_PLANS);
  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', USER_PLANS_KEY).maybeSingle()
      .then(({ data }) => {
        if (data?.value) {
          try { setPlans(mergeUserPlans(JSON.parse(data.value))); } catch { /* défauts */ }
        }
      });
  }, []);
  return plans;
}
