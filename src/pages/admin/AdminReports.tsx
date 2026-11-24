import { useEffect, useState } from 'react';
import { Flag, RefreshCw, Check, X, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { REPORT_REASONS } from '../../lib/moderation';

// Signalements de membres (E4, 24/11/2026). Lecture et traitement réservés aux
// admins par la base. Les « preuves » sont les derniers messages échangés entre
// les deux membres, capturés par le serveur au moment du signalement.

interface PersonRef { username: string | null; prenom: string | null; email: string | null }
interface Report {
  id: string;
  reporter_id: string | null;
  reported_id: string | null;
  reason: string;
  details: string | null;
  evidence: { auteur: 'signaleur' | 'signale'; contenu: string; created_at: string }[] | null;
  context: 'profil' | 'conversation' | null;
  status: 'open' | 'resolved' | 'dismissed';
  admin_note: string | null;
  created_at: string;
  handled_at: string | null;
  reporter: PersonRef | null;
  reported: PersonRef | null;
}

type Tab = 'open' | 'resolved' | 'dismissed';

const reasonLabel = (r: string) => REPORT_REASONS.find((x) => x.value === r)?.label ?? r;
const who = (p: PersonRef | null) => (p ? (p.prenom || p.username || 'Membre') : 'Compte supprimé');
const fmt = (d: string) => new Date(d).toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function AdminReports() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>('open');
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCount, setOpenCount] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('user_reports')
      .select('*, reporter:profiles!user_reports_reporter_id_fkey(username, prenom, email), reported:profiles!user_reports_reported_id_fkey(username, prenom, email)')
      .eq('status', tab)
      .order('created_at', { ascending: false });
    if (error) toast.error('Les signalements n’ont pas pu être chargés.');
    setReports((data as Report[]) || []);
    setLoading(false);
  };
  const loadCount = async () => {
    const { count } = await supabase.from('user_reports').select('id', { count: 'exact', head: true }).eq('status', 'open');
    setOpenCount(count || 0);
  };

  useEffect(() => { load(); }, [tab]);
  useEffect(() => { loadCount(); }, []);

  const handle = async (r: Report, status: 'resolved' | 'dismissed') => {
    setBusyId(r.id);
    const { error } = await supabase.from('user_reports').update({
      status,
      admin_note: (notes[r.id] ?? r.admin_note ?? '').trim() || null,
      handled_at: new Date().toISOString(),
      handled_by: profile?.id ?? null,
    }).eq('id', r.id);
    setBusyId(null);
    if (error) { toast.error('Mise à jour impossible.'); return; }
    toast.success(status === 'resolved' ? 'Signalement marqué comme traité' : 'Signalement classé sans suite');
    load(); loadCount();
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'open', label: `À traiter${openCount ? ` (${openCount})` : ''}` },
    { key: 'resolved', label: 'Traités' },
    { key: 'dismissed', label: 'Sans suite' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Flag size={20} style={{ color: '#7B2D8B' }} />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Signalements</h1>
        </div>
        <button onClick={() => { load(); loadCount(); }} className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
          <RefreshCw size={15} /> Rafraîchir
        </button>
      </div>
      <p className="text-sm text-gray-500 -mt-2">
        Un membre en a signalé un autre. Le membre signalé n’est pas prévenu. Pour supprimer un compte, passez par la rubrique Membres.
      </p>

      <div className="flex gap-1 bg-light-surface dark:bg-dark-surface p-1 rounded-input border border-light-border dark:border-dark-border w-fit">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${tab === t.key ? 'bg-primary/15 text-primary' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>{t.label}</button>
        ))}
      </div>

      {loading && <p className="text-sm text-gray-500 flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Chargement…</p>}
      {!loading && reports.length === 0 && <p className="text-sm text-gray-500">Aucun signalement ici.</p>}

      <div className="space-y-3">
        {reports.map((r) => {
          const isOpen = expanded === r.id;
          const urgent = r.reason === 'mineur' || r.reason === 'harcelement';
          return (
            <div key={r.id} className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${urgent ? 'bg-alert/15 text-alert' : 'bg-primary/10 text-primary'}`}>{reasonLabel(r.reason)}</span>
                    <span className="text-xs text-gray-500">{fmt(r.created_at)} · depuis {r.context === 'conversation' ? 'une conversation' : 'un profil'}</span>
                  </div>
                  <p className="text-sm text-gray-900 dark:text-white">
                    <strong>{who(r.reported)}</strong>
                    {r.reported?.email && <span className="text-gray-500"> ({r.reported.email})</span>}
                    <span className="text-gray-500"> signalé·e par </span>
                    {who(r.reporter)}
                    {r.reporter?.email && <span className="text-gray-500"> ({r.reporter.email})</span>}
                  </p>
                  {r.details && <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">« {r.details} »</p>}
                </div>
                <button onClick={() => setExpanded(isOpen ? null : r.id)} className="text-xs flex items-center gap-1 text-gray-500 hover:text-gray-900 dark:hover:text-white">
                  {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Messages joints ({r.evidence?.length ?? 0})
                </button>
              </div>

              {isOpen && (
                <div className="rounded-input bg-light-bg dark:bg-dark-bg p-3 space-y-2 max-h-72 overflow-y-auto">
                  {(r.evidence ?? []).length === 0 && <p className="text-xs text-gray-500">Aucun message échangé entre ces deux membres.</p>}
                  {(r.evidence ?? []).map((m, i) => (
                    <div key={i} className={`text-sm ${m.auteur === 'signale' ? 'text-alert' : 'text-gray-700 dark:text-gray-300'}`}>
                      <span className="text-xs text-gray-500">{fmt(m.created_at)} · {m.auteur === 'signale' ? who(r.reported) : who(r.reporter)} :</span>{' '}
                      <span className="whitespace-pre-wrap">{m.contenu}</span>
                    </div>
                  ))}
                </div>
              )}

              {r.status === 'open' ? (
                <div className="space-y-2">
                  <input
                    value={notes[r.id] ?? ''}
                    onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                    placeholder="Note interne (facultatif) : ce que vous avez fait"
                    className="w-full px-3 py-2 rounded-input text-sm bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:border-primary"
                  />
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => handle(r, 'resolved')} disabled={busyId === r.id} className="btn-primary text-sm flex items-center gap-1.5 py-2 px-4 disabled:opacity-50">
                      <Check size={15} /> Marquer comme traité
                    </button>
                    <button onClick={() => handle(r, 'dismissed')} disabled={busyId === r.id} className="text-sm flex items-center gap-1.5 py-2 px-4 border border-light-border dark:border-dark-border rounded-input text-gray-700 dark:text-gray-300 hover:border-primary disabled:opacity-50">
                      <X size={15} /> Classer sans suite
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-500">
                  {r.status === 'resolved' ? 'Traité' : 'Classé sans suite'}{r.handled_at ? ` le ${fmt(r.handled_at)}` : ''}{r.admin_note ? ` — ${r.admin_note}` : ''}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
