// Suscripción a Web Push desde el navegador.
//
// iOS/iPadOS: Safari sólo permite push si la app está INSTALADA en la
// pantalla de inicio (16.4+). En el navegador común, `isPushSupported()` da
// false y la UI explica cómo instalarla.

import type { SupabaseClient } from "@supabase/supabase-js"

export type PushStatus =
  | "unsupported" // el navegador no soporta push / service worker
  | "needs-install" // iOS fuera de la app instalada
  | "not-configured" // falta NEXT_PUBLIC_VAPID_PUBLIC_KEY en el deploy
  | "denied" // el usuario bloqueó las notificaciones
  | "off" // soportado pero este dispositivo no está suscripto
  | "on" // suscripto

export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ""

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
}

export function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

export function isPushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window
}

export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"))
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

async function getRegistration() {
  return (await navigator.serviceWorker.getRegistration("/")) ?? (await navigator.serviceWorker.register("/sw.js"))
}

export async function getPushStatus(): Promise<PushStatus> {
  if (typeof window === "undefined") return "unsupported"
  if (!isPushSupported()) return isIOS() && !isStandalone() ? "needs-install" : "unsupported"
  if (!VAPID_PUBLIC_KEY) return "not-configured"
  if (Notification.permission === "denied") return "denied"
  const reg = await navigator.serviceWorker.getRegistration("/")
  const sub = await reg?.pushManager.getSubscription()
  return sub ? "on" : "off"
}

export async function subscribePush(supabase: SupabaseClient): Promise<PushStatus> {
  if (!isPushSupported()) return "unsupported"
  if (!VAPID_PUBLIC_KEY) return "not-configured"

  const permission = await Notification.requestPermission()
  if (permission !== "granted") return permission === "denied" ? "denied" : "off"

  const reg = await getRegistration()
  await navigator.serviceWorker.ready
  const existing = await reg.pushManager.getSubscription()
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }))

  const json = sub.toJSON()
  const { error } = await supabase.rpc("registrar_push", {
    p_endpoint: json.endpoint,
    p_p256dh: json.keys?.p256dh,
    p_auth: json.keys?.auth,
    p_user_agent: navigator.userAgent,
  })
  if (error) {
    await sub.unsubscribe().catch(() => {})
    throw error
  }
  return "on"
}

export async function unsubscribePush(supabase: SupabaseClient): Promise<PushStatus> {
  const reg = await navigator.serviceWorker.getRegistration("/")
  const sub = await reg?.pushManager.getSubscription()
  if (sub) {
    await supabase.from("push_suscripciones").delete().eq("endpoint", sub.endpoint)
    await sub.unsubscribe()
  }
  return "off"
}
