"use client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Trash2, Loader2, UserX } from "lucide-react"
import React from "react"
import { ResourcesForm } from "./resources-form"
import { useCountries } from "@/hooks/use-countries"

const NOMBRE_DESCONOCIDO_OPTIONS = [
  { value: "Sin Identificar", label: "Sin Identificar" },
  { value: "Se desconoce nombre", label: "Se desconoce nombre" },
]

const ESTADO_PROCESAL_OPTIONS = [
  { value: "sospechoso", label: "Sospechoso" },
  { value: "imputado_procesado", label: "Imputado/Procesado" },
  { value: "a_juicio", label: "A juicio" },
  { value: "sobreseido", label: "Sobreseído" },
  { value: "condenado", label: "Condenado" },
  { value: "absuelto", label: "Absuelto" },
  { value: "prescripcion", label: "Prescripción" },
  { value: "menor_inimputable", label: "Menor inimputable con medida de seguridad" },
]

const judicialLevels = [
  "Fiscalía o Juzgado de Instrucción",
  "Juzgado de primera instancia",
  "Tribunal",
  "Cámara de apelaciones",
  "Cámara de casación",
  "Tribunal superior",
  "Corte suprema",
  "Juzgado de ejecución",
  "Otro",
]

interface AccusedFormProps {
  data: any[]
  onChange: (data: any[]) => void
}

export function AccusedForm({ data = [], onChange }: AccusedFormProps) {
  const [totalInvolved, setTotalInvolved] = React.useState(data.length || 0)
  const { countries, isLoading: isLoadingCountries } = useCountries()

  const addAccused = () => {
    const newAccused = {
      id: Date.now(),
      apellidoNombre: "",
      alias: "",
      edad: "",
      nacionalidad: "",
      documentoIdentidad: "",
      tribunalFallo: "",
      menorEdad: false,
      juzgadoUfi: "",
      estadoProcesal: "",
      trialDates: [],
      fechaVeredicto: "",
      pena: "",
      juicioAbreviado: false,
      prisionPerpetua: false,
      esExtranjero: false,
      detenidoPrevio: false,
      fallecido: false,
      esReincidente: false,
      cargos: "",
      resources: [],
      instanciasJudiciales: [],
    }
    onChange([...data, newAccused])
  }

  const removeAccused = (id: number) => {
    onChange(data.filter((accused) => accused.id !== id))
  }

  const updateAccused = (id: number, field: string, value: string | boolean | any[]) => {
    onChange(data.map((accused) => (accused.id === id ? { ...accused, [field]: value } : accused)))
  }

  const addTrialDate = (accusedId: number) => {
    const accused = data.find((a) => a.id === accusedId)
    if (accused) {
      const updatedDates = [...(accused.trialDates || []), ""]
      updateAccused(accusedId, "trialDates", updatedDates)
    }
  }

  const removeTrialDate = (accusedId: number, dateIndex: number) => {
    const accused = data.find((a) => a.id === accusedId)
    if (accused) {
      const updatedDates = (accused.trialDates || []).filter((_: any, index: number) => index !== dateIndex)
      updateAccused(accusedId, "trialDates", updatedDates)
    }
  }

  const updateTrialDate = (accusedId: number, dateIndex: number, value: string) => {
    const accused = data.find((a) => a.id === accusedId)
    if (accused) {
      const updatedDates = [...(accused.trialDates || [])]
      updatedDates[dateIndex] = value
      updateAccused(accusedId, "trialDates", updatedDates)
    }
  }

  const updateResources = (accusedId: number, resources: any[]) => {
    updateAccused(accusedId, "resources", resources)
  }

  const deleteSavedResource = (accusedId: number, resourceId: string) => {
    const accused = data.find((a) => a.id === accusedId)
    if (accused) {
      const updatedResources = (accused.resources || []).filter((r: any) => r.id !== resourceId)
      updateAccused(accusedId, "resources", updatedResources)
    }
  }

  const addInstanciaJudicial = (accusedId: number) => {
    const accused = data.find((a) => a.id === accusedId)
    if (accused) {
      const updatedInstancias = [
        ...(accused.instanciasJudiciales || []),
        {
          numeroCausa: "",
          fiscalFiscalia: "",
          caratula: "",
          ordenNivel: "",
        },
      ]
      updateAccused(accusedId, "instanciasJudiciales", updatedInstancias)
    }
  }

  const updateInstanciaJudicial = (accusedId: number, index: number, field: string, value: string) => {
    const accused = data.find((a) => a.id === accusedId)
    if (accused) {
      const updatedInstancias = [...(accused.instanciasJudiciales || [])]
      updatedInstancias[index] = { ...updatedInstancias[index], [field]: value }
      updateAccused(accusedId, "instanciasJudiciales", updatedInstancias)
    }
  }

  const removeInstanciaJudicial = (accusedId: number, index: number) => {
    const accused = data.find((a) => a.id === accusedId)
    if (accused) {
      const updatedInstancias = (accused.instanciasJudiciales || []).filter((_: any, i: number) => i !== index)
      updateAccused(accusedId, "instanciasJudiciales", updatedInstancias)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
        <div className="flex items-center gap-4">
          <Label className="text-sm font-medium text-slate-700">Cantidad Total de Involucrados:</Label>
          <Input
            type="number"
            min="0"
            value={totalInvolved}
            onChange={(e) => setTotalInvolved(Number.parseInt(e.target.value) || 0)}
            className="w-20 border-slate-300"
            placeholder="0"
          />
          <span className="text-xs text-slate-500">(Puede ser mayor al número de imputados identificados)</span>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-slate-900 font-heading">Imputados</h3>
        <Button onClick={addAccused} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700">
          <Plus className="w-4 h-4" />
          Agregar Imputado
        </Button>
      </div>

      {data.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          <p>No hay imputados registrados.</p>
          <p className="text-sm">Haga clic en &ldquo;Agregar Imputado&rdquo; para añadir información.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {data.map((accused, index) => (
            <Card key={accused.id} className="border-slate-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="text-base font-heading">Imputado #{index + 1}</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => removeAccused(accused.id)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* ... existing accused fields ... */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">Apellido y Nombre</Label>
                    <Input
                      placeholder="Apellido y nombre"
                      value={accused.apellidoNombre || ""}
                      onChange={(e) => updateAccused(accused.id, "apellidoNombre", e.target.value)}
                      className="border-slate-300"
                    />
                    <div className="flex flex-wrap gap-2 mt-1">
                      {NOMBRE_DESCONOCIDO_OPTIONS.map((option) => (
                        <Button
                          key={option.value}
                          type="button"
                          variant={accused.apellidoNombre === option.value ? "default" : "outline"}
                          size="sm"
                          onClick={() => updateAccused(accused.id, "apellidoNombre", option.value)}
                          className={`text-xs flex items-center gap-1 ${
                            accused.apellidoNombre === option.value
                              ? "bg-slate-800 hover:bg-slate-700"
                              : "hover:bg-slate-100"
                          }`}
                        >
                          <UserX className="w-3 h-3" />
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">Alias/Apodo</Label>
                    <Input
                      placeholder="Alias o apodo conocido"
                      value={accused.alias || ""}
                      onChange={(e) => updateAccused(accused.id, "alias", e.target.value)}
                      className="border-slate-300"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">DNI / Documento</Label>
                    <Input
                      placeholder="Número de documento de identidad"
                      value={accused.documentoIdentidad || ""}
                      onChange={(e) => updateAccused(accused.id, "documentoIdentidad", e.target.value)}
                      className="border-slate-300"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">Edad</Label>
                    <Input
                      placeholder="Edad o edad aproximada"
                      value={accused.edad || ""}
                      onChange={(e) => updateAccused(accused.id, "edad", e.target.value)}
                      className="border-slate-300"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">Nacionalidad</Label>
                    <Select
                      value={accused.nacionalidad || ""}
                      onValueChange={(value) => updateAccused(accused.id, "nacionalidad", value)}
                    >
                      <SelectTrigger className="border-slate-300">
                        <SelectValue
                          placeholder={isLoadingCountries ? "Cargando países..." : "Seleccionar nacionalidad"}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {isLoadingCountries ? (
                          <div className="flex items-center justify-center p-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
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
                    <Label className="text-sm font-medium text-slate-700">Juzgado/UFI</Label>
                    <Input
                      placeholder="Juzgado o Unidad Fiscal de Instrucción"
                      value={accused.juzgadoUfi || ""}
                      onChange={(e) => updateAccused(accused.id, "juzgadoUfi", e.target.value)}
                      className="border-slate-300"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">Estado Procesal</Label>
                    <Select
                      value={accused.estadoProcesal || ""}
                      onValueChange={(value) => updateAccused(accused.id, "estadoProcesal", value)}
                    >
                      <SelectTrigger className="border-slate-300">
                        <SelectValue placeholder="Seleccionar estado procesal" />
                      </SelectTrigger>
                      <SelectContent>
                        {ESTADO_PROCESAL_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">Tribunal que dictó fallo</Label>
                    <Input
                      placeholder="Nombre del tribunal"
                      value={accused.tribunalFallo || ""}
                      onChange={(e) => updateAccused(accused.id, "tribunalFallo", e.target.value)}
                      className="border-slate-300"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">Fecha del Veredicto</Label>
                    <Input
                      type="date"
                      value={accused.fechaVeredicto || ""}
                      onChange={(e) => updateAccused(accused.id, "fechaVeredicto", e.target.value)}
                      className="border-slate-300"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">Pena</Label>
                    <Input
                      placeholder="Pena impuesta (ej: 15 años de prisión)"
                      value={accused.pena || ""}
                      onChange={(e) => updateAccused(accused.id, "pena", e.target.value)}
                      className="border-slate-300"
                    />
                  </div>
                </div>

                {/* Fechas del Juicio */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-sm font-medium text-slate-700">Fechas del Juicio</Label>
                    <Button
                      onClick={() => addTrialDate(accused.id)}
                      size="sm"
                      variant="outline"
                      className="flex items-center gap-1 text-xs"
                    >
                      <Plus className="w-3 h-3" />
                      Agregar Fecha
                    </Button>
                  </div>

                  {!accused.trialDates || accused.trialDates.length === 0 ? (
                    <div className="text-center py-2 text-slate-500 text-sm border border-dashed border-slate-300 rounded">
                      <p>No hay fechas de juicio registradas.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {accused.trialDates.map((date: string, dateIndex: number) => (
                        <div key={dateIndex} className="flex items-center gap-2">
                          <Input
                            type="date"
                            value={date}
                            onChange={(e) => updateTrialDate(accused.id, dateIndex, e.target.value)}
                            className="border-slate-300 flex-1"
                          />
                          <Button
                            onClick={() => removeTrialDate(accused.id, dateIndex)}
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Opciones Adicionales */}
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <Label className="text-sm font-medium text-slate-700 mb-3 block">Opciones Adicionales</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`minor-${accused.id}`}
                        checked={accused.menorEdad || false}
                        onCheckedChange={(checked) => updateAccused(accused.id, "menorEdad", checked)}
                      />
                      <Label htmlFor={`minor-${accused.id}`} className="text-sm text-slate-700">
                        Menor de Edad
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`extranjero-${accused.id}`}
                        checked={accused.esExtranjero || false}
                        onCheckedChange={(checked) => updateAccused(accused.id, "esExtranjero", checked)}
                      />
                      <Label htmlFor={`extranjero-${accused.id}`} className="text-sm text-slate-700">
                        Extranjero
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`detenido-${accused.id}`}
                        checked={accused.detenidoPrevio || false}
                        onCheckedChange={(checked) => updateAccused(accused.id, "detenidoPrevio", checked)}
                      />
                      <Label htmlFor={`detenido-${accused.id}`} className="text-sm text-slate-700">
                        Detenido antes del juicio
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`abbreviated-${accused.id}`}
                        checked={accused.juicioAbreviado || false}
                        onCheckedChange={(checked) => updateAccused(accused.id, "juicioAbreviado", checked)}
                      />
                      <Label htmlFor={`abbreviated-${accused.id}`} className="text-sm text-slate-700">
                        Juicio Abreviado
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`life-sentence-${accused.id}`}
                        checked={accused.prisionPerpetua || false}
                        onCheckedChange={(checked) => updateAccused(accused.id, "prisionPerpetua", checked)}
                      />
                      <Label htmlFor={`life-sentence-${accused.id}`} className="text-sm text-slate-700">
                        Prisión Perpetua
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`fallecido-${accused.id}`}
                        checked={accused.fallecido || false}
                        onCheckedChange={(checked) => updateAccused(accused.id, "fallecido", checked)}
                      />
                      <Label htmlFor={`fallecido-${accused.id}`} className="text-sm text-slate-700">
                        Muerte
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`reincidente-${accused.id}`}
                        checked={accused.esReincidente || false}
                        onCheckedChange={(checked) => updateAccused(accused.id, "esReincidente", checked)}
                      />
                      <Label htmlFor={`reincidente-${accused.id}`} className="text-sm text-slate-700">
                        Reincidencia
                      </Label>
                    </div>
                  </div>
                </div>

                {/* Cargos */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">Cargos/Delitos</Label>
                  <Textarea
                    placeholder="Cargos imputados o delitos cometidos"
                    value={accused.cargos || ""}
                    onChange={(e) => updateAccused(accused.id, "cargos", e.target.value)}
                    className="border-slate-300"
                    rows={2}
                  />
                </div>

                <div className="border-t pt-4 mt-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-md font-semibold text-slate-900 font-heading">Instancias Judiciales</h4>
                      <p className="text-xs text-slate-500">Causas y fiscalías relacionadas con este imputado.</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => addInstanciaJudicial(accused.id)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Agregar Instancia
                    </Button>
                  </div>

                  {!accused.instanciasJudiciales || accused.instanciasJudiciales.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic text-center py-4 border border-dashed border-slate-300 rounded">
                      No hay instancias judiciales registradas.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {accused.instanciasJudiciales.map((instancia: any, instIndex: number) => (
                        <Card key={instIndex} className="border-slate-200 bg-slate-50">
                          <CardContent className="pt-4">
                            <div className="flex items-start justify-between mb-3">
                              <h5 className="text-sm font-medium text-slate-700">
                                Instancia {instIndex + 1}
                                {instancia.ordenNivel && ` - ${instancia.ordenNivel}`}
                              </h5>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeInstanciaJudicial(accused.id, instIndex)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 -mt-1 h-8 w-8 p-0"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label className="text-xs font-medium text-slate-600">Nivel / Orden</Label>
                                <Select
                                  value={instancia.ordenNivel || ""}
                                  onValueChange={(value) =>
                                    updateInstanciaJudicial(accused.id, instIndex, "ordenNivel", value)
                                  }
                                >
                                  <SelectTrigger className="border-slate-300 h-9">
                                    <SelectValue placeholder="Seleccionar nivel" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {judicialLevels.map((level) => (
                                      <SelectItem key={level} value={level}>
                                        {level}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-1">
                                <Label className="text-xs font-medium text-slate-600">Número de Causa</Label>
                                <Input
                                  placeholder="IPP N° o número de causa"
                                  value={instancia.numeroCausa || ""}
                                  onChange={(e) =>
                                    updateInstanciaJudicial(accused.id, instIndex, "numeroCausa", e.target.value)
                                  }
                                  className="border-slate-300 h-9"
                                />
                              </div>

                              <div className="space-y-1">
                                <Label className="text-xs font-medium text-slate-600">Carátula</Label>
                                <Input
                                  placeholder="Carátula de la causa"
                                  value={instancia.caratula || ""}
                                  onChange={(e) =>
                                    updateInstanciaJudicial(accused.id, instIndex, "caratula", e.target.value)
                                  }
                                  className="border-slate-300 h-9"
                                />
                              </div>

                              <div className="space-y-1">
                                <Label className="text-xs font-medium text-slate-600">
                                  Fiscalía o tribunal/ operadores judiciales
                                </Label>
                                <Input
                                  placeholder="Nombre del fiscal, fiscalía o tribunal"
                                  value={instancia.fiscalFiscalia || ""}
                                  onChange={(e) =>
                                    updateInstanciaJudicial(accused.id, instIndex, "fiscalFiscalia", e.target.value)
                                  }
                                  className="border-slate-300 h-9"
                                />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recursos del Imputado */}
                <div className="border-t pt-4 mt-4">
                  <h4 className="text-md font-semibold text-slate-900 font-heading mb-2">Recursos del Imputado</h4>
                  <p className="text-xs text-slate-500 mb-4">
                    Fotos, documentos, noticias y enlaces relacionados con este imputado.
                  </p>
                  <ResourcesForm
                    data={(accused.resources || []).filter(
                      (r: any) => !r.id || (typeof r.id === "string" && r.id.startsWith("temp-")),
                    )}
                    onChange={(resources) => {
                      const savedRes = (accused.resources || []).filter(
                        (r: any) => r.id && typeof r.id === "string" && !r.id.startsWith("temp-"),
                      )
                      updateResources(accused.id, [...savedRes, ...resources])
                    }}
                    savedResources={(accused.resources || []).filter(
                      (r: any) => r.id && typeof r.id === "string" && !r.id.startsWith("temp-"),
                    )}
                    onDeleteSavedResource={(resourceId) => deleteSavedResource(accused.id, resourceId)}
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
