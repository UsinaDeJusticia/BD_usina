
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "allowed_users": {
                  Row: {
                    "email": string
                  }
                  ComputedFields: never
                  Insert: {
                    "email": string
                  }
                  Update: {
                    "email"?: string
                  }
                  Relationships: [
                    
                  ]
                },"casos": {
                  Row: {
                    "created_at": string | null,"estado": string | null,"estado_general": string | null,"hecho_id": string | null,"id": string,"numero_involucrados": number | null,"updated_at": string | null,"victima_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string | null,"estado"?: string | null,"estado_general"?: string | null,"hecho_id"?: string | null,"id"?: string,"numero_involucrados"?: number | null,"updated_at"?: string | null,"victima_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string | null,"estado"?: string | null,"estado_general"?: string | null,"hecho_id"?: string | null,"id"?: string,"numero_involucrados"?: number | null,"updated_at"?: string | null,"victima_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "casos_hecho_id_fkey"
      columns: ["hecho_id"]
isOneToOne: false
      referencedRelation: "hechos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "casos_victima_id_fkey"
      columns: ["victima_id"]
isOneToOne: false
      referencedRelation: "victimas"
      referencedColumns: ["id"]
    }
                  ]
                },"fechas_juicio": {
                  Row: {
                    "created_at": string | null,"descripcion": string | null,"fecha_audiencia": string,"id": string,"imputado_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string | null,"descripcion"?: string | null,"fecha_audiencia": string,"id"?: string,"imputado_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string | null,"descripcion"?: string | null,"fecha_audiencia"?: string,"id"?: string,"imputado_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "fechas_juicio_imputado_id_fkey"
      columns: ["imputado_id"]
isOneToOne: false
      referencedRelation: "imputados"
      referencedColumns: ["id"]
    }
                  ]
                },"hechos": {
                  Row: {
                    "caratula": string | null,"created_at": string | null,"email_fiscalia": string | null,"estado_caso": string | null,"fecha_fallecimiento": string | null,"fecha_hecho": string | null,"id": string,"localidad_barrio": string | null,"lugar_especifico": string | null,"lugar_otro": string | null,"municipio": string | null,"numero_causa": string | null,"provincia": string | null,"resumen_hecho": string | null,"telefono_fiscalia": string | null,"tipo_arma": string | null,"tipo_crimen": string | null,"tipo_lugar": string | null,"updated_at": string | null,"victima_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "caratula"?: string | null,"created_at"?: string | null,"email_fiscalia"?: string | null,"estado_caso"?: string | null,"fecha_fallecimiento"?: string | null,"fecha_hecho"?: string | null,"id"?: string,"localidad_barrio"?: string | null,"lugar_especifico"?: string | null,"lugar_otro"?: string | null,"municipio"?: string | null,"numero_causa"?: string | null,"provincia"?: string | null,"resumen_hecho"?: string | null,"telefono_fiscalia"?: string | null,"tipo_arma"?: string | null,"tipo_crimen"?: string | null,"tipo_lugar"?: string | null,"updated_at"?: string | null,"victima_id"?: string | null
                  }
                  Update: {
                    "caratula"?: string | null,"created_at"?: string | null,"email_fiscalia"?: string | null,"estado_caso"?: string | null,"fecha_fallecimiento"?: string | null,"fecha_hecho"?: string | null,"id"?: string,"localidad_barrio"?: string | null,"lugar_especifico"?: string | null,"lugar_otro"?: string | null,"municipio"?: string | null,"numero_causa"?: string | null,"provincia"?: string | null,"resumen_hecho"?: string | null,"telefono_fiscalia"?: string | null,"tipo_arma"?: string | null,"tipo_crimen"?: string | null,"tipo_lugar"?: string | null,"updated_at"?: string | null,"victima_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "hechos_victima_id_fkey"
      columns: ["victima_id"]
isOneToOne: false
      referencedRelation: "victimas"
      referencedColumns: ["id"]
    }
                  ]
                },"imputados": {
                  Row: {
                    "alias": string | null,"apellido_nombre": string | null,"cargos": string | null,"created_at": string | null,"detenido_previo": boolean | null,"documento_identidad": string | null,"edad": string | null,"es_extranjero": boolean | null,"es_reincidente": boolean | null,"estado_procesal": string | null,"fallecido": boolean | null,"fecha_veredicto": string | null,"hecho_id": string | null,"id": string,"juicio_abreviado": boolean | null,"juzgado_ufi": string | null,"menor_edad": boolean | null,"nacionalidad": string | null,"pena": string | null,"prision_perpetua": boolean | null,"tribunal_fallo": string | null,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "alias"?: string | null,"apellido_nombre"?: string | null,"cargos"?: string | null,"created_at"?: string | null,"detenido_previo"?: boolean | null,"documento_identidad"?: string | null,"edad"?: string | null,"es_extranjero"?: boolean | null,"es_reincidente"?: boolean | null,"estado_procesal"?: string | null,"fallecido"?: boolean | null,"fecha_veredicto"?: string | null,"hecho_id"?: string | null,"id"?: string,"juicio_abreviado"?: boolean | null,"juzgado_ufi"?: string | null,"menor_edad"?: boolean | null,"nacionalidad"?: string | null,"pena"?: string | null,"prision_perpetua"?: boolean | null,"tribunal_fallo"?: string | null,"updated_at"?: string | null
                  }
                  Update: {
                    "alias"?: string | null,"apellido_nombre"?: string | null,"cargos"?: string | null,"created_at"?: string | null,"detenido_previo"?: boolean | null,"documento_identidad"?: string | null,"edad"?: string | null,"es_extranjero"?: boolean | null,"es_reincidente"?: boolean | null,"estado_procesal"?: string | null,"fallecido"?: boolean | null,"fecha_veredicto"?: string | null,"hecho_id"?: string | null,"id"?: string,"juicio_abreviado"?: boolean | null,"juzgado_ufi"?: string | null,"menor_edad"?: boolean | null,"nacionalidad"?: string | null,"pena"?: string | null,"prision_perpetua"?: boolean | null,"tribunal_fallo"?: string | null,"updated_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "imputados_hecho_id_fkey"
      columns: ["hecho_id"]
isOneToOne: false
      referencedRelation: "hechos"
      referencedColumns: ["id"]
    }
                  ]
                },"instancias_judiciales": {
                  Row: {
                    "caratula": string | null,"created_at": string | null,"fiscal": string | null,"fiscalia": string | null,"id": string,"imputado_id": string | null,"numero_causa": string | null,"orden_nivel": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "caratula"?: string | null,"created_at"?: string | null,"fiscal"?: string | null,"fiscalia"?: string | null,"id"?: string,"imputado_id"?: string | null,"numero_causa"?: string | null,"orden_nivel"?: string | null
                  }
                  Update: {
                    "caratula"?: string | null,"created_at"?: string | null,"fiscal"?: string | null,"fiscalia"?: string | null,"id"?: string,"imputado_id"?: string | null,"numero_causa"?: string | null,"orden_nivel"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "instancias_judiciales_imputado_id_fkey"
      columns: ["imputado_id"]
isOneToOne: false
      referencedRelation: "imputados"
      referencedColumns: ["id"]
    }
                  ]
                },"notificacion_preferencias": {
                  Row: {
                    "aniversarios": boolean,"audiencias": boolean,"casos": boolean,"updated_at": string,"user_email": string
                  }
                  ComputedFields: never
                  Insert: {
                    "aniversarios"?: boolean,"audiencias"?: boolean,"casos"?: boolean,"updated_at"?: string,"user_email": string
                  }
                  Update: {
                    "aniversarios"?: boolean,"audiencias"?: boolean,"casos"?: boolean,"updated_at"?: string,"user_email"?: string
                  }
                  Relationships: [
                    
                  ]
                },"notificaciones": {
                  Row: {
                    "created_at": string,"cuerpo": string | null,"dedupe_key": string | null,"id": string,"leida_at": string | null,"push_enviada_at": string | null,"tipo": string,"titulo": string,"url": string | null,"user_email": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"cuerpo"?: string | null,"dedupe_key"?: string | null,"id"?: string,"leida_at"?: string | null,"push_enviada_at"?: string | null,"tipo": string,"titulo": string,"url"?: string | null,"user_email": string
                  }
                  Update: {
                    "created_at"?: string,"cuerpo"?: string | null,"dedupe_key"?: string | null,"id"?: string,"leida_at"?: string | null,"push_enviada_at"?: string | null,"tipo"?: string,"titulo"?: string,"url"?: string | null,"user_email"?: string
                  }
                  Relationships: [
                    
                  ]
                },"push_suscripciones": {
                  Row: {
                    "auth": string,"created_at": string,"endpoint": string,"id": string,"last_success_at": string | null,"p256dh": string,"user_agent": string | null,"user_email": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auth": string,"created_at"?: string,"endpoint": string,"id"?: string,"last_success_at"?: string | null,"p256dh": string,"user_agent"?: string | null,"user_email": string
                  }
                  Update: {
                    "auth"?: string,"created_at"?: string,"endpoint"?: string,"id"?: string,"last_success_at"?: string | null,"p256dh"?: string,"user_agent"?: string | null,"user_email"?: string
                  }
                  Relationships: [
                    
                  ]
                },"recursos": {
                  Row: {
                    "archivo_nombre": string | null,"archivo_path": string | null,"archivo_size": number | null,"archivo_tipo": string | null,"created_at": string | null,"descripcion": string | null,"fuente": string | null,"hecho_id": string | null,"id": string,"imputado_id": string | null,"tipo": string,"titulo": string,"updated_at": string | null,"url": string | null,"victima_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "archivo_nombre"?: string | null,"archivo_path"?: string | null,"archivo_size"?: number | null,"archivo_tipo"?: string | null,"created_at"?: string | null,"descripcion"?: string | null,"fuente"?: string | null,"hecho_id"?: string | null,"id"?: string,"imputado_id"?: string | null,"tipo": string,"titulo": string,"updated_at"?: string | null,"url"?: string | null,"victima_id"?: string | null
                  }
                  Update: {
                    "archivo_nombre"?: string | null,"archivo_path"?: string | null,"archivo_size"?: number | null,"archivo_tipo"?: string | null,"created_at"?: string | null,"descripcion"?: string | null,"fuente"?: string | null,"hecho_id"?: string | null,"id"?: string,"imputado_id"?: string | null,"tipo"?: string,"titulo"?: string,"updated_at"?: string | null,"url"?: string | null,"victima_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "recursos_hecho_id_fkey"
      columns: ["hecho_id"]
isOneToOne: false
      referencedRelation: "hechos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recursos_imputado_id_fkey"
      columns: ["imputado_id"]
isOneToOne: false
      referencedRelation: "imputados"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recursos_victima_id_fkey"
      columns: ["victima_id"]
isOneToOne: false
      referencedRelation: "victimas"
      referencedColumns: ["id"]
    }
                  ]
                },"seguimiento": {
                  Row: {
                    "abogado_amicus_firmante": string | null,"abogado_querellante": string | null,"abogado_usina_amicus": string | null,"amicus_curiae": boolean | null,"como_llego_caso": string | null,"contacto_familia": string | null,"created_at": string | null,"datos_abogados_querellantes": Json | null,"direccion_contacto": string | null,"email_contacto": string | null,"email_miembro": string | null,"fecha_asignacion": string | null,"hecho_id": string | null,"id": string,"lista_contactos_familiares": Json | null,"lista_miembros_asignados": Json | null,"miembro_asignado": string | null,"notas_seguimiento": string | null,"otra_intervencion": boolean | null,"otra_intervencion_descripcion": string | null,"parentesco_contacto": string | null,"parentesco_otro": string | null,"primer_contacto": boolean | null,"proximas_acciones": string | null,"telefono_contacto": string | null,"telefono_miembro": string | null,"tiene_abogado_querellante": string | null,"tipo_acompanamiento": (string)[] | null,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "abogado_amicus_firmante"?: string | null,"abogado_querellante"?: string | null,"abogado_usina_amicus"?: string | null,"amicus_curiae"?: boolean | null,"como_llego_caso"?: string | null,"contacto_familia"?: string | null,"created_at"?: string | null,"datos_abogados_querellantes"?: Json | null,"direccion_contacto"?: string | null,"email_contacto"?: string | null,"email_miembro"?: string | null,"fecha_asignacion"?: string | null,"hecho_id"?: string | null,"id"?: string,"lista_contactos_familiares"?: Json | null,"lista_miembros_asignados"?: Json | null,"miembro_asignado"?: string | null,"notas_seguimiento"?: string | null,"otra_intervencion"?: boolean | null,"otra_intervencion_descripcion"?: string | null,"parentesco_contacto"?: string | null,"parentesco_otro"?: string | null,"primer_contacto"?: boolean | null,"proximas_acciones"?: string | null,"telefono_contacto"?: string | null,"telefono_miembro"?: string | null,"tiene_abogado_querellante"?: string | null,"tipo_acompanamiento"?: (string)[] | null,"updated_at"?: string | null
                  }
                  Update: {
                    "abogado_amicus_firmante"?: string | null,"abogado_querellante"?: string | null,"abogado_usina_amicus"?: string | null,"amicus_curiae"?: boolean | null,"como_llego_caso"?: string | null,"contacto_familia"?: string | null,"created_at"?: string | null,"datos_abogados_querellantes"?: Json | null,"direccion_contacto"?: string | null,"email_contacto"?: string | null,"email_miembro"?: string | null,"fecha_asignacion"?: string | null,"hecho_id"?: string | null,"id"?: string,"lista_contactos_familiares"?: Json | null,"lista_miembros_asignados"?: Json | null,"miembro_asignado"?: string | null,"notas_seguimiento"?: string | null,"otra_intervencion"?: boolean | null,"otra_intervencion_descripcion"?: string | null,"parentesco_contacto"?: string | null,"parentesco_otro"?: string | null,"primer_contacto"?: boolean | null,"proximas_acciones"?: string | null,"telefono_contacto"?: string | null,"telefono_miembro"?: string | null,"tiene_abogado_querellante"?: string | null,"tipo_acompanamiento"?: (string)[] | null,"updated_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "seguimiento_hecho_id_fkey"
      columns: ["hecho_id"]
isOneToOne: false
      referencedRelation: "hechos"
      referencedColumns: ["id"]
    }
                  ]
                },"victimas": {
                  Row: {
                    "created_at": string | null,"edad": number | null,"fecha_fallecimiento": string | null,"fecha_hecho": string | null,"fecha_nacimiento": string | null,"foto_path": string | null,"id": string,"municipio_residencia": string | null,"nacionalidad": string | null,"nombre_completo": string | null,"notas_adicionales": string | null,"profesion": string | null,"provincia_residencia": string | null,"redes_sociales": string | null,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string | null,"edad"?: number | null,"fecha_fallecimiento"?: string | null,"fecha_hecho"?: string | null,"fecha_nacimiento"?: string | null,"foto_path"?: string | null,"id"?: string,"municipio_residencia"?: string | null,"nacionalidad"?: string | null,"nombre_completo"?: string | null,"notas_adicionales"?: string | null,"profesion"?: string | null,"provincia_residencia"?: string | null,"redes_sociales"?: string | null,"updated_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string | null,"edad"?: number | null,"fecha_fallecimiento"?: string | null,"fecha_hecho"?: string | null,"fecha_nacimiento"?: string | null,"foto_path"?: string | null,"id"?: string,"municipio_residencia"?: string | null,"nacionalidad"?: string | null,"nombre_completo"?: string | null,"notas_adicionales"?: string | null,"profesion"?: string | null,"provincia_residencia"?: string | null,"redes_sociales"?: string | null,"updated_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "crear_notificaciones":
{ Args: { "p_cuerpo"?: string,"p_dedupe_key"?: string,"p_excluir_email"?: string,"p_tipo": string,"p_titulo": string,"p_url"?: string }; Returns: number
                           },
"delete_caso":
{ Args: { "p_caso_id": string }; Returns: Json
                           },
"get_dashboard_stats":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"is_allowed_user":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"notificacion_de_prueba":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"notificar_evento_caso":
{ Args: { "p_caso_id": string,"p_tipo": string }; Returns: number
                           },
"registrar_push":
{ Args: { "p_auth": string,"p_endpoint": string,"p_p256dh": string,"p_user_agent"?: string }; Returns: undefined
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
