// supabase/functions/check-anniversaries/index.ts
//
// Notifica por email a info@usinadejusticia.org.ar y Pborras58@gmail.com
// las víctimas cuyo cumpleaños o aniversario de fallecimiento cae al día
// siguiente (preaviso de 24h, para preparar contenido conmemorativo).
//
// Disparada por pg_cron a las 15:00 UTC (12:00 AR). Ver scripts/009_*.sql.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TZ = "America/Argentina/Buenos_Aires";

interface Victima {
  id: string;
  nombre_completo: string;
  fecha_nacimiento: string | null;
  fecha_fallecimiento: string | null;
}

interface Anniversary {
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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

    // 1. Traer víctimas con al menos una fecha cargada.
    const { data: victimas, error } = await supabase
      .from("victimas")
      .select("id, nombre_completo, fecha_nacimiento, fecha_fallecimiento")
      .or("fecha_nacimiento.not.is.null,fecha_fallecimiento.not.is.null");

    if (error) {
      throw new Error(`Error fetching victims: ${error.message}`);
    }

    if (!victimas || victimas.length === 0) {
      return new Response(
        JSON.stringify({ message: "No victims with dates found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Filtrar las que caen MAÑANA (day+month).
    const anniversaries: Anniversary[] = [];

    for (const victima of victimas as Victima[]) {
      const checkDate = (raw: string | null, tipo: Anniversary["tipo"]) => {
        if (!raw) return;
        const parts = raw.split("-");
        if (parts.length !== 3) return;
        const y = parseInt(parts[0]);
        const m = parseInt(parts[1]);
        const d = parseInt(parts[2]);
        if (d !== targetDay || m !== targetMonth) return;
        anniversaries.push({
          nombre: victima.nombre_completo || "Sin nombre",
          tipo,
          años: targetYear - y,
        });
      };

      checkDate(victima.fecha_nacimiento, "cumpleaños");
      checkDate(victima.fecha_fallecimiento, "fallecimiento");
    }

    // Target date como string ISO ("YYYY-MM-DD") para el response y logging.
    const targetISO = `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`;

    if (anniversaries.length === 0) {
      return new Response(
        JSON.stringify({ message: "No anniversaries tomorrow", date: targetISO }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
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
        <strong style="font-size: 16px; color: #1e3a5f;">${a.nombre}</strong>
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
      to: ["info@usinadejusticia.org.ar", "Pborras58@gmail.com"],
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
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
