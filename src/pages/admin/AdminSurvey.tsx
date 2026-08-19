import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardList, Download, Mail, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ALL_QUESTIONS, SURVEY_SECTIONS, type Answers, type Question } from '../../lib/survey';

interface Response {
  id: string;
  answers: Answers;
  email: string | null;
  recontact: boolean;
  created_at: string;
}

/**
 * Dépouillement du questionnaire.
 *
 * Deux lectures complémentaires : les questions fermées en barres (on voit la
 * tendance d'un coup d'œil) et les réponses libres en entier (c'est là qu'est
 * la matière). Les libellés viennent de `src/lib/survey.ts`, donc jamais de
 * décalage avec ce qui a été demandé aux gens.
 */
export default function AdminSurvey() {
  const [rows, setRows] = useState<Response[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('survey_responses')
      .select('id,answers,email,recontact,created_at')
      .order('created_at', { ascending: false });
    setRows((data as Response[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const closed = useMemo(
    () => ALL_QUESTIONS.filter((q) => q.kind === 'radio' || q.kind === 'checkbox' || q.kind === 'scale'),
    [],
  );

  /** Compte les réponses d'une question fermée, valeur par valeur. */
  const tally = (q: Question) => {
    const counts = new Map<string, number>();
    for (const r of rows) {
      const v = r.answers?.[q.id];
      if (v === undefined || v === null || v === '') continue;
      const values = Array.isArray(v) ? v.map(String) : [String(v)];
      for (const x of values) counts.set(x, (counts.get(x) || 0) + 1);
    }
    const order = q.kind === 'scale' ? ['1', '2', '3', '4', '5'] : (q.options || []);
    const known = order.map((o) => ({ label: o, n: counts.get(o) || 0 }));
    // Les valeurs hors liste (anciennes formulations) restent visibles.
    const extra = [...counts.entries()].filter(([k]) => !order.includes(k)).map(([label, n]) => ({ label, n }));
    return [...known, ...extra];
  };

  const emails = useMemo(() => rows.filter((r) => r.recontact && r.email), [rows]);

  const exportCSV = () => {
    const cols = ['date', ...ALL_QUESTIONS.map((q) => q.label), 'e-mail'];
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const lines = [cols.map(esc).join(';')];
    for (const r of rows) {
      const cells = [new Date(r.created_at).toLocaleString('fr-FR')];
      for (const q of ALL_QUESTIONS) {
        const v = r.answers?.[q.id];
        cells.push(Array.isArray(v) ? v.join(' | ') : v === undefined ? '' : String(v));
      }
      cells.push(r.email || '');
      lines.push(cells.map(esc).join(';'));
    }
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `questionnaire-pass-navigay-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  if (loading) return <div className="skeleton h-64 rounded-card" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardList size={20} style={{ color: '#7B2D8B' }} />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Questionnaire</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} disabled={!rows.length}
            className="text-sm flex items-center gap-1.5 py-2 px-4 rounded-input border border-light-border dark:border-dark-border text-gray-700 dark:text-gray-300 hover:border-primary disabled:opacity-40">
            <Download size={15} /> Exporter
          </button>
          <button onClick={load} className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-900 dark:hover:text-white">
            <RefreshCw size={15} /> Rafraîchir
          </button>
        </div>
      </div>
      <p className="text-sm text-gray-500 -mt-3">
        Réponses reçues sur <a href="/questionnaire" target="_blank" rel="noreferrer" className="text-primary hover:underline">/questionnaire</a>.
        Anonymes, sauf l'e-mail laissé volontairement pour être recontacté.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Metric label="Réponses" value={String(rows.length)} />
        <Metric label="Acceptent d'être recontactés" value={String(emails.length)} />
        <Metric label="Dernière réponse"
          value={rows[0] ? new Date(rows[0].created_at).toLocaleDateString('fr-FR') : '—'} />
      </div>

      {rows.length === 0 ? (
        <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card p-12 text-center">
          <ClipboardList size={30} className="mx-auto text-gray-400 mb-3" />
          <p className="text-sm text-gray-500">Aucune réponse pour l'instant.</p>
        </div>
      ) : (
        <>
          {/* ── Ce que disent les questions fermées ────────────────────────── */}
          <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card p-5 space-y-6">
            <h2 className="font-semibold text-gray-900 dark:text-white">En un coup d'œil</h2>
            {closed.map((q) => {
              const data = tally(q);
              const max = Math.max(1, ...data.map((d) => d.n));
              return (
                <div key={q.id}>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">{q.label}</p>
                  <div className="space-y-1.5">
                    {data.map((d) => (
                      <div key={d.label} className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 w-1/2 sm:w-2/5 truncate" title={d.label}>{d.label}</span>
                        <div className="flex-1 h-2 rounded-full bg-light-bg dark:bg-dark-bg overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${(d.n / max) * 100}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 tabular-nums w-6 text-right">{d.n}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Les gens à recontacter ─────────────────────────────────────── */}
          {emails.length > 0 && (
            <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card p-5">
              <h2 className="font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                <Mail size={16} className="text-primary" /> À recontacter pour tester
              </h2>
              <p className="text-xs text-gray-500 mb-3">Ces personnes ont accepté explicitement.</p>
              <p className="text-sm text-gray-700 dark:text-gray-300 break-all">
                {emails.map((e) => e.email).join(', ')}
              </p>
            </div>
          )}

          {/* ── Chaque réponse en entier ───────────────────────────────────── */}
          <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card overflow-hidden">
            <div className="p-4 border-b border-light-border dark:border-dark-border">
              <h2 className="font-semibold text-gray-900 dark:text-white">Les réponses une par une</h2>
              <p className="text-xs text-gray-500">C'est dans les réponses libres qu'il y a le plus à apprendre.</p>
            </div>
            <ul className="divide-y divide-light-border dark:divide-dark-border">
              {rows.map((r, i) => {
                const open = openId === r.id;
                return (
                  <li key={r.id}>
                    <button onClick={() => setOpenId(open ? null : r.id)}
                      className="w-full flex items-center gap-3 p-4 text-left hover:bg-light-bg/60 dark:hover:bg-dark-bg/40 transition-colors">
                      {open ? <ChevronDown size={16} className="text-gray-400 shrink-0" /> : <ChevronRight size={16} className="text-gray-400 shrink-0" />}
                      <span className="text-sm font-medium text-gray-900 dark:text-white shrink-0">Réponse {rows.length - i}</span>
                      <span className="text-xs text-gray-500 shrink-0">{new Date(r.created_at).toLocaleString('fr-FR')}</span>
                      <span className="text-xs text-gray-400 truncate flex-1">
                        {typeof r.answers?.premiere_reaction === 'string' ? r.answers.premiere_reaction : ''}
                      </span>
                      {r.recontact && <span className="badge text-xs bg-primary/10 text-primary shrink-0">recontact</span>}
                    </button>
                    {open && (
                      <div className="px-4 pb-5 space-y-4">
                        {SURVEY_SECTIONS.map((s) => (
                          <div key={s.title}>
                            <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">{s.title}</p>
                            <div className="space-y-3">
                              {s.questions.map((q) => {
                                const v = r.answers?.[q.id];
                                if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) return null;
                                return (
                                  <div key={q.id}>
                                    <p className="text-xs text-gray-500">{q.label}</p>
                                    <p className="text-sm text-gray-900 dark:text-white whitespace-pre-line">
                                      {Array.isArray(v) ? v.join(' · ') : String(v)}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card p-5">
      <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</span>
      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
    </div>
  );
}
