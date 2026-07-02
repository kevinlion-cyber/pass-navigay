import { useEffect, useState, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { MessageSquare, Send, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import type { Establishment, Review } from '../../lib/types';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import StarRating from '../../components/ui/StarRating';
import ShieldRating from '../../components/ui/ShieldRating';

interface PartnerContext {
  establishment: Establishment;
}

export default function PartnerReviews() {
  const { establishment } = useOutletContext<PartnerContext>();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: revs } = await supabase
        .from('reviews')
        .select('*')
        .eq('establishment_id', establishment.id)
        .order('created_at', { ascending: false });
      const list = (revs as Review[]) || [];
      const authorIds = [...new Set(list.map((r) => r.user_id).filter(Boolean))];
      let authors: Record<string, any> = {};
      if (authorIds.length) {
        const { data } = await supabase.from('public_profiles').select('id, username, avatar_url').in('id', authorIds);
        authors = Object.fromEntries((data || []).map((a: any) => [a.id, a]));
      }
      setReviews(list.map((r) => ({ ...r, user: authors[r.user_id] })));
      setDrafts(Object.fromEntries(list.map((r) => [r.id, r.reply || ''])));
    } catch {
      toast.error('Erreur lors du chargement des avis');
    }
    setLoading(false);
  }, [establishment.id]);

  useEffect(() => { load(); }, [load]);

  const saveReply = async (reviewId: string) => {
    setSavingId(reviewId);
    const { error } = await supabase.rpc('set_review_reply', {
      p_review_id: reviewId,
      p_reply: drafts[reviewId] ?? '',
    });
    setSavingId(null);
    if (error) {
      toast.error('Erreur lors de l\'enregistrement de la réponse');
    } else {
      toast.success('Réponse enregistrée');
      load();
    }
  };

  const avg = reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : '—';

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size={32} /></div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <MessageSquare size={22} style={{ color: '#7B2D8B' }} />
          Avis clients
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          {reviews.length} avis · note moyenne {avg}{reviews.length > 0 ? '/5' : ''}
        </p>
      </div>

      {reviews.length === 0 ? (
        <div className="text-center py-16 rounded-card" style={{ background: 'var(--pn-surface)', border: '1px solid var(--pn-border2)' }}>
          <MessageSquare size={40} className="mx-auto text-gray-600 mb-3" />
          <p className="text-gray-400">Pas encore d'avis sur votre établissement.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => (
            <div key={r.id} className="rounded-card p-4" style={{ background: 'var(--pn-surface)', border: '1px solid var(--pn-border2)' }}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-medium text-white overflow-hidden shrink-0">
                  {r.user?.avatar_url ? (
                    <img src={r.user.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (r.user?.username?.charAt(0).toUpperCase()) || '?'
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{r.user?.username || 'Anonyme'}</p>
                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    <StarRating rating={r.rating} size={13} />
                    {r.safety_rating != null && r.safety_rating > 0 && (
                      <ShieldRating rating={r.safety_rating} size={13} />
                    )}
                  </div>
                </div>
                <span className="text-xs text-gray-500 ml-auto">
                  {new Date(r.created_at).toLocaleDateString('fr-FR')}
                </span>
              </div>

              {r.comment && <p className="text-sm text-gray-300 mb-3">{r.comment}</p>}

              <div className="mt-2">
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  {r.reply ? 'Votre réponse' : 'Répondre à cet avis'}
                </label>
                <textarea
                  value={drafts[r.id] ?? ''}
                  onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                  rows={2}
                  placeholder="Votre réponse publique…"
                  className="w-full px-3 py-2 rounded-input text-sm text-gray-900 dark:text-white placeholder-gray-600 outline-none resize-none"
                  style={{ background: 'var(--pn-bg)', border: '1px solid var(--pn-border2)' }}
                />
                <div className="flex justify-end mt-2">
                  <button
                    onClick={() => saveReply(r.id)}
                    disabled={savingId === r.id || (drafts[r.id] ?? '') === (r.reply || '')}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-input text-sm font-semibold text-gray-900 dark:text-white transition-all hover:opacity-90 disabled:opacity-40"
                    style={{ background: '#7B2D8B' }}
                  >
                    {savingId === r.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    {r.reply ? 'Mettre à jour' : 'Publier la réponse'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
