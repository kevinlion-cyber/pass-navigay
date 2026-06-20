import { useState, useMemo } from 'react';
import { X, Loader2, Gift } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';

interface GiftPeriodModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  recipientId: string;
  recipientName: string;
  recipientType: 'user' | 'establishment';
  giftType: 'premium' | 'pro';
  currentlyActive: boolean;
  currentExpiry: string | null;
}

const PRESETS = [
  { label: '7 jours', days: 7 },
  { label: '14 jours', days: 14 },
  { label: '1 mois', days: 30 },
  { label: '3 mois', days: 90 },
  { label: '6 mois', days: 180 },
  { label: '1 an', days: 365 },
  { label: 'Personnalise', days: -1 },
];

function formatDateFr(date: Date): string {
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function GiftPeriodModal({
  open,
  onClose,
  onSuccess,
  recipientId,
  recipientName,
  recipientType,
  giftType,
  currentlyActive,
  currentExpiry,
}: GiftPeriodModalProps) {
  const [selectedPreset, setSelectedPreset] = useState('1 mois');
  const [customDays, setCustomDays] = useState(30);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isCustom = selectedPreset === 'Personnalise';
  const daysToAdd = isCustom
    ? customDays
    : PRESETS.find((p) => p.label === selectedPreset)?.days ?? 30;

  const label = giftType === 'premium' ? 'Premium' : 'Pro';
  const table = recipientType === 'user' ? 'profiles' : 'establishments';
  const activeField = giftType === 'premium' ? 'is_premium' : 'is_pro';
  const expiryField = giftType === 'premium' ? 'premium_expires_at' : 'pro_expires_at';

  const hasActiveExpiry = useMemo(() => {
    if (!currentlyActive || !currentExpiry) return false;
    return new Date(currentExpiry) > new Date();
  }, [currentlyActive, currentExpiry]);

  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    let baseDate: Date;
    if (hasActiveExpiry && currentExpiry) {
      baseDate = new Date(currentExpiry);
    } else {
      baseDate = now;
    }
    const end = new Date(baseDate);
    end.setDate(end.getDate() + daysToAdd);
    return { startDate: now, endDate: end };
  }, [daysToAdd, hasActiveExpiry, currentExpiry]);

  const handlePresetChange = (val: string) => {
    setSelectedPreset(val);
    const preset = PRESETS.find((p) => p.label === val);
    if (preset && preset.days > 0) {
      setCustomDays(preset.days);
    }
  };

  const handleSubmit = async () => {
    if (daysToAdd < 1 || daysToAdd > 365) {
      toast.error('La duree doit etre entre 1 et 365 jours.');
      return;
    }
    setSubmitting(true);
    try {
      const { data: current } = await supabase
        .from(table)
        .select(`${activeField}, ${expiryField}`)
        .eq('id', recipientId)
        .single();

      const now = new Date();
      let baseDate: Date;

      const row = current as Record<string, unknown> | null;
      const isActive = row?.[activeField];
      const expiry = row?.[expiryField] as string | undefined;

      if (isActive && expiry) {
        const currentExpiryDate = new Date(expiry);
        baseDate = currentExpiryDate > now ? currentExpiryDate : now;
      } else {
        baseDate = now;
      }

      const newExpiry = new Date(baseDate);
      newExpiry.setDate(newExpiry.getDate() + daysToAdd);

      const { error: updateError } = await supabase
        .from(table)
        .update({
          [activeField]: true,
          [expiryField]: newExpiry.toISOString(),
        })
        .eq('id', recipientId);

      if (updateError) throw updateError;

      const { error: logError } = await supabase.from('admin_gifts').insert({
        recipient_id: recipientId,
        recipient_type: recipientType,
        gift_type: giftType,
        days_added: daysToAdd,
        new_expiry: newExpiry.toISOString(),
        note: note.trim() || null,
      });

      if (logError) throw logError;

      toast.success(`${label} offert a ${recipientName} jusqu'au ${formatDateFr(newExpiry)} !`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de l\'attribution');
    }
    setSubmitting(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.7)' }} />
      <div
        className="relative w-full max-w-[420px]"
        style={{
          background: '#0f0f17',
          border: '1px solid #1e1e2e',
          borderRadius: 14,
          padding: 32,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2 mb-6">
          <Gift size={20} className="text-[#c084f5]" />
          <h2 className="text-[18px] font-bold text-white leading-tight">
            Offrir une periode {label} a {recipientName}
          </h2>
        </div>

        <div
          className="rounded-lg px-4 py-3 mb-6"
          style={{ background: '#1a1a24', border: '1px solid #1e1e2e' }}
        >
          {hasActiveExpiry && currentExpiry ? (
            <p className="text-[13px]" style={{ color: '#27ae60' }}>
              {label} actif jusqu'au{' '}
              <span className="font-semibold">{formatDateFr(new Date(currentExpiry))}</span>
            </p>
          ) : currentlyActive ? (
            <p className="text-[13px]" style={{ color: '#27ae60' }}>
              {label} actif (sans date d'expiration)
            </p>
          ) : (
            <p className="text-[13px] text-gray-500">
              Statut actuel : Gratuit
            </p>
          )}
        </div>

        <div className="mb-4">
          <label className="block text-[12px] uppercase tracking-[0.5px] text-[#606070] font-medium mb-2">
            Duree a offrir
          </label>
          <select
            value={selectedPreset}
            onChange={(e) => handlePresetChange(e.target.value)}
            className="w-full rounded-lg px-3 py-2.5 text-[14px] text-white outline-none"
            style={{ background: '#1a1a24', border: '1px solid #2a2a3a' }}
          >
            {PRESETS.map((p) => (
              <option key={p.label} value={p.label}>{p.label}</option>
            ))}
          </select>
        </div>

        {isCustom && (
          <div className="mb-4 flex items-center gap-3">
            <input
              type="number"
              min={1}
              max={365}
              value={customDays}
              onChange={(e) => setCustomDays(Math.min(365, Math.max(1, parseInt(e.target.value) || 1)))}
              className="w-24 rounded-lg px-3 py-2.5 text-[14px] text-white outline-none"
              style={{ background: '#1a1a24', border: '1px solid #2a2a3a' }}
            />
            <span className="text-[14px] text-gray-400">jours</span>
          </div>
        )}

        <div
          className="rounded-lg px-4 py-3 mb-6"
          style={{ background: '#1a1a24', border: '1px solid #1e1e2e' }}
        >
          {hasActiveExpiry ? (
            <p className="text-[13px] text-gray-400">
              La periode sera prolongee jusqu'au{' '}
              <span className="font-semibold text-[#c084f5]">{formatDateFr(endDate)}</span>
            </p>
          ) : (
            <p className="text-[13px] text-gray-400">
              {label} offert du{' '}
              <span className="font-semibold text-[#c084f5]">{formatDateFr(startDate)}</span>
              {' '}au{' '}
              <span className="font-semibold text-[#c084f5]">{formatDateFr(endDate)}</span>
            </p>
          )}
        </div>

        <div className="mb-6">
          <label className="block text-[12px] uppercase tracking-[0.5px] text-[#606070] font-medium mb-2">
            Note interne (optionnel)
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex: Partenaire test, influenceur, lot concours..."
            className="w-full rounded-lg px-3 py-2.5 text-[14px] text-white placeholder:text-[#404050] outline-none"
            style={{ background: '#1a1a24', border: '1px solid #2a2a3a' }}
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-2.5 rounded-lg text-[14px] transition-colors hover:opacity-90"
            style={{ background: 'transparent', border: '1px solid #2a2a3a', color: '#a0a0b0' }}
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || daysToAdd < 1}
            className="flex-[2] py-2.5 rounded-lg text-[14px] font-semibold text-white transition-colors hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: '#7B2D8B' }}
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
            Offrir le {label}
          </button>
        </div>
      </div>
    </div>
  );
}
