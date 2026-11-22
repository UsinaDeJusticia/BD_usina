"use client"

import Link from "next/link"
import { Bell, CalendarClock, Flame, FilePlus2, FilePen, FlaskConical, Trash2 } from "lucide-react"
import type { Notificacion, TipoNotificacion } from "@/lib/notifications/api"
import { tiempoRelativo } from "@/lib/notifications/use-notificaciones"
import { cn } from "@/lib/utils"

const ICONS: Record<TipoNotificacion, typeof Bell> = {
  aniversario: Flame,
  audiencia: CalendarClock,
  caso_nuevo: FilePlus2,
  caso_editado: FilePen,
  prueba: FlaskConical,
}

interface Props {
  items: Notificacion[]
  onOpen: (n: Notificacion) => void
  onDelete?: (n: Notificacion) => void
  compact?: boolean
}

export function NotificationList({ items, onOpen, onDelete, compact }: Props) {
  if (items.length === 0) {
    return (
      <div className="px-4 py-10 text-center text-sm text-slate-500">
        <Bell className="mx-auto mb-2 h-6 w-6 text-slate-300" aria-hidden />
        No tenés notificaciones.
      </div>
    )
  }

  return (
    <ul className="divide-y divide-slate-100">
      {items.map((n) => {
        const Icon = ICONS[n.tipo] ?? Bell
        const unread = !n.leida_at
        const content = (
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span
              className={cn(
                "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                unread ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-500",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className={cn("block text-sm", unread ? "font-semibold text-slate-900" : "text-slate-700")}>
                {n.titulo}
              </span>
              {n.cuerpo && !compact && <span className="mt-0.5 block text-sm text-slate-500">{n.cuerpo}</span>}
              <span className="mt-0.5 block text-xs text-slate-400">{tiempoRelativo(n.created_at)}</span>
            </span>
            {unread && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-600" aria-label="No leída" />}
          </div>
        )
        return (
          <li key={n.id} className={cn("group flex items-start gap-2 px-4 py-3", unread && "bg-blue-50/40")}>
            {n.url ? (
              <Link href={n.url} onClick={() => onOpen(n)} className="flex min-w-0 flex-1 rounded-md outline-offset-2">
                {content}
              </Link>
            ) : (
              <button type="button" onClick={() => onOpen(n)} className="flex min-w-0 flex-1 text-left">
                {content}
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(n)}
                className="rounded p-1 text-slate-400 opacity-100 hover:bg-slate-100 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100"
                aria-label="Eliminar notificación"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
