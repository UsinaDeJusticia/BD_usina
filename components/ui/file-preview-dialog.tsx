"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Download, FileText } from "lucide-react"
import { safeExternalUrl } from "@/lib/url"

interface FilePreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  url: string
  tipo: string
  titulo: string
  archivoTipo?: string
}

export function FilePreviewDialog({ open, onOpenChange, url: rawUrl, tipo, titulo, archivoTipo }: FilePreviewDialogProps) {
  // Nunca renderizar esquemas peligrosos (javascript:, data:...) en src/href.
  const url = safeExternalUrl(rawUrl) ?? ""
  const isImage = archivoTipo?.startsWith("image/") || tipo === "Foto"
  const isPDF = archivoTipo === "application/pdf" || tipo === "Resolución judicial" || url?.endsWith(".pdf")
  const isVideo = archivoTipo?.startsWith("video/") || tipo === "Video"
  const isAudio = archivoTipo?.startsWith("audio/") || tipo === "Audio"

  const renderPreview = () => {
    if (isImage) {
      return (
        <div className="flex items-center justify-center p-4">
          <img
            src={url || "/placeholder.svg"}
            alt={titulo}
            className="max-h-[70vh] max-w-full object-contain rounded-lg"
          />
        </div>
      )
    }

    if (isPDF) {
      return <iframe src={url} title={titulo} className="w-full h-[75vh] rounded-lg border-0" />
    }

    if (isVideo) {
      return (
        <div className="flex items-center justify-center p-4">
          <video src={url} controls className="max-h-[70vh] max-w-full rounded-lg">
            Tu navegador no soporta la reproducción de video.
          </video>
        </div>
      )
    }

    if (isAudio) {
      return (
        <div className="flex flex-col items-center justify-center p-8 gap-4">
          <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center">
            <FileText className="w-12 h-12 text-slate-400" />
          </div>
          <audio src={url} controls className="w-full max-w-md">
            Tu navegador no soporta la reproducción de audio.
          </audio>
        </div>
      )
    }

    // Fallback para otros tipos
    return (
      <div className="flex flex-col items-center justify-center p-12 gap-4">
        <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center">
          <FileText className="w-12 h-12 text-slate-400" />
        </div>
        <p className="text-slate-600 text-center">Vista previa no disponible para este tipo de archivo.</p>
        <Button asChild>
          <a href={url} target="_blank" rel="noopener noreferrer">
            <Download className="w-4 h-4 mr-2" />
            Descargar archivo
          </a>
        </Button>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold truncate pr-8">{titulo}</DialogTitle>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-auto">{renderPreview()}</div>
        <div className="flex-shrink-0 flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          <Button asChild>
            <a href={url} target="_blank" rel="noopener noreferrer" download>
              <Download className="w-4 h-4 mr-2" />
              Descargar
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
