interface ResolvedStat {
  label: string;
  desc: string;
  display: string;
}

interface ProsStatsProps {
  items: ResolvedStat[];
}

export default function ProsStats({ items }: ProsStatsProps) {
  if (!items.length) return null;

  // Colonnes adaptées au nombre de chiffres (2, 3 ou 4).
  const cols = items.length >= 4 ? 'sm:grid-cols-4' : items.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3';

  return (
    <section className="pt-20 pb-10 px-6" style={{ background: '#0f0f17' }}>
      <div className={`max-w-4xl mx-auto grid grid-cols-1 ${cols}`}>
        {items.map((s, i) => (
          <div
            key={s.label + i}
            className={`text-center py-8 sm:py-0 ${
              i < items.length - 1
                ? 'border-b sm:border-b-0 sm:border-r border-[#1e1e2e]'
                : ''
            }`}
          >
            <p className="text-[#c084f5]">
              <span className="text-[48px] md:text-[64px] font-black leading-none">{s.display}</span>
            </p>
            <p className="text-[14px] font-semibold text-white mt-2 tracking-[1px]">{s.label}</p>
            <p className="text-[13px] text-[#606070] mt-1">{s.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
