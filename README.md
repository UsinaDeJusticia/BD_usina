# Base de Datos de Víctimas - Usina de Justicia

*Automatically synced with your [v0.app](https://v0.app) deployments*

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/ejairsud-3412s-projects/v0-image-analysis)
[![Built with v0](https://img.shields.io/badge/Built%20with-v0.app-black?style=for-the-badge)](https://v0.app/chat/projects/GB1CM5Pa1VV)

## Overview

Sistema de gestión y seguimiento de casos de víctimas de inseguridad, desarrollado para Usina de Justicia.

## 🚀 Desarrollo Local

### Requisitos

- Node.js 20 o superior
- Un proyecto de Supabase con el esquema de `scripts/` aplicado (ver `scripts/README.md`)

### Variables de entorno

Crear `.env.local` (está en `.gitignore`, nunca commitearlo):

```env
NEXT_PUBLIC_SUPABASE_URL=https://<proyecto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
# Opcional pero recomendado: cachea 15 min el chequeo de whitelist del middleware.
# Generar con: openssl rand -hex 32
WHITELIST_COOKIE_SECRET=<secreto aleatorio>
```

La app no usa la `service_role` key: no hace falta configurarla en Vercel.

### Comandos

```bash
npm ci              # instala exactamente lo del package-lock.json
npm run dev         # desarrollo
npm run typecheck   # TypeScript
npm run lint        # ESLint
npm test            # tests (los de integración necesitan TEST_DATABASE_URL)
npm run build       # build de producción (falla si hay errores de tipos)
```

Tests de integración con Postgres local:

```bash
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres npm test
```

## 🔒 Seguridad

- Acceso: login con Supabase Auth + whitelist (`allowed_users`) validada en el
  middleware **y** en la base (RLS, `scripts/013_harden_rls.sql`).
- Archivos: bucket privado; se sirven por `/api/files/...` con signed URLs de 60 s.
- Pasos pendientes de aplicar en producción: ver `docs/security-hardening.md`.

## 🔧 Características

- ✅ Gestión completa de casos de víctimas
- ✅ Dashboard con estadísticas y gráficos
- ✅ Filtros avanzados por fecha, provincia, estado
- ✅ Carga de documentos y archivos adjuntos
- ✅ Vista animada y vista de grilla
- ✅ Autenticación con Supabase + whitelist de usuarios
- ✅ Integración con base de datos PostgreSQL

## 📦 Deployment

Your project is live at:

**[https://vercel.com/ejairsud-3412s-projects/v0-image-analysis](https://vercel.com/ejairsud-3412s-projects/v0-image-analysis)**

## Build your app

Continue building your app on:

**[https://v0.app/chat/projects/GB1CM5Pa1VV](https://v0.app/chat/projects/GB1CM5Pa1VV)**

## How It Works

1. Create and modify your project using [v0.app](https://v0.app)
2. Deploy your chats from the v0 interface
3. Changes are automatically pushed to this repository
4. Vercel deploys the latest version from this repository
