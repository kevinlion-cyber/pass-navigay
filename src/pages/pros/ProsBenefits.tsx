import { ProsContent } from './prosContent';

interface ProsBenefitsProps {
  content: ProsContent['benefits'];
}

export default function ProsBenefits({ content }: ProsBenefitsProps) {
  return (
    <section className="py-[100px] px-6" style={{ background: '#0a0a0f' }}>
      <div className="max-w-[1100px] mx-auto">
        <h2 className="text-[32px] md:text-[40px] font-extrabold text-white text-center">
          {content.title}
        </h2>
        <p className="text-[18px] text-[#a0a0b0] text-center mt-4 max-w-2xl mx-auto">
          {content.subtitle}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-[60px]">
          {content.items.map((b, i) => (
            <div
              key={b.title + i}
              className="pros-card-benefit rounded-2xl p-9 transition-all duration-200 hover:-translate-y-1 hover:border-[#7B2D8B]"
              style={{ animationDelay: `${i * 0.1}s` }}
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
