// supabase/functions/check-anniversaries/index.ts
//
// Notifica por email las víctimas cuyo cumpleaños o aniversario de
// fallecimiento cae al día siguiente (preaviso de 24h, para preparar
// contenido conmemorativo).
//
// Disparada por pg_cron a las 15:00 UTC (12:00 AR). Ver scripts/009_*.sql.
//
// Seguridad:
//   - La anon key es pública, así que `verify_jwt` sola no alcanza: cualquiera
//     podría invocar la función y mandar emails en loop. Si el secret
//     `CRON_SECRET` está configurado, se exige el header `x-cron-secret`
//     con ese valor (comparación en tiempo constante). Ver scripts/014_*.sql.
//   - Sin CORS: la invoca pg_cron (server-to-server), no un navegador.
//   - Los nombres se escapan antes de insertarlos en el HTML del email.
//
// Variables de entorno (Supabase → Edge Functions → Secrets):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY  (obligatorias)
//   CRON_SECRET              (recomendada; activa la verificación del header)
//   ANNIVERSARY_RECIPIENTS   (opcional; emails separados por coma)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend";

const jsonHeaders = { "Content-Type": "application/json" };

// Destinatarios por defecto (los mismos que antes). Se pueden reemplazar sin
// tocar código con el secret ANNIVERSARY_RECIPIENTS.
const DEFAULT_RECIPIENTS = ["info@usinadejusticia.org.ar", "ejairsud@gmail.com"];

function getRecipients(): string[] {
  const raw = Deno.env.get("ANNIVERSARY_RECIPIENTS");
  if (!raw) return DEFAULT_RECIPIENTS;
  const list = raw.split(",").map((e) => e.trim()).filter((e) => /^[^\s@]+@[^\s@]+$/.test(e));
  return list.length > 0 ? list : DEFAULT_RECIPIENTS;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

const TZ = "America/Argentina/Buenos_Aires";

interface Victima {
  id: string;
  nombre_completo: string;
  fecha_nacimiento: string | null;
  fecha_fallecimiento: string | null;
}

interface Anniversary {
  victimaId: string;
  nombre: string;
  tipo: "cumpleaños" | "fallecimiento";
  años: number;
}

/**
 * Devuelve { year, month, day } de la fecha pasada interpretada en
 * America/Argentina/Buenos_Aires. Hacerlo en UTC desfasa el día según
 * la hora que corra el cron en Supabase.
 */
function dateInAR(d: Date): { year: number; month: number; day: number } {
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d); // "YYYY-MM-DD"
  const [y, m, dd] = iso.split("-").map(Number);
  return { year: y, month: m, day: dd };
}

type Supa = ReturnType<typeof createClient>;

/**
 * Crea notificaciones en la app (y dispara push vía trigger) para los
 * aniversarios y audiencias de mañana. Usa crear_notificaciones(), que respeta
 * las preferencias de cada usuario y evita duplicados con dedupe_key.
 * Nunca lanza: devuelve un resumen o el error.
 */
async function notifyInApp(supabase: Supa, anniversaries: Anniversary[], targetISO: string) {
  try {
    let created = 0;
    for (const a of anniversaries) {
      const titulo = a.tipo === "fallecimiento"
        ? `Mañana: ${a.años} año${a.años !== 1 ? "s" : ""} del fallecimiento de ${a.nombre}`
        : `Mañana: ${a.nombre} cumpliría ${a.años} años`;
      const { data, error } = await supabase.rpc("crear_notificaciones", {
        p_tipo: "aniversario",
        p_titulo: titulo.slice(0, 200),
        p_cuerpo: "Preaviso para preparar el contenido conmemorativo.",
        p_url: `/casos/${a.victimaId}`,
        p_dedupe_key: `aniversario:${a.tipo}:${a.victimaId}:${targetISO}`,
      });
      if (error) throw new Error(error.message);
      created += Number(data ?? 0);
    }

    // Audiencias de mañana.
    const { data: fechas, error: fechasError } = await supabase
      .from("fechas_juicio")
      .select("id, imputado_id, imputados(apellido_nombre, hecho_id)")
      .eq("fecha_audiencia", targetISO);
    if (fechasError) throw new Error(fechasError.message);

    for (const f of (fechas ?? []) as any[]) {
      const imp = Array.isArray(f.imputados) ? f.imputados[0] : f.imputados;
      let url = "/casos";
      if (imp?.hecho_id) {
        const { data: caso } = await supabase
          .from("casos")
          .select("id")
          .eq("hecho_id", imp.hecho_id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (caso?.id) url = `/casos/${caso.id}`;
      }
      const { data, error } = await supabase.rpc("crear_notificaciones", {
        p_tipo: "audiencia",
        p_titulo: `Mañana: audiencia de ${imp?.apellido_nombre || "un imputado"}`.slice(0, 200),
        p_cuerpo: null,
        p_url: url,
        p_dedupe_key: `audiencia:${f.id}:${targetISO}`,
      });
      if (error) throw new Error(error.message);
      created += Number(data ?? 0);
    }
    return { ok: true, created };
  } catch (err) {
    // Antes de aplicar 016 la RPC no existe: no es un error del email.
    console.error("check-anniversaries: notificaciones en la app fallaron:", err instanceof Error ? err.message : err);
    return { ok: false };
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...jsonHeaders, Allow: "POST" },
    });
  }

  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret) {
    const provided = req.headers.get("x-cron-secret") ?? "";
    if (!safeEqual(provided, cronSecret)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: jsonHeaders,
      });
    }
  } else {
    // Compatibilidad: hasta configurar CRON_SECRET la función sigue
    // funcionando como antes, pero queda registrado en los logs.
    console.warn("CRON_SECRET no configurado: la función acepta cualquier JWT válido.");
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    // "Mañana" en horario Argentina: hoy + 24h, evaluado en TZ AR.
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const { year: targetYear, month: targetMonth, day: targetDay } =
      dateInAR(tomorrow);

    // Target date como string ISO ("YYYY-MM-DD") para el response y logging.
    const targetISO = `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`;

    // 1. Traer víctimas con al menos una fecha cargada.
    const { data: victimas, error } = await supabase
      .from("victimas")
      .select("id, nombre_completo, fecha_nacimiento, fecha_fallecimiento")
      .or("fecha_nacimiento.not.is.null,fecha_fallecimiento.not.is.null");

    if (error) {
      throw new Error(`Error fetching victims: ${error.message}`);
    }

    // 2. Filtrar las que caen MAÑANA (day+month).
    const anniversaries: Anniversary[] = [];

    for (const victima of (victimas ?? []) as Victima[]) {
      const checkDate = (raw: string | null, tipo: Anniversary["tipo"]) => {
        if (!raw) return;
        const parts = raw.split("-");
        if (parts.length !== 3) return;
        const y = parseInt(parts[0]);
        const m = parseInt(parts[1]);
        const d = parseInt(parts[2]);
        if (d !== targetDay || m !== targetMonth) return;
        anniversaries.push({
          victimaId: victima.id,
          nombre: victima.nombre_completo || "Sin nombre",
          tipo,
          años: targetYear - y,
        });
      };

      checkDate(victima.fecha_nacimiento, "cumpleaños");
      checkDate(victima.fecha_fallecimiento, "fallecimiento");
    }

    // Notificaciones en la app + push (scripts/016). Independiente del email:
    // si falla, se registra y el email sale igual.
    const inApp = await notifyInApp(supabase, anniversaries, targetISO);

    if (!victimas || victimas.length === 0) {
      return new Response(
        JSON.stringify({ message: "No victims with dates found", notifications: inApp }),
        { headers: jsonHeaders },
      );
    }

    if (anniversaries.length === 0) {
      return new Response(
        JSON.stringify({ message: "No anniversaries tomorrow", date: targetISO, notifications: inApp }),
        { headers: jsonHeaders },
      );
    }

    // 3. HTML del email — "Mañana recordamos a…"
    const tomorrowFormatted = new Intl.DateTimeFormat("es-AR", {
      timeZone: TZ,
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(tomorrow);

    const tomorrowShort = new Intl.DateTimeFormat("es-AR", {
      timeZone: TZ,
    }).format(tomorrow);

    const listaHtml = anniversaries.map((a) =>
      `<li style="background: white; padding: 15px 20px; margin-bottom: 10px; border-radius: 8px; border-left: 4px solid ${a.tipo === "fallecimiento" ? "#6b7280" : "#3b82f6"}; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <strong style="font-size: 16px; color: #1e3a5f;">${escapeHtml(a.nombre)}</strong>
        <br>
        <span style="color: ${a.tipo === "fallecimiento" ? "#6b7280" : "#3b82f6"}; font-size: 14px;">
          ${a.tipo === "fallecimiento" ? `Aniversario de Fallecimiento - ${a.años} año${a.años !== 1 ? "s" : ""}` : `Cumpleaños - Cumpliría ${a.años} años`}
        </span>
      </li>`
    ).join("");

    const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Preaviso de Aniversario</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">🕯️ Preaviso de Aniversario</h1>
    <p style="color: #b8d4e8; margin: 10px 0 0 0;">Mañana, ${tomorrowFormatted}</p>
  </div>

  <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef; border-top: none;">
    <p style="font-size: 16px; margin-bottom: 20px;">Mañana recordamos a:</p>
    <ul style="list-style: none; padding: 0; margin: 0;">
      ${listaHtml}
    </ul>
  </div>
</body>
</html>
`;

    // 4. Enviar
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: "Usina de Justicia <no-reply@usinadejusticia.org.ar>",
      to: getRecipients(),
      subject: `🕯️ Mañana recordamos - ${tomorrowShort}`,
      html: htmlContent,
    });

    if (emailError) {
      throw new Error(`Error sending email: ${emailError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Email sent with ${anniversaries.length} anniversary(ies) for ${targetISO}`,
        emailId: emailData?.id,
        notifications: inApp,
      }),
      { headers: jsonHeaders },
    );
  } catch (error) {
    // El detalle va a los logs de la función, no a la respuesta HTTP.
    console.error("check-anniversaries error:", error instanceof Error ? error.message : error);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
