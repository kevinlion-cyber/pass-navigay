import { supabase } from './supabase';

// Clé publique VAPID (non secrète — la privée est un secret côté Edge Function).
export const VAPID_PUBLIC_KEY = 'BG5EzA6lNDkBEGmrzC4h1X4LmPzI5lpNxcngy84GdKrF29A3jyxc13jzQG-0vF9YJdxDaNgn27Sdd_SVLwvuZSU';

export function pushSupported(): boolean {
  return typeof navigator !== 'undefined'
    && 'serviceWorker' in navigator
    && typeof window !== 'undefined'
    && 'PushManager' in window
    && 'Notification' in window;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch {
    return null;
  }
}

// Demande la permission, s'abonne au push et enregistre l'abonnement en base.
// Retourne { ok, reason } — reason permet d'afficher un message utile.
export async function enablePush(userId: string): Promise<{ ok: boolean; reason?: string }> {
  if (!pushSupported()) return { ok: false, reason: 'unsupported' };
  const reg = await registerServiceWorker();
  if (!reg) return { ok: false, reason: 'sw' };

  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return { ok: false, reason: 'denied' };

  await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  const sub = existing ?? (await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  }));

  const json = sub.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id: userId,
    endpoint: sub.endpoint,
    p256dh: json.keys?.p256dh ?? '',
    auth: json.keys?.auth ?? '',
  }, { onConflict: 'endpoint' });
  if (error) return { ok: false, reason: error.message };

  return { ok: true };
}

// Désabonne cet appareil et retire l'abonnement de la base.
export async function disablePush(userId: string): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      await sub.unsubscribe();
    } else {
      await supabase.from('push_subscriptions').delete().eq('user_id', userId);
    }
  } catch {
    /* ignore */
  }
}

// Envoie la notif push au destinataire d'un message (best-effort, ne bloque pas l'UI).
export async function notifyNewMessage(receiverId: string, preview: string): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-message-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({ receiverId, preview }),
    });
  } catch {
    /* best-effort */
  }
}
