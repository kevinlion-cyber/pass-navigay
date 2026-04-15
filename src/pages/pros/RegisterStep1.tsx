import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

export interface Step1Data {
  prenom: string;
  nom: string;
  email: string;
  phone: string;
  password: string;
}

interface RegisterStep1Props {
  data: Step1Data;
  onChange: (data: Step1Data) => void;
  onNext: () => void;
}

function getPasswordStrength(pw: string): number {
  if (pw.length < 8) return 0;
  let score = 1;
  if (/[A-Z]/.test(pw) || /[0-9]/.test(pw)) score = 2;
  if (/[A-Z]/.test(pw) && /[0-9]/.test(pw)) score = 3;
  if (/[A-Z]/.test(pw) && /[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score = 4;
  return score;
}

const STRENGTH_LABELS = ['', 'Faible', 'Moyen', 'Bon', 'Excellent'];
const STRENGTH_COLORS = ['', '#ef4444', '#f97316', '#eab308', '#22c55e'];

export default function RegisterStep1({ data, onChange, onNext }: RegisterStep1Props) {
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmPw, setConfirmPw] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [checking, setChecking] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const strength = getPasswordStrength(data.password);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email);
  const phoneValid = data.phone.replace(/\D/g, '').length >= 10;
  const passwordsMatch = data.password === confirmPw && confirmPw.length > 0;

  const set = (field: keyof Step1Data, value: string) => {
    onChange({ ...data, [field]: value });
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!data.prenom.trim()) errs.prenom = 'Ce champ est requis.';
    if (!data.nom.trim()) errs.nom = 'Ce champ est requis.';
    if (!data.email.trim()) errs.email = 'Ce champ est requis.';
    else if (!emailValid) errs.email = 'Format d\u2019email invalide.';
    if (!data.phone.trim()) errs.phone = 'Ce champ est requis.';
    else if (!phoneValid) errs.phone = 'Au moins 10 chiffres requis.';
    if (!data.password) errs.password = 'Ce champ est requis.';
    else if (data.password.length < 8) errs.password = 'Au moins 8 caract\u00e8res requis.';
    if (!confirmPw) errs.confirm = 'Ce champ est requis.';
    else if (data.password !== confirmPw) errs.confirm = 'Les mots de passe ne correspondent pas.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = async () => {
    if (!validate()) return;
    setChecking(true);
    try {
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', data.email)
        .maybeSingle();
      if (existing) {
        toast.error('Cet email est d\u00e9j\u00e0 utilis\u00e9. Connectez-vous plut\u00f4t.');
        setChecking(false);
        return;
      }
    } catch {
      // profiles may not have email column, proceed
    }
    setChecking(false);
    onNext();
  };

  const inputStyle = (field: string, extraValid?: boolean) => ({
    background: '#0a0a0f',
    border: `1px solid ${errors[field] ? '#ef4444' : (extraValid === false && touched[field]) ? '#ef4444' : (extraValid === true && touched[field]) ? '#22c55e' : '#2a2a3a'}`,
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[20px] font-bold text-white">Parlez-nous de vous</h2>
        <p className="text-[13px] mt-1" style={{ color: '#a0a0b0' }}>
          Ces informations serviront à créer votre compte Pass Navigay.
        </p>
      </div>

      <div>
        <label className="block text-[13px] font-medium text-[#c0c0d0] mb-1.5">Votre prénom</label>
        <input
          value={data.prenom}
          onChange={(e) => set('prenom', e.target.value)}
          placeholder="Marie"
          className="w-full px-4 py-3 rounded-[10px] text-[14px] text-white outline-none transition-colors focus:border-[#7B2D8B]"
          style={inputStyle('prenom')}
        />
        {errors.prenom && <p className="text-[12px] text-red-500 mt-1">{errors.prenom}</p>}
      </div>

      <div>
        <label className="block text-[13px] font-medium text-[#c0c0d0] mb-1.5">Votre nom</label>
        <input
          value={data.nom}
          onChange={(e) => set('nom', e.target.value)}
          placeholder="Dupont"
          className="w-full px-4 py-3 rounded-[10px] text-[14px] text-white outline-none transition-colors focus:border-[#7B2D8B]"
          style={inputStyle('nom')}
        />
        {errors.nom && <p className="text-[12px] text-red-500 mt-1">{errors.nom}</p>}
      </div>

      <div>
        <label className="block text-[13px] font-medium text-[#c0c0d0] mb-1.5">Votre email professionnel</label>
        <input
          type="email"
          value={data.email}
          onChange={(e) => set('email', e.target.value)}
          onBlur={() => setTouched((p) => ({ ...p, email: true }))}
          placeholder="marie@monestablissement.fr"
          className="w-full px-4 py-3 rounded-[10px] text-[14px] text-white outline-none transition-colors focus:border-[#7B2D8B]"
          style={inputStyle('email', data.email ? emailValid : undefined)}
        />
        {errors.email && <p className="text-[12px] text-red-500 mt-1">{errors.email}</p>}
      </div>

      <div>
        <label className="block text-[13px] font-medium text-[#c0c0d0] mb-1.5">Votre numéro de téléphone</label>
        <input
          type="tel"
          value={data.phone}
          onChange={(e) => set('phone', e.target.value)}
          onBlur={() => setTouched((p) => ({ ...p, phone: true }))}
          placeholder="06 12 34 56 78"
          className="w-full px-4 py-3 rounded-[10px] text-[14px] text-white outline-none transition-colors focus:border-[#7B2D8B]"
          style={inputStyle('phone')}
        />
        {errors.phone && <p className="text-[12px] text-red-500 mt-1">{errors.phone}</p>}
      </div>

      <div>
        <label className="block text-[13px] font-medium text-[#c0c0d0] mb-1.5">Choisissez un mot de passe</label>
        <div className="relative">
          <input
            type={showPw ? 'text' : 'password'}
            value={data.password}
            onChange={(e) => set('password', e.target.value)}
            className="w-full px-4 py-3 pr-11 rounded-[10px] text-[14px] text-white outline-none transition-colors focus:border-[#7B2D8B]"
            style={inputStyle('password')}
          />
          <button
            type="button"
            onClick={() => setShowPw(!showPw)}
            className="absolute right-3 top-1/2 -translate-y-1/2"
            style={{ color: '#606070' }}
          >
            {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {errors.password && <p className="text-[12px] text-red-500 mt-1">{errors.password}</p>}
        {data.password.length > 0 && (
          <div className="mt-2">
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="flex-1 h-[3px] rounded-full"
                  style={{ background: i <= strength ? STRENGTH_COLORS[strength] : '#1e1e2e' }}
                />
              ))}
            </div>
            {strength > 0 && (
              <p className="text-[11px] mt-1" style={{ color: STRENGTH_COLORS[strength] }}>
                {STRENGTH_LABELS[strength]}
              </p>
            )}
          </div>
        )}
      </div>

      <div>
        <label className="block text-[13px] font-medium text-[#c0c0d0] mb-1.5">Confirmez votre mot de passe</label>
        <div className="relative">
          <input
            type={showConfirm ? 'text' : 'password'}
            value={confirmPw}
            onChange={(e) => { setConfirmPw(e.target.value); setErrors((p) => ({ ...p, confirm: '' })); }}
            onBlur={() => setTouched((p) => ({ ...p, confirm: true }))}
            className="w-full px-4 py-3 pr-11 rounded-[10px] text-[14px] text-white outline-none transition-colors focus:border-[#7B2D8B]"
            style={{
              background: '#0a0a0f',
              border: `1px solid ${errors.confirm ? '#ef4444' : (touched.confirm && confirmPw) ? (passwordsMatch ? '#22c55e' : '#ef4444') : '#2a2a3a'}`,
            }}
          />
          <button
            type="button"
            onClick={() => setShowConfirm(!showConfirm)}
            className="absolute right-3 top-1/2 -translate-y-1/2"
            style={{ color: '#606070' }}
          >
            {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {errors.confirm && <p className="text-[12px] text-red-500 mt-1">{errors.confirm}</p>}
      </div>

      <button
        onClick={handleNext}
        disabled={checking}
        className="w-full py-3.5 rounded-[10px] text-[15px] font-semibold text-white transition-colors flex items-center justify-center gap-2"
        style={{ background: '#7B2D8B' }}
      >
        {checking && <LoadingSpinner size={16} />}
        Continuer &rarr;
      </button>
    </div>
  );
}
