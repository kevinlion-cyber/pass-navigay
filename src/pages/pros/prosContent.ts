// Contenu éditable de la landing Pros.
// Source de vérité : valeurs par défaut ci-dessous, surchargées par app_settings.key = 'pros_landing'
// (édité dans /admin/pros-landing). Aucune donnée inventée : les stats sont branchées sur les
// vrais compteurs live, les témoignages sont vides par défaut (Kevin ajoute les vrais).

export interface ProsBenefit {
  emoji: string;
  title: string;
  text: string;
}

export interface ProsTestimonial {
  name: string;
  place: string;
  quote: string;
  stars: number;
}

export type ProsStatSource = 'establishments' | 'events' | 'members' | 'reviews' | 'custom';

export interface ProsStatItem {
  source: ProsStatSource; // 'custom' => on affiche `value` tel quel ; sinon compteur live
  value: string; // utilisé si source = 'custom' (ou en mode manuel)
  label: string;
  desc: string;
}

export interface ProsFreeFeature {
  label: string;
  included: boolean;
}

export interface ProsContent {
  hero: {
    title: string;
    highlight: string; // mot mis en avant (couleur accent) à la fin du titre
    subtitle: string;
    ctaPrimary: string;
    ctaSecondary: string;
  };
  stats: {
    show: boolean;
    mode: 'auto' | 'manual'; // auto = compteurs live, manual = valeurs saisies
    items: ProsStatItem[];
  };
  benefits: {
    title: string;
    subtitle: string;
    items: ProsBenefit[];
  };
  pricing: {
    show: boolean;
    proMonthly: number; // €/mois
    proYearly: number; // €/an
    freeFeatures: ProsFreeFeature[];
    proFeatures: string[];
  };
  testimonials: {
    show: boolean;
    title: string;
    subtitle: string;
    items: ProsTestimonial[];
  };
  cta: {
    title: string;
    subtitle: string;
    button: string;
  };
}

export const PROS_SETTINGS_KEY = 'pros_landing';

export const DEFAULT_PROS_CONTENT: ProsContent = {
  hero: {
    title: 'Rejoignez le réseau des lieux LGBT-friendly de',
    highlight: 'France',
    subtitle:
      'Référencez votre établissement, publiez vos événements et touchez une communauté qui cherche activement des lieux sûrs et bienveillants près de chez elle.',
    ctaPrimary: 'Créer mon profil gratuit',
    ctaSecondary: 'Déjà partenaire ? Se connecter',
  },
  stats: {
    show: true,
    mode: 'auto',
    items: [
      { source: 'establishments', value: '', label: 'ÉTABLISSEMENTS', desc: 'Adresses inclusives référencées' },
      { source: 'events', value: '', label: 'ÉVÉNEMENTS', desc: 'Publiés sur la plateforme' },
      { source: 'members', value: '', label: 'MEMBRES', desc: 'Une communauté qui grandit' },
    ],
  },
  benefits: {
    title: 'Pourquoi rejoindre Pass Navigay ?',
    subtitle: 'Une plateforme pensée pour les établissements qui veulent toucher une communauté engagée.',
    items: [
      {
        emoji: '🎯',
        title: 'Visibilité auprès d’une communauté ciblée',
        text: 'Votre établissement apparaît directement auprès d’utilisateurs LGBT+ et allié·es qui cherchent activement des lieux inclusifs près de chez eux.',
      },
      {
        emoji: '📅',
        title: 'Publiez vos événements en quelques clics',
        text: 'Soirées, brunchs, concerts, expos… Créez vos événements depuis votre tableau de bord et touchez la communauté qui cherche quoi faire ce week-end.',
      },
      {
        emoji: '🏷',
        title: 'Boostez votre activité avec les promos',
        text: 'Lancez des offres exclusives pour les membres Pass Navigay : happy hours, entrées gratuites, réductions. Vous choisissez les règles, l’app fait le reste.',
      },
    ],
  },
  pricing: {
    show: true,
    proMonthly: 69,
    proYearly: 690,
    freeFeatures: [
      { label: 'Apparition dans l’annuaire', included: true },
      { label: 'Fiche avec nom, adresse, catégorie', included: true },
      { label: 'Bannière personnalisée', included: false },
      { label: 'Galerie photos', included: false },
      { label: 'Création d’événements', included: false },
      { label: 'Système de promotions', included: false },
      { label: 'Visibilité renforcée dans les résultats', included: false },
      { label: 'Support prioritaire', included: false },
    ],
    proFeatures: [
      'Apparition dans l’annuaire',
      'Fiche avec nom, adresse, catégorie',
      'Bannière personnalisée',
      'Galerie photos',
      'Création d’événements',
      'Système de promotions / couponing',
      'Avis de membres Premium (qualité & Safe place)',
      'Visibilité renforcée dans les résultats',
      'Support prioritaire',
    ],
  },
  testimonials: {
    show: false, // masqué tant qu’il n’y a pas de vrais avis
    title: 'Ils nous font confiance',
    subtitle: 'Des établissements qui ont rejoint la communauté Pass Navigay',
    items: [],
  },
  cta: {
    title: 'Prêt à rejoindre la communauté ?',
    subtitle: 'Inscription gratuite · Aucun engagement · Passez Pro quand vous voulez',
    button: 'Créer mon profil maintenant',
  },
};

// Fusionne le contenu stocké (potentiellement partiel) au-dessus des défauts,
// section par section. Les tableaux sont remplacés (pas fusionnés) s'ils sont présents.
export function mergeProsContent(stored: Partial<ProsContent> | null | undefined): ProsContent {
  const d = DEFAULT_PROS_CONTENT;
  const s = stored || {};
  return {
    hero: { ...d.hero, ...(s.hero || {}) },
    stats: {
      ...d.stats,
      ...(s.stats || {}),
      items: s.stats?.items ?? d.stats.items,
    },
    benefits: {
      ...d.benefits,
      ...(s.benefits || {}),
      items: s.benefits?.items ?? d.benefits.items,
    },
    pricing: {
      ...d.pricing,
      ...(s.pricing || {}),
      freeFeatures: s.pricing?.freeFeatures ?? d.pricing.freeFeatures,
      proFeatures: s.pricing?.proFeatures ?? d.pricing.proFeatures,
    },
    testimonials: {
      ...d.testimonials,
      ...(s.testimonials || {}),
      items: s.testimonials?.items ?? d.testimonials.items,
    },
    cta: { ...d.cta, ...(s.cta || {}) },
  };
}

// Économie annuelle (jamais incohérente : calculée depuis les prix réels).
export function yearlySavings(proMonthly: number, proYearly: number): number {
  return Math.max(0, proMonthly * 12 - proYearly);
}

export function monthsFree(proMonthly: number, proYearly: number): number {
  if (proMonthly <= 0) return 0;
  return Math.round((proMonthly * 12 - proYearly) / proMonthly);
}
