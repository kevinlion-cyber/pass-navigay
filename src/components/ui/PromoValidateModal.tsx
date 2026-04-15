import { useState } from 'react';
import { Loader2, Ticket, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';

interface Props {
  open: boolean;
  onClose: () => void;
  onValidated: () => void;
  promotionId: string;
  promotionTitle: string;
  establishmentName: string;
  userId: string;
}

export default function PromoValidateModal({
  open,
  onClose,
  onValidated,
  promotionId,
  promotionTitle,
  establishmentName,
  userId,
}: Props) {
  const [submitting, setSubmitting] = useState(false);

  const handleValidate = async () => {
    setSubmitting(true);
    try {
      const { data: existingUse } = await supabase
        .from('promotion_uses')
        .select('id')
        .eq('promotion_id', promotionId)
        .eq('user_id', userId)
        .maybeSingle();

      if (existingUse) {
        toast.error('Tu as deja utilise cette promotion.');
        onClose();
        setSubmitting(false);
        return;
      }

      const { data: promo } = await supabase
        .from('promotions')
        .select('valid_until, max_uses, current_uses')
        .eq('id', promotionId)
        .single();

      if (!promo) {
        toast.error('Promotion introuvable.');
        onClose();
        setSubmitting(false);
        return;
      }

      if (new Date(promo.valid_until) < new Date()) {
        toast.error('Cette promotion a expire.');
        onClose();
        setSubmitting(false);
        return;
      }

      if (promo.max_uses && promo.current_uses >= promo.max_uses) {
        toast.error("Le nombre maximum d'utilisations a ete atteint.");
        onClose();
        setSubmitting(false);
        return;
      }

      const { error } = await supabase.from('promotion_uses').insert({
        promotion_id: promotionId,
        user_id: userId,
        used_at: new Date().toISOString(),
      });

      if (error) {
        if (error.code === '23505') {
          toast.error('Tu as deja utilise cette promotion.');
        } else {
          toast.error('Une erreur est survenue. Reessaie.');
        }
        onClose();
        setSubmitting(false);
        return;
      }

      await supabase
        .from('promotions')
        .update({ current_uses: (promo.current_uses || 0) + 1 })
        .eq('id', promotionId);

      onValidated();
      onClose();
      toast.success('Promotion validee ! Profites-en bien !');
    } catch {
      toast.error('Une erreur est survenue. Reessaie.');
    }
    setSubmitting(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.75)' }} />
      <div
        className="relative w-full max-w-[400px] text-center"
        style={{
          background: '#0f0f17',
          border: '1px solid #1e1e2e',
          borderRadius: 16,
          padding: 32,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center mb-4">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(123,45,139,0.15)' }}
          >
            <Ticket size={32} style={{ color: '#7B2D8B' }} />
          </div>
        </div>

        <h2 className="text-[20px] font-bold text-white mb-2">Valider cette promotion ?</h2>
        <p className="text-[15px] font-bold mb-4" style={{ color: '#7B2D8B' }}>
          {promotionTitle}
        </p>

        <div
          className="rounded-lg px-4 py-3.5 text-left"
          style={{
            background: 'rgba(212,160,23,0.1)',
            border: '1px solid rgba(212,160,23,0.3)',
          }}
        >
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" style={{ color: '#d4a017' }} />
            <div>
              <p className="text-[13px] font-semibold mb-1" style={{ color: '#d4a017' }}>Important</p>
              <p className="text-[13px] leading-relaxed" style={{ color: '#d4a017' }}>
                Assure-toi d'etre physiquement present(e) chez {establishmentName} avant de valider.
                Cette action est irreversible et ne peut pas etre annulee.
              </p>
            </div>
          </div>
        </div>

        <p className="text-[13px] text-gray-500 mt-3 leading-relaxed">
          Une fois validee, la promotion sera consommee et ce bouton ne sera plus disponible.
        </p>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-3 rounded-[10px] text-[14px] transition-colors hover:opacity-90"
            style={{ background: 'transparent', border: '1px solid #2a2a3a', color: '#a0a0b0' }}
          >
            Annuler
          </button>
          <button
            onClick={handleValidate}
            disabled={submitting}
            className="flex-[2] py-3 rounded-[10px] text-[14px] font-semibold text-white transition-colors hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: '#7B2D8B' }}
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
            Oui, je suis sur place
          </button>
        </div>
      </div>
    </div>
  );
}
