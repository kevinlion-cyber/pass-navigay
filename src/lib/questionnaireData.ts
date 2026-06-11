export type QuestionType = 'single' | 'multi' | 'text' | 'triple_text';

export interface QuestionDef {
  id: string;
  field: string;
  botMessage: string;
  type: QuestionType;
  options?: string[];
  placeholder?: string;
  maxLength?: number;
  tripleFields?: { field: string; label: string; placeholder: string }[];
}

export interface SectionDef {
  intro?: string;
  questions: QuestionDef[];
}

export const QUESTIONNAIRE_SECTIONS: SectionDef[] = [
  {
    intro: "Salut ! Je suis la pour t'aider a creer un profil qui te ressemble vraiment. On va prendre 5 minutes ensemble -- promis, c'est fun. Et tu pourras tout changer apres. C'est parti ?",
    questions: [
      {
        id: 'intro_confirm',
        field: '_intro',
        botMessage: '',
        type: 'single',
        options: ["C'est parti !"],
      },
    ],
  },
  {
    intro: "Premiere chose -- et la plus importante.",
    questions: [
      {
        id: 'gender_identity',
        field: 'gender_identity',
        botMessage: "Comment tu te definis aujourd'hui ? (Tu peux choisir plusieurs reponses)",
        type: 'multi',
        options: [
          'Femme',
          'Homme',
          'Non-binaire',
          'Genderfluid',
          'En pleine evolution',
          "J'evite les cases comme j'evite les mauvais dates",
          'Autre',
        ],
      },
      {
        id: 'pronouns',
        field: 'pronouns',
        botMessage: 'Et tes pronoms ?',
        type: 'single',
        options: ['Elle / La', 'Il / Le', 'Iel', 'Mix selon le mood', 'Surprise me (mais avec respect hein)'],
      },
    ],
  },
  {
    intro: "Ton radar a crush",
    questions: [
      {
        id: 'attracted_to',
        field: 'attracted_to',
        botMessage: 'Qui peut te faire perdre tes moyens ?',
        type: 'multi',
        options: [
          'Les femmes',
          'Les hommes',
          "Tout le monde -- je suis ouvert\u00b7e d'esprit et de coeur",
          "Ca depend de l'energie",
          'Je suis en mode decouverte',
        ],
      },
      {
        id: 'orientation',
        field: 'orientation',
        botMessage: 'Ton orientation, si tu veux en parler :',
        type: 'single',
        options: [
          'Gay / Lesbienne',
          'Bi / Pan',
          'Queer',
          'Asexuel\u00b7le',
          "J'aime pas les etiquettes, j'aime les gens",
          'Autre',
        ],
      },
    ],
  },
  {
    intro: "Ce que tu veux vraiment",
    questions: [
      {
        id: 'looking_for',
        field: 'looking_for',
        botMessage: "La tout de suite, tu cherches quoi ici ? (promis, on ne juge pas)",
        type: 'multi',
        options: [
          'Une histoire serieuse',
          'Des rencontres chill',
          'Du fun -- on ne va pas tourner autour du pot',
          "Des ami\u00b7e\u00b7s",
          "Un peu de tout, je suis polyvalent\u00b7e",
        ],
      },
      {
        id: 'relationship_intensity',
        field: 'relationship_intensity',
        botMessage: "Ton niveau d'intensite relationnelle ?",
        type: 'single',
        options: [
          'Slow burn -- ca prend du temps',
          'Rapide et passionne',
          'Ca depend de la personne',
          "J'improvise, comme dans la vie",
        ],
      },
    ],
  },
  {
    intro: "Ton vibe",
    questions: [
      {
        id: 'vibe',
        field: 'vibe',
        botMessage: 'Ce que les gens ressentent en te rencontrant. Tu es plutot :',
        type: 'single',
        options: [
          "Discret\u00b7e mais captivant\u00b7e",
          'Charismatique (et tu le sais)',
          'Drole (ou tu le penses tres fort)',
          'Sensible',
          "Chaotique mais attachant\u00b7e",
          'Un melange dangereux de tout ca',
        ],
      },
      {
        id: 'evening_energy',
        field: 'evening_energy',
        botMessage: 'Et ton energie en soiree ?',
        type: 'single',
        options: [
          'Celui/celle qui observe',
          'Celui/celle qui lance la vibe',
          'Celui/celle qui disparait sans prevenir',
          'Celui/celle dont tout le monde se souvient',
        ],
      },
    ],
  },
  {
    intro: "Tes green flags",
    questions: [
      {
        id: 'green_flags',
        field: 'green_flags',
        botMessage: 'Chez les autres, tu craques pour : (plusieurs reponses possibles)',
        type: 'multi',
        options: [
          "L'humour",
          "L'authenticite",
          'La confiance en soi',
          'La douceur',
          "L'intelligence",
          'Le chaos (oui, on sait...)',
        ],
      },
    ],
  },
  {
    intro: "Tes red flags",
    questions: [
      {
        id: 'red_flags',
        field: 'red_flags',
        botMessage: 'Ce qui te fait fuir instantanement :',
        type: 'multi',
        options: [
          'Le ghosting',
          "L'ego surdimensionne",
          "Le manque d'ouverture",
          "Le manque d'hygiene emotionnelle (oui, ca compte)",
          'Les gens ennuyeux (pire crime)',
        ],
      },
    ],
  },
  {
    intro: "Ta relation a la communaute",
    questions: [
      {
        id: 'community_involvement',
        field: 'community_involvement',
        botMessage: 'Tu te sens :',
        type: 'single',
        options: [
          "Tres implique\u00b7e",
          "Connecte\u00b7e mais tranquille",
          'En exploration',
          'A ma facon, sans suivre les regles',
        ],
      },
      {
        id: 'community_goals',
        field: 'community_goals',
        botMessage: 'Ce que tu veux trouver ici :',
        type: 'multi',
        options: [
          'Des gens comme moi',
          'Des gens differents',
          'Un espace safe',
          'Des evenements et sorties',
          'Des rencontres inattendues',
        ],
      },
    ],
  },
  {
    intro: "Compatibilite",
    questions: [
      {
        id: 'ideal_type',
        field: 'ideal_type',
        botMessage: "Ton type de personne en quelques mots :",
        type: 'text',
        placeholder: 'Quelqu\'un qui...',
        maxLength: 100,
      },
      {
        id: 'deal_breaker',
        field: 'deal_breaker',
        botMessage: 'Ton deal breaker ultime :',
        type: 'text',
        placeholder: 'Ce que je ne peux pas accepter...',
        maxLength: 100,
      },
      {
        id: 'what_i_bring',
        field: 'what_i_bring',
        botMessage: "Ce que tu apportes dans une relation ou une rencontre :",
        type: 'text',
        placeholder: "J'apporte...",
        maxLength: 100,
      },
    ],
  },
  {
    intro: "Derniere petite chose fun. Si tu etais...",
    questions: [
      {
        id: 'if_i_were',
        field: '_if_i_were',
        botMessage: "Reponds a ces trois petites questions :",
        type: 'triple_text',
        tripleFields: [
          { field: 'if_i_were_vibe', label: 'Une vibe', placeholder: 'Jazz a 2h du matin...' },
          { field: 'if_i_were_music', label: 'Une musique', placeholder: 'Rosalia ou PNL...' },
          { field: 'if_i_were_energy', label: 'Une energie', placeholder: 'Feu de cheminee ou tempete...' },
        ],
      },
    ],
  },
  {
    questions: [
      {
        id: 'late_truth',
        field: 'late_truth',
        botMessage: "Une verite sur toi que les gens decouvrent trop tard :",
        type: 'text',
        placeholder: 'En fait je suis...',
        maxLength: 200,
      },
    ],
  },
];

export const TOTAL_QUESTIONS = QUESTIONNAIRE_SECTIONS.reduce(
  (acc, s) => acc + s.questions.length,
  0
);
