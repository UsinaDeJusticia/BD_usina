"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { BellOff, BellRing, CheckCheck, Loader2, Smartphone } from "lucide-react"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { NotificationList } from "@/components/notifications/notification-list"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import { queryKeys } from "@/lib/queries/keys"
import { useNotificaciones } from "@/lib/notifications/use-notificaciones"
import {
  DEFAULT_PREFS,
  enviarPrueba,
  fetchPreferencias,
  guardarPreferencias,
  type PreferenciasNotificacion,
} from "@/lib/notifications/api"
import { getPushStatus, subscribePush, unsubscribePush, type PushStatus } from "@/lib/notifications/push"

const PREF_LABELS: { key: keyof PreferenciasNotificacion; title: string; help: string }[] = [
  {
    key: "aniversarios",
    title: "Aniversarios",
    help: "El día anterior al cumpleaños o aniversario de fallecimiento de una víctima.",
  },
  { key: "audiencias", title: "Audiencias", help: "El día anterior a una fecha de juicio cargada en un caso." },
  { key: "casos", title: "Casos nuevos y editados", help: "Cuando otra persona del equipo crea o modifica un caso." },
]

const PUSH_TEXT: Record<PushStatus, string> = {
  on: "Este dispositivo recibe notificaciones aunque la app esté cerrada.",
  off: "Este dispositivo todavía no recibe notificaciones push.",
  denied:
    "Bloqueaste las notificaciones para este sitio. Habilitalas desde la configuración del navegador (ícono del candado junto a la dirección) y recargá.",
  unsupported: "Este navegador no soporta notificaciones push. Igual vas a verlas en la campanita.",
  "needs-install":
    "En iPhone/iPad las notificaciones push funcionan sólo con la app instalada: tocá Compartir → \"Agregar a inicio\" y abrila desde el ícono.",
  "not-configured": "Las notificaciones push todavía no están configuradas en el servidor. Igual vas a verlas en la campanita.",
}

export default function NotificacionesPage() {
  const supabase = useMemo(() => createClient(), [])
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { items, unread, query, markRead, markAllRead, remove, refresh } = useNotificaciones()

  const [email, setEmail] = useState<string | null>(null)
  const [pushStatus, setPushStatus] = useState<PushStatus | null>(null)
  const [pushBusy, setPushBusy] = useState(false)
  const [testBusy, setTestBusy] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null))
    getPushStatus().then(setPushStatus).catch(() => setPushStatus("unsupported"))
  }, [supabase])

  const prefsQuery = useQuery({
    queryKey: queryKeys.notificationPrefs,
    queryFn: () => fetchPreferencias(supabase),
    retry: false,
  })
  const prefs = prefsQuery.data ?? DEFAULT_PREFS

  const togglePref = async (key: keyof PreferenciasNotificacion, value: boolean) => {
    if (!email) return
    const next = { ...prefs, [key]: value }
    queryClient.setQueryData(queryKeys.notificationPrefs, next)
    try {
      await guardarPreferencias(supabase, email, next)
    } catch {
      queryClient.setQueryData(queryKeys.notificationPrefs, prefs)
      toast({ title: "No se pudo guardar", description: "Intentá de nuevo en unos segundos.", variant: "destructive" })
    }
  }

  const togglePush = async () => {
    setPushBusy(true)
    try {
      const status = pushStatus === "on" ? await unsubscribePush(supabase) : await subscribePush(supabase)
      setPushStatus(status)
      if (status === "on") toast({ title: "Listo", description: "Este dispositivo va a recibir notificaciones." })
    } catch {
      toast({
        title: "No se pudo activar",
        description: "Revisá los permisos del navegador e intentá de nuevo.",
        variant: "destructive",
      })
    } finally {
      setPushBusy(false)
    }
  }

  const sendTest = async () => {
    setTestBusy(true)
    try {
      await enviarPrueba(supabase)
      await refresh()
      toast({
        title: "Notificación de prueba enviada",
        description: pushStatus === "on" ? "Debería llegarte al dispositivo en unos segundos." : "Ya aparece en la lista.",
      })
    } catch {
      toast({ title: "No se pudo enviar la prueba", variant: "destructive" })
    } finally {
      setTestBusy(false)
    }
  }

  const notReady = query.isError

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <h2 className="font-heading text-2xl font-bold text-slate-900">Notificaciones</h2>
          <p className="text-slate-600">Elegí qué avisos recibir y en qué dispositivos.</p>
        </div>

        {notReady && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Las notificaciones todavía no están habilitadas en la base de datos.
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Qué quiero recibir</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {PREF_LABELS.map(({ key, title, help }) => (
                <div key={key} className="flex items-start gap-3">
                  <Checkbox
                    id={`pref-${key}`}
                    checked={prefs[key]}
                    disabled={!email || prefsQuery.isLoading || notReady}
                    onCheckedChange={(v) => togglePref(key, v === true)}
                    className="mt-0.5"
                  />
                  <div>
                    <Label htmlFor={`pref-${key}`} className="font-medium text-slate-900">
                      {title}
                    </Label>
                    <p className="text-sm text-slate-500">{help}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Smartphone className="h-4 w-4" /> Este dispositivo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-600">{pushStatus ? PUSH_TEXT[pushStatus] : "Verificando…"}</p>
              <div className="flex flex-wrap gap-2">
                {(pushStatus === "on" || pushStatus === "off") && (
                  <Button onClick={togglePush} disabled={pushBusy || notReady} variant={pushStatus === "on" ? "outline" : "default"}>
                    {pushBusy ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : pushStatus === "on" ? (
                      <BellOff className="mr-2 h-4 w-4" />
                    ) : (
                      <BellRing className="mr-2 h-4 w-4" />
                    )}
                    {pushStatus === "on" ? "Desactivar en este dispositivo" : "Activar notificaciones push"}
                  </Button>
                )}
                <Button variant="outline" onClick={sendTest} disabled={testBusy || notReady}>
                  {testBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Enviar prueba
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">
              Historial {unread > 0 && <span className="text-sm font-normal text-slate-500">· {unread} sin leer</span>}
            </CardTitle>
            {unread > 0 && (
              <Button variant="ghost" size="sm" onClick={() => markAllRead.mutate()}>
                <CheckCheck className="mr-1 h-4 w-4" /> Marcar todas como leídas
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {query.isLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              </div>
            ) : (
              <NotificationList
                items={items}
                onOpen={(n) => !n.leida_at && markRead.mutate(n.id)}
                onDelete={(n) => remove.mutate(n.id)}
              />
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
