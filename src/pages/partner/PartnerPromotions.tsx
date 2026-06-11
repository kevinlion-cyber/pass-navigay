import { useEffect, useState, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Pencil, Trash2, X, Check, Copy, Power } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import type { Establishment, Promotion } from '../../lib/types';
import ProGate from '../../components/partner/ProGate';
import ConfirmModal from '../../components/admin/ConfirmModal';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ImageUploadWithCrop from '../../components/admin/ImageUploadWithCrop';
import PromoUsesSection from './PromoUsesSection';

interface PartnerContext {
  establishment: Establishment;
}

type PromoType = 'percentage' | 'fixed' | 'offer';

interface PromoForm {
  title: string;
  description: string;
  promo_type: PromoType;
  value: number;
  offer_text: string;
  is_permanent: boolean;
  valid_from: string;
  valid_until: string;
  image_url: string;
}

const EMPTY_FORM: PromoForm = {
  title: '',
  description: '',
  promo_type: 'percentage',
  value: 0,
  offer_text: '',
  is_permanent: false,
  valid_from: '',
  valid_until: '',
  image_url: '',
};

export default function PartnerPromotions() {
  const { establishment } = useOutletContext<PartnerContext>();
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [form, setForm] = useState<PromoForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Promotion | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (!establishment.is_pro) return <ProGate feature="créer des promotions" />;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('promotions').select('*')
        .eq('establishment_id', establishment.id)
        .order('created_at', { ascending: false });
      setPromos((data as Promotion[]) || []);
    } catch {
      toast.error('Erreur lors du chargement des promotions');
    }
    setLoading(false);
  }, [establishment.id]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setCroppedBlob(null);
    setFormOpen(true);
  };

  const openEdit = (p: Promotion) => {
    setEditing(p);
    setForm({
      title: p.title,
      description: p.description || '',
      promo_type: p.promo_type,
      value: p.value || 0,
      offer_text: p.promo_type === 'offer' ? (p.description || '') : '',
      is_permanent: p.is_permanent ?? false,
      valid_from: p.valid_from ? p.valid_from.slice(0, 16) : '',
      valid_until: p.valid_until ? p.valid_until.slice(0, 16) : '',
      image_url: p.image_url || '',
    });
    setCroppedBlob(null);
    setFormOpen(true);
  };

  const handleDuplicate = (p: Promotion) => {
    setEditing(null);
    setForm({
      title: p.title + ' (copie)',
      description: p.description || '',
      promo_type: p.promo_type,
      value: p.value || 0,
      offer_text: p.promo_type === 'offer' ? (p.description || '') : '',
      is_permanent: p.is_permanent ?? false,
      valid_from: '',
      valid_until: '',
      image_url: p.image_url || '',
    });
    setCroppedBlob(null);
    setFormOpen(true);
  };

  const toggleActive = async (p: Promotion) => {
    const newActive = !(p.is_active ?? true);
    const { error } = await supabase.from('promotions').update({ is_active: newActive }).eq('id', p.id);
    if (error) {
      toast.error('Erreur lors de la mise à jour');
    } else {
      toast.success(newActive ? 'Promotion activée' : 'Promotion désactivée');
      load();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    if (!form.is_permanent) {
      if (!form.valid_from || !form.valid_until) {
        toast.error('Renseignez les dates de validité ou cochez "Promotion permanente"');
        return;
      }
      if (new Date(form.valid_until) <= new Date(form.valid_from)) {
        toast.error('La date de fin doit être après la date de début');
        return;
      }
    }
    setSaving(true);
    try {
      let image_url = form.image_url || null;
      if (croppedBlob) {
        const path = `${establishment.id}/${Date.now()}.jpg`;
        const { error: upErr } = await supabase.storage.from('promo-images')
          .upload(path, croppedBlob, { contentType: 'image/jpeg' });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from('promo-images').getPublicUrl(path);
        image_url = urlData.publicUrl;
      }

      const payload = {
        establishment_id: establishment.id,
        title: form.title.trim(),
        description: form.description.trim(),
        promo_type: form.promo_type,
        value: form.promo_type === 'offer' ? null : form.value,
        is_permanent: form.is_permanent,
        valid_from: form.is_permanent ? new Date().toISOString() : new Date(form.valid_from).toISOString(),
        valid_until: form.is_permanent ? '2099-12-31T23:59:59' : new Date(form.valid_until).toISOString(),
        is_recurring: false,
        recurrence_rule: '',
        max_uses: null,
        image_url,
        is_active: true,
      };

      if (editing) {
        const { error } = await supabase.from('promotions').update(payload).eq('id', editing.id);
        if (error) throw error;
        toast.success('Promotion modifiée !');
      } else {
        const { error } = await supabase.from('promotions').insert({ ...payload, current_uses: 0 });
        if (error) throw error;
        toast.success("Promotion lancée ! Elle est maintenant visible dans l'onglet Promos.");
      }
      setFormOpen(false);
      load();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la sauvegarde');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('promotions').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      toast.success('Promotion supprimée.');
      setDeleteTarget(null);
      load();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la suppression');
    }
    setDeleting(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Mes promotions</h1>
        <button onClick={openCreate} className="btn-primary text-sm py-2.5 px-5 flex items-center gap-2">
          <Plus size={16} /> Créer une promotion
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="skeleton h-40 rounded-card" />)}</div>
      ) : promos.length === 0 ? (
        <EmptyState onAction={openCreate} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {promos.map(p => (
            <PromoCard key={p.id} promo={p}
              onEdit={() => openEdit(p)}
              onDelete={() => setDeleteTarget(p)}
              onDuplicate={() => handleDuplicate(p)}
              onToggleActive={() => toggleActive(p)}
            />
          ))}
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={e => e.target === e.currentTarget && setFormOpen(false)}>
          <div className="bg-dark-surface border border-dark-border rounded-card w-full max-w-[580px] max-h-[90vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                {editing ? 'Modifier la promotion' : 'Nouvelle promotion'}
              </h2>
              <button onClick={() => setFormOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <ImageUploadWithCrop
                currentImageUrl={form.image_url || null}
                onImageCropped={blob => setCroppedBlob(blob)}
                aspectRatio={4 / 3}
                label="Visuel de la promotion (format 4:3)"
                hint="Affiché sur la carte de la promotion dans l'app."
              />

              <div>
                <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1.5">Titre de la promotion</label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                  required placeholder="Happy Hour -50%, Cocktail offert, Entrée gratuite..."
                  className="input-field bg-dark-bg border-dark-border text-white" />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1.5">Description</label>
                <textarea value={form.description}
                  onChange={e => { if (e.target.value.length <= 300) setForm({ ...form, description: e.target.value }); }}
                  rows={3} placeholder="Détaillez les conditions, les restrictions, comment bénéficier de l'offre..."
                  className="input-field bg-dark-bg border-dark-border text-white resize-none" style={{ minHeight: 80 }} />
                <p className="text-xs text-gray-600 text-right mt-1">{form.description.length}/300</p>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wide text-gray-500 mb-2">Type d'offre</label>
                <div className="flex gap-2">
                  {([
                    { key: 'percentage' as PromoType, label: '% Réduction' },
                    { key: 'fixed' as PromoType, label: 'Montant fixe \u20ac' },
                    { key: 'offer' as PromoType, label: 'Offre spéciale' },
                  ]).map(({ key, label }) => (
                    <button key={key} type="button" onClick={() => setForm({ ...form, promo_type: key })}
                      className="flex-1 py-2.5 rounded-[8px] text-sm font-medium transition-colors"
                      style={form.promo_type === key
                        ? { background: 'rgba(123,45,139,0.2)', border: '1px solid #7B2D8B', color: '#7B2D8B' }
                        : { background: '#1a1a24', border: '1px solid #2a2a3a', color: '#a0a0b0' }
                      }>
                      {label}
                    </button>
                  ))}
                </div>
                {form.promo_type === 'percentage' && (
                  <div className="mt-3">
                    <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1.5">Valeur (%)</label>
                    <input type="number" min={1} max={100} value={form.value || ''} placeholder="20"
                      onChange={e => setForm({ ...form, value: parseInt(e.target.value) || 0 })}
                      className="input-field bg-dark-bg border-dark-border text-white" />
                  </div>
                )}
                {form.promo_type === 'fixed' && (
                  <div className="mt-3">
                    <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1.5">Montant (&euro;)</label>
                    <input type="number" min={0.01} step="0.01" value={form.value || ''} placeholder="5"
                      onChange={e => setForm({ ...form, value: parseFloat(e.target.value) || 0 })}
                      className="input-field bg-dark-bg border-dark-border text-white" />
                  </div>
                )}
                {form.promo_type === 'offer' && (
                  <div className="mt-3">
                    <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1.5">Décrivez l'offre</label>
                    <input value={form.offer_text}
                      onChange={e => setForm({ ...form, offer_text: e.target.value })}
                      placeholder="1 cocktail offert pour 1 acheté"
                      className="input-field bg-dark-bg border-dark-border text-white" />
                  </div>
                )}
              </div>

              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <ToggleSwitch checked={form.is_permanent} onChange={v => setForm({ ...form, is_permanent: v })} />
                  <span className="text-sm text-gray-300">Promotion permanente (sans date de fin)</span>
                </label>
              </div>

              {!form.is_permanent && (
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1.5">Valable à partir du</label>
                    <input type="datetime-local" value={form.valid_from}
                      onChange={e => setForm({ ...form, valid_from: e.target.value })}
                      required className="input-field bg-dark-bg border-dark-border text-white" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1.5">Jusqu'au</label>
                    <input type="datetime-local" value={form.valid_until}
                      onChange={e => setForm({ ...form, valid_until: e.target.value })}
                      required className="input-field bg-dark-bg border-dark-border text-white" />
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setFormOpen(false)}
                  className="flex-1 btn-ghost py-2.5 text-sm">
                  Annuler
                </button>
                <button type="submit" disabled={saving}
                  className="flex-[2] py-2.5 rounded-input text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: '#7B2D8B' }}>
                  {saving && <LoadingSpinner size={16} />}
                  {editing ? 'Enregistrer' : 'Lancer la promotion'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal open={!!deleteTarget} title="Supprimer la promotion"
        message={`Supprimer "${deleteTarget?.title}" ? Cette action est irréversible.`}
        confirmLabel="Supprimer" onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete} loading={deleting} />
    </div>
  );
}

function EmptyState({ onAction }: { onAction: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <span className="text-5xl mb-6">🏷</span>
      <h2 className="text-lg font-semibold text-white mb-2">Vous n'avez pas encore de promotions</h2>
      <p className="text-sm text-gray-400 max-w-md mb-6 leading-relaxed">
        Lancez des offres exclusives pour les membres Pass Navigay :
        happy hours, entrées gratuites, réductions permanentes ou ponctuelles.
        C'est gratuit et cela fidélise une nouvelle clientèle.
      </p>
      <div className="flex flex-col sm:flex-row items-center gap-4 mb-8 text-sm text-gray-400">
        <span className="flex items-center gap-1.5">
          <Check size={14} style={{ color: '#1a7a3a' }} /> Visible immédiatement dans l'onglet Promos
        </span>
        <span className="flex items-center gap-1.5">
          <Check size={14} style={{ color: '#1a7a3a' }} /> Permanente ou ponctuelle
        </span>
        <span className="flex items-center gap-1.5">
          <Check size={14} style={{ color: '#1a7a3a' }} /> Inclus dans votre abonnement Pro
        </span>
      </div>
      <button onClick={onAction}
        className="py-3 px-8 rounded-input text-sm font-semibold text-white transition-colors hover:opacity-90"
        style={{ background: '#7B2D8B' }}>
        + Créer ma première promotion
      </button>
    </div>
  );
}

function PromoCard({
  promo, onEdit, onDelete, onDuplicate, onToggleActive,
}: {
  promo: Promotion;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onToggleActive: () => void;
}) {
  const isActive = promo.is_active ?? true;
  const isPermanent = promo.is_permanent ?? false;

  const now = new Date();
  const from = new Date(promo.valid_from);
  const until = new Date(promo.valid_until);

  let status: { label: string; bg: string; color: string };
  if (!isActive) {
    status = { label: 'Désactivée', bg: 'rgba(100,100,100,0.15)', color: '#888' };
  } else if (isPermanent) {
    status = { label: 'Permanente', bg: 'rgba(26,122,58,0.1)', color: '#1a7a3a' };
  } else if (now < from) {
    status = { label: 'À venir', bg: 'rgba(123,45,139,0.1)', color: '#7B2D8B' };
  } else if (now > until) {
    status = { label: 'Expirée', bg: 'rgba(100,100,100,0.15)', color: '#888' };
  } else {
    status = { label: 'Active', bg: 'rgba(26,122,58,0.1)', color: '#1a7a3a' };
  }

  const promoLabel = () => {
    if (promo.promo_type === 'percentage' && promo.value) return `-${promo.value}%`;
    if (promo.promo_type === 'fixed' && promo.value) return `-${promo.value} \u20ac`;
    return 'Offre';
  };

  const typeBg = () => {
    if (promo.promo_type === 'percentage') return 'rgba(123,45,139,0.15)';
    if (promo.promo_type === 'fixed') return 'rgba(234,148,40,0.15)';
    return 'rgba(26,122,58,0.15)';
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

  return (
    <div className={`rounded-card overflow-hidden transition-opacity ${!isActive ? 'opacity-60' : ''}`}
      style={{ background: '#16161f', border: '1px solid #2a2a35' }}>
      {promo.image_url ? (
        <div className="h-[100px] overflow-hidden">
          <img src={promo.image_url} alt="" className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="h-[60px]" style={{ background: typeBg() }} />
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex items-center px-2 py-0.5 rounded-pill text-xs font-bold shrink-0"
              style={{ background: typeBg(), color: promo.promo_type === 'percentage' ? '#7B2D8B' : promo.promo_type === 'fixed' ? '#ea9428' : '#1a7a3a' }}>
              {promoLabel()}
            </span>
            <h3 className="text-sm font-bold text-white truncate">{promo.title}</h3>
          </div>
          <span className="shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-pill text-xs font-medium"
            style={{ background: status.bg, color: status.color }}>
            {status.label}
          </span>
        </div>

        {promo.description && (
          <p className="text-xs text-gray-500 truncate mb-2">{promo.description}</p>
        )}

        {!isPermanent && (
          <p className="text-xs text-gray-500 mb-2">
            Du {formatDate(promo.valid_from)} au {formatDate(promo.valid_until)}
          </p>
        )}

        <div className="flex items-center gap-2 border-t border-dark-border pt-3 flex-wrap">
          <button onClick={onToggleActive}
            className={`flex items-center gap-1.5 text-xs transition-colors px-2 py-1 rounded-input ${
              isActive
                ? 'text-gray-400 hover:text-amber-400 hover:bg-amber-400/10'
                : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-400/10'
            }`}>
            <Power size={13} /> {isActive ? 'Désactiver' : 'Activer'}
          </button>
          <button onClick={onEdit}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors px-2 py-1 rounded-input hover:bg-dark-border">
            <Pencil size={13} /> Modifier
          </button>
          <button onClick={onDuplicate}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors px-2 py-1 rounded-input hover:bg-dark-border">
            <Copy size={13} /> Dupliquer
          </button>
          <button onClick={onDelete}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-alert transition-colors px-2 py-1 rounded-input hover:bg-alert/10">
            <Trash2 size={13} /> Supprimer
          </button>
        </div>

        <PromoUsesSection
          promoId={promo.id}
          maxUses={promo.max_uses}
          currentUses={promo.current_uses}
        />
      </div>
    </div>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0"
      style={{ background: checked ? '#7B2D8B' : '#2a2a35' }}>
      <span className="inline-block h-4 w-4 rounded-full bg-white transition-transform"
        style={{ transform: checked ? 'translateX(24px)' : 'translateX(4px)' }} />
    </button>
  );
}
