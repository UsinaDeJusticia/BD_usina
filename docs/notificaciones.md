# PWA y notificaciones

## Qué hay

- **App instalable (PWA):** en Android/Chrome aparece "Instalar app"; en iPhone,
  Compartir → "Agregar a inicio". Íconos con la "U" de Usina.
- **Sin datos en el dispositivo:** el service worker (`public/sw.js`) sólo guarda
  JS/CSS, íconos y la página offline. Ninguna página con datos, ni respuestas de
  `/api` o de Supabase. Sin conexión se muestra `public/offline.html`.
- **Campanita** en el header con las no leídas, y la página `/notificaciones`:
  historial, preferencias por usuario y activación de push por dispositivo.
- **Push:** llegan aunque la app esté cerrada. En iPhone/iPad sólo con la app
  instalada en la pantalla de inicio (iOS 16.4+).

## Tipos de notificación (cada usuario elige)

| Tipo | Cuándo | Por defecto |
|---|---|---|
| Aniversarios | El día anterior, a las 12:00 AR (mismo cron que el email) | Activado |
| Audiencias | El día anterior a una fecha de `fechas_juicio` | Activado |
| Casos nuevos y editados | Cuando OTRA persona crea o edita un caso (ediciones agrupadas cada 10 min) | Desactivado |

## Cómo funciona

```
check-anniversaries (cron 15:00 UTC) ─┐
app: guardar caso → notificar_evento_caso()
app: "Enviar prueba" → notificacion_de_prueba()
                                      ▼
              crear_notificaciones() → public.notificaciones  ──► campanita (RLS: cada uno ve las suyas)
                                      │ trigger AFTER INSERT (pg_net)
                                      ▼
                     edge function send-push  ──► Web Push cifrado ──► dispositivos del usuario
```

- Los usuarios no pueden crear notificaciones para otros: sólo las funciones
  de la base (security definer) insertan.
- El contenido del push va cifrado de punta a punta (RFC 8291).
- Suscripciones vencidas (410/404) se borran solas.
- Si el push falla, la notificación queda igual en la campanita.

## Configuración

| Dónde | Variable | Valor |
|---|---|---|
| Vercel | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Clave pública VAPID |
| Supabase (secrets de funciones) | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Par VAPID + `mailto:` |
| Supabase | `CRON_SECRET` | Ya existe (lo usa también `send-push`) |

Sin `NEXT_PUBLIC_VAPID_PUBLIC_KEY` la app funciona igual: la campanita anda y
la página explica que el push no está configurado.

## Pruebas

- `tests/sql-notifications.test.ts`: permisos, preferencias, deduplicación,
  trigger de push (con stubs de pg_net y Vault).
- `send-push` y el service worker se probaron de punta a punta: cifrado y
  descifrado del payload, limpieza de suscripciones vencidas, y el handler de
  push/click en Chromium (los links externos se reemplazan por `/notificaciones`).
