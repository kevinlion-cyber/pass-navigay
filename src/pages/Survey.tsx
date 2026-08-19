import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Loader2, Lock, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import {
  SURVEY_INTRO, SURVEY_SECTIONS, isVisible, missingIn,
  type Answers, type Question,
} from '../lib/survey';

/**
 * Questionnaire public, en plusieurs étapes.
 *
 * Une seule page de 21 questions fait fuir. On avance donc **une section à la
 * fois** (5 étapes), avec une barre de progression, et rien d'obligatoire n'est
 * signalé en rouge tant qu'on n'a pas essayé de passer à la suite : on
 * accompagne, on ne réprimande pas.
 */
export default function Survey() {
  const [step, setStep] = useState(-1); // -1 = écran d'accueil
  const [answers, setAnswers] = useState<Answers>({});
  const [showErrors, setShowErrors] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const sections = SURVEY_SECTIONS;
  const section = sections[step];
  const progress = step < 0 ? 0 : Math.round((step / sections.length) * 100);

  const missing = useMemo(
    () => (section ? missingIn(section, answers) : []),
    [section, answers],
  );

  const set = (id: string, value: Answers[string]) => {
    setAnswers((a) => ({ ...a, [id]: value }));
    setShowErrors(false);
  };

  const toggle = (q: Question, option: string) => {
    const current = Array.isArray(answers[q.id]) ? (answers[q.id] as string[]) : [];
    const next = current.includes(option) ? current.filter((o) => o !== option) : [...current, option];
    // Question « top 2 » : au-delà du compte demandé, on remplace le plus ancien
    // choix plutôt que de refuser le clic en silence.
    if (q.exactly && next.length > q.exactly) next.shift();
    set(q.id, next);
  };

  const next = () => {
    if (missing.length) { setShowErrors(true); return; }
    setShowErrors(false);
    setStep((s) => s + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const back = () => {
    setShowErrors(false);
    setStep((s) => s - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async () => {
    if (missing.length) { setShowErrors(true); return; }
    setSending(true);
    try {
      const recontact = answers.recontact === 'oui';
      const email = typeof answers.email === 'string' ? answers.email.trim() : '';
      const { error } = await supabase.from('survey_responses').insert({
        answers,
        email: recontact && email ? email : null,
        recontact,
        session_id: (() => { try { return localStorage.getItem('pn_session_id'); } catch { return null; } })(),
        user_agent: navigator.userAgent.slice(0, 300),
      });
      if (error) throw error;
      setDone(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      toast.error("Votre réponse n'a pas pu être envoyée. Réessayez dans un instant.");
    }
    setSending(false);
  };

  /* ── Remerciement ──────────────────────────────────────────────────────── */
  if (done) {
    return (
      <Shell>
        <div className="text-center py-10">
          <div className="w-14 h-14 rounded-full bg-success/15 flex items-center justify-center mx-auto mb-5">
            <Check size={26} className="text-success" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">Merci, c'est envoyé.</h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
            Vos réponses vont directement servir à construire la suite. C'est exactement ce qui manquait.
          </p>
          <Link to="/" className="btn-primary inline-flex mt-7">Découvrir les lieux</Link>
        </div>
      </Shell>
    );
  }

  /* ── Écran d'accueil ───────────────────────────────────────────────────── */
  if (step < 0) {
    return (
      <Shell>
        <div className="py-6">
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-white mb-4">
            Votre avis, avant qu'on aille plus loin
          </h1>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-6">{SURVEY_INTRO}</p>

          <ul className="space-y-2 mb-8">
            {[
              ['Anonyme', "Aucun compte, aucune trace. Vous ne donnez votre e-mail que si vous le voulez."],
              ['Une dizaine de minutes', `${sections.length} étapes courtes, vous pouvez revenir en arrière.`],
              ['Rien à ménager', "Un avis tiède ne sert à rien. Les critiques sont les réponses les plus utiles."],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-3">
                <Check size={16} className="text-primary shrink-0 mt-1" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  <strong className="text-gray-900 dark:text-white">{t}.</strong> {d}
                </span>
              </li>
            ))}
          </ul>

          <button onClick={() => setStep(0)} className="btn-primary w-full sm:w-auto px-8 py-3 inline-flex items-center gap-2">
            Commencer <ArrowRight size={17} />
          </button>
        </div>
      </Shell>
    );
  }

  /* ── Une étape ─────────────────────────────────────────────────────────── */
  const isLast = step === sections.length - 1;

  return (
    <Shell>
      <div className="mb-6">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
          <span>Étape {step + 1} sur {sections.length}</span>
          <span className="tabular-nums">{progress} %</span>
        </div>
        <div className="h-1.5 rounded-full bg-light-border dark:bg-dark-border overflow-hidden">
          <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{section.title}</h2>
      {section.intro && <p className="text-sm text-gray-500 mt-1 mb-7">{section.intro}</p>}

      <div className="space-y-8">
        {section.questions.filter((q) => isVisible(q, answers)).map((q) => (
          <Field key={q.id} q={q} answers={answers} set={set} toggle={toggle}
            error={showErrors && missing.includes(q)} />
        ))}
      </div>

      {showErrors && missing.length > 0 && (
        <p className="text-sm text-alert mt-6">
          Il reste {missing.length === 1 ? 'une réponse' : `${missing.length} réponses`} à compléter au-dessus.
        </p>
      )}

      <div className="flex items-center gap-3 mt-9">
        <button onClick={back} className="btn-ghost inline-flex items-center gap-1.5 text-sm">
          <ArrowLeft size={16} /> Retour
        </button>
        {isLast ? (
          <button onClick={submit} disabled={sending} className="btn-primary flex-1 sm:flex-none px-8 py-3 inline-flex items-center justify-center gap-2">
            {sending ? <Loader2 size={17} className="animate-spin" /> : <Send size={16} />}
            {sending ? 'Envoi…' : 'Envoyer mes réponses'}
          </button>
        ) : (
          <button onClick={next} className="btn-primary flex-1 sm:flex-none px-8 py-3 inline-flex items-center justify-center gap-2">
            Continuer <ArrowRight size={17} />
          </button>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-20">
      <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card p-6 sm:p-8">
        {children}
      </div>
      <p className="flex items-center justify-center gap-1.5 text-xs text-gray-400 mt-4">
        <Lock size={12} /> Réponses anonymes, lues uniquement par l'équipe de Pass Navigay.
      </p>
    </div>
  );
}

function Field({
  q, answers, set, toggle, error,
}: {
  q: Question;
  answers: Answers;
  set: (id: string, v: Answers[string]) => void;
  toggle: (q: Question, option: string) => void;
  error: boolean;
}) {
  const value = answers[q.id];
  const chosen = Array.isArray(value) ? value : [];
  const inputClass =
    `input-field w-full bg-light-bg dark:bg-dark-bg text-gray-900 dark:text-white ${
      error ? 'border-alert' : 'border-light-border dark:border-dark-border'}`;

  return (
    <div>
      <label className="block font-medium text-gray-900 dark:text-white mb-1 leading-snug">{q.label}</label>
      {q.hint && <p className="text-xs text-gray-500 mb-3">{q.hint}</p>}
      {!q.hint && <div className="mb-3" />}

      {q.kind === 'radio' && (
        <div className="flex flex-wrap gap-2">
          {q.options!.map((o) => {
            const on = value === o;
            return (
              <button key={o} type="button" onClick={() => set(q.id, o)}
                className={`px-4 py-2.5 rounded-input border text-sm text-left transition-colors ${
                  on ? 'border-primary bg-primary/10 text-primary font-medium'
                     : 'border-light-border dark:border-dark-border text-gray-700 dark:text-gray-300 hover:border-primary'}`}>
                {o}
              </button>
            );
          })}
        </div>
      )}

      {q.kind === 'checkbox' && (
        <div className="space-y-2">
          {q.options!.map((o) => {
            const on = chosen.includes(o);
            return (
              <button key={o} type="button" onClick={() => toggle(q, o)}
                className={`w-full flex items-start gap-3 px-4 py-3 rounded-input border text-sm text-left transition-colors ${
                  on ? 'border-primary bg-primary/10' : 'border-light-border dark:border-dark-border hover:border-primary'}`}>
                <span className={`w-4 h-4 rounded shrink-0 mt-0.5 border flex items-center justify-center ${
                  on ? 'bg-primary border-primary' : 'border-gray-400'}`}>
                  {on && <Check size={11} className="text-white" />}
                </span>
                <span className={on ? 'text-primary font-medium' : 'text-gray-700 dark:text-gray-300'}>{o}</span>
              </button>
            );
          })}
          {q.exactly && (
            <p className="text-xs text-gray-500">{chosen.length} sur {q.exactly} choisies.</p>
          )}
        </div>
      )}

      {q.kind === 'scale' && (
        <div>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => set(q.id, n)}
                className={`flex-1 py-3 rounded-input border text-sm font-semibold transition-colors ${
                  value === n ? 'border-primary bg-primary/10 text-primary'
                              : 'border-light-border dark:border-dark-border text-gray-500 hover:border-primary'}`}>
                {n}
              </button>
            ))}
          </div>
          {q.scaleLabels && (
            <div className="flex justify-between text-xs text-gray-500 mt-1.5">
              <span>1, {q.scaleLabels[0]}</span><span>5, {q.scaleLabels[1]}</span>
            </div>
          )}
        </div>
      )}

      {q.kind === 'text' && (
        <input value={(value as string) || ''} onChange={(e) => set(q.id, e.target.value)} className={inputClass} />
      )}

      {q.kind === 'email' && (
        <input type="email" inputMode="email" placeholder="vous@exemple.fr"
          value={(value as string) || ''} onChange={(e) => set(q.id, e.target.value)} className={inputClass} />
      )}

      {q.kind === 'textarea' && (
        <textarea rows={4} value={(value as string) || ''} onChange={(e) => set(q.id, e.target.value)}
          className={`${inputClass} resize-y`} />
      )}
    </div>
  );
}
