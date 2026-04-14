import { useEffect, useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const SUBJECTS = [
  'Question générale',
  'Problème technique',
  'Partenariat',
  'Signalement',
  'Autre',
];

export default function LegalContact() {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'legal_contact_text')
        .maybeSingle();
      setContent(data?.value || '');
      setLoading(false);
    };
    load();
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (message.length < 20) {
      toast.error('Ton message doit contenir au moins 20 caractères.');
      return;
    }
    setSending(true);
    setTimeout(() => {
      setSending(false);
      toast.success('Message envoyé ! On te répondra dans les plus brefs délais.');
      setName('');
      setEmail('');
      setSubject(SUBJECTS[0]);
      setMessage('');
    }, 800);
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-1/2 rounded bg-[#1e1e2e]" />
        <div className="h-4 w-full rounded bg-[#1e1e2e]" />
        <div className="h-4 w-5/6 rounded bg-[#1e1e2e]" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-12">
        <h1 className="text-[32px] font-extrabold text-white mb-6">Contact</h1>
        {content.split('\n').map((line, i) => {
          if (!line.trim()) return <br key={i} />;
          if (line.startsWith('## ')) {
            return <h2 key={i} className="text-[22px] font-bold text-[#c084f5] mt-10 mb-4">{line.replace('## ', '')}</h2>;
          }
          if (line.startsWith('**') && line.endsWith('**')) {
            return <p key={i} className="text-[15px] text-white font-semibold leading-[1.75] mb-2">{line.replace(/\*\*/g, '')}</p>;
          }
          const placeholderRe = /\[([A-ZÀÂÉÈÊËÏÎÔÙÛÜÇ\s']+À COMPLÉTER)\]/g;
          if (placeholderRe.test(line)) {
            return (
              <p
                key={i}
                className="text-[15px] text-[#c0c0d0] leading-[1.75] mb-2"
                dangerouslySetInnerHTML={{
                  __html: line.replace(placeholderRe, '<span class="legal-placeholder">[$1]</span>'),
                }}
              />
            );
          }
          return <p key={i} className="text-[15px] text-[#c0c0d0] leading-[1.75] mb-2">{line}</p>;
        })}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
        <div>
          <label className="block text-[13px] font-medium text-[#a0a0b0] mb-1.5">Ton prénom</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 rounded-lg text-[14px] text-white placeholder-[#606070] outline-none transition-colors focus:border-[#7B2D8B]"
            style={{ background: '#0f0f17', border: '1px solid #2a2a3a' }}
            placeholder="Ton prénom"
          />
        </div>
        <div>
          <label className="block text-[13px] font-medium text-[#a0a0b0] mb-1.5">Ton email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-lg text-[14px] text-white placeholder-[#606070] outline-none transition-colors focus:border-[#7B2D8B]"
            style={{ background: '#0f0f17', border: '1px solid #2a2a3a' }}
            placeholder="ton@email.com"
          />
        </div>
        <div>
          <label className="block text-[13px] font-medium text-[#a0a0b0] mb-1.5">Sujet</label>
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full px-4 py-3 rounded-lg text-[14px] text-white outline-none transition-colors focus:border-[#7B2D8B]"
            style={{ background: '#0f0f17', border: '1px solid #2a2a3a' }}
          >
            {SUBJECTS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[13px] font-medium text-[#a0a0b0] mb-1.5">Ton message</label>
          <textarea
            required
            minLength={20}
            rows={6}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full px-4 py-3 rounded-lg text-[14px] text-white placeholder-[#606070] outline-none transition-colors resize-none focus:border-[#7B2D8B]"
            style={{ background: '#0f0f17', border: '1px solid #2a2a3a' }}
            placeholder="Décris ta demande en détail (min. 20 caractères)"
          />
        </div>
        <button
          type="submit"
          disabled={sending}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#7B2D8B] text-white text-[14px] font-semibold transition-all hover:bg-[#9b3dab] disabled:opacity-50"
        >
          <Send size={16} />
          {sending ? 'Envoi en cours...' : 'Envoyer'}
        </button>
      </form>
    </div>
  );
}
