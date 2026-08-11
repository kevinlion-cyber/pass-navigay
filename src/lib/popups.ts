import { useEffect, useState } from 'react';
import { supabase } from './supabase';

/**
 * Textes des fenêtres (pop-ups) du site, éditables par l'admin.
 *
 * Kevin doit pouvoir changer les mots de ces fenêtres sans toucher au code.
 * Tout est stocké dans `app_settings` sous la clé `popups_config` (un seul JSON),
 * et fusionné par-dessus les valeurs par défaut ci-dessous. Si rien n'est en base,
 * ce sont les défauts qui s'affichent : aucune fenêtre ne peut se retrouver vide.
 */

export type PopupKey = 'welcome' | 'messages_premium' | 'promos_premium';

export interface PopupText {
  title: string;
  body: string;
  cta: string;
}

/** Libellé et emplacement de chaque fenêtre, pour l'écran d'administration. */
export const POPUP_META: Record<PopupKey, { label: string; where: string }> = {
  welcome: {
    label: 'Accueil (message de bienvenue)',
    where: "Fenêtre affichée sur la page d'accueil, par-dessus l'annuaire.",
  },
  messages_premium: {
    label: 'Messagerie Premium',
    where: "Écran affiché aux membres non Premium sur l'onglet Messages.",
  },
  promos_premium: {
    label: 'Promotions Premium',
    where: "Bloc affiché aux membres non Premium sur l'onglet Promotions.",
  },
};

export const POPUP_DEFAULTS: Record<PopupKey, PopupText> = {
  welcome: {
    title: 'Pass Navigay',
    body: 'Découvrez les lieux LGBT-friendly près de chez vous.',
    cta: 'Créer mon compte',
  },
  messages_premium: {
    title: 'La messagerie est réservée aux membres Premium',
    body: 'Passez Premium pour envoyer des messages à la communauté.',
    cta: 'Passer Premium',
  },
  promos_premium: {
    title: 'Réservé aux membres Premium',
    body: 'Les promotions de nos partenaires sont réservées aux membres Premium.',
    cta: 'Passer Premium',
  },
};

// Cache mémoire : les fenêtres sont lues souvent, la config change rarement.
let cache: Record<PopupKey, PopupText> | null = null;

/** À appeler après une sauvegarde admin pour que les nouveaux textes soient relus. */
export function clearPopupsCache(): void {
  cache = null;
}

export async function fetchPopups(): Promise<Record<PopupKey, PopupText>> {
  if (cache) return cache;
  const merged: Record<PopupKey, PopupText> = {
    welcome: { ...POPUP_DEFAULTS.welcome },
    messages_premium: { ...POPUP_DEFAULTS.messages_premium },
    promos_premium: { ...POPUP_DEFAULTS.promos_premium },
  };
  try {
    const { data } = await supabase.from('app_settings').select('value').eq('key', 'popups_config').maybeSingle();
    if (data?.value) {
      const parsed = JSON.parse(data.value) as Partial<Record<PopupKey, Partial<PopupText>>>;
      (Object.keys(merged) as PopupKey[]).forEach((k) => {
        const o = parsed[k];
        if (o) {
          if (typeof o.title === 'string' && o.title.trim()) merged[k].title = o.title;
          if (typeof o.body === 'string' && o.body.trim()) merged[k].body = o.body;
          if (typeof o.cta === 'string' && o.cta.trim()) merged[k].cta = o.cta;
        }
      });
    }
  } catch {
    /* on garde les valeurs par défaut */
  }
  cache = merged;
  return merged;
}

/** Renvoie les textes d'une fenêtre (défauts d'abord, remplacés dès que la base répond). */
export function usePopupText(key: PopupKey): PopupText {
  const [text, setText] = useState<PopupText>(POPUP_DEFAULTS[key]);
  useEffect(() => {
    let alive = true;
    fetchPopups().then((all) => { if (alive) setText(all[key]); });
    return () => { alive = false; };
  }, [key]);
  return text;
}
