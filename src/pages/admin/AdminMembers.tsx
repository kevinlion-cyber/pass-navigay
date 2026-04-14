import { useEffect, useState } from 'react';
import { Search, X, Eye, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import type { Profile } from '../../lib/types';
import MemberSidebar from './MemberSidebar';
import ConfirmModal from '../../components/admin/ConfirmModal';

export default function AdminMembers() {
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [premiumFilter, setPremiumFilter] = useState('all');
  const [totalCount, setTotalCount] = useState(0);
  const [premiumCount, setPremiumCount] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      let query = supabase.from('profiles').select('*', { count: 'exact' }).order('created_at', { ascending: false });
      if (premiumFilter === 'premium') query = query.eq('is_premium', true);
      if (premiumFilter === 'free') query = query.eq('is_premium', false);
      if (search) query = query.ilike('username', `%${search}%`);

      const { data, count } = await query;
      setMembers((data as Profile[]) || []);
      setTotalCount(count ?? 0);

      const { count: pc } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_premium', true);
      setPremiumCount(pc ?? 0);
    } catch { /* handled */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, [premiumFilter, search]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      toast.error(`Compte de ${deleteTarget.username} supprimé.`);
      setDeleteTarget(null);
      load();
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    }
    setDeleting(false);
  };

  const truncateId = (id: string) => id.substring(0, 8) + '...';
  const pct = totalCount > 0 ? Math.round((premiumCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-white">Membres</h1>

      <div className="bg-dark-surface border border-dark-border rounded-card p-4">
        <p className="text-sm text-gray-400">
          <span className="text-primary font-semibold">{premiumCount}</span> membres Premium sur{' '}
          <span className="text-white font-semibold">{totalCount}</span> total ({pct}%)
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select value={premiumFilter} onChange={(e) => setPremiumFilter(e.target.value)} className="input-field bg-dark-surface border-dark-border text-white text-sm w-auto py-2">
          <option value="all">Tous</option>
          <option value="premium">Premium</option>
          <option value="free">Gratuit</option>
        </select>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher par username..." className="input-field bg-dark-surface border-dark-border text-white text-sm pl-9 py-2" />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"><X size={14} /></button>}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton h-16 rounded-card" />)}</div>
      ) : members.length === 0 ? (
        <p className="text-center text-gray-500 py-12">Aucun membre trouve.</p>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-gray-500 text-xs uppercase tracking-wide border-b border-dark-border">
                  <th className="py-3 px-3">Avatar</th>
                  <th className="py-3 px-3">Username</th>
                  <th className="py-3 px-3">Email</th>
                  <th className="py-3 px-3">Premium</th>
                  <th className="py-3 px-3">Inscrit le</th>
                  <th className="py-3 px-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-b border-dark-border/50 hover:bg-dark-surface/50">
                    <td className="py-2.5 px-3">
                      <div className="w-8 h-8 rounded-full bg-primary/20 overflow-hidden flex items-center justify-center">
                        {m.avatar_url ? <img src={m.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-primary text-xs font-medium">{m.username?.charAt(0).toUpperCase()}</span>}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-white font-medium">{m.username}</td>
                    <td className="py-2.5 px-3 text-[13px] text-[#a0a0b0] max-w-[180px] truncate">{truncateId(m.id)}</td>
                    <td className="py-2.5 px-3">{m.is_premium ? <span className="badge-sponsor text-xs">Premium</span> : <span className="text-gray-500 text-xs">Gratuit</span>}</td>
                    <td className="py-2.5 px-3 text-gray-500 text-xs">{new Date(m.created_at).toLocaleDateString('fr-FR')}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setSelectedId(m.id)} title="Voir le profil" className="p-1.5 text-gray-500 hover:text-white transition-colors">
                          <Eye size={16} />
                        </button>
                        <button onClick={() => setDeleteTarget(m)} title="Supprimer" className="p-1.5 text-gray-500 hover:text-alert transition-colors">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-3">
            {members.map((m) => (
              <div key={m.id} className="bg-dark-surface border border-dark-border rounded-card p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 overflow-hidden flex items-center justify-center shrink-0">
                    {m.avatar_url ? <img src={m.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-primary text-sm font-medium">{m.username?.charAt(0).toUpperCase()}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{m.username}</p>
                    <p className="text-xs text-gray-500">{new Date(m.created_at).toLocaleDateString('fr-FR')}</p>
                  </div>
                  {m.is_premium && <span className="badge-sponsor text-xs shrink-0">Premium</span>}
                  <button onClick={() => setSelectedId(m.id)} className="p-1.5 text-gray-500 hover:text-white transition-colors shrink-0">
                    <Eye size={16} />
                  </button>
                  <button onClick={() => setDeleteTarget(m)} className="p-1.5 text-gray-500 hover:text-alert transition-colors shrink-0">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <MemberSidebar
        memberId={selectedId}
        onClose={() => setSelectedId(null)}
        onRefresh={load}
      />

      <ConfirmModal
        open={!!deleteTarget}
        title={`Supprimer le compte de ${deleteTarget?.username} ?`}
        message="Cette action est irreversible. Toutes les donnees de ce membre seront definitivement supprimees."
        confirmLabel="Supprimer definitivement"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}
