import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { supabase } from '../../lib/supabase';

const PLACEHOLDER_RE = /\[([A-ZÀÂÉÈÊËÏÎÔÙÛÜÇ\s']+À COMPLÉTER)\]/g;

function highlightPlaceholders(text: string): string {
  return text.replace(PLACEHOLDER_RE, '<span class="legal-placeholder">[$1]</span>');
}

export default function LegalMarkdown({ settingsKey }: { settingsKey: string }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', settingsKey)
        .maybeSingle();
      setContent(data?.value || '');
      setLoading(false);
    };
    load();
  }, [settingsKey]);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-1/2 rounded bg-[#1e1e2e]" />
        <div className="h-4 w-full rounded bg-[#1e1e2e]" />
        <div className="h-4 w-5/6 rounded bg-[#1e1e2e]" />
        <div className="h-4 w-full rounded bg-[#1e1e2e]" />
        <div className="h-6 w-1/3 rounded bg-[#1e1e2e] mt-6" />
        <div className="h-4 w-full rounded bg-[#1e1e2e]" />
        <div className="h-4 w-4/5 rounded bg-[#1e1e2e]" />
      </div>
    );
  }

  const processed = highlightPlaceholders(content);

  return (
    <div className="legal-content">
      <ReactMarkdown
        components={{
          h1: ({ children }) => <h1 className="text-[32px] font-extrabold text-white mb-6">{children}</h1>,
          h2: ({ children }) => <h2 className="text-[22px] font-bold text-[#c084f5] mt-10 mb-4">{children}</h2>,
          h3: ({ children }) => <h3 className="text-[18px] font-semibold text-white mt-8 mb-3">{children}</h3>,
          p: ({ children }) => {
            const text = String(children);
            if (PLACEHOLDER_RE.test(text)) {
              return (
                <p
                  className="text-[15px] text-[#c0c0d0] leading-[1.75] mb-4"
                  dangerouslySetInnerHTML={{ __html: highlightPlaceholders(text) }}
                />
              );
            }
            return <p className="text-[15px] text-[#c0c0d0] leading-[1.75] mb-4">{children}</p>;
          },
          ul: ({ children }) => <ul className="list-disc list-inside space-y-2 mb-4 text-[15px] text-[#c0c0d0]">{children}</ul>,
          li: ({ children }) => <li className="leading-[1.75]">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
          em: ({ children }) => <em className="text-[#606070]">{children}</em>,
          a: ({ href, children }) => (
            <a href={href} className="text-[#c084f5] underline hover:text-white transition-colors" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          hr: () => <hr className="border-[#1e1e2e] my-8" />,
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}
