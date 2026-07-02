import { ProsContent } from './prosContent';

interface ProsTestimonialsProps {
  content: ProsContent['testimonials'];
}

export default function ProsTestimonials({ content }: ProsTestimonialsProps) {
  return (
    <section className="py-[100px] px-6" style={{ background: '#0a0a0f' }}>
      <div className="max-w-[1100px] mx-auto">
        <h2 className="text-[32px] md:text-[40px] font-extrabold text-white text-center">
          {content.title}
        </h2>
        <p className="text-[18px] text-[#a0a0b0] text-center mt-4">
          {content.subtitle}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-[60px]">
          {content.items.map((t, i) => {
            const stars = Math.max(0, Math.min(5, t.stars || 5));
            return (
              <div
                key={t.name + i}
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
                  {'★'.repeat(stars)}
                  <span className="text-[#2a2a3a]">{'★'.repeat(5 - stars)}</span>
                </div>

                <p className="text-[15px] text-[#c0c0d0] leading-[1.75] italic relative z-10">
                  &laquo;{t.quote}&raquo;
                </p>

                <div className="flex items-center gap-3 mt-6">
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold shrink-0"
                    style={{ background: '#7B2D8B', border: '2px solid #7B2D8B' }}
                  >
                    {(t.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-[14px] font-bold text-white">{t.name}</p>
                    <p className="text-[13px] text-[#c084f5]">{t.place}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
