import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, X, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';

interface PromoUse {
  id: string;
  user_id: string;
  used_at: string;
  username?: string;
  avatar_url?: string | null;
}

interface Props {
  promoId: string;
  maxUses: number | null;
  currentUses: number;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "a l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days}j`;
}

function formatDateTimeFr(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} a ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

export default function PromoUsesSection({ promoId, maxUses, currentUses }: Props) {
  const [uses, setUses] = useState<PromoUse[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [allUsesOpen, setAllUsesOpen] = useState(false);
  const [allUses, setAllUses] = useState<PromoUse[]>([]);
  const [totalCount, setTotalCount] = useState(currentUses);
  const [loadingAll, setLoadingAll] = useState(false);

  const enrichUses = async (rawUses: { id: string; user_id: string; used_at: string }[]): Promise<PromoUse[]> => {
    if (rawUses.length === 0) return [];
    const userIds = rawUses.map((u) => u.user_id);
    const { data: profiles } = await supabase
      .from('public_profiles')
      .select('id, username, avatar_url')
      .in('id', userIds);
    const profileMap = new Map<string, { username: string; avatar_url: string | null }>();
    (profiles || []).forEach((p) => {
      profileMap.set(p.id, { username: p.username, avatar_url: p.avatar_url });
    });
    return rawUses.map((u) => ({
      ...u,
      username: profileMap.get(u.user_id)?.username || 'Utilisateur',
      avatar_url: profileMap.get(u.user_id)?.avatar_url || null,
    }));
  };

  useEffect(() => {
    const loadRecent = async () => {
      const { data } = await supabase
        .from('promotion_uses')
        .select('id, user_id, used_at')
        .eq('promotion_id', promoId)
        .order('used_at', { ascending: false })
        .limit(5);
      if (data) {
        const enriched = await enrichUses(data);
        setUses(enriched);
      }
    };
    loadRecent();
  }, [promoId]);

  useEffect(() => {
    const channel = supabase
      .channel(`promo-uses-${promoId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'promotion_uses',
          filter: `promotion_id=eq.${promoId}`,
        },
        async (payload) => {
          const enriched = await enrichUses([payload.new as { id: string; user_id: string; used_at: string }]);
          if (enriched.length > 0) {
            setUses((prev) => [enriched[0], ...prev].slice(0, 5));
            setTotalCount((prev) => prev + 1);
            toast.success('Nouvelle utilisation de votre promotion !', { duration: 4000 });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [promoId]);

  const loadAllUses = async () => {
    setLoadingAll(true);
    const { data } = await supabase
      .from('promotion_uses')
      .select('id, user_id, used_at')
      .eq('promotion_id', promoId)
      .order('used_at', { ascending: false });
    if (data) {
      const enriched = await enrichUses(data);
      setAllUses(enriched);
    }
    setLoadingAll(false);
    setAllUsesOpen(true);
  };

  if (totalCount === 0 && uses.length === 0) return null;

  const usagePercent = maxUses ? Math.min(100, Math.round((totalCount / maxUses) * 100)) : null;

  return (
    <>
      <div className="border-t border-light-border dark:border-dark-border pt-3 mt-1">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-900 dark:text-white transition-colors w-full"
        >
          <Users size={13} />
          <span>Voir les utilisations ({totalCount})</span>
          {expanded ? <ChevronUp size={13} className="ml-auto" /> : <ChevronDown size={13} className="ml-auto" />}
        </button>

        {expanded && (
          <div className="mt-3 space-y-2">
            {uses.map((u) => (
              <div key={u.id} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-dark-border overflow-hidden shrink-0">
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-gray-500 font-medium">
                      {u.username?.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-900 dark:text-white font-medium truncate">{u.username}</p>
                </div>
                <span className="text-[11px] text-gray-500 shrink-0">{timeAgo(u.used_at)}</span>
              </div>
            ))}
            {totalCount > 5 && (
              <button
                onClick={loadAllUses}
                className="text-xs font-medium hover:underline mt-1"
                style={{ color: '#7B2D8B' }}
              >
                Voir toutes les {totalCount} utilisations
              </button>
            )}
          </div>
        )}
      </div>

      {allUsesOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setAllUsesOpen(false)}
        >
          <div
            className="relative w-full max-w-[480px] max-h-[85vh] flex flex-col"
            style={{ background: 'var(--pn-bg)', border: '1px solid var(--pn-border)', borderRadius: 14 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-light-border dark:border-dark-border shrink-0">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Toutes les utilisations</h3>
              <button onClick={() => setAllUsesOpen(false)} className="text-gray-500 hover:text-gray-900 dark:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {loadingAll ? (
                <p className="text-center text-gray-500 py-8">Chargement...</p>
              ) : (
                allUses.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 py-1.5">
                    <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-dark-border overflow-hidden shrink-0">
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-gray-500 font-medium">
                          {u.username?.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 dark:text-white font-medium truncate">{u.username}</p>
                      <p className="text-[11px] text-gray-500">{formatDateTimeFr(u.used_at)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="shrink-0 px-6 py-4 border-t border-light-border dark:border-dark-border">
              <p className="text-xs text-gray-400 mb-2">
                {totalCount} utilisation{totalCount > 1 ? 's' : ''}
                {maxUses ? ` sur ${maxUses} possibles` : ''}
              </p>
              {usagePercent !== null && (
                <div className="h-2 rounded-full bg-gray-200 dark:bg-dark-border overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${usagePercent}%`, background: '#7B2D8B' }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
