import { useEffect, useState } from 'react';
import { MessageSquare, Loader2, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import {
  POPUP_DEFAULTS,
  POPUP_META,
  clearPopupsCache,
  type PopupKey,
  type PopupText,
} from '../../lib/popups';

const POPUP_KEYS = Object.keys(POPUP_DEFAULTS) as PopupKey[];
const SETTINGS_KEY = 'popups_config';

export default function AdminPopups() {
  const [texts, setTexts] = useState<Record<PopupKey, PopupText>>(POPUP_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', SETTINGS_KEY).maybeSingle().then(({ data }) => {
      const merged: Record<PopupKey, PopupText> = {
        welcome: { ...POPUP_DEFAULTS.welcome },
        messages_premium: { ...POPUP_DEFAULTS.messages_premium },
        promos_premium: { ...POPUP_DEFAULTS.promos_premium },
        events: { ...POPUP_DEFAULTS.events },
      };
      if (data?.value) {
        try {
          const parsed = JSON.parse(data.value) as Partial<Record<PopupKey, Partial<PopupText>>>;
          POPUP_KEYS.forEach((k) => {
            const o = parsed[k];
            if (o) merged[k] = { ...merged[k], ...o };
          });
        } catch { /* on garde les défauts */ }
      }
      setTexts(merged);
      setLoading(false);
    });
  }, []);

  const setField = (key: PopupKey, field: keyof PopupText, value: string) => {
    setTexts((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  const resetOne = (key: PopupKey) => {
    setTexts((prev) => ({ ...prev, [key]: { ...POPUP_DEFAULTS[key] } }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({ key: SETTINGS_KEY, value: JSON.stringify(texts), updated_at: new Date().toISOString() }, { onConflict: 'key' });
      if (error) throw error;
      clearPopupsCache();
      toast.success('Textes des pop-ups enregistrés');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="flex justify-center py-12"><LoadingSpinner size={32} /></div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <MessageSquare size={22} className="text-[#c084f5]" />
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Pop-ups</h1>
      </div>
      <p className="text-sm text-gray-500 max-w-2xl">
        Modifiez ici les textes des fenêtres affichées aux visiteurs. Laissez un champ vide pour
        revenir au texte par défaut. Les changements s'appliquent au prochain affichage.
      </p>

      <div className="space-y-4">
        {POPUP_KEYS.map((key) => {
          const t = texts[key];
          const meta = POPUP_META[key];
          const def = POPUP_DEFAULTS[key];
          return (
            <div key={key} className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-card p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-[15px] font-semibold text-gray-900 dark:text-white">{meta.label}</h2>
                  <p className="text-[12px] text-gray-500 mt-0.5">{meta.where}</p>
                </div>
                <button
                  onClick={() => resetOne(key)}
                  className="shrink-0 flex items-center gap-1.5 text-[12px] text-gray-500 hover:text-[#c084f5] transition-colors"
                  title="Remettre le texte par défaut"
                >
                  <RotateCcw size={13} /> Par défaut
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[12px] uppercase tracking-[0.5px] text-[#606070] font-medium mb-1.5">Titre</label>
                  <input
                    value={t.title}
                    onChange={(e) => setField(key, 'title', e.target.value)}
                    placeholder={def.title}
                    className="input-field bg-light-surface dark:bg-dark-surface border-light-border dark:border-dark-border text-gray-900 dark:text-white text-sm w-full py-2"
                  />
                </div>
                <div>
                  <label className="block text-[12px] uppercase tracking-[0.5px] text-[#606070] font-medium mb-1.5">Texte</label>
                  <textarea
                    value={t.body}
                    onChange={(e) => setField(key, 'body', e.target.value)}
                    placeholder={def.body}
                    rows={2}
                    className="input-field bg-light-surface dark:bg-dark-surface border-light-border dark:border-dark-border text-gray-900 dark:text-white text-sm w-full py-2 resize-y"
                  />
                </div>
                <div>
                  <label className="block text-[12px] uppercase tracking-[0.5px] text-[#606070] font-medium mb-1.5">
                    {def.cta2 ? 'Premier bouton' : 'Bouton'}
                  </label>
                  <input
                    value={t.cta}
                    onChange={(e) => setField(key, 'cta', e.target.value)}
                    placeholder={def.cta}
                    className="input-field bg-light-surface dark:bg-dark-surface border-light-border dark:border-dark-border text-gray-900 dark:text-white text-sm w-full py-2 md:max-w-xs"
                  />
                  {def.cta2 && (
                    <p className="text-[11px] text-gray-500 mt-1">
                      Mène à la création d'un compte gratuit. Masqué pour un membre déjà connecté.
                    </p>
                  )}
                </div>
                {/* Second bouton : seule la fenêtre de l'agenda en a un (compte gratuit
                    d'un côté, pass Premium de l'autre). */}
                {def.cta2 && (
                  <div>
                    <label className="block text-[12px] uppercase tracking-[0.5px] text-[#606070] font-medium mb-1.5">Second bouton</label>
                    <input
                      value={t.cta2 || ''}
                      onChange={(e) => setField(key, 'cta2', e.target.value)}
                      placeholder={def.cta2}
                      className="input-field bg-light-surface dark:bg-dark-surface border-light-border dark:border-dark-border text-gray-900 dark:text-white text-sm w-full py-2 md:max-w-xs"
                    />
                    <p className="text-[11px] text-gray-500 mt-1">Mène à la page Tarifs, au pass Premium.</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="sticky bottom-4 flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="btn-primary text-sm flex items-center gap-2 py-2.5 px-6 shadow-lg disabled:opacity-60"
        >
          {saving && <Loader2 size={16} className="animate-spin" />}
          Enregistrer
        </button>
      </div>
    </div>
  );
}
