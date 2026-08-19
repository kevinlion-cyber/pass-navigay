/**
 * Le questionnaire de Kevin, défini UNE fois.
 *
 * La page publique (`Survey.tsx`) et le dépouillement dans l'administration
 * (`AdminSurvey.tsx`) lisent tous les deux ces définitions : impossible qu'une
 * question change d'un côté sans l'autre, et les réponses restent lisibles même
 * si on ajoute des questions plus tard (elles sont stockées par identifiant).
 */

export type QuestionKind = 'radio' | 'checkbox' | 'text' | 'textarea' | 'scale' | 'email';

export interface Question {
  id: string;
  label: string;
  kind: QuestionKind;
  required?: boolean;
  options?: string[];
  hint?: string;
  /** Nombre exact de cases à cocher attendu (question « top 2 »). */
  exactly?: number;
  /** N'apparaît que si une autre réponse vaut l'une de ces valeurs. */
  showIf?: { id: string; equals: string[] };
  scaleLabels?: [string, string];
}

export interface Section {
  title: string;
  intro?: string;
  questions: Question[];
}

export const SURVEY_INTRO =
  "J'ai besoin de comprendre vos habitudes actuelles. C'est anonyme, ça prend une dizaine de minutes, " +
  "et il n'y a pas de mauvaise réponse : votre avis honnête m'intéresse plus qu'un avis gentil. Merci !";

export const SURVEY_SECTIONS: Section[] = [
  {
    title: 'Vous',
    intro: 'On commence doucement, trois questions.',
    questions: [
      {
        id: 'age', kind: 'radio', required: true, label: 'Quel âge avez-vous ?',
        options: ['moins de 18', '18-24', '25-34', '35-44', '45+'],
      },
      {
        id: 'montpellier', kind: 'radio', required: true,
        label: 'Habitez-vous à Montpellier ou dans son agglomération ?',
        options: ['oui', 'de passage', 'non, jamais'],
      },
      {
        id: 'identite', kind: 'text',
        label: "Comment décririez-vous votre orientation ou votre identité, si vous êtes à l'aise pour la partager ?",
        hint: "Rien n'est obligatoire ici. Vous pouvez laisser vide ou écrire « préfère ne pas répondre ».",
      },
    ],
  },
  {
    title: 'Vos habitudes aujourd’hui',
    intro: "Comment vous faites, en vrai, avant d'aller quelque part.",
    questions: [
      {
        id: 'decouverte_incertaine', kind: 'textarea', required: true,
        label: "Racontez une fois où vous avez découvert un lieu sans savoir comment vous y seriez accueilli.",
      },
      {
        id: 'comment_verifier', kind: 'checkbox', required: true,
        label: "En général, comment savez-vous qu'un lieu est sûr avant d'y aller pour la première fois ?",
        hint: 'Cochez tout ce qui vous ressemble.',
        options: [
          'Bouche-à-oreille d’ami·es LGBTQ+',
          'Groupes Facebook ou WhatsApp communautaires',
          'Instagram ou les réseaux sociaux',
          'Google Maps ou les avis en ligne classiques',
          'Sites ou applications spécialisées LGBT (misterb&b, autres)',
          'Je ne vérifie pas à l’avance, j’avise sur place',
          'Je vais uniquement dans des lieux déjà connus comme gays, lesbiens ou LGBT',
          'Autre',
        ],
      },
      {
        id: 'comment_verifier_autre', kind: 'text',
        label: 'Vous avez coché « Autre » : de quoi s’agit-il ?',
        showIf: { id: 'comment_verifier', equals: ['Autre'] },
      },
      {
        id: 'evite_lieu', kind: 'radio', required: true,
        label: "Vous est-il déjà arrivé d'éviter ou de quitter un lieu à cause d'un malaise lié à votre orientation ou votre identité ?",
        options: ['oui, souvent', 'oui, une ou deux fois', 'jamais'],
      },
      {
        id: 'evite_lieu_detail', kind: 'textarea',
        label: 'Si vous voulez bien, racontez brièvement.',
        showIf: { id: 'evite_lieu', equals: ['oui, souvent', 'oui, une ou deux fois'] },
      },
      {
        id: 'confiance', kind: 'scale', required: true,
        label: "Face à un commerce dont vous ne savez rien, quel est votre niveau de confiance ?",
        scaleLabels: ['très méfiant·e', 'totalement confiant·e'],
      },
    ],
  },
  {
    title: 'Ce qui existe déjà',
    intro: 'Et ce qui vous manque dedans.',
    questions: [
      {
        id: 'connait_apps', kind: 'radio', required: true,
        label: 'Connaissez-vous déjà des applications ou des sites qui référencent des lieux LGBT-friendly ?',
        options: ['oui', 'non'],
      },
      {
        id: 'connait_apps_lesquelles', kind: 'textarea',
        label: 'Lesquels, et qu’en pensez-vous ?',
        showIf: { id: 'connait_apps', equals: ['oui'] },
      },
      {
        id: 'manque', kind: 'textarea', required: true,
        label: "Qu'est-ce qui vous manque le plus, aujourd'hui, pour trouver un lieu de confiance ?",
      },
    ],
  },
  {
    title: 'Pass Navigay',
    intro: "Là on parle du projet. Dites ce que vous pensez vraiment, c'est tout l'intérêt.",
    questions: [
      {
        id: 'premiere_reaction', kind: 'textarea', required: true,
        label: "Après avoir vu l'application, quelle est votre première réaction, honnêtement ?",
      },
      {
        id: 'fonctionnalites', kind: 'checkbox', required: true, exactly: 2,
        label: 'Parmi ces fonctions, les deux qui vous seraient les plus utiles, à vous personnellement ?',
        hint: 'Choisissez exactement deux réponses.',
        options: [
          'Un badge « safe place » noté par la communauté',
          'Un itinéraire vers un lieu sûr',
          'Les événements LGBTQ+ près de chez moi',
          'Des promotions dans les lieux partenaires',
          'Une messagerie pour discuter avec d’autres membres',
          'Découvrir des commerces non « gays » mais validés comme bienveillants',
        ],
      },
      {
        id: 'doute_badge', kind: 'textarea', required: true,
        label: "Qu'est-ce qui vous ferait douter d'un badge « safe place » sur une application comme celle-ci ?",
      },
      {
        id: 'telechargerait', kind: 'radio', required: true,
        label: "Si l'application existait aujourd'hui avec les lieux déjà référencés à Montpellier, la téléchargeriez-vous ?",
        options: ['oui certainement', 'oui probablement', 'peut-être', 'probablement pas', 'non'],
      },
      {
        id: 'telechargerait_pourquoi', kind: 'textarea',
        label: 'Pourquoi ?',
      },
      {
        id: 'revenir', kind: 'textarea', required: true,
        label: "Qu'est-ce qui vous ferait y revenir régulièrement, plutôt que de la télécharger puis de l'oublier ?",
      },
    ],
  },
  {
    title: 'Pour finir',
    questions: [
      {
        id: 'libre', kind: 'textarea',
        label: "Autre chose à dire sur ce projet ? Une envie, une crainte, une idée ?",
      },
      {
        id: 'recontact', kind: 'radio', required: true,
        label: 'Accepteriez-vous d’être recontacté dans quelques semaines pour tester une nouvelle version ?',
        options: ['oui', 'non'],
      },
      {
        id: 'email', kind: 'email',
        label: 'Votre e-mail',
        hint: 'Il ne servira qu’à ça, et à rien d’autre.',
        showIf: { id: 'recontact', equals: ['oui'] },
      },
    ],
  },
];

export type Answers = Record<string, string | string[] | number | undefined>;

/** Une question conditionnelle ne compte pas tant que sa condition n'est pas remplie. */
export function isVisible(q: Question, answers: Answers): boolean {
  if (!q.showIf) return true;
  const v = answers[q.showIf.id];
  if (Array.isArray(v)) return v.some((x) => q.showIf!.equals.includes(x));
  return typeof v === 'string' && q.showIf.equals.includes(v);
}

/** Ce qui manque dans une section, pour bloquer « Suivant » sans brusquer. */
export function missingIn(section: Section, answers: Answers): Question[] {
  return section.questions.filter((q) => {
    if (!q.required || !isVisible(q, answers)) return false;
    const v = answers[q.id];
    if (q.kind === 'checkbox') {
      const arr = Array.isArray(v) ? v : [];
      return q.exactly ? arr.length !== q.exactly : arr.length === 0;
    }
    if (q.kind === 'scale') return typeof v !== 'number';
    return !v || (typeof v === 'string' && !v.trim());
  });
}

export const ALL_QUESTIONS: Question[] = SURVEY_SECTIONS.flatMap((s) => s.questions);
