import { useEffect, useState } from 'react';
import { ExternalLink, Crown, Trash2, Download, Gift, Mail, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import ConfirmModal from '../../components/admin/ConfirmModal';

interface PartnerRow {
  id: string;
  name: string;
  is_pro: boolean;
  pro_expires_at: string | null;
  owner_id: string;
  owner_username: string;
}

export default function AdminPartners() {
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<PartnerRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [giftTarget, setGiftTarget] = useState<PartnerRow | null>(null);
  const [giftMonths, setGiftMonths] = useState(1);
  const [gifting, setGifting] = useState(false);

  // Message aux établissements inscrits (demande Kevin).
  const [msgTarget, setMsgTarget] = useState<'all' | 'pro' | 'free'>('all');
  const [msgSubject, setMsgSubject] = useState('');
  const [msgBody, setMsgBody] = useState('');
  const [msgCount, setMsgCount] = useState<number | null>(null);
  const [msgSending, setMsgSending] = useState(false);
  const [msgConfirm, setMsgConfirm] = useState(false);

  useEffect(() => {
    supabase.functions.invoke('pros-message', { body: { mode: 'count', target: msgTarget } })
      .then(({ data }) => setMsgCount(data && !data.error ? data.recipients : null));
  }, [msgTarget]);

  const sendMessage = async () => {
    setMsgSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('pros-message', {
        body: { mode: 'send', target: msgTarget, subject: msgSubject.trim(), message: msgBody.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`${data.sent}/${data.recipients} message(s) envoyé(s)`);
      setMsgSubject(''); setMsgBody(''); setMsgConfirm(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
    setMsgSending(false);
  };

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('establishments')
        .select('id, name, is_pro, pro_expires_at, owner_id, owner:profiles!establishments_owner_id_fkey(username)')
        .not('owner_id', 'is', null)
        .order('created_at', { ascending: false });

      const rows: PartnerRow[] = (data || []).map((d: any) => ({
        id: d.id,
        name: d.name,
        is_pro: d.is_pro,
        pro_expires_at: d.pro_expires_at,
        owner_id: d.owner_id,
        owner_username: d.owner?.username || 'Inconnu',
      }));
      setPartners(rows);
    } catch { /* handled */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const proCount = partners.filter((p) => p.is_pro).length;
  const estimatedRevenue = proCount * 690;

  const activatePro = async (id: string) => {
    try {
      const { error } = await supabase.from('establishments').update({
        is_pro: true,
        pro_expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      }).eq('id', id);
      if (error) throw error;
      toast.success('Pro active !');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const handleGiftMonths = async () => {
    if (!giftTarget) return;
    setGifting(true);
    try {
      const baseDate = giftTarget.pro_expires_at
        ? new Date(Math.max(new Date(giftTarget.pro_expires_at).getTime(), Date.now()))
        : new Date();
      const newExpiry = new Date(baseDate.getTime() + giftMonths * 30 * 24 * 60 * 60 * 1000);

      const { error } = await supabase.from('establishments').update({
        is_pro: true,
        pro_expires_at: newExpiry.toISOString(),
      }).eq('id', giftTarget.id);
      if (error) throw error;
      toast.success(`${giftMonths} mois offert${giftMonths > 1 ? 's' : ''} !`);
      setGiftTarget(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
    setGifting(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('establishments').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      toast.success('Etablissement supprime');
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
    setDeleting(false);
  };

  const exportCSV = () => {
    const header = 'Etablissement,Proprietaire,Statut,Expiration Pro\n';
    const rows = partners.map((p) =>
      `"${p.name}","${p.owner_username}","${p.is_pro ? 'Pro' : 'Gratuit'}","${p.pro_expires_at || '-'}"`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'partenaires.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('fr-FR') : '-';

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-20 rounded-card" />
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-16 rounded-card" />)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Partenaires</h1>
        <button onClick={exportCSV} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors border border-light-border dark:border-dark-border rounded-input px-3 py-2">
          <Download size={15} /> Export CSV
        </button>
      </div>

      <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card p-5">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Revenu annuel estime</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{estimatedRevenue} EUR</p>
        <p className="text-xs text-gray-500 mt-1">{proCount} etablissement{proCount > 1 ? 's' : ''} Pro x 690 EUR/an</p>
      </div>

      {/* Message aux établissements inscrits */}
      <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Mail size={17} className="text-primary" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Envoyer un message aux établissements inscrits</h2>
        </div>
        <p className="text-xs text-gray-500 -mt-1">Un e-mail part vers les établissements qui ont créé un compte, à l'adresse de leur compte.</p>

        <div className="flex items-center gap-2 flex-wrap">
          {([['all', 'Tous les inscrits'], ['pro', 'Pro uniquement'], ['free', 'Gratuits uniquement']] as const).map(([v, label]) => (
            <button key={v} onClick={() => setMsgTarget(v)}
              className={`px-3 py-1.5 rounded-input text-sm font-medium border transition-colors ${msgTarget === v ? 'bg-primary/15 text-primary border-primary/40' : 'text-gray-500 border-light-border dark:border-dark-border hover:text-gray-900 dark:hover:text-white'}`}>
              {label}
            </button>
          ))}
          <span className="text-xs text-gray-500 ml-1">
            {msgCount === null ? '…' : <><strong className="text-gray-900 dark:text-white">{msgCount}</strong> destinataire{msgCount > 1 ? 's' : ''}</>}
          </span>
        </div>

        <input value={msgSubject} onChange={(e) => setMsgSubject(e.target.value)} placeholder="Objet de l'e-mail"
          className="w-full px-3 py-2 text-sm rounded-input bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border text-gray-900 dark:text-white focus:outline-none focus:border-primary" />
        <textarea value={msgBody} onChange={(e) => setMsgBody(e.target.value)} rows={5} placeholder="Votre message… (une ligne vide = un nouveau paragraphe)"
          className="w-full px-3 py-2 text-sm rounded-input bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border text-gray-900 dark:text-white focus:outline-none focus:border-primary resize-y" />

        <div className="flex items-center justify-end">
          <button onClick={() => setMsgConfirm(true)} disabled={!msgSubject.trim() || !msgBody.trim() || !msgCount || msgSending}
            className="btn-primary text-sm flex items-center gap-1.5 py-2 px-4 disabled:opacity-50">
            {msgSending ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />} Envoyer{msgCount ? ` à ${msgCount}` : ''}
          </button>
        </div>
      </div>

      {partners.length === 0 ? (
        <p className="text-center text-gray-500 py-12">Aucun partenaire.</p>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-gray-500 text-xs uppercase tracking-wide border-b border-light-border dark:border-dark-border">
                  <th className="py-3 px-3">Etablissement</th>
                  <th className="py-3 px-3">Proprietaire</th>
                  <th className="py-3 px-3">Statut</th>
                  <th className="py-3 px-3">Expiration</th>
                  <th className="py-3 px-3">Valeur</th>
                  <th className="py-3 px-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {partners.map((p) => (
                  <tr key={p.id} className="border-b border-light-border dark:border-dark-border/50 hover:bg-light-surface dark:bg-dark-surface/50">
                    <td className="py-2.5 px-3 text-gray-900 dark:text-white font-medium">{p.name}</td>
                    <td className="py-2.5 px-3 text-gray-400">{p.owner_username}</td>
                    <td className="py-2.5 px-3">{p.is_pro ? <span className="badge-pro text-xs">Pro</span> : <span className="badge text-xs bg-gray-700 text-gray-400">Gratuit</span>}</td>
                    <td className="py-2.5 px-3 text-gray-500 text-xs">{p.is_pro ? formatDate(p.pro_expires_at) : '-'}</td>
                    <td className="py-2.5 px-3 text-gray-400">{p.is_pro ? '690 EUR/an' : '0 EUR'}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1">
                        <a href={`/establishment/${p.id}`} target="_blank" rel="noopener noreferrer" className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white"><ExternalLink size={15} /></a>
                        {!p.is_pro && <button onClick={() => activatePro(p.id)} title="Activer Pro" className="p-1.5 text-gray-500 hover:text-primary"><Crown size={15} /></button>}
                        <button onClick={() => { setGiftTarget(p); setGiftMonths(1); }} title="Offrir des mois" className="p-1.5 text-gray-500 hover:text-amber-400"><Gift size={15} /></button>
                        <button onClick={() => setDeleteTarget(p)} className="p-1.5 text-gray-500 hover:text-alert"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-3">
            {partners.map((p) => (
              <div key={p.id} className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{p.name}</p>
                  {p.is_pro ? <span className="badge-pro text-xs">Pro</span> : <span className="badge text-xs bg-gray-700 text-gray-400">Gratuit</span>}
                </div>
                <p className="text-xs text-gray-500">Proprietaire : {p.owner_username}</p>
                {p.is_pro && <p className="text-xs text-gray-500">Expiration : {formatDate(p.pro_expires_at)}</p>}
                <div className="flex items-center justify-end gap-1">
                  <a href={`/establishment/${p.id}`} target="_blank" rel="noopener noreferrer" className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white"><ExternalLink size={15} /></a>
                  {!p.is_pro && <button onClick={() => activatePro(p.id)} className="p-1.5 text-gray-500 hover:text-primary"><Crown size={15} /></button>}
                  <button onClick={() => { setGiftTarget(p); setGiftMonths(1); }} className="p-1.5 text-gray-500 hover:text-amber-400"><Gift size={15} /></button>
                  <button onClick={() => setDeleteTarget(p)} className="p-1.5 text-gray-500 hover:text-alert"><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <ConfirmModal
        open={msgConfirm}
        title="Envoyer le message"
        message={`Envoyer « ${msgSubject} » à ${msgCount} établissement${(msgCount || 0) > 1 ? 's' : ''} inscrit${(msgCount || 0) > 1 ? 's' : ''} ? L'e-mail part immédiatement.`}
        confirmLabel="Envoyer"
        onCancel={() => setMsgConfirm(false)}
        onConfirm={sendMessage}
        loading={msgSending}
      />

      <ConfirmModal
        open={!!deleteTarget}
        title="Supprimer l'etablissement"
        message={`Supprimer definitivement "${deleteTarget?.name}" ?`}
        confirmLabel="Supprimer"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
      />

      {giftTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setGiftTarget(null)} />
          <div className="relative bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card p-6 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Offrir des mois Pro</h2>
            <p className="text-sm text-gray-400">Etablissement : <span className="text-gray-900 dark:text-white">{giftTarget.name}</span></p>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Nombre de mois</label>
              <input
                type="number"
                min={1}
                max={24}
                value={giftMonths}
                onChange={(e) => setGiftMonths(Math.max(1, parseInt(e.target.value) || 1))}
                className="input-field bg-light-bg dark:bg-dark-bg border-light-border dark:border-dark-border text-gray-900 dark:text-white w-32"
              />
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button onClick={() => setGiftTarget(null)} className="flex-1 py-2.5 rounded-input border border-light-border dark:border-dark-border text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm font-medium transition-colors">Annuler</button>
              <button onClick={handleGiftMonths} disabled={gifting} className="flex-1 btn-primary text-sm py-2.5">{gifting ? 'En cours...' : 'Offrir'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
