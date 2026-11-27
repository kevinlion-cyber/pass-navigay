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
  // Champ piège invisible (anti-robots) : un humain ne le voit pas et le laisse vide.
  const [piege, setPiege] = useState('');

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'legal_contact_text')
        .maybeSingle();
      // L'adresse email n'est plus affichée sur la page (demande de Kévin, 27/11/2026) :
      // on retire les lignes qui ne contiennent qu'une adresse, et on remplace une
      // adresse citée dans une phrase par « le formulaire ci-dessous ».
      const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;
      const texte = (data?.value || '')
        .split('\n')
        .filter((l: string) => !(l.match(EMAIL) && l.replace(EMAIL, '').replace(/e-?mail|courriel|contact|adresse/gi, '').replace(/[\s*_:–—-]/g, '') === ''))
        .map((l: string) => l.replace(EMAIL, 'le formulaire ci-dessous'))
        .join('\n')
        .replace(/ ?ou directement par (e-?mail|le formulaire ci-dessous)/gi, '')
        .replace(/via le formulaire ci-dessous ou le formulaire ci-dessous/g, 'via le formulaire ci-dessous');
      setContent(texte);
      setLoading(false);
    };
    load();
  }, []);

  // Envoi réel (avant : le formulaire affichait « Message envoyé » sans rien envoyer).
  // La fonction contact-message transmet le message par email à l'équipe, sans jamais
  // exposer l'adresse de réception.
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (message.trim().length < 20) {
      toast.error('Ton message doit contenir au moins 20 caractères.');
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('contact-message', {
        body: { name, email, subject, message, site_web: piege },
      });
      if (error) {
        let msg = 'Envoi impossible pour le moment. Réessaie un peu plus tard.';
        try {
          const corps = await (error as { context?: Response }).context?.json();
          if (corps?.error) msg = corps.error;
        } catch { /* réponse illisible */ }
        throw new Error(msg);
      }
      if (!data?.ok) throw new Error('Envoi impossible pour le moment. Réessaie un peu plus tard.');
      toast.success('Message envoyé ! On te répondra dans les plus brefs délais.');
      setName('');
      setEmail('');
      setSubject(SUBJECTS[0]);
      setMessage('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Envoi impossible.');
    }
    setSending(false);
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
          const parts: React.ReactNode[] = [];
          let lastIndex = 0;
          let match: RegExpExecArray | null;
          let p = 0;
          while ((match = placeholderRe.exec(line)) !== null) {
            if (match.index > lastIndex) parts.push(line.slice(lastIndex, match.index));
            parts.push(<span key={`ph-${p++}`} className="legal-placeholder">[{match[1]}]</span>);
            lastIndex = match.index + match[0].length;
          }
          if (lastIndex < line.length) parts.push(line.slice(lastIndex));
          return <p key={i} className="text-[15px] text-[#c0c0d0] leading-[1.75] mb-2">{parts.length ? parts : line}</p>;
        })}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
        <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
          <label>Site web (laisser vide)
            <input type="text" tabIndex={-1} autoComplete="off" value={piege} onChange={(e) => setPiege(e.target.value)} />
          </label>
        </div>
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
          {sending ? 'Envoi en cours…' : 'Envoyer'}
        </button>
        <p className="text-[12px] text-[#808090] leading-relaxed">
          Tes informations servent uniquement à te répondre. Elles sont conservées 12 mois au plus,
          puis supprimées. Voir notre politique de confidentialité.
        </p>
      </form>
    </div>
  );
}
