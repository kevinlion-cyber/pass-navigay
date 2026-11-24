import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

// Envoie une notification push « nouveau message » aux appareils du destinataire,
// s'il a laissé les notifications activées. Appelé par l'expéditeur après l'envoi.
//
// Sécurité (faille M1 de l'audit, 24/11/2026) : avant, n'importe quel compte, même
// gratuit, pouvait envoyer une notification au texte libre sur le téléphone de
// n'importe quel membre, sans envoyer de vrai message. Désormais la notification
// ne part que si un VRAI message de l'expéditeur vers ce destinataire vient d'être
// enregistré (moins de 2 minutes, non lu), et son texte est celui du message en
// base — jamais un texte fourni par le navigateur. L'enregistrement du message
// lui-même reste contrôlé par la base (réservé aux Premium).
// Fichier autonome : peut être redéployé depuis l'éditeur du tableau de bord Supabase.

const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:contact@passnavigay.com";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const RECENT_MS = 2 * 60 * 1000;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return jsonResponse({ error: "Non authentifié" }, 401);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: auth, error: authErr } = await userClient.auth.getUser();
    const user = auth?.user;
    if (authErr || !user) return jsonResponse({ error: "Non authentifié" }, 401);

    const { receiverId } = await req.json().catch(() => ({}));
    if (!receiverId || typeof receiverId !== "string") {
      return jsonResponse({ error: "receiverId requis" }, 400);
    }
    if (receiverId === user.id) return jsonResponse({ success: true, skipped: "self" });

    const svc = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Un vrai message, tout juste envoyé, non lu ?
    const since = new Date(Date.now() - RECENT_MS).toISOString();
    const { data: msg } = await svc
      .from("messages")
      .select("content, created_at")
      .eq("sender_id", user.id)
      .eq("receiver_id", receiverId)
      .eq("is_read", false)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!msg) return jsonResponse({ success: true, skipped: "no_recent_message" });

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
    const text = typeof msg.content === "string" ? msg.content.trim() : "";
    const payload = JSON.stringify({
      title: `${senderName} vous a envoyé un message`,
      body: text ? text.slice(0, 120) : "Nouveau message",
      url: `/messages/${user.id}`,
      // Même étiquette pour un même expéditeur : les notifications se remplacent
      // au lieu de s'empiler si l'appel est répété.
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
    console.error("send-message-push:", err);
    return jsonResponse({ error: "Erreur" }, 500);
  }
});
