"use client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Plus,
  Trash2,
  ExternalLink,
  Upload,
  LinkIcon,
  Download,
  FileText,
  ImageIcon,
  Video,
  Music,
  File,
  Newspaper,
  Share2,
  Gavel,
} from "lucide-react"
import { FileUpload } from "@/components/ui/file-upload"
import { getPublicFileUrl, formatFileSize } from "@/lib/supabase/storage"
import { isUnsafeExternalUrl, openExternalUrl } from "@/lib/url"

interface SavedResource {
  id: string
  tipo: string | null
  titulo: string | null
  descripcion: string | null
  url: string | null
  fuente: string | null
  fecha?: string | null
  archivo_path: string | null
  archivo_nombre: string | null
  archivo_tipo: string | null
  archivo_size: number | null
}

interface Recurso {
  id: string
  isNew: boolean
  tipo: string
  tipo_otro: string
  titulo: string
  url: string
  fuente: string
  fecha: string
  descripcion: string
  archivo_path: string | null
  archivo_nombre: string | null
  archivo_tipo: string | null
  archivo_size: number | null
  input_mode: string
}

interface ResourcesFormProps {
  data?: Recurso[]
  onChange?: (data: Recurso[]) => void
  savedResources?: SavedResource[] // Previously saved resources from DB
  onDeleteSavedResource?: (resourceId: string) => void
}

function getResourceIcon(tipo: string | null, archivoTipo: string | null) {
  // First check archivo_tipo for file-based resources
  if (archivoTipo) {
    if (archivoTipo.startsWith("image/")) return <ImageIcon className="w-5 h-5 text-blue-500" />
    if (archivoTipo.startsWith("video/")) return <Video className="w-5 h-5 text-purple-500" />
    if (archivoTipo.startsWith("audio/")) return <Music className="w-5 h-5 text-green-500" />
    if (archivoTipo === "application/pdf") return <FileText className="w-5 h-5 text-red-500" />
  }

  // Then check tipo for URL-based resources
  switch (tipo) {
    case "news":
      return <Newspaper className="w-5 h-5 text-orange-500" />
    case "video":
      return <Video className="w-5 h-5 text-purple-500" />
    case "photo":
      return <ImageIcon className="w-5 h-5 text-blue-500" />
    case "document":
      return <FileText className="w-5 h-5 text-slate-600" />
    case "judicial_resolution":
      return <Gavel className="w-5 h-5 text-amber-600" />
    case "audio":
      return <Music className="w-5 h-5 text-green-500" />
    case "social":
      return <Share2 className="w-5 h-5 text-pink-500" />
    default:
      return <File className="w-5 h-5 text-slate-400" />
  }
}

function getTipoLabel(tipo: string | null): string {
  switch (tipo) {
    case "news":
      return "Noticia"
    case "video":
      return "Video"
    case "photo":
      return "Fotografía"
    case "document":
      return "Documento"
    case "judicial_resolution":
      return "Resolución judicial"
    case "audio":
      return "Audio"
    case "social":
      return "Red Social"
    case "other":
      return "Otro"
    default:
      return tipo || "Sin tipo"
  }
}

export function ResourcesForm({ data = [], onChange, savedResources = [], onDeleteSavedResource }: ResourcesFormProps) {
  const addResource = () => {
    const newResource = {
      id: `temp-${Date.now()}`,
      isNew: true,
      tipo: "",
      tipo_otro: "",
      titulo: "",
      url: "",
      fuente: "",
      fecha: "",
      descripcion: "",
      archivo_path: null,
      archivo_nombre: null,
      archivo_tipo: null,
      archivo_size: null,
      input_mode: "url",
    }
    if (onChange) {
      onChange([...data, newResource])
    }
  }

  const removeResource = (id: string | number) => {
    if (onChange) {
      onChange(data.filter((resource) => resource.id !== id))
    }
  }

  const updateResource = (id: string | number, field: string, value: any) => {
    if (onChange) {
      onChange(data.map((resource) => (resource.id === id ? { ...resource, [field]: value } : resource)))
    }
  }

  const handleFileUpload = (
    id: string | number,
    file: { path: string; url: string; name: string; type: string; size: number },
  ) => {
    if (onChange) {
      onChange(
        data.map((resource) =>
          resource.id === id
            ? {
                ...resource,
                archivo_path: file.path,
                archivo_nombre: file.name,
                archivo_tipo: file.type,
                archivo_size: file.size,
                url: file.url,
              }
            : resource,
        ),
      )
    }
  }

  const handleFileRemove = (id: string | number) => {
    if (onChange) {
      onChange(
        data.map((resource) =>
          resource.id === id
            ? {
                ...resource,
                archivo_path: null,
                archivo_nombre: null,
                archivo_tipo: null,
                archivo_size: null,
                url: "",
              }
            : resource,
        ),
      )
    }
  }

  const handleDownload = (resource: SavedResource) => {
    if (resource.archivo_path) {
      openExternalUrl(getPublicFileUrl(resource.archivo_path))
    } else if (resource.url) {
      openExternalUrl(resource.url)
    }
  }

  const getResourceDisplayName = (resource: SavedResource): string => {
    if (resource.titulo && resource.titulo.trim()) {
      return resource.titulo
    }
    if (resource.archivo_nombre && resource.archivo_nombre.trim()) {
      return resource.archivo_nombre
    }
    if (resource.url) {
      try {
        const urlObj = new URL(resource.url)
        const pathParts = urlObj.pathname.split("/").filter(Boolean)
        if (pathParts.length > 0) {
          return decodeURIComponent(pathParts[pathParts.length - 1])
        }
        return urlObj.hostname
      } catch {
        return "Archivo sin nombre"
      }
    }
    return "Archivo sin nombre"
  }

  return (
    <div className="space-y-6">
      {savedResources.length > 0 && (
        <Card className="border-green-200 bg-green-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading flex items-center gap-2 text-green-800">
              <FileText className="w-5 h-5" />
              Recursos Cargados ({savedResources.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-green-200 bg-white">
              <Table>
                <TableHeader>
                  <TableRow className="bg-green-100/50">
                    <TableHead className="w-[50px]">Tipo</TableHead>
                    <TableHead>Título / Nombre</TableHead>
                    <TableHead className="hidden md:table-cell">Fuente</TableHead>
                    <TableHead className="hidden md:table-cell">Tamaño</TableHead>
                    <TableHead className="w-[100px] text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {savedResources.map((resource) => (
                    <TableRow key={resource.id}>
                      <TableCell>
                        <div className="flex items-center justify-center">
                          {getResourceIcon(resource.tipo, resource.archivo_tipo)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-900 truncate max-w-[200px]">
                            {getResourceDisplayName(resource)}
                          </span>
                          <span className="text-xs text-slate-500">{getTipoLabel(resource.tipo)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-slate-600">{resource.fuente || "-"}</TableCell>
                      <TableCell className="hidden md:table-cell text-slate-600">
                        {resource.archivo_size ? formatFileSize(resource.archivo_size) : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {resource.archivo_path || resource.url ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownload(resource)}
                              className="flex items-center gap-1 text-green-700 hover:text-green-800 hover:bg-green-100"
                            >
                              {resource.archivo_path ? (
                                <>
                                  <Download className="w-4 h-4" />
                                  <span className="hidden sm:inline">Descargar</span>
                                </>
                              ) : (
                                <>
                                  <ExternalLink className="w-4 h-4" />
                                  <span className="hidden sm:inline">Ver</span>
                                </>
                              )}
                            </Button>
                          ) : (
                            <span className="text-xs text-slate-400">Sin archivo</span>
                          )}
                          {onDeleteSavedResource && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onDeleteSavedResource(resource.id)}
                              className="flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span className="hidden sm:inline">Eliminar</span>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Existing: Add new resources section */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-slate-900 font-heading">
          {savedResources.length > 0 ? "Agregar Nuevos Recursos" : "Recursos Multimedia"}
        </h3>
        <Button onClick={addResource} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700">
          <Plus className="w-4 h-4" />
          Agregar Recurso
        </Button>
      </div>

      {data.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          <p>No hay recursos nuevos para agregar.</p>
          <p className="text-sm">
            Haga clic en &ldquo;Agregar Recurso&rdquo; para añadir archivos, enlaces a noticias, videos, fotos, etc.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {data.map((resource, index) => (
            <Card key={resource.id} className="border-slate-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="text-base font-heading">Nuevo Recurso #{index + 1}</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => removeResource(resource.id)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">Tipo de Recurso</Label>
                    <Select
                      value={resource.tipo || ""}
                      onValueChange={(value) => updateResource(resource.id, "tipo", value)}
                    >
                      <SelectTrigger className="border-slate-300">
                        <SelectValue placeholder="Seleccionar tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="news">Noticia</SelectItem>
                        <SelectItem value="video">Video</SelectItem>
                        <SelectItem value="photo">Fotografía</SelectItem>
                        <SelectItem value="document">Documento</SelectItem>
                        <SelectItem value="judicial_resolution">Resolución judicial</SelectItem>
                        <SelectItem value="audio">Audio</SelectItem>
                        <SelectItem value="social">Red Social</SelectItem>
                        <SelectItem value="other">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {resource.tipo === "other" && (
                    <div className="space-y-2">
                      <Label htmlFor={`tipo-otro-${resource.id}`} className="text-sm font-medium text-slate-700">
                        Especificar Tipo
                      </Label>
                      <Input
                        id={`tipo-otro-${resource.id}`}
                        placeholder="Ej: Informe pericial, Carta, etc."
                        value={resource.tipo_otro || ""}
                        onChange={(e) => updateResource(resource.id, "tipo_otro", e.target.value)}
                        className="border-slate-300"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor={`date-${resource.id}`} className="text-sm font-medium text-slate-700">
                      Fecha de Publicación
                    </Label>
                    <Input
                      id={`date-${resource.id}`}
                      type="date"
                      value={resource.fecha || ""}
                      onChange={(e) => updateResource(resource.id, "fecha", e.target.value)}
                      className="border-slate-300"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`title-${resource.id}`} className="text-sm font-medium text-slate-700">
                    Título del Recurso
                  </Label>
                  <Input
                    id={`title-${resource.id}`}
                    placeholder="Título de la noticia, video, documento, etc."
                    value={resource.titulo || ""}
                    onChange={(e) => updateResource(resource.id, "titulo", e.target.value)}
                    className="border-slate-300"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">Archivo o Enlace</Label>
                  <Tabs
                    value={resource.input_mode || "url"}
                    onValueChange={(value) => updateResource(resource.id, "input_mode", value)}
                    className="w-full"
                  >
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="url" className="flex items-center gap-2">
                        <LinkIcon className="w-4 h-4" />
                        Enlace URL
                      </TabsTrigger>
                      <TabsTrigger value="file" className="flex items-center gap-2">
                        <Upload className="w-4 h-4" />
                        Subir Archivo
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="url" className="mt-3">
                      <div className="flex gap-2">
                        <Input
                          id={`url-${resource.id}`}
                          placeholder="https://ejemplo.com/noticia"
                          value={resource.archivo_path ? "" : resource.url || ""}
                          onChange={(e) => updateResource(resource.id, "url", e.target.value)}
                          className="border-slate-300 flex-1"
                          disabled={!!resource.archivo_path}
                        />
                        {resource.url && !resource.archivo_path && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openExternalUrl(resource.url)}
                            className="flex items-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                      {!resource.archivo_path && isUnsafeExternalUrl(resource.url) && (
                        <p className="mt-1 text-xs text-red-600">
                          URL inválida: sólo se aceptan enlaces http:// o https://. No se guardará.
                        </p>
                      )}
                    </TabsContent>
                    <TabsContent value="file" className="mt-3">
                      <FileUpload
                        folder={`casos/${resource.id}`}
                        onUpload={(file) => handleFileUpload(resource.id, file)}
                        onRemove={() => handleFileRemove(resource.id)}
                        currentFile={
                          resource.archivo_path
                            ? {
                                path: resource.archivo_path,
                                url: resource.url,
                                name: resource.archivo_nombre || "Archivo",
                                type: resource.archivo_tipo || "application/octet-stream",
                                size: resource.archivo_size || 0,
                              }
                            : null
                        }
                      />
                    </TabsContent>
                  </Tabs>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`source-${resource.id}`} className="text-sm font-medium text-slate-700">
                    Fuente/Medio
                  </Label>
                  <Input
                    id={`source-${resource.id}`}
                    placeholder="Nombre del medio, canal, sitio web, etc."
                    value={resource.fuente || ""}
                    onChange={(e) => updateResource(resource.id, "fuente", e.target.value)}
                    className="border-slate-300"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`description-${resource.id}`} className="text-sm font-medium text-slate-700">
                    Descripción
                  </Label>
                  <Textarea
                    id={`description-${resource.id}`}
                    placeholder="Descripción del contenido, relevancia para el caso"
                    value={resource.descripcion || ""}
                    onChange={(e) => updateResource(resource.id, "descripcion", e.target.value)}
                    className="border-slate-300"
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
