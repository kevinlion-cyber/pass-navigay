import { useEffect, useState } from 'react';
import { Megaphone, Instagram, Facebook, RefreshCw, Loader2, ExternalLink, Clock, CheckCircle2, AlertTriangle, Send, X, PenLine, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import ConfirmModal from '../../components/admin/ConfirmModal';

interface SocialPost {
  id: string;
  kind: 'establishment' | 'event';
  establishment_id: string | null;
  event_id: string | null;
  caption: string;
  image_url: string | null;
  link_url: string | null;
  platforms: string[] | null;
  status: 'brouillon' | 'publication' | 'annule' | 'generated' | 'posted' | 'partial' | 'failed';
  error: string | null;
  created_at: string;
  posted_at: string | null;
  establishments?: { name: string } | null;
  events?: { title: string } | null;
}

const STATUS: Record<string, { label: string; icon: typeof Clock; color: string; bg: string }> = {
  brouillon: { label: 'À valider', icon: PenLine, color: '#c084f5', bg: 'rgba(123,45,139,0.15)' },
  publication: { label: 'Publication en cours', icon: Loader2, color: '#808090', bg: 'rgba(255,255,255,0.05)' },
  annule: { label: 'Annulé', icon: X, color: '#808090', bg: 'rgba(255,255,255,0.05)' },
  generated: { label: 'Généré (non publié)', icon: Clock, color: '#808090', bg: 'rgba(255,255,255,0.05)' },
  posted: { label: 'Publié', icon: CheckCircle2, color: '#3fb950', bg: 'rgba(46,160,67,0.12)' },
  partial: { label: 'Partiel', icon: AlertTriangle, color: '#e3b341', bg: 'rgba(210,153,34,0.12)' },
  failed: { label: 'Échec', icon: AlertTriangle, color: '#c0392b', bg: 'rgba(192,57,43,0.12)' },
};

const META_APP_ID = import.meta.env.VITE_META_APP_ID as string | undefined;
const META_REDIRECT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-oauth`;
// instagram_manage_comments + pages_read_engagement = lire les commentaires laissés
// sur nos posts (IG + FB). À demander DÈS la 1re autorisation, sinon il faut tout ré-autoriser.
const META_SCOPES = 'pages_show_list,pages_manage_posts,pages_read_engagement,instagram_basic,instagram_content_publish,instagram_manage_comments,business_management';
// Les apps Meta de type « Entreprise » passent par « Connexion Facebook pour les
// entreprises », où les permissions viennent d'une CONFIGURATION créée dans le
// tableau de bord (paramètre config_id) plutôt que de `scope`. Meta accepte encore
// `scope`, mais recommande config_id. On gère les deux : si VITE_META_CONFIG_ID est
// renseignée on l'utilise, sinon on retombe sur les scopes. Ça évite d'avoir à
// redéployer si la connexion par scopes se fait refuser.
const META_CONFIG_ID = import.meta.env.VITE_META_CONFIG_ID as string | undefined;
const metaOauthUrl = (state: string) => {
  const auth = META_CONFIG_ID ? `config_id=${META_CONFIG_ID}` : `scope=${META_SCOPES}`;
  return `https://www.facebook.com/v21.0/dialog/oauth?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(META_REDIRECT)}&${auth}&response_type=code&state=${encodeURIComponent(state)}`;
};

// M2 : jeton à usage unique enregistré avant de partir chez Facebook ; meta-oauth
// refuse tout retour qui ne le porte pas (un tiers ne peut plus connecter sa page).
async function startMetaOauth(userId: string | undefined) {
  if (!userId) { toast.error('Session expirée, reconnectez-vous.'); return; }
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const state = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  const { error } = await supabase.from('oauth_states').insert({ state, created_by: userId });
  if (error) { toast.error('Impossible de lancer la connexion Facebook. Réessayez.'); return; }
  window.location.href = metaOauthUrl(state);
}

interface Integration { page_name: string | null; ig_username: string | null; connected_at: string | null; }

interface Cmt { id: string; platform: string; author: string | null; text: string | null; commented_at: string | null }

export default function AdminSocial() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [integ, setInteg] = useState<Integration | null>(null);
  const [comments, setComments] = useState<Cmt[]>([]);
  const [fetchingC, setFetchingC] = useState(false);
  const [textes, setTextes] = useState<Record<string, string>>({});
  const [aPublier, setAPublier] = useState<SocialPost | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [consignes, setConsignes] = useState('');
  const [consignesPost, setConsignesPost] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const [p, c] = await Promise.all([
      supabase.from('social_posts').select('*, establishments(name), events(title)').order('created_at', { ascending: false }).limit(60),
      supabase.from('social_comments').select('id,platform,author,text,commented_at').order('commented_at', { ascending: false }).limit(50),
    ]);
    setPosts((p.data as SocialPost[]) || []);
    setComments((c.data as Cmt[]) || []);
    setLoading(false);
  };

  // Récupère les commentaires laissés sur nos posts Facebook + Instagram.
  const fetchComments = async () => {
    setFetchingC(true);
    try {
      const { data, error } = await supabase.functions.invoke('social-comments', { body: {} });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`${data.stored ?? 0} commentaire(s) récupéré(s) sur ${data.posts ?? 0} post(s)`);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
    setFetchingC(false);
  };

  useEffect(() => {
    load();
    supabase.from('social_integrations').select('page_name,ig_username,connected_at').eq('id', 1).maybeSingle()
      .then(({ data }) => setInteg(data as Integration | null));
    const p = new URLSearchParams(window.location.search);
    if (p.get('connected')) toast.success('Instagram + Facebook connectés !');
    if (p.get('meta_error')) toast.error(p.get('meta_error') === 'state' ? 'Connexion Meta refusée : relancez-la depuis ce bouton (lien expiré ou non sollicité).' : 'Connexion Meta : ' + p.get('meta_error'));
    if (p.get('connected') || p.get('meta_error')) window.history.replaceState({}, '', '/admin/reseaux-sociaux');
  }, []);

  const runNow = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('social-daily', { body: { consignes: consignes.trim() } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const n = data.posts?.length || 0;
      toast.success(n ? `${n} brouillon${n > 1 ? 's' : ''} prêt${n > 1 ? 's' : ''} à relire` : 'Aucun lieu ni événement à proposer aujourd’hui');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
    setRunning(false);
  };

  const publier = async () => {
    if (!aPublier) return;
    const post = aPublier;
    setAPublier(null);
    setEnCours(post.id);
    try {
      const { data, error } = await supabase.functions.invoke('social-daily', {
        body: { action: 'publier', post_id: post.id, caption: textes[post.id] ?? post.caption },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data.status === 'posted') toast.success('Publié sur Facebook et Instagram');
      else if (data.status === 'partial') toast.error('Publié en partie : ' + (data.errors || []).join(' | '));
      else toast.error('Échec de la publication : ' + (data.errors || []).join(' | '));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
    setEnCours(null);
    load();
  };

  const regenerer = async (post: SocialPost) => {
    setEnCours(post.id);
    try {
      const { data, error } = await supabase.functions.invoke('social-daily', {
        body: { action: 'regenerer', post_id: post.id, consignes: (consignesPost[post.id] ?? '').trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setTextes((prev) => ({ ...prev, [post.id]: data.caption }));
      toast.success('Nouveau texte proposé');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
    setEnCours(null);
  };

  const annuler = async (post: SocialPost) => {
    setEnCours(post.id);
    try {
      const { data, error } = await supabase.functions.invoke('social-daily', { body: { action: 'annuler', post_id: post.id } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Brouillon écarté');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
    setEnCours(null);
    load();
  };

  const brouillons = posts.filter((p) => p.status === 'brouillon');
  const historique = posts.filter((p) => p.status !== 'brouillon');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Megaphone size={20} style={{ color: '#7B2D8B' }} />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Social quotidien</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={runNow} disabled={running} className="btn-primary text-sm flex items-center gap-1.5 py-2 px-4 disabled:opacity-60">
            {running ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Préparer le post du jour
          </button>
        </div>
      </div>
      <p className="text-sm text-gray-500 -mt-2">
        Un établissement (et un événement à venir s'il y en a) est préparé avec un texte écrit par l'IA. Rien n'est publié tant que vous n'avez pas relu et cliqué « Publier ». Les fiches Coquin 18+ ne sont jamais proposées.
      </p>
      <div>
        <label htmlFor="consignes-ia" className="text-xs font-medium text-gray-600 dark:text-gray-400">Consignes pour l'IA (facultatif, utilisées au prochain « Préparer »)</label>
        <textarea
          id="consignes-ia"
          value={consignes}
          onChange={(e) => setConsignes(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="Ex. : ton humoristique, parler du brunch du dimanche, texte très court, mentionner la Pride…"
          className="input-field w-full text-sm mt-1"
        />
      </div>

      {/* Connexion Meta en 1 clic */}
      <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5" style={{ color: '#7B2D8B' }}><Instagram size={20} /><Facebook size={20} /></span>
          {integ?.connected_at ? (
            <p className="text-sm">
              <span className="inline-flex items-center gap-1 text-green-500 font-medium"><CheckCircle2 size={15} /> Connecté</span>
              <span className="text-gray-500"> · {integ.page_name}{integ.ig_username ? ` · @${integ.ig_username}` : ''}</span>
            </p>
          ) : (
            <p className="text-sm text-gray-500">Instagram + Facebook <strong>non connectés</strong> — les posts sont générés mais pas publiés.</p>
          )}
        </div>
        {META_APP_ID ? (
          <button onClick={() => startMetaOauth(user?.id)} className="btn-primary text-sm py-2 px-4">
            {integ?.connected_at ? 'Reconnecter' : 'Connecter Instagram + Facebook'}
          </button>
        ) : (
          <span className="text-xs text-gray-500 italic">Configuration Meta requise (App ID)</span>
        )}
      </div>

      {/* Ce que les gens disent : commentaires laissés sur nos posts FB + IG */}
      <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Ce que les gens disent</h2>
            <p className="text-xs text-gray-500">Commentaires laissés sur nos publications Facebook et Instagram.</p>
          </div>
          <button onClick={fetchComments} disabled={fetchingC || !integ?.connected_at}
            className="text-sm flex items-center gap-1.5 py-2 px-4 border border-light-border dark:border-dark-border rounded-input text-gray-700 dark:text-gray-300 hover:border-primary disabled:opacity-50">
            {fetchingC ? 'Récupération…' : 'Récupérer les commentaires'}
          </button>
        </div>
        {comments.length === 0 ? (
          <p className="text-sm text-gray-500">{integ?.connected_at ? 'Aucun commentaire pour le moment.' : 'Connectez Instagram + Facebook pour récupérer les commentaires.'}</p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {comments.map((c) => (
              <div key={c.id} className="flex items-start gap-2 text-sm border-b border-light-border dark:border-dark-border pb-2 last:border-0">
                <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0 mt-0.5" style={{ background: c.platform === 'instagram' ? 'rgba(225,48,108,0.15)' : 'rgba(24,119,242,0.15)', color: c.platform === 'instagram' ? '#e1306c' : '#1877f2' }}>
                  {c.platform === 'instagram' ? 'IG' : 'FB'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-gray-900 dark:text-white">{c.text || <em className="text-gray-500">(sans texte)</em>}</p>
                  <p className="text-xs text-gray-500">{c.author || 'anonyme'}{c.commented_at ? ` · ${new Date(c.commented_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {brouillons.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">À valider ({brouillons.length})</h2>
          {brouillons.map((p) => {
            const name = p.establishments?.name || p.events?.title || (p.kind === 'event' ? 'Événement' : 'Établissement');
            const texte = textes[p.id] ?? p.caption;
            return (
              <div key={p.id} className="bg-light-surface dark:bg-dark-surface border-2 rounded-card p-4 flex flex-col sm:flex-row gap-4" style={{ borderColor: 'rgba(123,45,139,0.5)' }}>
                {p.image_url && (
                  <img loading="lazy" decoding="async" src={p.image_url} alt="" className="w-full sm:w-48 h-48 object-cover rounded-input shrink-0" />
                )}
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(123,45,139,0.15)', color: '#c084f5' }}>
                      {p.kind === 'event' ? 'Événement' : 'Établissement'}
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{name}</span>
                    {p.link_url && (
                      <a href={p.link_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white">
                        <ExternalLink size={12} /> Voir la fiche
                      </a>
                    )}
                  </div>
                  <textarea
                    value={texte}
                    onChange={(e) => setTextes((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    rows={7}
                    maxLength={2000}
                    className="input-field w-full text-sm leading-relaxed"
                    aria-label="Texte du post"
                  />
                  <p className="text-xs text-gray-500">{texte.length} / 2000 caractères · le lien vers la fiche est ajouté automatiquement à la fin.</p>
                  <div className="flex gap-2 flex-col sm:flex-row">
                    <input
                      type="text"
                      value={consignesPost[p.id] ?? ''}
                      onChange={(e) => setConsignesPost((prev) => ({ ...prev, [p.id]: e.target.value }))}
                      maxLength={500}
                      placeholder="Consignes pour un autre texte (ex. : plus court, plus drôle, citer la terrasse)"
                      className="input-field flex-1 text-sm"
                      aria-label="Consignes pour régénérer le texte"
                    />
                    <button
                      onClick={() => regenerer(p)}
                      disabled={!!enCours}
                      className="text-sm flex items-center justify-center gap-1.5 py-2 px-4 rounded-input border border-light-border dark:border-dark-border text-gray-700 dark:text-gray-200 hover:opacity-80 disabled:opacity-60 shrink-0"
                    >
                      {enCours === p.id ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Régénérer le texte
                    </button>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => setAPublier(p)}
                      disabled={!!enCours || !texte.trim()}
                      className="btn-primary text-sm flex items-center gap-1.5 py-2 px-4 disabled:opacity-60"
                    >
                      {enCours === p.id ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Publier
                    </button>
                    <button
                      onClick={() => annuler(p)}
                      disabled={!!enCours}
                      className="text-sm flex items-center gap-1.5 py-2 px-4 rounded-input border border-light-border dark:border-dark-border text-gray-600 dark:text-gray-300 hover:opacity-80 disabled:opacity-60"
                    >
                      <X size={15} /> Ne pas publier
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {historique.length > 0 && !loading && <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Historique</h2>}
      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-24 rounded-card" />)}</div>
      ) : posts.length === 0 ? (
        <p className="text-center text-gray-500 py-12">Aucun post encore. Cliquez « Préparer le post du jour ».</p>
      ) : (
        <div className="space-y-3">
          {historique.map((p) => {
            const st = STATUS[p.status] || STATUS.generated;
            const StIcon = st.icon;
            const name = p.establishments?.name || p.events?.title || (p.kind === 'event' ? 'Événement' : 'Établissement');
            return (
              <div key={p.id} className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card p-4 flex gap-4">
                {p.image_url && (
                  <img loading="lazy" decoding="async" src={p.image_url} alt="" className="w-24 h-24 object-cover rounded-input shrink-0 hidden sm:block" />
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

      <ConfirmModal
        open={!!aPublier}
        title="Publier ce post ?"
        message={`Il sera publié tout de suite sur ${[integ?.page_name ? 'la page Facebook ' + integ.page_name : null, integ?.ig_username ? 'Instagram @' + integ.ig_username : null].filter(Boolean).join(' et ') || 'Facebook et Instagram'}. Une fois publié, il faudra le supprimer à la main sur Facebook / Instagram.`}
        confirmLabel="Publier"
        onCancel={() => setAPublier(null)}
        onConfirm={publier}
      />
    </div>
  );
}
