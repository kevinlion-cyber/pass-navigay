import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import LegalMarkdown from './LegalMarkdown';
import { LEGAL_CUSTOM_KEY, LegalPage, parseLegalPages } from './legalPages';

export default function LegalCustomPage() {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState<LegalPage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase.from('app_settings').select('value').eq('key', LEGAL_CUSTOM_KEY).maybeSingle();
      const pages = parseLegalPages(data?.value);
      setPage(pages.find((p) => p.slug === slug) ?? null);
      setLoading(false);
    };
    load();
  }, [slug]);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-1/2 rounded bg-[#1e1e2e]" />
        <div className="h-4 w-full rounded bg-[#1e1e2e]" />
        <div className="h-4 w-5/6 rounded bg-[#1e1e2e]" />
      </div>
    );
  }

  if (!page) {
    return <p className="text-[15px] text-[#a0a0b0]">Cette page n'existe pas ou a été supprimée.</p>;
  }

  return (
    <div>
      <h1 className="text-[32px] font-extrabold text-white mb-6">{page.title}</h1>
      <LegalMarkdown content={page.content} />
    </div>
  );
}
