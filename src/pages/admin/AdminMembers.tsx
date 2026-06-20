import { useEffect, useState } from 'react';
import { Search, X, Eye, Trash2, ShieldCheck, Plus } from 'lucide-react';
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
  const [cityFilter, setCityFilter] = useState('all');
  const [cities, setCities] = useState<string[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [premiumCount, setPremiumCount] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      let query = supabase.from('profiles').select('*', { count: 'exact' }).order('created_at', { ascending: false });
      if (premiumFilter === 'premium') query = query.eq('is_premium', true);
      if (premiumFilter === 'free') query = query.eq('is_premium', false);
      if (cityFilter !== 'all') query = query.eq('city', cityFilter);
      if (search) query = query.or(`username.ilike.%${search}%,email.ilike.%${search}%,prenom.ilike.%${search}%,nom.ilike.%${search}%`);

      const { data, count } = await query;
      setMembers((data as Profile[]) || []);
      setTotalCount(count ?? 0);

      const { count: pc } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_premium', true);
      setPremiumCount(pc ?? 0);
    } catch { /* handled */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, [premiumFilter, cityFilter, search]);

  useEffect(() => {
    supabase.from('profiles').select('city').then(({ data }) => {
      setCities([...new Set((data || []).map((r: { city: string | null }) => r.city).filter(Boolean) as string[])].sort());
    });
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      toast.error(`Compte de ${deleteTarget.username} supprime.`);
      setDeleteTarget(null);
      load();
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    }
    setDeleting(false);
  };

  const toggleVerified = async (member: Profile) => {
    const newVal = !(member as any).is_verified;
    const { error } = await supabase.from('profiles').update({ is_verified: newVal }).eq('id', member.id);
    if (error) {
      toast.error('Erreur');
      return;
    }
    toast.success(newVal ? 'Compte verifie' : 'Verification retiree');
    load();
  };

  const pct = totalCount > 0 ? Math.round((premiumCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Membres</h1>
        <button onClick={() => setShowCreate(true)} className="btn-primary text-sm flex items-center gap-1.5 py-2 px-4">
          <Plus size={16} /> Creer un membre
        </button>
      </div>

      <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card p-4">
        <p className="text-sm text-gray-400">
          <span className="text-primary font-semibold">{premiumCount}</span> membres Premium sur{' '}
          <span className="text-gray-900 dark:text-white font-semibold">{totalCount}</span> total ({pct}%)
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select value={premiumFilter} onChange={(e) => setPremiumFilter(e.target.value)} className="input-field bg-light-surface dark:bg-dark-surface border-light-border dark:border-dark-border text-gray-900 dark:text-white text-sm w-auto py-2">
          <option value="all">Tous</option>
          <option value="premium">Premium</option>
          <option value="free">Gratuit</option>
        </select>
        {cities.length > 0 && (
          <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} className="input-field bg-light-surface dark:bg-dark-surface border-light-border dark:border-dark-border text-gray-900 dark:text-white text-sm w-auto py-2">
            <option value="all">Toutes les villes</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher par nom, prenom ou email..." className="input-field bg-light-surface dark:bg-dark-surface border-light-border dark:border-dark-border text-gray-900 dark:text-white text-sm pl-9 py-2" />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-900 dark:hover:text-white"><X size={14} /></button>}
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
                <tr className="text-gray-500 text-xs uppercase tracking-wide border-b border-light-border dark:border-dark-border">
                  <th className="py-3 px-3">Avatar</th>
                  <th className="py-3 px-3">Prenom</th>
                  <th className="py-3 px-3">Nom</th>
                  <th className="py-3 px-3">Email</th>
                  <th className="py-3 px-3">Premium</th>
                  <th className="py-3 px-3">Verifie</th>
                  <th className="py-3 px-3">Inscrit le</th>
                  <th className="py-3 px-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-b border-light-border dark:border-dark-border/50 hover:bg-light-surface dark:bg-dark-surface/50">
                    <td className="py-2.5 px-3">
                      <div className="w-8 h-8 rounded-full bg-primary/20 overflow-hidden flex items-center justify-center">
                        {m.avatar_url ? <img src={m.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-primary text-xs font-medium">{((m as any).prenom || m.username)?.charAt(0).toUpperCase()}</span>}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-gray-900 dark:text-white font-medium">{(m as any).prenom || '-'}</td>
                    <td className="py-2.5 px-3 text-gray-900 dark:text-white font-medium">{(m as any).nom || '-'}</td>
                    <td className="py-2.5 px-3 text-[13px] text-[#a0a0b0] max-w-[180px] truncate">{(m as any).email || '-'}</td>
                    <td className="py-2.5 px-3">{m.is_premium ? <span className="badge-sponsor text-xs">Premium</span> : <span className="text-gray-500 text-xs">Gratuit</span>}</td>
                    <td className="py-2.5 px-3">
                      <button
                        onClick={() => toggleVerified(m)}
                        className={`w-10 h-5 rounded-full transition-colors relative ${(m as any).is_verified ? 'bg-emerald-500' : 'bg-dark-border'}`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${(m as any).is_verified ? 'left-5' : 'left-0.5'}`} />
                      </button>
                    </td>
                    <td className="py-2.5 px-3 text-gray-500 text-xs">{new Date(m.created_at).toLocaleDateString('fr-FR')}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setSelectedId(m.id)} title="Voir le profil" className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors">
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
              <div key={m.id} className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 overflow-hidden flex items-center justify-center shrink-0">
                    {m.avatar_url ? <img src={m.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-primary text-sm font-medium">{((m as any).prenom || m.username)?.charAt(0).toUpperCase()}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{(m as any).prenom || ''} {(m as any).nom || ''}</p>
                    <p className="text-xs text-gray-500 truncate">{(m as any).email || '-'}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {(m as any).is_verified && <ShieldCheck size={14} className="text-emerald-500" />}
                    {m.is_premium && <span className="badge-sponsor text-xs">Premium</span>}
                    <button onClick={() => setSelectedId(m.id)} className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors">
                      <Eye size={16} />
                    </button>
                    <button onClick={() => setDeleteTarget(m)} className="p-1.5 text-gray-500 hover:text-alert transition-colors">
                      <Trash2 size={15} />
                    </button>
                  </div>
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

      {showCreate && <CreateMemberModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
    </div>
  );
}

function CreateMemberModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!email || !username || !password) {
      toast.error('Tous les champs sont requis');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username } },
      });
      if (error) throw error;
      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          username,
          email,
        });
      }
      toast.success('Membre cree !');
      onCreated();
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card p-6 w-full max-w-md space-y-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Creer un membre</h2>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field bg-light-bg dark:bg-dark-bg border-light-border dark:border-dark-border text-gray-900 dark:text-white" />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Username</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} className="input-field bg-light-bg dark:bg-dark-bg border-light-border dark:border-dark-border text-gray-900 dark:text-white" />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Mot de passe</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input-field bg-light-bg dark:bg-dark-bg border-light-border dark:border-dark-border text-gray-900 dark:text-white" />
        </div>
        <div className="flex items-center gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-input border border-light-border dark:border-dark-border text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm font-medium transition-colors">Annuler</button>
          <button onClick={handleCreate} disabled={loading} className="flex-1 btn-primary text-sm py-2.5">{loading ? 'Creation...' : 'Creer'}</button>
        </div>
      </div>
    </div>
  );
}
