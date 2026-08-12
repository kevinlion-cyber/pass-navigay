import { useEffect, useState } from 'react';
import { MessageSquare, Loader2, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { translateDbError } from '../../lib/dbErrors';
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
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', SETTINGS_KEY).maybeSingle().then(({ data }) => {
      const merged: Record<PopupKey, PopupText> = {
        welcome: { ...POPUP_DEFAULTS.welcome },
        messages_premium: { ...POPUP_DEFAULTS.messages_premium },
        promos_premium: { ...POPUP_DEFAULTS.promos_premium },
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

  // Téléversement du logo de la fenêtre d'accueil. On enregistre tout de suite dans
  // les réglages : sinon un logo envoyé mais non sauvegardé resterait dans le
  // stockage sans être utilisé, et la personne croirait avoir fini.
  const handleLogoFile = async (key: PopupKey, file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Choisissez un fichier image (PNG, JPG ou WEBP).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Le logo doit peser moins de 2 Mo.');
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `logo-${key}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('site-assets')
        .upload(path, file, { contentType: file.type, upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('site-assets').getPublicUrl(path);
      const next = { ...texts, [key]: { ...texts[key], logo_url: urlData.publicUrl } };
      setTexts(next);
      await persist(next);
      toast.success('Logo mis à jour');
    } catch (e) {
      toast.error(translateDbError(e, "L'envoi du logo a échoué. Réessayez."));
    }
    setUploading(false);
  };

  const removeLogo = async (key: PopupKey) => {
    const next = { ...texts, [key]: { ...texts[key], logo_url: '' } };
    setTexts(next);
    await persist(next);
    toast.success('Logo retiré : le logo du site est utilisé.');
  };

  const persist = async (value: Record<PopupKey, PopupText>) => {
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: SETTINGS_KEY, value: JSON.stringify(value), updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw error;
    clearPopupsCache();
  };

  const save = async () => {
    setSaving(true);
    try {
      await persist(texts);
      toast.success('Textes des pop-ups enregistrés');
    } catch (e) {
      toast.error(translateDbError(e, "L'enregistrement a échoué. Réessayez."));
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
                {/* Logo : uniquement la fenêtre d'accueil en a un. */}
                {meta.hasLogo && (
                  <div>
                    <label className="block text-[12px] uppercase tracking-[0.5px] text-[#606070] font-medium mb-1.5">Logo</label>
                    <div className="flex items-center gap-4">
                      <img
                        src={t.logo_url || '/logo.png?v=2'}
                        alt=""
                        className="w-16 h-16 object-contain rounded-lg bg-light-bg dark:bg-dark-bg p-1"
                      />
                      <div className="space-y-2">
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          disabled={uploading}
                          onChange={(e) => { handleLogoFile(key, e.target.files?.[0]); e.target.value = ''; }}
                          className="block text-[13px] text-gray-600 dark:text-gray-300"
                        />
                        <p className="text-[11px] text-gray-500">
                          PNG, JPG ou WEBP · 2 Mo maximum. {t.logo_url
                            ? 'Votre logo est utilisé.'
                            : 'Aucun logo choisi : celui du site est utilisé.'}
                        </p>
                        {t.logo_url && (
                          <button
                            onClick={() => removeLogo(key)}
                            className="text-[12px] text-gray-500 hover:text-alert transition-colors"
                          >
                            Retirer et revenir au logo du site
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
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
                    Bouton
                  </label>
                  <input
                    value={t.cta}
                    onChange={(e) => setField(key, 'cta', e.target.value)}
                    placeholder={def.cta}
                    className="input-field bg-light-surface dark:bg-dark-surface border-light-border dark:border-dark-border text-gray-900 dark:text-white text-sm w-full py-2 md:max-w-xs"
                  />
                </div>
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
