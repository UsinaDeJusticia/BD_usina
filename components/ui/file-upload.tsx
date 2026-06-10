"use client"

import { useCallback, useState } from "react"
import { useDropzone } from "react-dropzone"
import { Upload, X, FileText, ImageIcon, Video, Music, File, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { uploadFile, formatFileSize } from "@/lib/supabase/storage"
import { cn } from "@/lib/utils"

interface UploadedFile {
  path: string
  url: string
  name: string
  type: string
  size: number
}

interface FileUploadProps {
  onUpload: (file: UploadedFile) => void
  onRemove?: () => void
  currentFile?: UploadedFile | null
  folder?: string
  accept?: Record<string, string[]>
  maxSize?: number
  className?: string
}

const DEFAULT_ACCEPT = {
  "image/*": [".jpeg", ".jpg", ".png", ".gif", ".webp"],
  "application/pdf": [".pdf"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "video/mp4": [".mp4"],
  "audio/mpeg": [".mp3"],
}

export function FileUpload({
  onUpload,
  onRemove,
  currentFile,
  folder = "general",
  accept = DEFAULT_ACCEPT,
  maxSize = 52428800, // 50MB
  className,
}: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0]
      if (!file) return

      setIsUploading(true)
      setError(null)

      const supabase = createClient()

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        setError("No hay sesión activa. Por favor, inicia sesión nuevamente.")
        setIsUploading(false)
        return
      }

      const result = await uploadFile(supabase, file, folder)

      if (result.success && result.path && result.url) {
        onUpload({
          path: result.path,
          url: result.url,
          name: file.name,
          type: file.type,
          size: file.size,
        })
      } else {
        setError(result.error || "Error al subir el archivo")
      }

      setIsUploading(false)
    },
    [folder, onUpload],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxSize,
    multiple: false,
    disabled: isUploading,
  })

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return <ImageIcon className="w-8 h-8 text-blue-500" />
    if (type.startsWith("video/")) return <Video className="w-8 h-8 text-purple-500" />
    if (type.startsWith("audio/")) return <Music className="w-8 h-8 text-green-500" />
    if (type === "application/pdf") return <FileText className="w-8 h-8 text-red-500" />
    return <File className="w-8 h-8 text-slate-500" />
  }

  if (currentFile) {
    return (
      <div className={cn("border rounded-lg p-4 bg-slate-50", className)}>
        <div className="flex items-center gap-3">
          {currentFile.type.startsWith("image/") ? (
            <img
              src={currentFile.url || "/placeholder.svg"}
              alt={currentFile.name}
              className="w-16 h-16 object-cover rounded"
            />
          ) : (
            getFileIcon(currentFile.type)
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">{currentFile.name}</p>
            <p className="text-xs text-slate-500">{formatFileSize(currentFile.size)}</p>
          </div>
          {onRemove && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
          isDragActive ? "border-blue-500 bg-blue-50" : "border-slate-300 hover:border-slate-400 hover:bg-slate-50",
          isUploading && "opacity-50 cursor-not-allowed",
        )}
      >
        <input {...getInputProps()} />
        {isUploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
            <p className="text-sm text-slate-600">Subiendo archivo...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="w-8 h-8 text-slate-400" />
            <p className="text-sm text-slate-600">
              {isDragActive ? "Suelta el archivo aquí" : "Arrastra un archivo o haz clic para seleccionar"}
            </p>
            <p className="text-xs text-slate-400">Imágenes, PDFs, documentos, videos o audio (máx. 50MB)</p>
          </div>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}
