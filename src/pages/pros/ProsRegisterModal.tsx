import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import RegisterStep1, { type Step1Data } from './RegisterStep1';
import RegisterStep2, { type Step2Data } from './RegisterStep2';
import RegisterStep3, { type Step3Data } from './RegisterStep3';

interface ProsRegisterModalProps {
  onClose: () => void;
  onSwitchToLogin: () => void;
}

const STEP_LABELS = ['Vos infos', 'Votre établissement', 'Vos photos'];

const LOADER_MESSAGES = [
  'Création de votre compte...',
  'Enregistrement de votre établissement...',
  'Upload de vos photos...',
  'Tout est prêt !',
];

export default function ProsRegisterModal({ onClose, onSwitchToLogin }: ProsRegisterModalProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [loaderStep, setLoaderStep] = useState(0);

  const [step1, setStep1] = useState<Step1Data>({
    prenom: '', nom: '', email: '', phone: '', password: '',
  });
  const [step2, setStep2] = useState<Step2Data>({
    name: '', category: '', subcategory: '', address: '', city: '', postal_code: '',
    latitude: null, longitude: null, phone: '', website: '', description: '',
  });
  const [step3, setStep3] = useState<Step3Data>({
    logoBlob: null, logoPreview: null, bannerBlob: null, bannerPreview: null,
    galleryBlobs: [], galleryPreviews: [],
  });

  const hasData = step1.prenom || step1.nom || step1.email || step2.name;

  const handleClose = useCallback(() => {
    if (submitting) return;
    if (hasData) {
      if (window.confirm('Vous allez perdre vos informations, continuer ?')) onClose();
    } else {
      onClose();
    }
  }, [hasData, submitting, onClose]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [handleClose]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setLoaderStep(0);

    try {
      setLoaderStep(0);
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: step1.email,
        password: step1.password,
      });
      if (authError) throw new Error(authError.message);
      if (!authData.user) throw new Error('Erreur lors de la création du compte.');
      const userId = authData.user.id;

      await supabase.from('profiles').upsert({
        id: userId,
        username: `${step1.prenom} ${step1.nom}`,
      });

      setLoaderStep(1);
      let logoUrl: string | null = null;
      if (step3.logoBlob) {
        const { data: logoData, error: logoErr } = await supabase.storage
          .from('establishment-logos')
          .upload(`${userId}/logo_${Date.now()}.jpg`, step3.logoBlob, { contentType: 'image/jpeg', upsert: true });
        if (logoErr) throw new Error(logoErr.message);
        logoUrl = supabase.storage.from('establishment-logos').getPublicUrl(logoData.path).data.publicUrl;
      }

      let bannerUrl: string | null = null;
      if (step3.bannerBlob) {
        const { data: bannerData, error: bannerErr } = await supabase.storage
          .from('establishment-banners')
          .upload(`${userId}/banner_${Date.now()}.jpg`, step3.bannerBlob, { contentType: 'image/jpeg', upsert: true });
        if (bannerErr) throw new Error(bannerErr.message);
        bannerUrl = supabase.storage.from('establishment-banners').getPublicUrl(bannerData.path).data.publicUrl;
      }

      const { data: establishment, error: estErr } = await supabase.from('establishments').insert({
        owner_id: userId,
        name: step2.name,
        address: step2.address,
        city: step2.city,
        postal_code: step2.postal_code,
        latitude: step2.latitude || 0,
        longitude: step2.longitude || 0,
        category: step2.category,
        subcategory: step2.subcategory,
        phone: step2.phone,
        website: step2.website,
        description: step2.description,
        logo_url: logoUrl,
        banner_url: bannerUrl,
        is_pro: false,
        is_verified: false,
      }).select('id').single();
      if (estErr) throw new Error(estErr.message);

      if (step3.galleryBlobs.length > 0) {
        setLoaderStep(2);
        for (let i = 0; i < step3.galleryBlobs.length; i++) {
          const blob = step3.galleryBlobs[i];
          const filename = `photo_${Date.now()}_${i}.jpg`;
          const { data: photoData, error: photoErr } = await supabase.storage
            .from('establishment-photos')
            .upload(`${establishment.id}/${filename}`, blob, { contentType: 'image/jpeg' });
          if (photoErr) throw new Error(photoErr.message);
          const photoUrl = supabase.storage.from('establishment-photos').getPublicUrl(photoData.path).data.publicUrl;
          await supabase.from('establishment_photos').insert({
            establishment_id: establishment.id,
            url: photoUrl,
            order_index: i,
          });
        }
      }

      setLoaderStep(3);
      await new Promise((r) => setTimeout(r, 800));
      toast.success('Bienvenue ! Votre établissement est en cours de validation.');
      onClose();
      navigate('/pros/tableau-de-bord');
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la création.');
      setSubmitting(false);
    }
  };

  if (submitting) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center"
        style={{ zIndex: 1000, background: 'rgba(0,0,0,0.75)' }}
      >
        <div
          className="w-full h-full md:w-full md:max-w-[560px] md:h-auto md:rounded-2xl flex flex-col items-center justify-center p-10"
          style={{ background: '#0f0f17', border: '1px solid #1e1e2e', boxShadow: '0 25px 60px rgba(0,0,0,0.7)', minHeight: 300 }}
        >
          <div className="w-10 h-10 border-3 border-t-transparent rounded-full animate-spin mb-6" style={{ borderColor: '#7B2D8B', borderTopColor: 'transparent', borderWidth: 3 }} />
          <p className="text-[16px] font-semibold text-white text-center animate-pulse">
            {LOADER_MESSAGES[loaderStep]}
          </p>
          <div className="flex gap-2 mt-6">
            {LOADER_MESSAGES.map((_, i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full transition-colors duration-300"
                style={{ background: i <= loaderStep ? '#7B2D8B' : '#2a2a3a' }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-0 md:p-4"
      style={{ zIndex: 1000, background: 'rgba(0,0,0,0.75)' }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        className="relative w-full h-full md:w-full md:max-w-[560px] md:h-auto md:max-h-[90vh] md:rounded-2xl overflow-hidden flex flex-col"
        style={{ background: '#0f0f17', border: '1px solid #1e1e2e', boxShadow: '0 25px 60px rgba(0,0,0,0.7)' }}
      >
        <div
          className="sticky top-0 z-10 flex items-center justify-center px-6 py-5 shrink-0"
          style={{ background: '#14141e', borderBottom: '1px solid #1e1e2e' }}
        >
          <span className="text-[14px] font-bold">
            <span className="text-white">Pass</span>{' '}
            <span style={{ color: '#7B2D8B' }}>Navigay</span>
            <span style={{ color: '#606070' }}> · Espace Partenaire</span>
          </span>
          <button
            onClick={handleClose}
            className="absolute top-4 right-5 p-1 transition-colors"
            style={{ color: '#606070', fontSize: 20 }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#606070')}
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-6 md:px-8 md:py-7">
          <div className="flex items-center justify-center mb-7">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center">
                {s > 1 && (
                  <div
                    className="w-10 md:w-14 h-[2px] mx-1"
                    style={{ background: step > s - 1 ? '#7B2D8B' : '#2a2a3a' }}
                  />
                )}
                <div className="flex flex-col items-center">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-semibold transition-colors"
                    style={{
                      background: step > s ? '#1a7a3a' : step === s ? '#7B2D8B' : '#1a1a24',
                      border: step < s ? '1px solid #2a2a3a' : 'none',
                      color: step > s || step === s ? '#fff' : '#606070',
                    }}
                  >
                    {step > s ? <Check size={14} /> : s}
                  </div>
                  <span
                    className="text-[11px] mt-1.5"
                    style={{ color: step >= s ? '#7B2D8B' : '#606070' }}
                  >
                    {STEP_LABELS[s - 1]}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {step === 1 && (
            <RegisterStep1 data={step1} onChange={setStep1} onNext={() => setStep(2)} />
          )}
          {step === 2 && (
            <RegisterStep2 data={step2} onChange={setStep2} onNext={() => setStep(3)} onPrev={() => setStep(1)} />
          )}
          {step === 3 && (
            <RegisterStep3 data={step3} onChange={setStep3} onPrev={() => setStep(2)} onSubmit={handleSubmit} submitting={submitting} />
          )}

          {step === 1 && (
            <p className="text-center text-[13px] mt-6" style={{ color: '#606070' }}>
              Déjà partenaire ?{' '}
              <button
                onClick={onSwitchToLogin}
                className="font-medium transition-colors hover:underline"
                style={{ color: '#7B2D8B' }}
              >
                Connectez-vous &rarr;
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
