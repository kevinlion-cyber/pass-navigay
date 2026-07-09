import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import webpush from "npm:web-push@3.6.7";
import { corsHeaders, getAuthenticatedUser, jsonResponse, serviceClient } from "../_shared/auth.ts";

const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:contact@passnavigay.com";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

// Envoie une notification push « nouveau message » aux appareils du destinataire,
// s'il a laissé les notifications activées. Appelé par l'expéditeur après l'envoi.
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return jsonResponse({ error: "Non authentifié" }, 401);

    const { receiverId, preview } = await req.json().catch(() => ({}));
    if (!receiverId || typeof receiverId !== "string") {
      return jsonResponse({ error: "receiverId requis" }, 400);
    }
    if (receiverId === user.id) return jsonResponse({ success: true, skipped: "self" });

    const svc = serviceClient();

    const [{ data: receiver }, { data: sender }] = await Promise.all([
      svc.from("profiles").select("notify_messages").eq("id", receiverId).maybeSingle(),
      svc.from("profiles").select("username, prenom").eq("id", user.id).maybeSingle(),
    ]);

    if (!receiver || receiver.notify_messages === false) {
      return jsonResponse({ success: true, skipped: "pref" });
    }

    const { data: subs } = await svc.from("push_subscriptions").select("*").eq("user_id", receiverId);
    if (!subs || subs.length === 0) return jsonResponse({ success: true, sent: 0 });

    const senderName = (sender?.prenom || sender?.username || "Quelqu'un") as string;
    const payload = JSON.stringify({
      title: `${senderName} vous a envoyé un message`,
      body: typeof preview === "string" && preview.trim() ? preview.slice(0, 120) : "Nouveau message",
      url: `/messages/${user.id}`,
      tag: `msg-${user.id}`,
    });

    let sent = 0;
    for (const s of subs) {
      const subscription = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } };
      try {
        await webpush.sendNotification(subscription, payload);
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) {
          await svc.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        }
      }
    }

    return jsonResponse({ success: true, sent });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Erreur" }, 500);
  }
});
