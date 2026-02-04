"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCountries } from "@/hooks/use-countries"
import { useArgentinaGeo } from "@/hooks/use-argentina-geo"
import { Loader2, Upload, User, X } from "lucide-react"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"

interface VictimFormProps {
  data: any
  onChange: (data: any) => void
  showDates?: boolean
}

export function VictimForm({ data, onChange, showDates = false }: VictimFormProps) {
  const { countries, isLoading: isLoadingCountries } = useCountries()
  const { provincias, municipios, isLoadingProvincias, isLoadingMunicipios, fetchMunicipios } = useArgentinaGeo(
    data.provinciaResidencia,
  )
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const supabase = createClient()

  const savedMunicipioInList = municipios.some(
    (m) => m.nombre === data.municipioResidencia || m.nombre.toLowerCase() === data.municipioResidencia?.toLowerCase(),
  )

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0]
      if (!file) return

      setUploadingPhoto(true)

      const fileExt = file.name.split(".").pop()
      const fileName = `${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `victim-photos/${fileName}`

      const { error: uploadError } = await supabase.storage.from("archivos-casos").upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from("archivos-casos").getPublicUrl(filePath)

      onChange({
        ...data,
        fotoPerfil: publicUrl,
        fotoPath: filePath,
      })
    } catch (err) {
      console.error("Error uploading photo:", err)
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handlePhotoRemove = async () => {
    if (data.fotoPath) {
      await supabase.storage.from("archivos-casos").remove([data.fotoPath])
    }
    onChange({
      ...data,
      fotoPerfil: null,
      fotoPath: null,
    })
  }

  const handleChange = (field: string, value: string) => {
    onChange({
      ...data,
      [field]: value,
    })
  }

  const handleProvinciaResidenciaChange = (provincia: string) => {
    onChange({
      ...data,
      provinciaResidencia: provincia,
      municipioResidencia: "",
    })
    if (provincia) {
      fetchMunicipios(provincia)
    }
  }

  return (
    <div className="space-y-6">
      {showDates && (
        <div>
          <h3 className="text-lg font-semibold text-slate-900 font-heading mb-4">Fechas del Caso</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fechaHecho" className="text-sm font-medium text-slate-700">
                Fecha del Hecho
              </Label>
              <Input
                id="fechaHecho"
                type="date"
                value={data.fechaHecho || ""}
                onChange={(e) => handleChange("fechaHecho", e.target.value)}
                className="border-slate-300"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fechaFallecimiento" className="text-sm font-medium text-slate-700">
                Fecha de Fallecimiento
              </Label>
              <Input
                id="fechaFallecimiento"
                type="date"
                value={data.fechaFallecimiento || ""}
                onChange={(e) => handleChange("fechaFallecimiento", e.target.value)}
                className="border-slate-300"
              />
            </div>
          </div>
        </div>
      )}

      <div>
        <h3 className="text-lg font-semibold text-slate-900 font-heading mb-4">Datos Personales de la Víctima</h3>

        <div className="space-y-4 mb-6">
          <Label className="text-sm font-medium text-slate-700">Foto de Perfil</Label>
          <div className="flex items-start gap-4">
            {data.fotoPerfil ? (
              <div className="relative">
                <img
                  src={data.fotoPerfil}
                  alt="Foto de perfil"
                  className="w-24 h-24 rounded-lg object-cover border-2 border-slate-200"
                />
                <button
                  type="button"
                  onClick={handlePhotoRemove}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="w-24 h-24 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center bg-slate-50">
                <User className="w-8 h-8 text-slate-400" />
              </div>
            )}
            <div className="flex-1">
              <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors cursor-pointer w-fit">
                {uploadingPhoto ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Subiendo...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    {data.fotoPerfil ? "Cambiar Foto" : "Subir Foto"}
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  disabled={uploadingPhoto}
                  className="hidden"
                />
              </label>
              <p className="text-xs text-slate-500 mt-2">
                Formatos: JPG, PNG, WEBP. Máx. 5MB
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="victimName" className="text-sm font-medium text-slate-700">
              Nombre Completo
            </Label>
            <Input
              id="victimName"
              placeholder="Nombre y apellido completo"
              value={data.nombreCompleto || ""}
              onChange={(e) => handleChange("nombreCompleto", e.target.value)}
              className="border-slate-300"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="victimBirthDate" className="text-sm font-medium text-slate-700">
              Fecha de Nacimiento
            </Label>
            <Input
              id="victimBirthDate"
              type="date"
              value={data.fechaNacimiento || ""}
              onChange={(e) => handleChange("fechaNacimiento", e.target.value)}
              className="border-slate-300"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="victimAge" className="text-sm font-medium text-slate-700">
              Edad
            </Label>
            <Input
              id="victimAge"
              type="number"
              placeholder="Edad en años"
              value={data.edad || ""}
              onChange={(e) => handleChange("edad", e.target.value)}
              className="border-slate-300"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="victimNationality" className="text-sm font-medium text-slate-700">
              Nacionalidad
            </Label>
            <Select value={data.nacionalidad || ""} onValueChange={(value) => handleChange("nacionalidad", value)}>
              <SelectTrigger className="border-slate-300">
                <SelectValue placeholder={isLoadingCountries ? "Cargando países..." : "Seleccionar nacionalidad"} />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {isLoadingCountries ? (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Cargando...
                  </div>
                ) : (
                  countries.map((country) => (
                    <SelectItem key={country.nameSpanish} value={country.nameSpanish}>
                      {country.nameSpanish}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="victimProfession" className="text-sm font-medium text-slate-700">
              Profesión/Ocupación
            </Label>
            <Input
              id="victimProfession"
              placeholder="Profesión u ocupación"
              value={data.profesion || ""}
              onChange={(e) => handleChange("profesion", e.target.value)}
              className="border-slate-300"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="victimSocialMedia" className="text-sm font-medium text-slate-700">
              Redes Sociales
            </Label>
            <Input
              id="victimSocialMedia"
              placeholder="Instagram, Facebook, Twitter, etc."
              value={data.redesSociales || ""}
              onChange={(e) => handleChange("redesSociales", e.target.value)}
              className="border-slate-300"
            />
          </div>
        </div>

        <div className="mt-4">
          <h4 className="text-sm font-medium text-slate-700 mb-3">Ubicación de Residencia</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="victimProvinciaResidencia" className="text-sm font-medium text-slate-700">
                Provincia de Residencia
              </Label>
              <Select value={data.provinciaResidencia || ""} onValueChange={handleProvinciaResidenciaChange}>
                <SelectTrigger className="border-slate-300">
                  <SelectValue placeholder={isLoadingProvincias ? "Cargando provincias..." : "Seleccionar provincia"} />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {isLoadingProvincias ? (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Cargando...
                    </div>
                  ) : (
                    provincias.map((provincia) => (
                      <SelectItem key={provincia.id} value={provincia.nombre}>
                        {provincia.nombre}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="victimMunicipioResidencia" className="text-sm font-medium text-slate-700">
                Localidad de Residencia
              </Label>
              <Select
                value={data.municipioResidencia || ""}
                onValueChange={(value) => handleChange("municipioResidencia", value)}
                disabled={!data.provinciaResidencia || isLoadingMunicipios}
              >
                <SelectTrigger className="border-slate-300">
                  <SelectValue
                    placeholder={
                      !data.provinciaResidencia
                        ? "Primero seleccione provincia"
                        : isLoadingMunicipios
                          ? "Cargando localidades..."
                          : "Seleccionar localidad"
                    }
                  />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {isLoadingMunicipios ? (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Cargando...
                    </div>
                  ) : municipios.length === 0 ? (
                    <div className="p-4 text-center text-slate-500 text-sm">No hay localidades disponibles</div>
                  ) : (
                    <>
                      {data.municipioResidencia && !savedMunicipioInList && (
                        <SelectItem key="saved-value" value={data.municipioResidencia}>
                          {data.municipioResidencia} (guardado)
                        </SelectItem>
                      )}
                      {municipios.map((municipio) => (
                        <SelectItem key={municipio.id} value={municipio.nombre}>
                          {municipio.nombre}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <Label htmlFor="victimNotes" className="text-sm font-medium text-slate-700">
            Notas Adicionales u Observaciones
          </Label>
          <Textarea
            id="victimNotes"
            placeholder="Información adicional sobre la víctima"
            value={data.notasAdicionales || ""}
            onChange={(e) => handleChange("notasAdicionales", e.target.value)}
            className="border-slate-300"
            rows={3}
          />
        </div>
      </div>
    </div>
  )
}
