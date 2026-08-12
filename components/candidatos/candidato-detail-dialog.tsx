"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertTriangle, ExternalLink, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useCasesList } from "@/lib/queries/casos"
import { useDecidirCandidato } from "@/lib/queries/candidatos"
import type { PropuestaCandidata } from "@/lib/mdd/types"

interface CandidatoDetailDialogProps {
  candidato: PropuestaCandidata
  children: React.ReactNode
}

const MOTIVOS_RECHAZO = [
  { value: "no_relevante", label: "No es un caso relevante" },
  { value: "datos_insuficientes", label: "Datos insuficientes" },
  { value: "fuera_de_alcance", label: "Fuera del alcance de Usina" },
  { value: "otro", label: "Otro" },
]

export function CandidatoDetailDialog({ candidato, children }: CandidatoDetailDialogProps) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<"detalle" | "rechazar" | "duplicado">("detalle")

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setView("detalle")
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        {view === "detalle" && (
          <DetalleView candidato={candidato} onRechazar={() => setView("rechazar")} onDuplicado={() => setView("duplicado")} />
        )}
        {view === "rechazar" && (
          <RechazarView candidato={candidato} onBack={() => setView("detalle")} onDone={() => setOpen(false)} />
        )}
        {view === "duplicado" && (
          <DuplicadoView candidato={candidato} onBack={() => setView("detalle")} onDone={() => setOpen(false)} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function DetalleView({
  candidato,
  onRechazar,
  onDuplicado,
}: {
  candidato: PropuestaCandidata
  onRechazar: () => void
  onDuplicado: () => void
}) {
  const posiblesMatches = candidato.duplicado_check?.posibles_matches ?? []

  return (
    <>
      <DialogHeader>
        <DialogTitle>{candidato.nombre_completo}</DialogTitle>
      </DialogHeader>

      <div className="space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Edad aproximada" value={candidato.edad_aproximada?.toString()} />
          <Field label="Nacionalidad" value={candidato.nacionalidad} />
          <Field label="Provincia" value={candidato.provincia} />
          <Field label="Municipio" value={candidato.municipio} />
          <Field
            label="Fecha del hecho"
            value={
              candidato.fecha_hecho
                ? `${candidato.fecha_hecho}${candidato.fecha_hecho_precision ? ` (${candidato.fecha_hecho_precision})` : ""}`
                : undefined
            }
          />
          <Field label="Tipo de crimen" value={candidato.tipo_crimen} />
        </div>

        {candidato.resumen_corto && (
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1">Resumen (scraper)</p>
            <p className="text-slate-700">{candidato.resumen_corto}</p>
          </div>
        )}

        {candidato.fuentes.length > 0 && (
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1">Fuentes ({candidato.fuentes.length})</p>
            <ul className="space-y-1">
              {candidato.fuentes.map((f, i) => (
                <li key={i}>
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline flex items-center gap-1 text-xs"
                  >
                    <ExternalLink className="w-3 h-3 shrink-0" />
                    <span className="line-clamp-1">{f.titulo || f.url}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {posiblesMatches.length > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-medium text-amber-800 mb-2 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              Posibles coincidencias en BD Usina
            </p>
            <ul className="space-y-1">
              {posiblesMatches.map((m) => (
                <li key={m.usina_victima_id}>
                  <Link
                    href={`/casos/${m.usina_victima_id}`}
                    target="_blank"
                    className="text-blue-700 hover:underline text-xs"
                  >
                    Ver ficha ({(m.score * 100).toFixed(0)}% de coincidencia)
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <DialogFooter className="gap-2 sm:gap-2">
        <Button variant="outline" onClick={onDuplicado}>
          Es duplicado
        </Button>
        <Button variant="outline" className="text-red-600 hover:text-red-700" onClick={onRechazar}>
          Rechazar
        </Button>
        <Button asChild>
          <Link href={`/casos/nuevo?fromCandidato=${candidato.id}`}>Aprobar</Link>
        </Button>
      </DialogFooter>
    </>
  )
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-slate-800">{value || "—"}</p>
    </div>
  )
}

function RechazarView({
  candidato,
  onBack,
  onDone,
}: {
  candidato: PropuestaCandidata
  onBack: () => void
  onDone: () => void
}) {
  const { toast } = useToast()
  const [motivo, setMotivo] = useState("")
  const [detalle, setDetalle] = useState("")
  const decidir = useDecidirCandidato()

  const handleSubmit = async () => {
    try {
      await decidir.mutateAsync({
        id: candidato.id,
        decision: "rechazada",
        motivo_rechazo: detalle ? `${motivo}: ${detalle}` : motivo,
      })
      toast({ title: "Candidato rechazado" })
      onDone()
    } catch (err) {
      toast({
        title: "Error al rechazar",
        description: err instanceof Error ? err.message : "Error desconocido",
        variant: "destructive",
      })
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Rechazar propuesta</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <Select value={motivo} onValueChange={setMotivo}>
          <SelectTrigger>
            <SelectValue placeholder="Motivo del rechazo" />
          </SelectTrigger>
          <SelectContent>
            {MOTIVOS_RECHAZO.map((m) => (
              <SelectItem key={m.value} value={m.label}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Textarea
          placeholder="Detalle opcional"
          value={detalle}
          onChange={(e) => setDetalle(e.target.value)}
          rows={3}
        />
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onBack} disabled={decidir.isPending}>
          Volver
        </Button>
        <Button
          variant="destructive"
          onClick={handleSubmit}
          disabled={!motivo || decidir.isPending}
        >
          {decidir.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Confirmar rechazo
        </Button>
      </DialogFooter>
    </>
  )
}

function DuplicadoView({
  candidato,
  onBack,
  onDone,
}: {
  candidato: PropuestaCandidata
  onBack: () => void
  onDone: () => void
}) {
  const { toast } = useToast()
  const [filtro, setFiltro] = useState("")
  const [seleccionId, setSeleccionId] = useState<string | null>(null)
  const { data: casos = [], isLoading } = useCasesList()
  const decidir = useDecidirCandidato()

  const filtrados = filtro.trim()
    ? casos.filter((c) => c.victimName.toLowerCase().includes(filtro.trim().toLowerCase())).slice(0, 8)
    : casos.slice(0, 8)

  const handleSubmit = async () => {
    if (!seleccionId) return
    try {
      await decidir.mutateAsync({
        id: candidato.id,
        decision: "duplicada",
        usina_victima_id: seleccionId,
      })
      toast({ title: "Marcado como duplicado" })
      onDone()
    } catch (err) {
      toast({
        title: "Error al marcar duplicado",
        description: err instanceof Error ? err.message : "Error desconocido",
        variant: "destructive",
      })
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Marcar como duplicado</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <Input
          placeholder="Buscar ficha existente por nombre..."
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
        />
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
            <Loader2 className="w-4 h-4 animate-spin" /> Cargando casos...
          </div>
        ) : (
          <ul className="max-h-64 overflow-y-auto divide-y divide-slate-100 border rounded-md">
            {filtrados.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSeleccionId(c.id)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between ${
                    seleccionId === c.id ? "bg-blue-50" : ""
                  }`}
                >
                  <span>{c.victimName}</span>
                  {seleccionId === c.id && <Badge className="bg-blue-600 hover:bg-blue-600">Seleccionada</Badge>}
                </button>
              </li>
            ))}
            {filtrados.length === 0 && <li className="px-3 py-4 text-sm text-slate-400 text-center">Sin resultados</li>}
          </ul>
        )}
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onBack} disabled={decidir.isPending}>
          Volver
        </Button>
        <Button onClick={handleSubmit} disabled={!seleccionId || decidir.isPending}>
          {decidir.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Confirmar duplicado
        </Button>
      </DialogFooter>
    </>
  )
}
