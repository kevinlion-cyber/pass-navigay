import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { translateAuthError } from '../../lib/authErrors';
import RegisterStep1, { type Step1Data } from './RegisterStep1';
import RegisterStep2, { type Step2Data } from './RegisterStep2';
import RegisterStep3, { type Step3Data } from './RegisterStep3';

interface ProsRegisterModalProps {
  onClose: () => void;
  onSwitchToLogin: () => void;
}

const STEP_LABELS = ['Vos infos', 'Votre établissement', 'Vos photos'];

const LOADER_MESSAGES = [
  'Création de votre compte…',
  'Enregistrement de votre établissement…',
  'Envoi de vos photos…',
  'Tout est prêt !',
];

export default function ProsRegisterModal({ onClose, onSwitchToLogin }: ProsRegisterModalProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [loaderStep, setLoaderStep] = useState(0);
  const [phase, setPhase] = useState<'form' | 'verify'>('form');
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

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

  // Étape 1 : créer le compte auth. Avec la confirmation email active, aucune session
  // n'est ouverte ici → on demande le code à 6 chiffres avant de créer l'établissement.
  const handleSignup = async () => {
    setSubmitting(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: step1.email,
        password: step1.password,
      });
      if (authError) throw new Error(translateAuthError(authError));
      if (!authData.user) throw new Error('Erreur lors de la création du compte.');

      // Adresse déjà rattachée à un compte : pour ne pas révéler qui est inscrit,
      // Supabase répond « créé » MAIS n'envoie aucun code, et renvoie un utilisateur
      // sans aucune identité. Sans ce test, on affichait l'écran « saisissez le code »
      // et le gérant attendait un e-mail qui ne partirait jamais (cas vécu en démo).
      if (Array.isArray(authData.user.identities) && authData.user.identities.length === 0) {
        setSubmitting(false);
        setAlreadyRegistered(true);
        return;
      }

      setSubmitting(false);
      setPhase('verify');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la création du compte.');
      setSubmitting(false);
    }
  };

  // Renvoi du code : sans ce bouton, un gérant qui perd l'e-mail (ou ferme la
  // fenêtre) se retrouvait dans une impasse, son compte existant mais inutilisable.
  const handleResend = async () => {
    setResending(true);
    const { error } = await supabase.auth.resend({ type: 'signup', email: step1.email });
    setResending(false);
    if (error) {
      toast.error(translateAuthError(error));
      return;
    }
    toast.success('Un nouveau code vient de vous être envoyé.');
  };

  // Étape 2 : valider le code → une session s'ouvre → on crée profil + établissement + photos.
  const handleVerify = async () => {
    if (code.length !== 6) { toast.error('Le code doit contenir 6 chiffres.'); return; }
    setVerifying(true);
    try {
      const { data: vData, error: vErr } = await supabase.auth.verifyOtp({
        email: step1.email,
        token: code,
        type: 'signup',
      });
      if (vErr) throw new Error(translateAuthError(vErr));
      const userId = vData.user?.id;
      if (!userId) throw new Error('Votre session n\'a pas pu être ouverte. Réessayez.');

      setVerifying(false);
      setSubmitting(true);
      setLoaderStep(0);

      // Le profil doit exister AVANT l'établissement (`owner_id` pointe dessus).
      // `username` est unique : deux gérants homonymes faisaient échouer cet
      // enregistrement en silence, puis l'établissement échouait sur la clé
      // étrangère avec un message technique en anglais. On suffixe donc jusqu'à
      // trouver un nom libre, et on remonte une vraie erreur si ça échoue.
      const baseName = `${step1.prenom} ${step1.nom}`.trim() || step1.email.split('@')[0];
      let savedProfile = false;
      for (let attempt = 0; attempt < 5 && !savedProfile; attempt++) {
        const username = attempt === 0 ? baseName : `${baseName} ${attempt + 1}`;
        const { error: profileErr } = await supabase.from('profiles').upsert({
          id: userId,
          username,
          prenom: step1.prenom,
          nom: step1.nom,
          email: step1.email,
          phone: step1.phone,
          account_type: 'pro',
        });
        if (!profileErr) { savedProfile = true; break; }
        // 23505 = nom déjà pris : on retente avec un suffixe. Toute autre erreur est finale.
        if (profileErr.code !== '23505') {
          throw new Error("Impossible d'enregistrer votre profil. Réessayez ou contactez-nous.");
        }
      }
      if (!savedProfile) {
        throw new Error("Impossible d'enregistrer votre profil. Réessayez ou contactez-nous.");
      }

      setLoaderStep(1);
      let logoUrl: string | null = null;
      if (step3.logoBlob) {
        const { data: logoData, error: logoErr } = await supabase.storage
          .from('establishment-logos')
          .upload(`${userId}/logo_${Date.now()}.jpg`, step3.logoBlob, { contentType: 'image/jpeg', upsert: true });
        if (logoErr) throw new Error("Impossible d'envoyer votre logo. Réessayez.");
        logoUrl = supabase.storage.from('establishment-logos').getPublicUrl(logoData.path).data.publicUrl;
      }

      let bannerUrl: string | null = null;
      if (step3.bannerBlob) {
        const { data: bannerData, error: bannerErr } = await supabase.storage
          .from('establishment-banners')
          .upload(`${userId}/banner_${Date.now()}.jpg`, step3.bannerBlob, { contentType: 'image/jpeg', upsert: true });
        if (bannerErr) throw new Error("Impossible d'envoyer votre bannière. Réessayez.");
        bannerUrl = supabase.storage.from('establishment-banners').getPublicUrl(bannerData.path).data.publicUrl;
      }

      // Adresse de page (`slug`) et ville de rattachement (`city_slug`) ne sont pas
      // posées ici volontairement : la base les remplit (migration 59, trigger
      // trg_establishments_fill_slugs), pour tous les chemins de création à la fois.
      // Une commune déjà rattachée à une ville couverte reprend ce rattachement
      // (un lieu à Lattes devient un lieu de Montpellier). Ne pas refaire ce calcul
      // ici : c'est sa duplication écran par écran qui avait laissé le parcours des
      // pros créer des fiches introuvables et absentes des pages de ville.
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
      if (estErr) throw new Error("Impossible d'enregistrer votre établissement. Réessayez ou contactez-nous.");

      if (step3.galleryBlobs.length > 0) {
        setLoaderStep(2);
        for (let i = 0; i < step3.galleryBlobs.length; i++) {
          const blob = step3.galleryBlobs[i];
          const filename = `photo_${Date.now()}_${i}.jpg`;
          const { data: photoData, error: photoErr } = await supabase.storage
            .from('establishment-photos')
            .upload(`${establishment.id}/${filename}`, blob, { contentType: 'image/jpeg' });
          if (photoErr) throw new Error("Impossible d'envoyer vos photos. Réessayez.");
          const photoUrl = supabase.storage.from('establishment-photos').getPublicUrl(photoData.path).data.publicUrl;
          await supabase.from('establishment_photos').insert({
            establishment_id: establishment.id,
            url: photoUrl,
            order_index: i,
          });
        }
      }

      setLoaderStep(3);
      fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-welcome-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: step1.email, username: `${step1.prenom} ${step1.nom}`, type: 'pro' }),
      }).catch(() => {});
      await new Promise((r) => setTimeout(r, 800));
      toast.success('Bienvenue ! Votre établissement est en ligne. Complétez votre fiche pour la mettre en valeur.');
      onClose();
      navigate('/pros/tableau-de-bord');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la création.');
      setSubmitting(false);
      setVerifying(false);
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

  // Adresse déjà utilisée : on le dit, avec la sortie (se connecter). Avant, on
  // affichait l'écran du code et le gérant restait planté devant un champ inutile.
  if (alreadyRegistered) {
    return (
      <div className="fixed inset-0 flex items-center justify-center p-0 md:p-4" style={{ zIndex: 1000, background: 'rgba(0,0,0,0.75)' }}>
        <div
          className="relative w-full h-full md:w-full md:max-w-[460px] md:h-auto md:rounded-2xl overflow-hidden flex flex-col justify-center p-8 md:p-10 text-center"
          style={{ background: '#0f0f17', border: '1px solid #1e1e2e', boxShadow: '0 25px 60px rgba(0,0,0,0.7)' }}
        >
          <button onClick={onClose} className="absolute top-4 right-5 p-1" style={{ color: '#606070' }} aria-label="Fermer">
            <X size={20} />
          </button>
          <h2 className="text-[20px] font-bold text-white">Cette adresse a déjà un compte</h2>
          <p className="text-[13px] mt-3" style={{ color: '#a0a0b0' }}>
            <strong className="text-white">{step1.email}</strong> est déjà inscrite sur Pass Navigay.
            Connectez-vous avec cette adresse, ou recommencez avec une autre adresse e-mail.
          </p>
          <button
            onClick={onSwitchToLogin}
            className="w-full mt-6 py-3 rounded-lg bg-[#7B2D8B] text-white text-[15px] font-semibold hover:bg-[#9b3dab] transition-colors"
          >
            Me connecter
          </button>
          <button
            onClick={() => { setAlreadyRegistered(false); setStep1({ ...step1, email: '' }); setStep(1); }}
            className="w-full mt-3 py-2.5 text-[13px] font-medium transition-colors hover:underline"
            style={{ color: '#a0a0b0' }}
          >
            Utiliser une autre adresse
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'verify') {
    return (
      <div className="fixed inset-0 flex items-center justify-center p-0 md:p-4" style={{ zIndex: 1000, background: 'rgba(0,0,0,0.75)' }}>
        <div
          className="relative w-full h-full md:w-full md:max-w-[460px] md:h-auto md:rounded-2xl overflow-hidden flex flex-col justify-center p-8 md:p-10"
          style={{ background: '#0f0f17', border: '1px solid #1e1e2e', boxShadow: '0 25px 60px rgba(0,0,0,0.7)' }}
        >
          <button onClick={handleClose} className="absolute top-4 right-5 p-1" style={{ color: '#606070' }} aria-label="Fermer">
            <X size={20} />
          </button>
          <div className="text-center mb-6">
            <h2 className="text-[20px] font-bold text-white">Vérification</h2>
            <p className="text-[13px] text-[#a0a0b0] mt-2">
              Un code à 6 chiffres a été envoyé à<br />
              <strong className="text-white">{step1.email}</strong>
            </p>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); handleVerify(); }} className="space-y-4">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="w-full text-center text-[28px] tracking-[0.5em] font-mono rounded-lg py-3 text-white outline-none"
              style={{ background: '#14141e', border: '1px solid #2a2a3a' }}
            />
            <button
              type="submit"
              disabled={verifying}
              className="w-full py-3 rounded-lg bg-[#7B2D8B] text-white text-[15px] font-semibold hover:bg-[#9b3dab] transition-colors disabled:opacity-50"
            >
              {verifying ? 'Vérification…' : 'Valider et créer mon établissement'}
            </button>
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="w-full py-2.5 text-[13px] font-medium transition-colors hover:underline disabled:opacity-50"
              style={{ color: '#a0a0b0' }}
            >
              {resending ? 'Envoi en cours…' : "Je n'ai rien reçu, renvoyer le code"}
            </button>
            <p className="text-[12px] text-center" style={{ color: '#606070' }}>
              Pensez à regarder dans vos courriers indésirables. Le code est valable 15 minutes.
            </p>
          </form>
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
            <RegisterStep3 data={step3} onChange={setStep3} onPrev={() => setStep(2)} onSubmit={handleSignup} submitting={submitting} />
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
