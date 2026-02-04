# AGENTS.md - Base de Datos de Víctimas - Usina de Justicia

## Comandos de Desarrollo
```bash
npm run dev          # Servidor de desarrollo (http://localhost:3000)
npm run build        # Build de producción
npm run start        # Servidor de producción
npm run lint         # Análisis ESLint (fail on error)
npm run lint -- --file <path>  # Lint archivo específico
```

**Notas:**
- No hay framework de tests configurado actualmente
- Autenticación real con Supabase (sin modo mock)
- TypeScript estricto + ESLint estricto en builds

## Stack Tecnológico
- **Next.js 15.1.11** App Router (React 19)
- **TypeScript** strict mode
- **Tailwind CSS v4.1.9** + CSS variables
- **Supabase** (PostgreSQL + Auth + Storage + RLS)
- **shadcn/ui** componentes con Radix UI
- **React Hook Form** + Zod validation
- **Recharts** visualización de datos

## Guías de Código

### Convenciones de Nomenclatura
- **Archivos:** kebab-case (`case-form.tsx`, `auth-guard.tsx`)
- **Componentes:** PascalCase (`CaseForm`, `AuthGuard`)
- **Variables:** camelCase (`formData`, `isLoading`)
- **Constantes:** UPPER_SNAKE_CASE (`BUCKET_NAME`)
- **Base de datos:** snake_case (`nombre_completo`)
- **TypeScript:** camelCase interfaces (`nombreCompleto`)

### Import Order
```typescript
// 1. React imports
import type React from "react"
import { useState, useEffect } from "react"

// 2. Next.js imports
import { useRouter } from "next/navigation"
import Image from "next/image"

// 3. Third-party libraries
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

// 4. Local imports (relative path last)
import { VictimForm } from "./forms/victim-form"
```

### Componentes
- **Cliente:** Directiva `"use client"` al inicio
- **Servidor:** Default para páginas App Router
- **Funciones:** Arrow functions preferidas
- **Props:** Interfaces con sufijo `Props` antes del componente

### TypeScript
- Tipos DB en `lib/types/database.ts` (snake_case)
- Props: interfaces con `Props` sufijo
- Types utility: `Insert`, `Update`, relaciones para queries

### Errores
```typescript
try {
  await operation()
} catch (err) {
  console.error("Descripción error:", err)
  setError("Mensaje usuario en español")
  // Comportamiento fallback
}
```

### Estados de Carga
- Boolean `isLoading` para operaciones async
- Estados específicos (`isLoadingProvincias`, `isLoadingMunicipios`)
- Indicadores con `Loader2` de Lucide React

### Formularios (React Hook Form + Zod)
```typescript
const { control, handleSubmit, formState: { errors } } = useForm({
  resolver: zodResolver(schema),
  defaultValues: initialData
})
```
- Campos controlados con `control`
- Validación en tiempo real
- Mensajes de error en español

### Base de Datos (Supabase)
```typescript
const supabase = createClient()
const { data, error } = await supabase
  .from("table_name")
  .select("*")
  .eq("field", value)
```

### Validación
- Zod schemas type-safe
- Textos hardcoded en español
- Feedback inmediato

### Internacionalización
- **Idioma:** Español hardcoded en UI
- Mensajes de error en español
- Datos geográficos Argentina-specific

## Reglas de Operación (Human-in-the-Loop)

**STOP y CONSULTAR** en estos escenarios:
1. **Acciones destructivas:** Antes de eliminar archivos o tablas DB
2. **Cambios de arquitectura:** Antes de agregar librerías mayores o cambiar estructura de carpetas
3. **Ambigüedad:** Si hay conflicto entre instrucciones y contexto

**PROCEED AUTONOMOUSLY** para todo lo demás (escribir funciones, fijar bugs, crear componentes UI)

## Calidad y Consistencia
- **Pasos atómicos:** Completar un paso, verificar, continuar al siguiente
- **Sin código truncado:** Nunca output `// ... rest of code`. Escribir archivo completo
- **Auto-corrección:** "Linter mental" antes de mostrar código - eliminar vars sin usar, fix types

## Autenticación
- **Supabase Auth:** Cliente con `@supabase/ssr`
- **Auth Guard:** Componente para rutas protegidas
- **Allowed Users:** Sistema whitelist en tabla `allowed_users`

## Storage de Archivos
- Subidas a Supabase Storage con timestamp prefixes
- URLs públicas para acceso
- File type detection + size formatting

## Seguridad
- RLS Policies en base de datos
- Environment variables protegidas
- Input sanitization para file uploads

## Datos
- **Schema Master:** `scripts/schema_master.sql` es fuente de verdad única
- Timestamps: `created_at`, `updated_at` automáticos
- Relaciones: tipos con relaciones para joins

## Estilos
- Tailwind utilities + CSS custom properties
- Dark mode con clase `.dark`
- shadcn/ui variants con `class-variance-authority`
- Mobile-first approach

## Comunicación Usuario
- Toast system via `useToast` hook
- Loading states consistentes
- Mensajes error amigables en español
- Success feedback para acciones

Este proyecto sigue patrones modernos React/Next.js con foco en type safety y mantenibilidad.
