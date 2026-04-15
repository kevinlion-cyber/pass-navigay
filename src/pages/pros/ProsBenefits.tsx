const BENEFITS = [
  {
    emoji: '\uD83C\uDFAF',
    title: 'Visibilité auprès d\u2019une communauté ciblée',
    text: 'Vos établissements apparaissent directement auprès d\u2019utilisateurs LGBT+ et alliés qui cherchent activement des lieux inclusifs partout en France.',
    delay: '0s',
  },
  {
    emoji: '\uD83D\uDCC5',
    title: 'Publiez vos événements en quelques clics',
    text: 'Soirées, brunchs, concerts, expos\u2026 Créez vos événements depuis votre dashboard et touchez immédiatement des milliers de membres qui cherchent quoi faire ce week-end.',
    delay: '0.1s',
  },
  {
    emoji: '\uD83C\uDFF7',
    title: 'Boostez votre activité avec les promos',
    text: 'Lancez des offres exclusives pour les membres Pass Navigay\u00A0: happy hours, entrées gratuites, réductions récurrentes. Vous choisissez les règles, l\u2019app fait le reste.',
    delay: '0.2s',
  },
];

export default function ProsBenefits() {
  return (
    <section className="py-[100px] px-6" style={{ background: '#0a0a0f' }}>
      <div className="max-w-[1100px] mx-auto">
        <h2 className="text-[32px] md:text-[40px] font-extrabold text-white text-center">
          Pourquoi rejoindre Pass Navigay ?
        </h2>
        <p className="text-[18px] text-[#a0a0b0] text-center mt-4 max-w-2xl mx-auto">
          Une plateforme pensée pour les établissements qui veulent toucher une communauté engagée.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-[60px]">
          {BENEFITS.map((b) => (
            <div
              key={b.title}
              className="pros-card-benefit rounded-2xl p-9 transition-all duration-200 hover:-translate-y-1 hover:border-[#7B2D8B]"
              style={{ animationDelay: b.delay }}
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mb-5 text-[28px]"
                style={{ background: 'rgba(123,45,139,0.15)', border: '1px solid rgba(123,45,139,0.3)' }}
              >
                {b.emoji}
              </div>
              <h3 className="text-[18px] font-bold text-white mb-3">{b.title}</h3>
              <p className="text-[14px] text-[#a0a0b0] leading-[1.7]">{b.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
