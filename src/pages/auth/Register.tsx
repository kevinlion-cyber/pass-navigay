import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Send, Eye, EyeOff, CheckCircle, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

type Step = 'username' | 'email' | 'password' | 'submitting' | 'done';

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
  const [step, setStep] = useState<Step>('username');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'w1', from: 'bot', text: BOT_MESSAGES.welcome },
    { id: 'w2', from: 'bot', text: BOT_MESSAGES.askUsername },
  ]);
  const [input, setInput] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [animatingBot, setAnimatingBot] = useState(false);

  const { signUp } = useAuth();
  const navigate = useNavigate();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, animatingBot]);

  useEffect(() => {
    if (!animatingBot && step !== 'done') {
      inputRef.current?.focus();
    }
  }, [animatingBot, step]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || animatingBot || step === 'submitting' || step === 'done') return;

    const value = input.trim();
    setInput('');

    if (step === 'username') {
      if (value.length < 3) {
        toast.error('Le pseudo doit contenir au moins 3 caracteres.');
        return;
      }
      addUserMessage(value);
      setUsername(value);
      await addBotMessage(BOT_MESSAGES.usernameOk);
      await addBotMessage(BOT_MESSAGES.askEmail);
      setStep('email');
    } else if (step === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        toast.error("Cette adresse email n'a pas l'air valide.");
        return;
      }
      addUserMessage(value);
      setEmail(value);
      await addBotMessage(BOT_MESSAGES.emailOk);
      await addBotMessage(BOT_MESSAGES.askPassword);
      setStep('password');
    } else if (step === 'password') {
      if (value.length < 6) {
        toast.error('Le mot de passe doit contenir au moins 6 caracteres.');
        return;
      }
      addUserMessage('\u2022'.repeat(value.length));
      setStep('submitting');
      await addBotMessage(BOT_MESSAGES.creating);

      const { error } = await signUp(email, value, username);

      if (error) {
        const isEmailError = error.toLowerCase().includes('email') || error.toLowerCase().includes('adresse');
        toast.error(error);
        if (isEmailError) {
          setStep('email');
          await addBotMessage("Cette adresse email est deja utilisee ou invalide. Essaie avec une autre adresse.");
        } else {
          setStep('password');
          await addBotMessage("Hmm, quelque chose n'a pas fonctionne. Reessaie.");
        }
      } else {
        await addBotMessage(BOT_MESSAGES.done);
        setStep('done');
        setTimeout(() => {
          navigate('/auth/verify', { state: { email } });
        }, 1500);
      }
    }
  };

  const getPlaceholder = (): string => {
    switch (step) {
      case 'username': return 'Ton pseudo...';
      case 'email': return 'ton@email.com';
      case 'password': return '6 caracteres minimum';
      default: return '';
    }
  };

  const getInputType = (): string => {
    if (step === 'email') return 'email';
    if (step === 'password') return showPassword ? 'text' : 'password';
    return 'text';
  };

  const isInputDisabled = step === 'submitting' || step === 'done' || animatingBot;

  const handleClose = () => {
    navigate(-1);
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) handleClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={handleBackdropClick}
    >
      <div
        className="relative w-full max-w-[400px] bg-light-surface dark:bg-dark-surface rounded-[16px] shadow-2xl flex flex-col"
        style={{ animation: 'fadeSlideIn 0.25s ease-out', maxHeight: '85vh' }}
      >
        <button
          onClick={handleClose}
          aria-label="Fermer"
          className="absolute top-3 right-3 z-10 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <X size={20} />
        </button>

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

          {step === 'done' && (
            <div className="flex justify-center py-4">
              <div className="flex items-center gap-2 text-success">
                <CheckCircle size={20} />
                <span className="text-sm font-medium">Redirection en cours...</span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {step !== 'done' && (
          <form onSubmit={handleSubmit} className="p-4 border-t border-light-border dark:border-dark-border shrink-0">
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
                  autoComplete={step === 'password' ? 'new-password' : step === 'email' ? 'email' : 'off'}
                />
                {step === 'password' && (
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
                {step === 'submitting' ? (
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
      </div>
    </div>
  );
}
