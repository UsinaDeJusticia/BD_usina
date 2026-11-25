"use client"

import { useMemo, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ImageIcon, Loader2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import { downloadStorageImage, signPhotoUrls, uploadProfilePhoto } from "@/lib/photos/storage"
import { usePhotoUrls } from "@/lib/photos/use-photo-urls"
import { useVictimPhotoSupport } from "@/lib/photos/use-photo-support"
import { cn } from "@/lib/utils"
import { PhotoCropperDialog } from "./photo-cropper-dialog"
import { VictimPhoto } from "./victim-photo"

const MAX_SOURCE_BYTES = 20 * 1024 * 1024
const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif"

interface ResourceLike {
  id?: string
  titulo?: string | null
  archivo_path?: string | null
  archivo_tipo?: string | null
  archivo_nombre?: string | null
}

interface Props {
  name: string
  /** null/undefined = sin foto. */
  fotoPath: string | null | undefined
  resources: ResourceLike[]
  onChange: (fotoPath: string | null) => void
}

const isImageResource = (r: ResourceLike) =>
  !!r.archivo_path && (r.archivo_tipo?.startsWith("image/") ?? /\.(jpe?g|png|webp|gif|heic)$/i.test(r.archivo_path))

/** Sección "Foto de perfil" del formulario de la víctima. */
export function VictimPhotoPicker({ name, fotoPath, resources, onChange }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const { toast } = useToast()
  const fileInput = useRef<HTMLInputElement>(null)
  const [source, setSource] = useState<Blob | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [loadingResource, setLoadingResource] = useState<string | null>(null)

  const supported = useVictimPhotoSupport()
  const urls = usePhotoUrls([fotoPath])
  const currentUrl = fotoPath ? urls[fotoPath] : null
  const images = resources.filter(isImageResource)

  const thumbs = useQuery({
    queryKey: ["resource-thumbs", images.map((r) => r.archivo_path).sort()],
    queryFn: () => signPhotoUrls(supabase, images.map((r) => r.archivo_path!)),
    enabled: pickerOpen && images.length > 0,
    staleTime: 50 * 60 * 1000,
  })

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
      toast({ title: "Archivo no válido", description: "Elegí una imagen JPG, PNG o WEBP.", variant: "destructive" })
      return
    }
    if (file.size > MAX_SOURCE_BYTES) {
      toast({ title: "Imagen muy pesada", description: "El máximo es 20 MB.", variant: "destructive" })
      return
    }
    setSource(file)
  }

  const pickResource = async (r: ResourceLike) => {
    if (!r.archivo_path) return
    setLoadingResource(r.archivo_path)
    try {
      const blob = await downloadStorageImage(supabase, r.archivo_path)
      setPickerOpen(false)
      setSource(blob)
    } catch {
      toast({ title: "No se pudo abrir la imagen", variant: "destructive" })
    } finally {
      setLoadingResource(null)
    }
  }

  const onCropped = async (blob: Blob) => {
    const path = await uploadProfilePhoto(supabase, blob)
    onChange(path)
    setSource(null)
    toast({ title: "Foto lista", description: "Se guarda al guardar el caso." })
  }

  // Base sin la columna foto_path (017 sin aplicar): no ofrecer algo que no se puede guardar.
  if (!supported) return null

  return (
    <div className="flex w-full flex-col items-center gap-3 md:w-56">
      <span className="self-start text-sm font-medium text-slate-700">Foto de perfil</span>
      <VictimPhoto name={name || "Sin nombre"} url={currentUrl} variant="avatar" size={160} className="border border-slate-200" />

      <input ref={fileInput} type="file" accept={ACCEPT} className="hidden" onChange={onFile} />
      <Button type="button" className="w-full bg-slate-800 hover:bg-slate-700" onClick={() => fileInput.current?.click()}>
        <Upload className="mr-2 h-4 w-4" />
        {fotoPath ? "Cambiar foto" : "Subir foto"}
      </Button>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => setPickerOpen(true)}
        disabled={images.length === 0}
        title={images.length === 0 ? "Esta víctima no tiene fotos en sus recursos" : undefined}
      >
        <ImageIcon className="mr-2 h-4 w-4" />
        Elegir de los recursos
      </Button>
      {fotoPath && (
        <Button type="button" variant="ghost" className="text-red-700 hover:bg-red-50 hover:text-red-800" onClick={() => onChange(null)}>
          Quitar foto
        </Button>
      )}
      <p className="text-center text-xs leading-relaxed text-slate-500">
        JPG, PNG o WEBP. Se guarda recortada en cuadrado y liviana.
      </p>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Elegir una foto ya cargada</DialogTitle>
            <DialogDescription>
              Fotos de los recursos de {name || "esta víctima"}. Después la vas a poder encuadrar. La original queda en los recursos.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {images.map((r) => {
              const url = thumbs.data?.[r.archivo_path!]
              const busy = loadingResource === r.archivo_path
              return (
                <button
                  key={r.archivo_path}
                  type="button"
                  onClick={() => pickResource(r)}
                  disabled={!!loadingResource}
                  className={cn(
                    "flex flex-col overflow-hidden rounded-lg border border-slate-200 text-left transition hover:border-blue-800 focus-visible:outline-2 focus-visible:outline-blue-900",
                    busy && "border-blue-800",
                  )}
                >
                  <span className="relative block h-28 w-full bg-slate-100">
                    {url ? (
                      <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <span className="flex h-full items-center justify-center">
                        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                      </span>
                    )}
                    {busy && (
                      <span className="absolute inset-0 flex items-center justify-center bg-white/60">
                        <Loader2 className="h-5 w-5 animate-spin text-blue-900" />
                      </span>
                    )}
                  </span>
                  <span className="truncate px-2 py-1.5 text-xs text-slate-700">
                    {r.titulo || r.archivo_nombre || "Foto"}
                  </span>
                </button>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>

      <PhotoCropperDialog source={source} onCancel={() => setSource(null)} onConfirm={onCropped} />
    </div>
  )
}
