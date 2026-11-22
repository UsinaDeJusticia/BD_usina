// supabase/functions/send-push/index.ts
//
// Envía por Web Push una notificación ya guardada en public.notificaciones a
// todos los dispositivos registrados de su destinatario.
//
// La invoca el trigger trg_notificaciones_push (scripts/016_notifications.sql)
// vía pg_net, con el header x-cron-secret. No es pública.
//
// Variables de entorno (Supabase → Edge Functions → Secrets):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (las inyecta Supabase)
//   CRON_SECRET                               (el mismo de check-anniversaries)
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY       (par VAPID; la pública también va
//                                              en Vercel como NEXT_PUBLIC_VAPID_PUBLIC_KEY)
//   VAPID_SUBJECT                             (p.ej. "mailto:info@usinadejusticia.org.ar")
//
// Privacidad: el contenido viaja cifrado de punta a punta (RFC 8291); el
// servicio de push del navegador (Google/Apple/Mozilla) no puede leerlo.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const jsonHeaders = { "Content-Type": "application/json" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

/** Comparación en tiempo constante para no filtrar el secret por timing. */
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  let diff = ab.length ^ bb.length;
  const len = Math.max(ab.length, bb.length);
  for (let i = 0; i < len; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...jsonHeaders, Allow: "POST" },
    });
  }

  // A diferencia de check-anniversaries, acá el secreto es OBLIGATORIO.
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || !safeEqual(req.headers.get("x-cron-secret") ?? "", cronSecret)) {
    return json({ error: "Unauthorized" }, 401);
  }

  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:info@usinadejusticia.org.ar";
  if (!vapidPublic || !vapidPrivate) {
    console.error("send-push: faltan VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY");
    return json({ error: "Push no configurado" }, 503);
  }

  let notificacionId: string;
  try {
    const body = await req.json();
    notificacionId = String(body?.notificacion_id ?? "");
  } catch {
    return json({ error: "Body inválido" }, 400);
  }
  if (!UUID_RE.test(notificacionId)) {
    return json({ error: "notificacion_id inválido" }, 400);
  }

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: notif, error: notifError } = await supabase
      .from("notificaciones")
      .select("id, user_email, tipo, titulo, cuerpo, url, push_enviada_at")
      .eq("id", notificacionId)
      .maybeSingle();
    if (notifError) throw new Error(`notificacion: ${notifError.message}`);
    if (!notif) return json({ error: "No existe" }, 404);
    if (notif.push_enviada_at) return json({ ok: true, skipped: "ya enviada" });

    const { data: subs, error: subsError } = await supabase
      .from("push_suscripciones")
      .select("id, endpoint, p256dh, auth")
      .eq("user_email", notif.user_email); // ambos guardados en minúsculas
    if (subsError) throw new Error(`suscripciones: ${subsError.message}`);

    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

    const payload = JSON.stringify({
      id: notif.id,
      title: notif.titulo,
      body: notif.cuerpo ?? "",
      url: notif.url ?? "/notificaciones",
      tipo: notif.tipo,
    });

    let sent = 0;
    const expired: string[] = [];
    const delivered: string[] = [];
    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { TTL: 60 * 60 * 24, urgency: "normal", topic: String(notif.id).replace(/-/g, "").slice(0, 32) },
        );
        sent++;
        delivered.push(s.id);
      } catch (err) {
        const status = (err as { statusCode?: number })?.statusCode;
        // 404/410: el navegador dio de baja la suscripción. Se borra.
        if (status === 404 || status === 410) expired.push(s.id);
        else console.error("send-push: fallo al enviar", status ?? (err as Error)?.message);
      }
    }

    if (expired.length > 0) {
      await supabase.from("push_suscripciones").delete().in("id", expired);
    }
    if (delivered.length > 0) {
      await supabase
        .from("push_suscripciones")
        .update({ last_success_at: new Date().toISOString() })
        .in("id", delivered);
    }
    await supabase
      .from("notificaciones")
      .update({ push_enviada_at: new Date().toISOString() })
      .eq("id", notif.id);

    return json({ ok: true, sent, expired: expired.length, devices: subs?.length ?? 0 });
  } catch (error) {
    console.error("send-push error:", error instanceof Error ? error.message : error);
    return json({ error: "Internal error" }, 500);
  }
});
