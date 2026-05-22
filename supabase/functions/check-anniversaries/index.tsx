import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { Resend } from "npm:resend"
import { serve } from "https://deno.land/std@0.170.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

interface Victima {
  id: string
  nombre_completo: string
  fecha_nacimiento: string | null
  fecha_fallecimiento: string | null
}

interface Anniversary {
  nombre: string
  tipo: "cumpleaños" | "fallecimiento"
  años: number
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const resend = new Resend(resendApiKey)

    const today = new Date()
    // Usamos UTC para evitar desfasajes horarios simples
    const todayDay = today.getUTCDate()
    const todayMonth = today.getUTCMonth() + 1
    const currentYear = today.getUTCFullYear()

    // 1. Obtener víctimas
    const { data: victimas, error } = await supabase
      .from("victimas")
      .select("id, nombre_completo, fecha_nacimiento, fecha_fallecimiento")
      .or("fecha_nacimiento.not.is.null,fecha_fallecimiento.not.is.null")

    if (error) throw error

    const anniversaries: Anniversary[] = []

    // 2. Filtrar
    for (const v of victimas as Victima[]) {
      if (v.fecha_nacimiento) {
        const [y, m, d] = v.fecha_nacimiento.split("-").map(Number)
        if (d === todayDay && m === todayMonth) {
          anniversaries.push({ nombre: v.nombre_completo, tipo: "cumpleaños", años: currentYear - y })
        }
      }
      if (v.fecha_fallecimiento) {
        const [y, m, d] = v.fecha_fallecimiento.split("-").map(Number)
        if (d === todayDay && m === todayMonth) {
          anniversaries.push({ nombre: v.nombre_completo, tipo: "fallecimiento", años: currentYear - y })
        }
      }
    }

    if (anniversaries.length === 0) {
      return new Response(JSON.stringify({ message: "No hay aniversarios hoy" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // 3. HTML del Email
    const listaHtml = anniversaries
      .map(
        (a) =>
          `<li style="margin-bottom: 10px;"><strong>${a.nombre}</strong>: ${a.tipo === "cumpleaños" ? "🎂 Cumpleaños" : "🕊️ Aniversario de Fallecimiento"} (${a.años} años)</li>`,
      )
      .join("")

    const htmlContent = `
      <h1>🕯️ Memoria Activa</h1>
      <p>Hoy recordamos a:</p>
      <ul>${listaHtml}</ul>
    `

    // 4. Enviar (Configuración Correcta)
    const { data, error: emailError } = await resend.emails.send({
      from: "Usina de Justicia <no-reply@alertas.usinadejusticia.org.ar>",
      to: ["info@usinadejusticia.org.ar"],
      subject: `Recordatorios del día: ${anniversaries.length} personas`,
      html: htmlContent,
    })

    if (emailError) throw new Error(emailError.message)

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
