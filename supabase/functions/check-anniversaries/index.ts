// supabase/functions/check-anniversaries/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Initialize clients
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    // Get today's date
    const today = new Date();
    const todayDay = today.getUTCDate();
    const todayMonth = today.getUTCMonth() + 1; // JavaScript months are 0-indexed
    const currentYear = today.getUTCFullYear();

    // 1. Query all victims with dates
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
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Filter anniversaries for today
    const anniversaries: Anniversary[] = [];

    for (const victima of (victimas as Victima[])) {
      // Check birthday
      if (victima.fecha_nacimiento) {
        const parts = victima.fecha_nacimiento.split('-');
        if(parts.length === 3) {
            const y = parseInt(parts[0]);
            const m = parseInt(parts[1]);
            const d = parseInt(parts[2]);
            
            if (d === todayDay && m === todayMonth) {
                 const años = currentYear - y;
                 anniversaries.push({
                    nombre: victima.nombre_completo || "Sin nombre",
                    tipo: "cumpleaños",
                    años,
                  });
            }
        }
      }

      // Check death anniversary
      if (victima.fecha_fallecimiento) {
         const parts = victima.fecha_fallecimiento.split('-');
         if(parts.length === 3) {
            const y = parseInt(parts[0]);
            const m = parseInt(parts[1]);
            const d = parseInt(parts[2]);

            if (d === todayDay && m === todayMonth) {
              const años = currentYear - y;
              anniversaries.push({
                nombre: victima.nombre_completo || "Sin nombre",
                tipo: "fallecimiento",
                años,
              });
            }
         }
      }
    }

    // If no anniversaries today, return early
    if (anniversaries.length === 0) {
      return new Response(
        JSON.stringify({ message: "No anniversaries today", date: today.toISOString() }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Build HTML email
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
  <title>Alertas de Aniversario</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">🕯️ Alertas de Aniversario</h1>
    <p style="color: #b8d4e8; margin: 10px 0 0 0;">${today.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}</p>
  </div>
  
  <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef; border-top: none;">
    <p style="font-size: 16px; margin-bottom: 20px;">Hoy recordamos a:</p>
    <ul style="list-style: none; padding: 0; margin: 0;">
      ${listaHtml}
    </ul>
  </div>
</body>
</html>
`;

    // 4. Send email via Resend
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: "Usina de Justicia <no-reply@alertas.usinadejusticia.org.ar>",
      to: ["info@usinadejusticia.org.ar"],
      subject: `🕯️ Recordatorios del día - ${today.toLocaleDateString("es-AR")}`,
      html: htmlContent,
    });

    if (emailError) {
      throw new Error(`Error sending email: ${emailError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Email sent with ${anniversaries.length} anniversary(ies)`,
        emailId: emailData?.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});