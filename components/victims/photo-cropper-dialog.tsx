"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, ZoomIn, ZoomOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { computeCrop, PROFILE_PHOTO_SIZE, type CropState } from "@/lib/photos/utils"

interface Props {
  /** Imagen a encuadrar (archivo elegido o blob descargado de los recursos). */
  source: Blob | null
  onCancel: () => void
  onConfirm: (cropped: Blob) => Promise<void> | void
}

const VIEW = 300 // lado del recuadro en pantalla (px)
const MAX_ZOOM = 4

/**
 * Encuadre circular de la foto de perfil: arrastrar para mover, zoom con el
 * control, la rueda o las teclas + / -, flechas para mover. Exporta un JPEG
 * cuadrado de 640 px.
 */
export function PhotoCropperDialog({ source, onCancel, onConfirm }: Props) {
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<CropState>({ zoom: 1, offsetX: 0, offsetY: 0 })
  const [saving, setSaving] = useState(false)
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  useEffect(() => {
    setImg(null)
    setError(null)
    setState({ zoom: 1, offsetX: 0, offsetY: 0 })
    if (!source) return
    const url = URL.createObjectURL(source)
    const image = new Image()
    image.onload = () => setImg(image)
    image.onerror = () => setError("No se pudo abrir la imagen. Probá con un JPG o PNG.")
    image.src = url
    return () => URL.revokeObjectURL(url)
  }, [source])

  const crop = img ? computeCrop(img.naturalWidth, img.naturalHeight, VIEW, state) : null

  const update = useCallback(
    (next: Partial<CropState>) => {
      setState((prev) => {
        const merged = { ...prev, ...next }
        if (!img) return merged
        // Normaliza el desplazamiento para que la imagen siempre cubra el recuadro.
        const c = computeCrop(img.naturalWidth, img.naturalHeight, VIEW, merged)
        return { zoom: Math.min(MAX_ZOOM, Math.max(1, merged.zoom)), offsetX: c.offsetX, offsetY: c.offsetY }
      })
    },
    [img],
  )

  const onPointerDown = (e: React.PointerEvent) => {
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, ox: state.offsetX, oy: state.offsetY }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    update({ offsetX: drag.current.ox + (e.clientX - drag.current.x), offsetY: drag.current.oy + (e.clientY - drag.current.y) })
  }
  const onPointerUp = () => {
    drag.current = null
  }
  const onWheel = (e: React.WheelEvent) => {
    update({ zoom: state.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08) })
  }
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = 12
    const map: Record<string, Partial<CropState>> = {
      ArrowLeft: { offsetX: state.offsetX - step },
      ArrowRight: { offsetX: state.offsetX + step },
      ArrowUp: { offsetY: state.offsetY - step },
      ArrowDown: { offsetY: state.offsetY + step },
      "+": { zoom: state.zoom * 1.1 },
      "=": { zoom: state.zoom * 1.1 },
      "-": { zoom: state.zoom / 1.1 },
    }
    if (map[e.key]) {
      e.preventDefault()
      update(map[e.key])
    }
  }

  const confirm = async () => {
    if (!img || !crop) return
    setSaving(true)
    try {
      const canvas = document.createElement("canvas")
      canvas.width = PROFILE_PHOTO_SIZE
      canvas.height = PROFILE_PHOTO_SIZE
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("Canvas no disponible")
      ctx.imageSmoothingQuality = "high"
      ctx.drawImage(img, crop.sx, crop.sy, crop.size, crop.size, 0, 0, PROFILE_PHOTO_SIZE, PROFILE_PHOTO_SIZE)
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85))
      if (!blob) throw new Error("No se pudo generar la imagen")
      await onConfirm(blob)
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la foto")
    } finally {
      setSaving(false)
    }
  }

  const dispW = img && crop ? img.naturalWidth * crop.scale : 0
  const dispH = img && crop ? img.naturalHeight * crop.scale : 0

  return (
    <Dialog open={!!source} onOpenChange={(open) => !open && !saving && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Encuadrar la foto</DialogTitle>
          <DialogDescription>Arrastrá la imagen para centrar la cara y usá el control para acercar.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4">
          <div
            role="application"
            aria-label="Área de recorte. Arrastrá o usá las flechas para mover y + / - para el zoom."
            tabIndex={0}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={onWheel}
            onKeyDown={onKeyDown}
            className="relative cursor-grab touch-none select-none overflow-hidden rounded-lg bg-slate-700 outline-offset-2 active:cursor-grabbing"
            style={{ width: VIEW, height: VIEW }}
          >
            {img && crop ? (
              <img
                src={img.src}
                alt=""
                draggable={false}
                className="pointer-events-none absolute max-w-none"
                style={{
                  width: dispW,
                  height: dispH,
                  left: VIEW / 2 - dispW / 2 + crop.offsetX,
                  top: VIEW / 2 - dispH / 2 + crop.offsetY,
                }}
              />
            ) : (
              !error && (
                <div className="flex h-full items-center justify-center text-slate-300">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              )
            )}
            {/* Círculo de encuadre: lo de afuera queda oscurecido. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-3 rounded-full border-2 border-white"
              style={{ boxShadow: "0 0 0 999px rgba(15,23,42,.55)" }}
            />
          </div>

          <div className="flex w-full items-center gap-3">
            <ZoomOut className="h-4 w-4 text-slate-500" aria-hidden />
            <label className="flex flex-1 flex-col gap-1 text-xs text-slate-600">
              Zoom
              <input
                type="range"
                min={1}
                max={MAX_ZOOM}
                step={0.01}
                value={state.zoom}
                onChange={(e) => update({ zoom: Number(e.target.value) })}
                disabled={!img}
                className="w-full accent-blue-900"
              />
            </label>
            <ZoomIn className="h-4 w-4 text-slate-500" aria-hidden />
          </div>

          {error && <p className="w-full text-sm text-red-700">{error}</p>}

          <div className="flex w-full justify-end gap-2">
            <Button variant="outline" onClick={onCancel} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={confirm} disabled={!img || saving} className="bg-blue-900 hover:bg-blue-800">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Usar esta foto
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
