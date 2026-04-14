import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import type { Establishment, Promotion } from '../../lib/types';
import ProGate from '../../components/partner/ProGate';
import ConfirmModal from '../../components/admin/ConfirmModal';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

interface PartnerContext {
  establishment: Establishment;
}

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

const EMPTY = {
  title: '', description: '', promo_type: 'percentage' as const, value: 0,
  valid_from: '', valid_until: '', is_recurring: false, recurrence_rule: '',
  max_uses: null as number | null, image_url: '',
};

export default function PartnerPromotions() {
  const { establishment } = useOutletContext<PartnerContext>();
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [unlimited, setUnlimited] = useState(true);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Promotion | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (!establishment.is_pro) return <ProGate feature="creer des promotions" />;

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('promotions').select('*').eq('establishment_id', establishment.id).order('valid_until', { ascending: false });
      setPromos((data as Promotion[]) || []);
    } catch { /* handled */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, [establishment.id]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setUnlimited(true);
    setSelectedDays([]);
    setImageFile(null);
    setFormOpen(true);
  };

  const openEdit = (p: Promotion) => {
    setEditing(p);
    setForm({
      title: p.title,
      description: p.description,
      promo_type: p.promo_type,
      value: p.value || 0,
      valid_from: p.valid_from.slice(0, 10),
      valid_until: p.valid_until.slice(0, 10),
      is_recurring: p.is_recurring,
      recurrence_rule: p.recurrence_rule,
      max_uses: p.max_uses,
      image_url: p.image_url || '',
    });
    setUnlimited(p.max_uses === null);
    setSelectedDays(p.recurrence_rule ? p.recurrence_rule.split(',') : []);
    setImageFile(null);
    setFormOpen(true);
  };

  const toggleDay = (day: string) => {
    setSelectedDays((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let image_url = form.image_url || null;
      if (imageFile) {
        const ext = imageFile.name.split('.').pop();
        const path = `${establishment.id}/promo_${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from('establishment-photos').upload(path, imageFile);
        if (error) throw error;
        const { data: urlData } = supabase.storage.from('establishment-photos').getPublicUrl(path);
        image_url = urlData.publicUrl;
      }

      const payload = {
        establishment_id: establishment.id,
        title: form.title,
        description: form.description,
        promo_type: form.promo_type,
        value: form.promo_type === 'offer' ? null : form.value,
        valid_from: form.valid_from,
        valid_until: form.valid_until,
        is_recurring: form.is_recurring,
        recurrence_rule: form.is_recurring ? selectedDays.join(',') : '',
        max_uses: unlimited ? null : form.max_uses,
        image_url,
      };

      if (editing) {
        const { error } = await supabase.from('promotions').update(payload).eq('id', editing.id);
        if (error) throw error;
        toast.success('Promotion modifiee');
      } else {
        const { error } = await supabase.from('promotions').insert(payload);
        if (error) throw error;
        toast.success('Promotion creee');
      }
      setFormOpen(false);
      load();
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('promotions').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      toast.success('Promotion supprimee');
      setDeleteTarget(null);
      load();
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    }
    setDeleting(false);
  };

  const statusBadge = (p: Promotion) => {
    const now = new Date();
    const from = new Date(p.valid_from);
    const until = new Date(p.valid_until);
    if (now < from) return <span className="badge text-xs bg-primary/10 text-primary">A venir</span>;
    if (now > until) return <span className="badge text-xs bg-gray-700 text-gray-400">Expiree</span>;
    return <span className="badge text-xs bg-success/10 text-success">Active</span>;
  };

  const promoLabel = (p: Promotion) => {
    if (p.promo_type === 'percentage' && p.value) return `-${p.value}%`;
    if (p.promo_type === 'fixed' && p.value) return `-${p.value} EUR`;
    return 'Offre';
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Promotions</h1>
        <button onClick={openCreate} className="btn-primary text-sm py-2 px-4 flex items-center gap-2">
          <Plus size={16} /> Creer
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-20 rounded-card" />)}</div>
      ) : promos.length === 0 ? (
        <p className="text-center text-gray-500 py-12">Aucune promotion pour le moment.</p>
      ) : (
        <div className="space-y-3">
          {promos.map((p) => (
            <div key={p.id} className="bg-dark-surface border border-dark-border rounded-card p-4 flex items-center gap-4">
              <div className="w-14 h-14 rounded bg-dark-border overflow-hidden shrink-0">
                {p.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-white truncate">{p.title}</p>
                  <span className="badge-pro text-xs shrink-0">{promoLabel(p)}</span>
                </div>
                <p className="text-xs text-gray-500">{formatDate(p.valid_from)} → {formatDate(p.valid_until)} · {p.current_uses}/{p.max_uses ?? 'Illimite'}</p>
              </div>
              {statusBadge(p)}
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => openEdit(p)} className="p-1.5 text-gray-500 hover:text-white"><Pencil size={15} /></button>
                <button onClick={() => setDeleteTarget(p)} className="p-1.5 text-gray-500 hover:text-alert"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-dark-surface border border-dark-border rounded-card w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">{editing ? 'Modifier' : 'Creer'} une promotion</h2>
              <button onClick={() => setFormOpen(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Titre</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required className="input-field bg-dark-bg border-dark-border text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="input-field bg-dark-bg border-dark-border text-white resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Type de promotion</label>
                <select value={form.promo_type} onChange={(e) => setForm({ ...form, promo_type: e.target.value as any })} className="input-field bg-dark-bg border-dark-border text-white">
                  <option value="percentage">Reduction %</option>
                  <option value="fixed">Montant fixe</option>
                  <option value="offer">Offre speciale</option>
                </select>
              </div>
              {form.promo_type !== 'offer' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Valeur ({form.promo_type === 'percentage' ? '%' : 'EUR'})</label>
                  <input type="number" min={0} value={form.value || ''} onChange={(e) => setForm({ ...form, value: parseFloat(e.target.value) || 0 })} className="input-field bg-dark-bg border-dark-border text-white" />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Image</label>
                <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} className="input-field bg-dark-bg border-dark-border text-white text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Date de debut</label>
                  <input type="date" value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} required className="input-field bg-dark-bg border-dark-border text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Date de fin</label>
                  <input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} required className="input-field bg-dark-bg border-dark-border text-white" />
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input type="checkbox" checked={form.is_recurring} onChange={(e) => setForm({ ...form, is_recurring: e.target.checked })} className="accent-primary" />
                  Recurrente
                </label>
                {form.is_recurring && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {DAYS.map((day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        className={`px-3 py-1.5 rounded-input text-xs font-medium transition-colors ${selectedDays.includes(day) ? 'bg-primary text-white' : 'bg-dark-border text-gray-400'}`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input type="checkbox" checked={unlimited} onChange={(e) => setUnlimited(e.target.checked)} className="accent-primary" />
                  Illimite
                </label>
                {!unlimited && (
                  <div className="mt-2">
                    <label className="block text-sm font-medium text-gray-300 mb-1">Nombre max d'utilisations</label>
                    <input type="number" min={1} value={form.max_uses || ''} onChange={(e) => setForm({ ...form, max_uses: parseInt(e.target.value) || null })} className="input-field bg-dark-bg border-dark-border text-white" />
                  </div>
                )}
              </div>
              <button type="submit" disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
                {saving && <LoadingSpinner size={16} />} {editing ? 'Enregistrer' : 'Creer la promotion'}
              </button>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Supprimer la promotion"
        message={`Es-tu sur de vouloir supprimer "${deleteTarget?.title}" ?`}
        confirmLabel="Supprimer"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}
