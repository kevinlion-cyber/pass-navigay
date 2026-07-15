import { useEffect, useState } from 'react';
import { BadgeCheck, Check, X, ExternalLink, MapPin, RefreshCw, Loader2, Search, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import ConfirmModal from '../../components/admin/ConfirmModal';

interface Claim {
  id: string;
  establishment_id: string;
  email: string;
  claimant_profile_id: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  establishments?: { name: string; city: string } | null;
  profiles?: { username: string | null; email: string | null } | null;
}

type Tab = 'pending' | 'approved' | 'rejected';

export default function AdminClaims() {
  const { profile } = useAuth();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('pending');
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<Claim | null>(null);
  const [stats, setStats] = useState<{ total: number; with_site: number; with_email: number; sendable: number; need_discovery: number } | null>(null);
  const [outreachBusy, setOutreachBusy] = useState<'' | 'discover' | 'send'>('');

  const loadStats = async () => {
    const { data } = await supabase.functions.invoke('pros-outreach', { body: { mode: 'stats' } });
    if (data && !data.error) setStats(data);
  };
  const runOutreach = async (mode: 'discover' | 'send') => {
    setOutreachBusy(mode);
    try {
      const { data, error } = await supabase.functions.invoke('pros-outreach', { body: { mode, limit: 30 } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (mode === 'discover') toast.success(`${data.found} email(s) trouvé(s) sur ${data.scanned} sites`);
      else toast.success(`${data.sent} relance(s) envoyée(s)`);
      loadStats();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
    setOutreachBusy('');
  };

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('establishment_claims')
      .select('*, establishments(name, city), profiles:claimant_profile_id(username, email)')
      .eq('status', tab)
      .order('created_at', { ascending: false });
    setClaims((data as Claim[]) || []);
    setLoading(false);
  };
  const loadCounts = async () => {
    const { data } = await supabase.from('establishment_claims').select('status');
    setCounts(((data as { status: string }[]) || []).reduce((a, r) => { a[r.status] = (a[r.status] || 0) + 1; return a; }, {} as Record<string, number>));
  };

  useEffect(() => { load(); }, [tab]);
  useEffect(() => { loadCounts(); loadStats(); }, []);

  const approve = async (c: Claim) => {
    setBusy(true);
    try {
      const { error: e1 } = await supabase.from('establishments').update({ owner_id: c.claimant_profile_id }).eq('id', c.establishment_id);
      if (e1) throw e1;
      if (c.claimant_profile_id) await supabase.from('profiles').update({ account_type: 'pro' }).eq('id', c.claimant_profile_id);
      const { error: e3 } = await supabase.from('establishment_claims').update({ status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: profile?.id ?? null }).eq('id', c.id);
      if (e3) throw e3;
      toast.success('Revendication validée — la fiche est attribuée');
      load(); loadCounts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
    setBusy(false);
  };

  const reject = async () => {
    if (!rejectTarget) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('establishment_claims').update({ status: 'rejected', reviewed_at: new Date().toISOString(), reviewed_by: profile?.id ?? null }).eq('id', rejectTarget.id);
      if (error) throw error;
      toast.success('Revendication refusée');
      setRejectTarget(null);
      load(); loadCounts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
    setBusy(false);
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'pending', label: `À valider${counts.pending ? ` (${counts.pending})` : ''}` },
    { key: 'approved', label: 'Validées' },
    { key: 'rejected', label: 'Refusées' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <BadgeCheck size={20} style={{ color: '#7B2D8B' }} />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Revendications</h1>
        </div>
        <button onClick={() => { load(); loadCounts(); }} className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
          <RefreshCw size={15} /> Rafraîchir
        </button>
      </div>
      <p className="text-sm text-gray-500 -mt-2">Un propriétaire a demandé à gérer sa fiche. Validez pour lui en attribuer la gestion (il pourra ensuite passer Pro).</p>

      {/* Relance propriétaires */}
      <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Relance des propriétaires</h2>
          {stats && (
            <span className="text-xs text-gray-500">
              {stats.with_email} email(s) trouvé(s) · <strong className="text-gray-900 dark:text-white">{stats.sendable}</strong> à relancer · {stats.need_discovery} sites à scanner
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500">On récupère l'email de contact sur le site web des établissements, puis on leur envoie l'invitation à revendiquer leur page (par lot, tu déclenches).</p>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => runOutreach('discover')} disabled={!!outreachBusy} className="text-sm flex items-center gap-1.5 py-2 px-4 border border-light-border dark:border-dark-border rounded-input text-gray-700 dark:text-gray-300 hover:border-primary disabled:opacity-60">
            {outreachBusy === 'discover' ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Découvrir les emails{stats?.need_discovery ? ` (${stats.need_discovery})` : ''}
          </button>
          <button onClick={() => runOutreach('send')} disabled={!!outreachBusy || !stats?.sendable} className="btn-primary text-sm flex items-center gap-1.5 py-2 px-4 disabled:opacity-50">
            {outreachBusy === 'send' ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />} Envoyer la relance{stats?.sendable ? ` (${stats.sendable})` : ''}
          </button>
        </div>
      </div>

      <div className="flex gap-1 bg-light-surface dark:bg-dark-surface p-1 rounded-input border border-light-border dark:border-dark-border w-fit">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${tab === t.key ? 'bg-primary/15 text-primary' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>{t.label}</button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="skeleton h-20 rounded-card" />)}</div>
      ) : claims.length === 0 ? (
        <p className="text-center text-gray-500 py-12">Aucune revendication dans cet onglet.</p>
      ) : (
        <div className="space-y-3">
          {claims.map((c) => (
            <div key={c.id} className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card p-4 flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-900 dark:text-white">{c.establishments?.name || 'Établissement'}</span>
                  <a href={`/establishment/${c.establishment_id}`} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-primary"><ExternalLink size={13} /></a>
                </div>
                <p className="text-xs text-gray-500 flex items-center gap-2 flex-wrap mt-0.5">
                  <span className="inline-flex items-center gap-1"><MapPin size={11} /> {c.establishments?.city}</span>
                  <span>Demandeur : {c.profiles?.username || '—'} · <strong>{c.profiles?.email || c.email}</strong></span>
                  <span>{new Date(c.created_at).toLocaleDateString('fr-FR')}</span>
                </p>
              </div>
              {c.status === 'pending' && (
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => approve(c)} disabled={busy} className="btn-primary text-sm flex items-center gap-1.5 py-1.5 px-3 disabled:opacity-60"><Check size={15} /> Valider</button>
                  <button onClick={() => setRejectTarget(c)} title="Refuser" className="p-2 text-gray-500 hover:text-alert transition-colors border border-light-border dark:border-dark-border rounded-input"><X size={15} /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmModal open={!!rejectTarget} title="Refuser la revendication" message={`Refuser la demande pour "${rejectTarget?.establishments?.name}" ?`} confirmLabel="Refuser" onCancel={() => setRejectTarget(null)} onConfirm={reject} loading={busy} />
    </div>
  );
}
