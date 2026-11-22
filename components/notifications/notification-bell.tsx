"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Bell, CheckCheck, Settings } from "lucide-react"
import { useNotificaciones } from "@/lib/notifications/use-notificaciones"
import { NotificationList } from "./notification-list"

/** Campanita del header con contador de no leídas y panel desplegable. */
export function NotificationBell() {
  const { items, unread, markRead, markAllRead, query } = useNotificaciones()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("mousedown", onDown)
    document.addEventListener("touchstart", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("touchstart", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  // Sin las tablas de 016 (o sin red) la campanita no molesta: se oculta.
  if (query.isError) return null

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-md border border-blue-200 text-blue-700 hover:bg-blue-50"
        aria-label={unread > 0 ? `Notificaciones: ${unread} sin leer` : "Notificaciones"}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-semibold leading-none text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notificaciones"
          className="fixed inset-x-2 top-16 z-50 max-h-[75vh] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-11 sm:w-96"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-sm font-semibold text-slate-900">Notificaciones</span>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  type="button"
                  onClick={() => markAllRead.mutate()}
                  className="flex items-center gap-1 rounded px-2 py-1 text-xs text-blue-700 hover:bg-blue-50"
                >
                  <CheckCheck className="h-3.5 w-3.5" /> Marcar todas
                </button>
              )}
              <Link
                href="/notificaciones"
                onClick={() => setOpen(false)}
                className="rounded p-1 text-slate-500 hover:bg-slate-100"
                aria-label="Configurar notificaciones"
              >
                <Settings className="h-4 w-4" />
              </Link>
            </div>
          </div>
          <div className="max-h-[calc(75vh-96px)] overflow-y-auto">
            <NotificationList
              compact
              items={items.slice(0, 10)}
              onOpen={(n) => {
                if (!n.leida_at) markRead.mutate(n.id)
                setOpen(false)
              }}
            />
          </div>
          <Link
            href="/notificaciones"
            onClick={() => setOpen(false)}
            className="block border-t border-slate-100 px-4 py-2.5 text-center text-sm font-medium text-blue-700 hover:bg-blue-50"
          >
            Ver todas y configurar
          </Link>
        </div>
      )}
    </div>
  )
}
