const TESTIMONIALS = [
  {
    avatar: 'https://i.pravatar.cc/88?img=33',
    name: 'Marc',
    place: 'Le Why Not',
    quote: 'Pass Navigay nous a amené une clientèle entièrement nouvelle. Nos soirées du vendredi ont doublé en fréquentation en moins de 3 mois. C\u2019est devenu un canal indispensable pour nous.',
  },
  {
    avatar: 'https://i.pravatar.cc/88?img=47',
    name: 'Sophie',
    place: 'La Mercerie',
    quote: 'L\u2019espace partenaire est vraiment simple à utiliser. En 10 minutes mon établissement était en ligne avec ma galerie et mes événements. Le support répond vite.',
  },
  {
    avatar: 'https://i.pravatar.cc/88?img=15',
    name: 'Thomas',
    place: 'Spa Antigone',
    quote: 'Nos promos du lundi soir affichent complet depuis qu\u2019on est sur Pass Navigay. La communauté est fidèle et engagée. Je recommande à tous les établissements inclusifs.',
  },
];

export default function ProsTestimonials() {
  return (
    <section className="py-[100px] px-6" style={{ background: '#0a0a0f' }}>
      <div className="max-w-[1100px] mx-auto">
        <h2 className="text-[32px] md:text-[40px] font-extrabold text-white text-center">
          Ils nous font confiance
        </h2>
        <p className="text-[18px] text-[#a0a0b0] text-center mt-4">
          Des établissements qui ont rejoint la communauté Pass Navigay
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-[60px]">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              className="relative rounded-2xl p-8"
              style={{ background: '#14141e', border: '1px solid #1e1e2e' }}
            >
              <span
                className="absolute top-4 left-6 text-[80px] font-black leading-none pointer-events-none select-none"
                style={{ color: 'rgba(123,45,139,0.2)' }}
              >
                &ldquo;
              </span>

              <div className="text-[14px] text-[#d4a017] mb-4 tracking-wider">
                &#9733;&#9733;&#9733;&#9733;&#9733;
              </div>

              <p className="text-[15px] text-[#c0c0d0] leading-[1.75] italic relative z-10">
                &laquo;{t.quote}&raquo;
              </p>

              <div className="flex items-center gap-3 mt-6">
                <img
                  src={t.avatar}
                  alt={t.name}
                  className="w-11 h-11 rounded-full object-cover"
                  style={{ border: '2px solid #7B2D8B' }}
                />
                <div>
                  <p className="text-[14px] font-bold text-white">{t.name}</p>
                  <p className="text-[13px] text-[#c084f5]">{t.place}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
