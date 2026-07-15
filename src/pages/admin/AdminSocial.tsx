import { useEffect, useState } from 'react';
import { Megaphone, Instagram, Facebook, RefreshCw, Loader2, ExternalLink, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';

interface SocialPost {
  id: string;
  kind: 'establishment' | 'event';
  establishment_id: string | null;
  event_id: string | null;
  caption: string;
  image_url: string | null;
  link_url: string | null;
  platforms: string[] | null;
  status: 'generated' | 'posted' | 'partial' | 'failed';
  error: string | null;
  created_at: string;
  posted_at: string | null;
  establishments?: { name: string } | null;
  events?: { title: string } | null;
}

const STATUS: Record<string, { label: string; icon: typeof Clock; color: string; bg: string }> = {
  generated: { label: 'Généré (en attente Meta)', icon: Clock, color: '#808090', bg: 'rgba(255,255,255,0.05)' },
  posted: { label: 'Publié', icon: CheckCircle2, color: '#3fb950', bg: 'rgba(46,160,67,0.12)' },
  partial: { label: 'Partiel', icon: AlertTriangle, color: '#e3b341', bg: 'rgba(210,153,34,0.12)' },
  failed: { label: 'Échec', icon: AlertTriangle, color: '#c0392b', bg: 'rgba(192,57,43,0.12)' },
};

export default function AdminSocial() {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('social_posts')
      .select('*, establishments(name), events(title)')
      .order('created_at', { ascending: false })
      .limit(60);
    setPosts((data as SocialPost[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const runNow = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('social-daily', { body: {} });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const n = data.posts?.length || 0;
      toast.success(n ? `${n} post(s) généré(s)` : 'Rien à publier aujourd’hui');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
    setRunning(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Megaphone size={20} style={{ color: '#7B2D8B' }} />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Social quotidien</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={runNow} disabled={running} className="btn-primary text-sm flex items-center gap-1.5 py-2 px-4 disabled:opacity-60">
            {running ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Générer le post du jour
          </button>
        </div>
      </div>
      <p className="text-sm text-gray-500 -mt-2">
        Chaque jour, un établissement (et un événement à venir s'il y en a) est publié automatiquement sur Instagram + Facebook, avec un appel à avis.
        Tant que l'accès Meta de Kevin n'est pas branché, les posts sont <strong>générés et prêts</strong> (statut « en attente Meta »), sans être publiés.
      </p>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-24 rounded-card" />)}</div>
      ) : posts.length === 0 ? (
        <p className="text-center text-gray-500 py-12">Aucun post encore. Cliquez « Générer le post du jour ».</p>
      ) : (
        <div className="space-y-3">
          {posts.map((p) => {
            const st = STATUS[p.status] || STATUS.generated;
            const StIcon = st.icon;
            const name = p.establishments?.name || p.events?.title || (p.kind === 'event' ? 'Événement' : 'Établissement');
            return (
              <div key={p.id} className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card p-4 flex gap-4">
                {p.image_url && (
                  <img src={p.image_url} alt="" className="w-24 h-24 object-cover rounded-input shrink-0 hidden sm:block" />
                )}
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(123,45,139,0.15)', color: '#c084f5' }}>
                      {p.kind === 'event' ? 'Événement' : 'Établissement'}
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{name}</span>
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.color }}>
                      <StIcon size={12} /> {st.label}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">{p.caption}</p>
                  {p.error && <p className="text-xs text-alert">{p.error}</p>}
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    {(p.platforms || []).includes('instagram') && <span className="inline-flex items-center gap-1"><Instagram size={13} /> Instagram</span>}
                    {(p.platforms || []).includes('facebook') && <span className="inline-flex items-center gap-1"><Facebook size={13} /> Facebook</span>}
                    <span>{new Date(p.created_at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    {p.link_url && (
                      <a href={p.link_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-gray-900 dark:hover:text-white">
                        <ExternalLink size={12} /> Fiche
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
