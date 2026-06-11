import { useEffect, useState, useCallback } from 'react';
import { X, Gift, ShieldOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import type { Profile } from '../../lib/types';
import ConfirmModal from '../../components/admin/ConfirmModal';
import GiftPeriodModal from '../../components/admin/GiftPeriodModal';

interface FavoriteItem {
  id: string;
  establishments: {
    name: string;
    category: string;
    subcategory: string;
    logo_url: string | null;
  } | null;
}

interface MemberSidebarProps {
  memberId: string | null;
  onClose: () => void;
  onRefresh: () => void;
}

function formatRelativeDate(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return 'Il y a 1j';
  return `Il y a ${diff}j`;
}

function formatMemberSince(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  });
}

export default function MemberSidebar({ memberId, onClose, onRefresh }: MemberSidebarProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [messageCount, setMessageCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showAllFavs, setShowAllFavs] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const loadData = useCallback(async () => {
    if (!memberId) return;
    setLoading(true);
    try {
      const [profileRes, favRes, msgRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', memberId).single(),
        supabase.from('favorites').select('id, establishments(name, category, subcategory, logo_url)').eq('user_id', memberId),
        supabase.from('messages').select('*', { count: 'exact', head: true }).eq('sender_id', memberId),
      ]);
      setProfile(profileRes.data as Profile);
      setFavorites((favRes.data as FavoriteItem[]) || []);
      setMessageCount(msgRes.count ?? 0);
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors du chargement');
    }
    setLoading(false);
  }, [memberId]);

  useEffect(() => {
    if (memberId) {
      setShowAllFavs(false);
      loadData();
    }
  }, [memberId, loadData]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleDelete = async () => {
    if (!profile) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', profile.id);
      if (error) throw error;
      toast.success('Compte supprimé.');
      setDeleteOpen(false);
      onClose();
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    }
    setDeleting(false);
  };

  const handleRevokePremium = async () => {
    if (!profile) return;
    setRevoking(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_premium: false, premium_expires_at: null })
        .eq('id', profile.id);
      if (error) throw error;
      toast.success(`Premium revoque pour ${profile.prenom || profile.username}.`);
      setRevokeOpen(false);
      loadData();
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    }
    setRevoking(false);
  };

  const open = !!memberId;
  const visibleFavs = showAllFavs ? favorites : favorites.slice(0, 8);

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/50 z-[999] transition-opacity duration-[250ms] ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      <div
        className={`fixed top-0 right-0 h-screen z-[1000] w-full md:w-[420px] transition-transform duration-[250ms] ease-out flex flex-col ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ background: '#0f0f17', borderLeft: '1px solid #1e1e2e' }}
      >
        {loading ? (
          <div className="p-6 space-y-6 animate-pulse">
            <div className="flex items-center gap-4">
              <div className="w-[72px] h-[72px] rounded-full bg-[#1e1e2e]" />
              <div className="space-y-2 flex-1">
                <div className="h-5 w-1/2 bg-[#1e1e2e] rounded" />
                <div className="h-3 w-1/3 bg-[#1e1e2e] rounded" />
              </div>
            </div>
            <div className="h-16 bg-[#1e1e2e] rounded" />
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-[#1e1e2e] rounded-lg" />)}
            </div>
            <div className="h-8 bg-[#1e1e2e] rounded" />
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-[#1e1e2e] rounded" />)}
            </div>
          </div>
        ) : profile ? (
          <>
            <div className="flex-1 overflow-y-auto">
              <div style={{ background: '#14141e', borderBottom: '1px solid #1e1e2e' }} className="px-6 py-5">
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-semibold text-gray-900 dark:text-white">Profil du membre</span>
                  <button onClick={onClose} className="text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors">
                    <X size={18} />
                  </button>
                </div>
                <div className="flex items-center gap-4 mt-4">
                  <div className="w-[72px] h-[72px] rounded-full overflow-hidden flex items-center justify-center shrink-0" style={{ background: profile.avatar_url ? undefined : '#2d0d3d' }}>
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[#c084f5] text-2xl font-bold">
                        {profile.username?.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-[20px] font-bold text-gray-900 dark:text-white">{profile.username}</p>
                    {profile.is_premium ? (
                      <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: 'rgba(212,160,23,0.15)', color: '#d4a017', border: '1px solid rgba(212,160,23,0.3)' }}>
                        Premium
                      </span>
                    ) : (
                      <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium text-gray-500" style={{ background: '#1a1a24' }}>
                        Gratuit
                      </span>
                    )}
                    <p className="text-[12px] text-gray-500 mt-1">
                      Membre depuis {formatMemberSince(profile.created_at)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-6 py-5" style={{ borderBottom: '1px solid #1e1e2e' }}>
                {profile.bio ? (
                  <p className="text-[14px] italic text-[#a0a0b0] leading-[1.6]">{profile.bio}</p>
                ) : (
                  <p className="text-[13px] text-gray-600 italic">Aucune bio renseignée.</p>
                )}
              </div>

              <div className="px-6 py-5" style={{ borderBottom: '1px solid #1e1e2e' }}>
                <p className="text-[12px] uppercase tracking-[1px] text-[#606070] mb-3 font-medium">Activité</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center rounded-lg p-3" style={{ background: '#1a1a24' }}>
                    <p className="text-[20px] font-bold text-[#c084f5]">{favorites.length}</p>
                    <p className="text-[11px] text-gray-500">Favoris</p>
                  </div>
                  <div className="text-center rounded-lg p-3" style={{ background: '#1a1a24' }}>
                    <p className="text-[20px] font-bold text-[#c084f5]">{messageCount}</p>
                    <p className="text-[11px] text-gray-500">Messages</p>
                  </div>
                  <div className="text-center rounded-lg p-3" style={{ background: '#1a1a24' }}>
                    <p className="text-[14px] font-bold text-gray-900 dark:text-white">{formatRelativeDate(profile.last_active_at)}</p>
                    <p className="text-[11px] text-gray-500">Activité</p>
                  </div>
                </div>
              </div>

              <div className="px-6 py-5" style={{ borderBottom: '1px solid #1e1e2e' }}>
                <p className="text-[12px] uppercase tracking-[1px] text-[#606070] mb-3 font-medium">Centres d'intérêt</p>
                {profile.favorite_categories && profile.favorite_categories.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {profile.favorite_categories.map((cat) => (
                      <span
                        key={cat}
                        className="text-[12px] rounded-full px-3 py-1"
                        style={{
                          background: 'rgba(123,45,139,0.15)',
                          border: '1px solid rgba(123,45,139,0.3)',
                          color: '#c084f5',
                        }}
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[13px] text-gray-600 italic">Aucun centre d'intérêt renseigné.</p>
                )}
              </div>

              <div className="px-6 py-5" style={{ borderBottom: '1px solid #1e1e2e' }}>
                <p className="text-[12px] uppercase tracking-[1px] text-[#606070] mb-3 font-medium">Ses lieux favoris</p>
                {favorites.length > 0 ? (
                  <div>
                    {visibleFavs.map((fav, idx) => (
                      <div
                        key={fav.id}
                        className="flex items-center gap-3 py-2"
                        style={idx < visibleFavs.length - 1 ? { borderBottom: '1px solid #1e1e2e' } : undefined}
                      >
                        <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center shrink-0" style={{ background: '#2d0d3d' }}>
                          {fav.establishments?.logo_url ? (
                            <img src={fav.establishments.logo_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[#c084f5] text-xs font-bold">
                              {fav.establishments?.name?.charAt(0).toUpperCase() || '?'}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="text-[13px] font-semibold text-gray-900 dark:text-white">{fav.establishments?.name || 'Inconnu'}</p>
                          <p className="text-[11px] text-[#c084f5]">{fav.establishments?.category}</p>
                        </div>
                      </div>
                    ))}
                    {favorites.length > 8 && !showAllFavs && (
                      <button
                        onClick={() => setShowAllFavs(true)}
                        className="text-[13px] text-[#c084f5] hover:underline mt-2"
                      >
                        Voir tous les favoris ({favorites.length})
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-[13px] text-gray-600 italic">Aucun lieu favori pour l'instant.</p>
                )}
              </div>
            </div>

            <div className="shrink-0 px-6 py-5 space-y-3" style={{ background: '#14141e', borderTop: '1px solid #1e1e2e' }}>
              <p className="text-[12px] uppercase tracking-[1px] text-[#606070] mb-4 font-medium">Actions</p>

              <button
                onClick={() => setGiftOpen(true)}
                className="w-full py-3 rounded-lg text-[14px] font-semibold transition-colors hover:opacity-90 flex items-center justify-center gap-2"
                style={{ background: '#7B2D8B', color: '#fff' }}
              >
                <Gift size={16} />
                Offrir une periode Premium
              </button>

              {profile.is_premium && (
                <button
                  onClick={() => setRevokeOpen(true)}
                  className="w-full py-3 rounded-lg text-[14px] font-semibold transition-colors hover:opacity-90 flex items-center justify-center gap-2"
                  style={{ background: 'transparent', border: '1px solid #e67e22', color: '#e67e22' }}
                >
                  <ShieldOff size={16} />
                  Revoquer le Premium
                </button>
              )}

              <button
                onClick={() => setDeleteOpen(true)}
                className="w-full py-3 rounded-lg text-[14px] font-semibold transition-colors hover:opacity-90"
                style={{ background: 'transparent', border: '1px solid #c0392b', color: '#c0392b' }}
              >
                Supprimer le compte
              </button>
            </div>
          </>
        ) : null}
      </div>

      <ConfirmModal
        open={deleteOpen}
        title={`Supprimer le compte de ${profile?.username} ?`}
        message="Cette action est irréversible. Toutes les données de ce membre seront définitivement supprimées."
        confirmLabel="Supprimer définitivement"
        onCancel={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        loading={deleting}
      />

      <ConfirmModal
        open={revokeOpen}
        title={`Revoquer le Premium de ${profile?.prenom || profile?.username} ?`}
        message="Le membre perdra immediatement l'acces aux fonctionnalites Premium (messagerie, promotions, profil enrichi)."
        confirmLabel="Revoquer le Premium"
        onCancel={() => setRevokeOpen(false)}
        onConfirm={handleRevokePremium}
        loading={revoking}
      />

      {profile && (
        <GiftPeriodModal
          open={giftOpen}
          onClose={() => setGiftOpen(false)}
          onSuccess={() => { loadData(); onRefresh(); }}
          recipientId={profile.id}
          recipientName={profile.prenom || profile.username}
          recipientType="user"
          giftType="premium"
          currentlyActive={profile.is_premium}
          currentExpiry={profile.premium_expires_at ?? null}
        />
      )}
    </>
  );
}
