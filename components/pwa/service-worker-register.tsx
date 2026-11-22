"use client"

import { useEffect } from "react"

/**
 * Registra /sw.js (PWA + push). En desarrollo no se registra salvo que se
 * pida con NEXT_PUBLIC_ENABLE_SW=true, para no pelear con el hot reload.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return
    const enabled = process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_ENABLE_SW === "true"
    if (!enabled) return

    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((err) => {
        console.error("No se pudo registrar el service worker:", err)
      })
    }
    if (document.readyState === "complete") register()
    else window.addEventListener("load", register, { once: true })
  }, [])

  return null
}
