import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Send, Eye, EyeOff, CheckCircle, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import PlanSelection, { type PlanType } from '../../components/ui/PlanSelection';

type TunnelStep = 'plan' | 'chat' | 'verify';
type ChatStep = 'username' | 'email' | 'password' | 'submitting' | 'done';

interface ChatMessage {
  id: string;
  from: 'bot' | 'user';
  text: string;
}

const BOT_MESSAGES = {
  welcome: "Salut ! Bienvenue sur Pass Navigay.",
  askUsername: "Pour commencer, comment veux-tu qu'on t'appelle ? Choisis un pseudo unique.",
  usernameOk: "Super pseudo !",
  askEmail: "Maintenant, quelle est ton adresse email ? On en aura besoin pour securiser ton compte.",
  emailOk: "Parfait !",
  askPassword: "Derniere etape : choisis un mot de passe (6 caracteres minimum).",
  creating: "C'est parti, je cree ton compte...",
  done: "Ton compte est cree ! Verifie ton email pour activer ton acces.",
};

export default function Register() {
  const [tunnelStep, setTunnelStep] = useState<TunnelStep>('plan');
  const [selectedPlan, setSelectedPlan] = useState<PlanType | null>(null);

  const [chatStep, setChatStep] = useState<ChatStep>('username');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'w1', from: 'bot', text: BOT_MESSAGES.welcome },
    { id: 'w2', from: 'bot', text: BOT_MESSAGES.askUsername },
  ]);
  const [input, setInput] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [animatingBot, setAnimatingBot] = useState(false);

  const [verifyCode, setVerifyCode] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);

  const { signUp, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, animatingBot]);

  useEffect(() => {
    if (!animatingBot && chatStep !== 'done' && tunnelStep === 'chat') {
      inputRef.current?.focus();
    }
  }, [animatingBot, chatStep, tunnelStep]);

  const addBotMessage = (text: string): Promise<void> => {
    return new Promise((resolve) => {
      setAnimatingBot(true);
      setTimeout(() => {
        setMessages((prev) => [...prev, { id: `b-${Date.now()}-${Math.random()}`, from: 'bot', text }]);
        setAnimatingBot(false);
        resolve();
      }, 600);
    });
  };

  const addUserMessage = (text: string) => {
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, from: 'user', text }]);
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || animatingBot || chatStep === 'submitting' || chatStep === 'done') return;

    const value = input.trim();
    setInput('');

    if (chatStep === 'username') {
      if (value.length < 3) {
        toast.error('Le pseudo doit contenir au moins 3 caracteres.');
        return;
      }
      addUserMessage(value);
      setUsername(value);
      await addBotMessage(BOT_MESSAGES.usernameOk);
      await addBotMessage(BOT_MESSAGES.askEmail);
      setChatStep('email');
    } else if (chatStep === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        toast.error("Cette adresse email n'a pas l'air valide.");
        return;
      }
      addUserMessage(value);
      setEmail(value);
      await addBotMessage(BOT_MESSAGES.emailOk);
      await addBotMessage(BOT_MESSAGES.askPassword);
      setChatStep('password');
    } else if (chatStep === 'password') {
      if (value.length < 6) {
        toast.error('Le mot de passe doit contenir au moins 6 caracteres.');
        return;
      }
      addUserMessage('\u2022'.repeat(value.length));
      setChatStep('submitting');
      await addBotMessage(BOT_MESSAGES.creating);

      const { error } = await signUp(email, value, username);

      if (error) {
        const isEmailError = error.toLowerCase().includes('email') || error.toLowerCase().includes('adresse');
        toast.error(error);
        if (isEmailError) {
          setChatStep('email');
          await addBotMessage("Cette adresse email est deja utilisee ou invalide. Essaie avec une autre adresse.");
        } else {
          setChatStep('password');
          await addBotMessage("Hmm, quelque chose n'a pas fonctionne. Reessaie.");
        }
      } else {
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-welcome-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, username, type: 'user' }),
        }).catch(() => {});
        await addBotMessage(BOT_MESSAGES.done);
        setChatStep('done');
        setTimeout(() => {
          setTunnelStep('verify');
        }, 1200);
      }
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyCode.length !== 6) {
      toast.error('Le code doit contenir 6 chiffres.');
      return;
    }

    setVerifyLoading(true);
    const { error } = await verifyOtp(email, verifyCode);
    setVerifyLoading(false);

    if (error) {
      toast.error(error);
      return;
    }

    if (selectedPlan === 'premium') {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-premium-checkout`;
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${session?.access_token ?? ''}`,
          },
          body: JSON.stringify({ billingInterval: 'yearly' }),
        });
        const data = await res.json();
        if (data?.url) {
          window.open(data.url, '_blank');
          return;
        }
      } catch {
        // Stripe not configured yet
      }
      toast.success('Bienvenue sur Pass Navigay ! Le paiement Premium sera disponible prochainement.');
      navigate('/explore');
    } else {
      toast.success('Bienvenue sur Pass Navigay !');
      navigate('/explore');
    }
  };

  const getPlaceholder = (): string => {
    switch (chatStep) {
      case 'username': return 'Ton pseudo...';
      case 'email': return 'ton@email.com';
      case 'password': return '6 caracteres minimum';
      default: return '';
    }
  };

  const getInputType = (): string => {
    if (chatStep === 'email') return 'email';
    if (chatStep === 'password') return showPassword ? 'text' : 'password';
    return 'text';
  };

  const isInputDisabled = chatStep === 'submitting' || chatStep === 'done' || animatingBot;

  const handleClose = () => {
    navigate(-1);
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) handleClose();
  };

  const stepIndex = tunnelStep === 'plan' ? 0 : tunnelStep === 'chat' ? 1 : 2;

  const stepIndicator = (
    <div className="flex items-center justify-center gap-2 py-3 border-b border-light-border dark:border-dark-border shrink-0">
      {['Plan', 'Infos', 'Verification'].map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          {i > 0 && <div className="w-6 h-px" style={{ background: i <= stepIndex ? '#7B2D8B' : '#2a2a3a' }} />}
          <div className="flex items-center gap-1.5">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
              style={{
                background: i <= stepIndex ? '#7B2D8B' : '#2a2a3a',
                color: i <= stepIndex ? 'white' : '#606070',
              }}
            >
              {i + 1}
            </div>
            <span
              className="text-[11px] font-medium hidden sm:inline"
              style={{ color: i <= stepIndex ? '#c084f5' : '#606070' }}
            >
              {label}
            </span>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={handleBackdropClick}
    >
      <div
        className="relative w-full max-w-[480px] bg-light-surface dark:bg-dark-surface rounded-[16px] shadow-2xl flex flex-col"
        style={{ animation: 'fadeSlideIn 0.25s ease-out', maxHeight: '90vh' }}
      >
        <button
          onClick={handleClose}
          aria-label="Fermer"
          className="absolute top-3 right-3 z-10 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <X size={20} />
        </button>

        {stepIndicator}

        {tunnelStep === 'plan' && (
          <div className="overflow-y-auto flex-1 min-h-0">
            <PlanSelection
              selectedPlan={selectedPlan}
              onSelect={setSelectedPlan}
              onContinue={() => setTunnelStep('chat')}
              onSwitchToLogin={() => navigate('/auth/login')}
            />
          </div>
        )}

        {tunnelStep === 'chat' && (
          <>
            <div className="p-4 border-b border-light-border dark:border-dark-border flex items-center gap-3 shrink-0">
              <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
                <span className="text-white text-sm font-semibold">P</span>
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-gray-900 dark:text-white text-sm">Pass</span>
                  <span className="font-semibold text-sm" style={{ color: '#7B2D8B' }}>Navigay</span>
                </div>
                <span className="text-xs text-success flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />
                  En ligne
                </span>
              </div>
              {selectedPlan && (
                <span
                  className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    background: selectedPlan === 'premium' ? 'rgba(123,45,139,0.2)' : '#2a2a3a',
                    color: selectedPlan === 'premium' ? '#c084f5' : '#a0a0b0',
                  }}
                >
                  {selectedPlan === 'premium' ? 'Premium' : 'Gratuit'}
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}
                  style={{ animation: 'fadeSlideIn 0.3s ease-out' }}
                >
                  <div
                    className={`max-w-[80%] px-4 py-2.5 text-sm leading-relaxed ${
                      msg.from === 'user'
                        ? 'bg-primary text-white rounded-2xl rounded-br-sm'
                        : 'bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border text-gray-900 dark:text-gray-100 rounded-2xl rounded-bl-sm'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}

              {animatingBot && (
                <div className="flex justify-start">
                  <div className="bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-2xl rounded-bl-sm px-4 py-3">
                    <div className="flex gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              {chatStep === 'done' && (
                <div className="flex justify-center py-4">
                  <div className="flex items-center gap-2 text-success">
                    <CheckCircle size={20} />
                    <span className="text-sm font-medium">Redirection...</span>
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {chatStep !== 'done' && (
              <form onSubmit={handleChatSubmit} className="p-4 border-t border-light-border dark:border-dark-border shrink-0">
                <div className="flex gap-2 items-center">
                  <div className="relative flex-1">
                    <input
                      ref={inputRef}
                      type={getInputType()}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={getPlaceholder()}
                      disabled={isInputDisabled}
                      className="input-field pr-10"
                      autoComplete={chatStep === 'password' ? 'new-password' : chatStep === 'email' ? 'email' : 'off'}
                    />
                    {chatStep === 'password' && (
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={isInputDisabled || !input.trim()}
                    aria-label="Envoyer"
                    className="btn-primary p-3 shrink-0"
                  >
                    {chatStep === 'submitting' ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Send size={18} />
                    )}
                  </button>
                </div>

                <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-3">
                  Deja un compte ?{' '}
                  <Link to="/auth/login" className="text-primary hover:underline font-medium">
                    Connecte-toi
                  </Link>
                </p>
              </form>
            )}
          </>
        )}

        {tunnelStep === 'verify' && (
          <div className="p-6 space-y-5">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary mx-auto flex items-center justify-center mb-4">
                <span className="text-white text-lg font-semibold">P</span>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Verification</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Un code a 6 chiffres a ete envoye a{' '}
                <strong className="text-gray-700 dark:text-gray-300">{email}</strong>
              </p>
            </div>

            <form onSubmit={handleVerifySubmit} className="space-y-4">
              <div>
                <label htmlFor="verify-code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Code de verification
                </label>
                <input
                  id="verify-code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  required
                  className="input-field text-center text-2xl tracking-[0.5em] font-mono"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={verifyLoading}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {verifyLoading && <Loader2 size={18} className="animate-spin" />}
                Valider
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
