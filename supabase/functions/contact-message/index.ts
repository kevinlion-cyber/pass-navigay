import { createClient } from "npm:@supabase/supabase-js@2.57.4";

// Formulaire de la page Contact (27/11/2026). Avant, le formulaire n'envoyait rien.
// Envoie le message par email à l'équipe (adresse jamais montrée sur le site) avec
// « Répondre à » = l'adresse du visiteur, et en garde une copie (table contact_messages).
// Garde-fous : champ piège anti-robots, longueurs bornées, 3 messages / heure par
// adresse IP (empreinte, jamais l'IP en clair), 50 / jour au total, texte échappé.
// Secrets : CONTACT_EMAIL (sinon ADMIN_ALERT_EMAIL) + RESEND_API_KEY.
// Fichier autonome, déployable depuis le tableau de bord, « Verify JWT » désactivé
// (les visiteurs sans compte doivent pouvoir écrire).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SUJETS = ["Question générale", "Problème technique", "Partenariat", "Signalement", "Autre"];
const echapper = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

async function empreinte(texte: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texte));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return json({ error: "Requête invalide." }, 400);
  }

  // Champ piège invisible : un robot le remplit, un humain non. On fait semblant d'accepter.
  if (typeof b.site_web === "string" && b.site_web.trim() !== "") return json({ ok: true });

  const name = typeof b.name === "string" ? b.name.trim().slice(0, 80) : "";
  const email = typeof b.email === "string" ? b.email.trim().slice(0, 200) : "";
  const subject = typeof b.subject === "string" && SUJETS.includes(b.subject) ? b.subject : "Autre";
  const message = typeof b.message === "string" ? b.message.trim().slice(0, 5000) : "";
  if (!name) return json({ error: "Indique ton prénom." }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ error: "Adresse email invalide." }, 400);
  if (message.length < 20) return json({ error: "Ton message doit contenir au moins 20 caractères." }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  // Compte connecté éventuel (facultatif)
  let userId: string | null = null;
  const auth = req.headers.get("Authorization") || "";
  if (auth.startsWith("Bearer ")) {
    const { data } = await admin.auth.getUser(auth.slice(7));
    userId = data.user?.id ?? null;
  }

  // Limites anti-abus
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "inconnue";
  const ipHash = await empreinte(`${ip}|${Deno.env.get("SUPABASE_URL")}`);
  const uneHeure = new Date(Date.now() - 3_600_000).toISOString();
  const unJour = new Date(Date.now() - 86_400_000).toISOString();
  const [{ count: parIp }, { count: total }] = await Promise.all([
    admin.from("contact_messages").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", uneHeure),
    admin.from("contact_messages").select("id", { count: "exact", head: true }).gte("created_at", unJour),
  ]);
  if ((parIp ?? 0) >= 3) return json({ error: "Tu as déjà envoyé plusieurs messages. Réessaie dans une heure." }, 429);
  if ((total ?? 0) >= 50) return json({ error: "Trop de messages aujourd'hui. Réessaie demain." }, 429);

  const { data: ligne, error } = await admin
    .from("contact_messages")
    .insert({ name, email, subject, message, user_id: userId, ip_hash: ipHash })
    .select("id")
    .single();
  if (error) {
    console.error("contact-message: insertion", error.message);
    return json({ error: "Envoi impossible pour le moment." }, 500);
  }

  const to = Deno.env.get("CONTACT_EMAIL") || Deno.env.get("ADMIN_ALERT_EMAIL");
  const key = Deno.env.get("RESEND_API_KEY");
  if (!to || !key) {
    console.error("contact-message: CONTACT_EMAIL/ADMIN_ALERT_EMAIL ou RESEND_API_KEY manquant");
    return json({ ok: true }); // gardé en base, consultable par l'équipe
  }

  const html = `<p><strong>${echapper(name)}</strong> (${echapper(email)}) a écrit via le formulaire de contact de passnavigay.com.</p>
<p><strong>Sujet :</strong> ${echapper(subject)}${userId ? " · membre connecté" : ""}</p>
<div style="white-space:pre-wrap;border-left:3px solid #7B2D8B;padding:8px 12px;background:#f7f5f0">${echapper(message)}</div>
<p style="color:#888;font-size:12px">Répondez directement à cet email : la réponse partira vers ${echapper(email)}.</p>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Pass Navigay <bonjour@passnavigay.com>",
      to: [to],
      reply_to: email,
      subject: `[Contact] ${subject} — ${name}`.slice(0, 150),
      html,
    }),
  });
  if (res.ok) await admin.from("contact_messages").update({ email_sent: true }).eq("id", ligne.id);
  else console.error("contact-message: Resend", res.status, (await res.text()).slice(0, 200));

  return json({ ok: true });
});
