"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Plus, Trash2, UserPlus, Users, Scale, FileText } from "lucide-react"
import { ResourcesForm } from "./resources-form"
import type { Recurso } from "@/lib/types/database"
import type { AbogadoQuerellante } from "@/lib/types/database"

interface FollowUpFormProps {
  data: any
  onChange: (data: any) => void
  resources?: any[]
  onResourcesChange?: (resources: any[]) => void
  savedResources?: Recurso[]
  onDeleteSavedResource?: (resourceId: string) => void
}

interface _FollowUpData {
  tipoAcompanamiento?: string[]
  abogadoQuerellante?: string
  abogadoUsinaFirmo?: string
  amicusCuriae?: boolean
  abogadoUsinaAmicus?: string
  abogadoAmicusFirmante?: string
  tieneAbogadoQuerellante?: string
  datosAbogadosQuerellantes?: AbogadoQuerellante[]
  otraIntervencion?: boolean
  otraIntervencionDescripcion?: string
}

const PARENTESCO_OPTIONS = [
  "Padre",
  "Madre",
  "Hijo/a",
  "Hermano/a",
  "Esposo/a",
  "Pareja",
  "Tío/a",
  "Abuelo/a",
  "Nieto/a",
  "Otro",
]

export function FollowUpForm({
  data,
  onChange,
  resources = [],
  onResourcesChange,
  savedResources = [],
  onDeleteSavedResource,
}: FollowUpFormProps) {
  const handleChange = (field: string, value: string | boolean) => {
    onChange({
      ...data,
      [field]: value,
    })
  }

  const handleCheckboxChange = (field: string, value: string, checked: boolean) => {
    const currentValues = data[field] || []
    if (checked) {
      onChange({
        ...data,
        [field]: [...currentValues, value],
      })
    } else {
      onChange({
        ...data,
        [field]: currentValues.filter((item: string) => item !== value),
      })
    }
  }

  const addMiembro = () => {
    const newMiembro = {
      id: Date.now(),
      nombre: "",
      telefono: "",
      email: "",
      fecha_asignacion: "",
    }
    onChange({
      ...data,
      listaMiembrosAsignados: [...(data.listaMiembrosAsignados || []), newMiembro],
    })
  }

  const updateMiembro = (id: number, field: string, value: string) => {
    const updated = (data.listaMiembrosAsignados || []).map((m: any) => (m.id === id ? { ...m, [field]: value } : m))
    onChange({ ...data, listaMiembrosAsignados: updated })
  }

  const removeMiembro = (id: number) => {
    const updated = (data.listaMiembrosAsignados || []).filter((m: any) => m.id !== id)
    onChange({ ...data, listaMiembrosAsignados: updated })
  }

  const addContacto = () => {
    const newContacto = {
      id: Date.now(),
      parentesco: "",
      parentesco_otro: "",
      nombre: "",
      telefono: "",
      email: "",
      direccion: "",
    }
    onChange({
      ...data,
      listaContactosFamiliares: [...(data.listaContactosFamiliares || []), newContacto],
    })
  }

  const updateContacto = (id: number, field: string, value: string) => {
    const updated = (data.listaContactosFamiliares || []).map((c: any) => (c.id === id ? { ...c, [field]: value } : c))
    onChange({ ...data, listaContactosFamiliares: updated })
  }

  const removeContacto = (id: number) => {
    const updated = (data.listaContactosFamiliares || []).filter((c: any) => c.id !== id)
    onChange({ ...data, listaContactosFamiliares: updated })
  }

  const addAbogado = () => {
    const newAbogado = {
      id: Date.now(),
      nombre: "",
      matricula: "",
      telefono: "",
      email: "",
      es_usina: false,
    }
    onChange({
      ...data,
      datosAbogadosQuerellantes: [...(data.datosAbogadosQuerellantes || []), newAbogado],
    })
  }

  const updateAbogado = (id: number, field: string, value: string | boolean) => {
    const updated = (data.datosAbogadosQuerellantes || []).map((a: any) => (a.id === id ? { ...a, [field]: value } : a))
    onChange({ ...data, datosAbogadosQuerellantes: updated })
  }

  const removeAbogado = (id: number) => {
    const updated = (data.datosAbogadosQuerellantes || []).filter((a: any) => a.id !== id)
    onChange({ ...data, datosAbogadosQuerellantes: updated })
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 font-heading mb-4">Seguimiento de la ONG</h3>

        <div className="mb-6">
          <h4 className="text-md font-medium text-slate-900 mb-4">Tipo de Acompañamiento</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              "Asesoramiento Legal",
              "Patrocinio Letrado",
              "Difusión en Redes",
              "Contención Emocional",
              "Ayuda Psicológica Profesional",
              "Derivación a otros Organismos",
            ].map((tipo) => (
              <div key={tipo} className="flex items-center space-x-2">
                <Checkbox
                  id={`tipo-${tipo}`}
                  checked={(data.tipoAcompanamiento || []).includes(tipo)}
                  onCheckedChange={(checked) => handleCheckboxChange("tipoAcompanamiento", tipo, checked as boolean)}
                />
                <Label htmlFor={`tipo-${tipo}`} className="text-sm text-slate-700">
                  {tipo}
                </Label>
              </div>
            ))}
          </div>

          <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="otra-intervencion"
                checked={data.otraIntervencion || false}
                onCheckedChange={(checked) => handleChange("otraIntervencion", checked as boolean)}
              />
              <Label htmlFor="otra-intervencion" className="text-sm font-medium text-slate-700">
                Otra intervención
              </Label>
            </div>

            {data.otraIntervencion && (
              <div className="mt-3 ml-6">
                <Label htmlFor="otraIntervencionDescripcion" className="text-sm font-medium text-slate-700">
                  Descripción de la intervención
                </Label>
                <Textarea
                  id="otraIntervencionDescripcion"
                  placeholder="Describa la intervención de UJ..."
                  value={data.otraIntervencionDescripcion || ""}
                  onChange={(e) => handleChange("otraIntervencionDescripcion", e.target.value)}
                  className="mt-1"
                  rows={3}
                />
              </div>
            )}
          </div>

          <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="amicus-curiae"
                checked={data.amicusCuriae || false}
                onCheckedChange={(checked) => handleChange("amicusCuriae", checked as boolean)}
              />
              <Label htmlFor="amicus-curiae" className="text-sm font-medium text-slate-700">
                Amicus Curiae
              </Label>
            </div>

            {data.amicusCuriae && (
              <div className="mt-3 ml-6">
                <Label htmlFor="abogadoUsinaFirmo" className="text-sm font-medium text-slate-700">
                  Abogado de Usina que firmó
                </Label>
                <Input
                  id="abogadoUsinaFirmo"
                  placeholder="Nombre del abogado de Usina"
                  value={data.abogadoUsinaFirmo || ""}
                  onChange={(e) => handleChange("abogadoUsinaFirmo", e.target.value)}
                  className="border-slate-300 mt-1"
                />
              </div>
            )}
          </div>
        </div>

        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-center gap-2 mb-4">
            <Scale className="w-5 h-5 text-amber-700" />
            <h4 className="text-md font-medium text-amber-900">Abogado/a Querellante</h4>
          </div>

          <div className="space-y-4 mb-4">
            <Label className="text-sm font-medium text-slate-700">¿La víctima tiene abogado/a querellante?</Label>
            <RadioGroup
              value={data.tieneAbogadoQuerellante || "ns_nc"}
              onValueChange={(value) => handleChange("tieneAbogadoQuerellante", value)}
              className="flex flex-wrap gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="si" id="abogado-si" />
                <Label htmlFor="abogado-si" className="text-sm text-slate-700 cursor-pointer">
                  Sí
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="abogado-no" />
                <Label htmlFor="abogado-no" className="text-sm text-slate-700 cursor-pointer">
                  No
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="ns_nc" id="abogado-ns" />
                <Label htmlFor="abogado-ns" className="text-sm text-slate-700 cursor-pointer">
                  NS/NC
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="mb-4">
            <Label className="text-sm font-medium text-slate-700">¿Usina patrocina o presenta amicus?</Label>
            <Select
              value={data.abogadoUsinaAmicus || ""}
              onValueChange={(value) => handleChange("abogadoUsinaAmicus", value)}
            >
              <SelectTrigger className="border-slate-300 bg-white mt-1 w-full md:w-64">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="patrocina">Usina patrocina</SelectItem>
                <SelectItem value="amicus">Usina presenta amicus</SelectItem>
                <SelectItem value="ambos">Ambos</SelectItem>
                <SelectItem value="ninguno">Ninguno</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {data.tieneAbogadoQuerellante === "si" && (
            <>
              <div className="flex justify-between items-center mb-3">
                <Label className="text-sm font-medium text-amber-900">Datos de Abogados Querellantes</Label>
                <Button
                  onClick={addAbogado}
                  size="sm"
                  variant="outline"
                  className="flex items-center gap-1 text-xs border-amber-300 text-amber-700 hover:bg-amber-100 bg-transparent"
                >
                  <Plus className="w-3 h-3" />
                  Agregar Abogado
                </Button>
              </div>

              {!data.datosAbogadosQuerellantes || data.datosAbogadosQuerellantes.length === 0 ? (
                <div className="text-center py-3 text-amber-700 text-sm border border-dashed border-amber-300 rounded bg-white">
                  <p>No hay abogados registrados. Haga clic en &ldquo;Agregar Abogado&rdquo;.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.datosAbogadosQuerellantes.map((abogado: any, index: number) => (
                    <Card key={abogado.id} className="border-amber-200 bg-white">
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-start mb-3">
                          <span className="text-sm font-medium text-amber-800">Abogado #{index + 1}</span>
                          <Button
                            onClick={() => removeAbogado(abogado.id)}
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 h-6 w-6 p-0"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <Input
                            placeholder="Nombre completo"
                            value={abogado.nombre || ""}
                            onChange={(e) => updateAbogado(abogado.id, "nombre", e.target.value)}
                            className="border-slate-300"
                          />
                          <Input
                            placeholder="Matrícula"
                            value={abogado.matricula || ""}
                            onChange={(e) => updateAbogado(abogado.id, "matricula", e.target.value)}
                            className="border-slate-300"
                          />
                          <Input
                            placeholder="Teléfono"
                            value={abogado.telefono || ""}
                            onChange={(e) => updateAbogado(abogado.id, "telefono", e.target.value)}
                            className="border-slate-300"
                          />
                          <Input
                            placeholder="Email"
                            type="email"
                            value={abogado.email || ""}
                            onChange={(e) => updateAbogado(abogado.id, "email", e.target.value)}
                            className="border-slate-300"
                          />
                        </div>
                        <div className="flex items-center space-x-2 mt-3">
                          <Checkbox
                            id={`usina-${abogado.id}`}
                            checked={abogado.es_usina || false}
                            onCheckedChange={(checked) => updateAbogado(abogado.id, "es_usina", checked as boolean)}
                          />
                          <Label htmlFor={`usina-${abogado.id}`} className="text-sm text-slate-700">
                            Es abogado/a de Usina de Justicia
                          </Label>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="space-y-2">
            <Label htmlFor="comoLlegoCaso" className="text-sm font-medium text-slate-700">
              Cómo llegó el caso
            </Label>
            <Input
              id="comoLlegoCaso"
              placeholder="Descripción de cómo llegó el caso a la organización"
              value={data.comoLlegoCaso || ""}
              onChange={(e) => handleChange("comoLlegoCaso", e.target.value)}
              className="border-slate-300"
            />
          </div>

          <div className="flex items-center space-x-2 mt-6">
            <Checkbox
              id="primerContacto"
              checked={data.primerContacto || false}
              onCheckedChange={(checked) => handleChange("primerContacto", checked as boolean)}
            />
            <Label htmlFor="primerContacto" className="text-sm text-slate-700">
              Primer Contacto (orientación inicial sin seguimiento completo)
            </Label>
          </div>
        </div>

        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-700" />
              <h4 className="text-md font-medium text-blue-900">Miembros Asignados de Usina</h4>
            </div>
            <Button
              onClick={addMiembro}
              size="sm"
              variant="outline"
              className="flex items-center gap-1 text-xs border-blue-300 text-blue-700 hover:bg-blue-100 bg-transparent"
            >
              <Plus className="w-3 h-3" />
              Agregar Miembro
            </Button>
          </div>

          {!data.listaMiembrosAsignados || data.listaMiembrosAsignados.length === 0 ? (
            <div className="text-center py-3 text-blue-700 text-sm border border-dashed border-blue-300 rounded bg-white">
              <p>No hay miembros asignados. Haga clic en &ldquo;Agregar Miembro&rdquo;.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.listaMiembrosAsignados.map((miembro: any, index: number) => (
                <Card key={miembro.id} className="border-blue-200 bg-white">
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-sm font-medium text-blue-800">Miembro #{index + 1}</span>
                      <Button
                        onClick={() => removeMiembro(miembro.id)}
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 h-6 w-6 p-0"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Input
                        placeholder="Nombre completo"
                        value={miembro.nombre || ""}
                        onChange={(e) => updateMiembro(miembro.id, "nombre", e.target.value)}
                        className="border-slate-300"
                      />
                      <Input
                        placeholder="Teléfono"
                        value={miembro.telefono || ""}
                        onChange={(e) => updateMiembro(miembro.id, "telefono", e.target.value)}
                        className="border-slate-300"
                      />
                      <Input
                        placeholder="Email"
                        type="email"
                        value={miembro.email || ""}
                        onChange={(e) => updateMiembro(miembro.id, "email", e.target.value)}
                        className="border-slate-300"
                      />
                      <Input
                        type="date"
                        value={miembro.fecha_asignacion || ""}
                        onChange={(e) => updateMiembro(miembro.id, "fecha_asignacion", e.target.value)}
                        className="border-slate-300"
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-green-700" />
              <h4 className="text-md font-medium text-green-900">Contactos Familiares</h4>
            </div>
            <Button
              onClick={addContacto}
              size="sm"
              variant="outline"
              className="flex items-center gap-1 text-xs border-green-300 text-green-700 hover:bg-green-100 bg-transparent"
            >
              <Plus className="w-3 h-3" />
              Agregar Contacto
            </Button>
          </div>

          {!data.listaContactosFamiliares || data.listaContactosFamiliares.length === 0 ? (
            <div className="text-center py-3 text-green-700 text-sm border border-dashed border-green-300 rounded bg-white">
              <p>No hay contactos familiares. Haga clic en &ldquo;Agregar Contacto&rdquo;.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.listaContactosFamiliares.map((contacto: any, index: number) => (
                <Card key={contacto.id} className="border-green-200 bg-white">
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-sm font-medium text-green-800">Contacto #{index + 1}</span>
                      <Button
                        onClick={() => removeContacto(contacto.id)}
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 h-6 w-6 p-0"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Select
                        value={contacto.parentesco || ""}
                        onValueChange={(value) => updateContacto(contacto.id, "parentesco", value)}
                      >
                        <SelectTrigger className="border-slate-300">
                          <SelectValue placeholder="Parentesco" />
                        </SelectTrigger>
                        <SelectContent>
                          {PARENTESCO_OPTIONS.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {contacto.parentesco === "Otro" && (
                        <Input
                          placeholder="Especificar parentesco"
                          value={contacto.parentesco_otro || ""}
                          onChange={(e) => updateContacto(contacto.id, "parentesco_otro", e.target.value)}
                          className="border-slate-300"
                        />
                      )}

                      <Input
                        placeholder="Nombre completo"
                        value={contacto.nombre || ""}
                        onChange={(e) => updateContacto(contacto.id, "nombre", e.target.value)}
                        className="border-slate-300"
                      />
                      <Input
                        placeholder="Teléfono"
                        value={contacto.telefono || ""}
                        onChange={(e) => updateContacto(contacto.id, "telefono", e.target.value)}
                        className="border-slate-300"
                      />
                      <Input
                        placeholder="Email"
                        type="email"
                        value={contacto.email || ""}
                        onChange={(e) => updateContacto(contacto.id, "email", e.target.value)}
                        className="border-slate-300"
                      />
                      <Input
                        placeholder="Dirección"
                        value={contacto.direccion || ""}
                        onChange={(e) => updateContacto(contacto.id, "direccion", e.target.value)}
                        className="border-slate-300 md:col-span-2"
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 space-y-2">
          <Label htmlFor="followUpNotes" className="text-sm font-medium text-slate-700">
            Notas de Seguimiento
          </Label>
          <Textarea
            id="followUpNotes"
            placeholder="Notas sobre el seguimiento del caso, necesidades de la familia, derivaciones realizadas, etc."
            value={data.notasSeguimiento || ""}
            onChange={(e) => handleChange("notasSeguimiento", e.target.value)}
            className="border-slate-300"
            rows={4}
          />
        </div>

        <div className="mt-4 space-y-2">
          <Label htmlFor="nextActions" className="text-sm font-medium text-slate-700">
            Próximas Acciones
          </Label>
          <Textarea
            id="nextActions"
            placeholder="Acciones planificadas, citas programadas, gestiones pendientes"
            value={data.proximasAcciones || ""}
            onChange={(e) => handleChange("proximasAcciones", e.target.value)}
            className="border-slate-300"
            rows={3}
          />
        </div>

        <div className="mt-8 pt-6 border-t border-slate-200">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-purple-600" />
            <h3 className="text-lg font-semibold text-slate-900 font-heading">Recursos y Documentos del Caso</h3>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            Sube documentos generales del caso: notas de prensa, resoluciones judiciales, informes, etc.
          </p>
          <ResourcesForm
            data={resources.filter((r: any) => !r.id || r.id.toString().startsWith("temp-"))}
            onChange={onResourcesChange || (() => {})}
            savedResources={savedResources}
            onDeleteSavedResource={onDeleteSavedResource}
          />
        </div>
      </div>
    </div>
  )
}
