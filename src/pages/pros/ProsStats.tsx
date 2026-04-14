const STATS = [
  { value: '12 000', suffix: '+', label: 'UTILISATEURS', desc: 'Une communauté en pleine croissance' },
  { value: '150', suffix: '+', label: 'LIEUX RÉFÉRENCÉS', desc: 'Des adresses inclusives partout en France' },
  { value: '500', suffix: '+', label: 'ÉVÉNEMENTS', desc: 'Publiés chaque mois sur la plateforme' },
];

export default function ProsStats() {
  return (
    <section className="pt-20 pb-10 px-6" style={{ background: '#0f0f17' }}>
      <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3">
        {STATS.map((s, i) => (
          <div
            key={s.label}
            className={`text-center py-8 sm:py-0 ${
              i < STATS.length - 1
                ? 'border-b sm:border-b-0 sm:border-r border-[#1e1e2e]'
                : ''
            }`}
          >
            <p className="text-[#c084f5]">
              <span className="text-[48px] md:text-[64px] font-black leading-none">{s.value}</span>
              <span className="text-[24px] md:text-[32px] font-black">{s.suffix}</span>
            </p>
            <p className="text-[14px] font-semibold text-white mt-2 tracking-[1px]">{s.label}</p>
            <p className="text-[13px] text-[#606070] mt-1">{s.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
