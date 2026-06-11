import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, ArrowRight, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { QUESTIONNAIRE_SECTIONS, TOTAL_QUESTIONS, type QuestionDef } from '../../lib/questionnaireData';

interface Props {
  onClose: () => void;
}

interface ChatMsg {
  id: string;
  from: 'bot' | 'user';
  text: string;
}

export default function PremiumQuestionnaireModal({ onClose }: Props) {
  const { user, profile, refreshProfile } = useAuth();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [sectionIdx, setSectionIdx] = useState(0);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [typing, setTyping] = useState(false);
  const [multiSelected, setMultiSelected] = useState<string[]>([]);
  const [textInput, setTextInput] = useState('');
  const [tripleInputs, setTripleInputs] = useState<string[]>(['', '', '']);
  const [awaitingInput, setAwaitingInput] = useState(false);
  const [finished, setFinished] = useState(false);
  const [answeredCount, setAnsweredCount] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, typing, awaitingInput]);

  const addBot = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      setTyping(true);
      setTimeout(() => {
        setMessages((prev) => [...prev, { id: `b-${Date.now()}-${Math.random()}`, from: 'bot', text }]);
        setTyping(false);
        resolve();
      }, 800);
    });
  }, []);

  const addUser = useCallback((text: string) => {
    setMessages((prev) => [...prev, { id: `u-${Date.now()}-${Math.random()}`, from: 'user', text }]);
  }, []);

  const saveField = useCallback(async (field: string, value: string | string[]) => {
    if (!user || field.startsWith('_')) return;
    await supabase.from('profiles').update({ [field]: value }).eq('id', user.id);
  }, [user]);

  const currentSection = QUESTIONNAIRE_SECTIONS[sectionIdx];
  const currentQuestion: QuestionDef | undefined = currentSection?.questions[questionIdx];

  const advanceToNextQuestion = useCallback(async () => {
    const nextQIdx = questionIdx + 1;
    if (nextQIdx < currentSection.questions.length) {
      setQuestionIdx(nextQIdx);
      const nextQ = currentSection.questions[nextQIdx];
      await addBot(nextQ.botMessage);
      setAwaitingInput(true);
    } else {
      const nextSIdx = sectionIdx + 1;
      if (nextSIdx < QUESTIONNAIRE_SECTIONS.length) {
        setSectionIdx(nextSIdx);
        setQuestionIdx(0);
        const nextSec = QUESTIONNAIRE_SECTIONS[nextSIdx];
        if (nextSec.intro) {
          await addBot(nextSec.intro);
        }
        const firstQ = nextSec.questions[0];
        if (firstQ.botMessage) {
          await addBot(firstQ.botMessage);
        }
        setAwaitingInput(true);
      } else {
        if (user) {
          await supabase.from('profiles').update({ questionnaire_completed: true }).eq('id', user.id);
        }
        await addBot("C'est tout ! Ton profil est maintenant cree. Tu peux modifier toutes ces infos a tout moment et choisir ce que tu veux montrer aux autres membres.");
        setFinished(true);
      }
    }
  }, [sectionIdx, questionIdx, currentSection, addBot, user]);

  useEffect(() => {
    const initChat = async () => {
      const sec = QUESTIONNAIRE_SECTIONS[0];
      if (sec.intro) {
        await addBot(sec.intro);
      }
      const firstQ = sec.questions[0];
      if (firstQ.botMessage) {
        await addBot(firstQ.botMessage);
      }
      setAwaitingInput(true);
    };
    initChat();
  }, []);

  const handleSingleSelect = async (option: string) => {
    setAwaitingInput(false);
    addUser(option);
    setAnsweredCount((c) => c + 1);

    if (currentQuestion) {
      if (currentQuestion.field === 'gender_identity') {
        await saveField(currentQuestion.field, option);
      } else if (Array.isArray(profile?.[currentQuestion.field as keyof typeof profile])) {
        await saveField(currentQuestion.field, [option]);
      } else {
        await saveField(currentQuestion.field, option);
      }
    }

    await advanceToNextQuestion();
  };

  const handleMultiConfirm = async () => {
    if (multiSelected.length === 0) return;
    setAwaitingInput(false);
    addUser(multiSelected.join(', '));
    setAnsweredCount((c) => c + 1);

    if (currentQuestion) {
      const isArrayField = ['attracted_to', 'looking_for', 'green_flags', 'red_flags', 'community_goals'].includes(currentQuestion.field);
      if (isArrayField) {
        await saveField(currentQuestion.field, multiSelected);
      } else {
        await saveField(currentQuestion.field, multiSelected.join(', '));
      }
    }

    setMultiSelected([]);
    await advanceToNextQuestion();
  };

  const handleTextSubmit = async () => {
    if (!textInput.trim()) return;
    setAwaitingInput(false);
    addUser(textInput.trim());
    setAnsweredCount((c) => c + 1);

    if (currentQuestion) {
      await saveField(currentQuestion.field, textInput.trim());
    }

    setTextInput('');
    await advanceToNextQuestion();
  };

  const handleTripleSubmit = async () => {
    if (!currentQuestion?.tripleFields) return;
    const filled = tripleInputs.some((v) => v.trim());
    if (!filled) return;
    setAwaitingInput(false);

    const display = currentQuestion.tripleFields
      .map((f, i) => tripleInputs[i].trim() ? `${f.label}: ${tripleInputs[i].trim()}` : '')
      .filter(Boolean)
      .join(' | ');
    addUser(display);
    setAnsweredCount((c) => c + 1);

    for (let i = 0; i < currentQuestion.tripleFields.length; i++) {
      if (tripleInputs[i].trim()) {
        await saveField(currentQuestion.tripleFields[i].field, tripleInputs[i].trim());
      }
    }

    setTripleInputs(['', '', '']);
    await advanceToNextQuestion();
  };

  const toggleMulti = (option: string) => {
    setMultiSelected((prev) =>
      prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]
    );
  };

  const progress = Math.round((answeredCount / TOTAL_QUESTIONS) * 100);

  const handleFinish = async () => {
    await refreshProfile();
    onClose();
  };

  return (
    <div className="fixed inset-x-0 top-14 bottom-0 z-[60] flex flex-col" style={{ background: '#0a0a0f' }}>
      <div className="flex items-center gap-3 px-4 pt-3 pb-2 shrink-0">
        <div className="flex-1">
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#1a1a24' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%`, background: '#7B2D8B' }}
            />
          </div>
          <p className="text-[10px] mt-1 text-right" style={{ color: '#606070' }}>{progress}%</p>
        </div>
        <button
          onClick={onClose}
          className="text-[12px] font-medium px-3 py-1.5 rounded-full transition-colors shrink-0"
          style={{ color: '#606070' }}
        >
          Passer
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4" style={{ maxWidth: 600, margin: '0 auto', width: '100%' }}>
        <div className="space-y-4 py-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}
              style={{ animation: 'fadeSlideIn 0.3s ease-out' }}
            >
              {msg.from === 'bot' && (
                <div className="w-8 h-8 rounded-full shrink-0 mr-2 flex items-center justify-center" style={{ background: '#7B2D8B' }}>
                  <span className="text-white text-[10px] font-bold">P</span>
                </div>
              )}
              <div
                className="max-w-[80%] px-[18px] py-[14px] text-[14px] leading-relaxed"
                style={msg.from === 'user'
                  ? {
                      background: 'rgba(123,45,139,0.3)',
                      border: '1px solid rgba(123,45,139,0.5)',
                      borderRadius: '16px 16px 4px 16px',
                      color: '#e0e0f0',
                    }
                  : {
                      background: '#1a1a24',
                      borderRadius: '16px 16px 16px 4px',
                      color: '#d0d0e0',
                    }
                }
              >
                {msg.text}
              </div>
            </div>
          ))}

          {typing && (
            <div className="flex justify-start" style={{ animation: 'fadeSlideIn 0.3s ease-out' }}>
              <div className="w-8 h-8 rounded-full shrink-0 mr-2 flex items-center justify-center" style={{ background: '#7B2D8B' }}>
                <span className="text-white text-[10px] font-bold">P</span>
              </div>
              <div className="px-5 py-3.5 rounded-2xl" style={{ background: '#1a1a24', borderRadius: '16px 16px 16px 4px' }}>
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#606070', animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#606070', animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#606070', animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          {awaitingInput && !typing && currentQuestion && !finished && (
            <div className="pt-2" style={{ animation: 'fadeSlideIn 0.3s ease-out' }}>
              {currentQuestion.type === 'single' && currentQuestion.options && (
                <div className="flex flex-wrap gap-2">
                  {currentQuestion.options.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => handleSingleSelect(opt)}
                      className="px-[18px] py-[10px] rounded-full text-[14px] transition-all cursor-pointer"
                      style={{
                        background: '#14141e',
                        border: '1px solid #2a2a3a',
                        color: '#a0a0b0',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#7B2D8B';
                        e.currentTarget.style.color = '#fff';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#2a2a3a';
                        e.currentTarget.style.color = '#a0a0b0';
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}

              {currentQuestion.type === 'multi' && currentQuestion.options && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {currentQuestion.options.map((opt) => {
                      const selected = multiSelected.includes(opt);
                      return (
                        <button
                          key={opt}
                          onClick={() => toggleMulti(opt)}
                          className="px-[18px] py-[10px] rounded-full text-[14px] transition-all cursor-pointer flex items-center gap-2"
                          style={{
                            background: selected ? 'rgba(123,45,139,0.2)' : '#14141e',
                            border: selected ? '1px solid #7B2D8B' : '1px solid #2a2a3a',
                            color: selected ? '#c084f5' : '#a0a0b0',
                          }}
                        >
                          {selected && <Check size={14} />}
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                  {multiSelected.length > 0 && (
                    <button
                      onClick={handleMultiConfirm}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-full text-[14px] font-semibold text-white transition-all"
                      style={{ background: '#7B2D8B' }}
                    >
                      Valider mes choix <ArrowRight size={16} />
                    </button>
                  )}
                </div>
              )}

              {currentQuestion.type === 'text' && (
                <div className="flex gap-2 items-end">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value.slice(0, currentQuestion.maxLength || 200))}
                      placeholder={currentQuestion.placeholder}
                      maxLength={currentQuestion.maxLength || 200}
                      className="w-full px-4 py-3 rounded-xl text-[14px] text-white placeholder-gray-500 outline-none focus:ring-1 focus:ring-[#7B2D8B]"
                      style={{ background: '#14141e', border: '1px solid #2a2a3a' }}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleTextSubmit(); }}
                      autoFocus
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px]" style={{ color: '#606070' }}>
                      {textInput.length}/{currentQuestion.maxLength || 200}
                    </span>
                  </div>
                  <button
                    onClick={handleTextSubmit}
                    disabled={!textInput.trim()}
                    className="p-3 rounded-xl transition-all shrink-0"
                    style={{ background: textInput.trim() ? '#7B2D8B' : '#2a2a3a' }}
                  >
                    <Send size={16} className="text-white" />
                  </button>
                </div>
              )}

              {currentQuestion.type === 'triple_text' && currentQuestion.tripleFields && (
                <div className="space-y-3">
                  {currentQuestion.tripleFields.map((tf, idx) => (
                    <div key={tf.field}>
                      <label className="text-[12px] font-medium mb-1 block" style={{ color: '#a0a0b0' }}>
                        {tf.label} &rarr;
                      </label>
                      <input
                        type="text"
                        value={tripleInputs[idx]}
                        onChange={(e) => {
                          const copy = [...tripleInputs];
                          copy[idx] = e.target.value.slice(0, 60);
                          setTripleInputs(copy);
                        }}
                        placeholder={tf.placeholder}
                        maxLength={60}
                        className="w-full px-4 py-2.5 rounded-xl text-[14px] text-white placeholder-gray-500 outline-none focus:ring-1 focus:ring-[#7B2D8B]"
                        style={{ background: '#14141e', border: '1px solid #2a2a3a' }}
                      />
                    </div>
                  ))}
                  <button
                    onClick={handleTripleSubmit}
                    disabled={!tripleInputs.some((v) => v.trim())}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full text-[14px] font-semibold text-white transition-all"
                    style={{ background: tripleInputs.some((v) => v.trim()) ? '#7B2D8B' : '#2a2a3a' }}
                  >
                    Valider <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </div>
          )}

          {finished && (
            <div className="pt-4 flex justify-center" style={{ animation: 'fadeSlideIn 0.3s ease-out' }}>
              <button
                onClick={handleFinish}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-[15px] font-semibold text-white transition-all hover:opacity-90"
                style={{ background: '#7B2D8B' }}
              >
                Voir mon profil <ArrowRight size={18} />
              </button>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}
