-- =============================================================================
-- Cola de reintentos para callbacks a Mapa del Delito
-- =============================================================================
-- Cuando se decide un candidato (aprobar/rechazar/marcar duplicado), BD
-- Usina intenta un UPDATE inmediato contra `propuestas_para_usina` en la
-- BD de MdD. Si eso falla (MdD caído, JWT vencido, red), la decisión ya
-- quedó aplicada acá (ficha creada, log escrito) pero el otro lado no se
-- enteró — se encola acá para reintentar sin perder la decisión.
--
-- Ejecutar UNA vez en el SQL Editor de Supabase (BD Usina). Idempotente.
-- -----------------------------------------------------------------------------

create table if not exists public.pending_callbacks_mdd (
  id                uuid primary key default gen_random_uuid(),
  candidato_id      uuid not null,          -- id en propuestas_para_usina (MdD)
  payload           jsonb not null,          -- {estado, usina_victima_id, motivo_rechazo, decidido_at, decidido_por}
  intentos          int not null default 0,
  ultimo_error      text,
  resuelto          boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_pending_callbacks_mdd_pendientes
  on public.pending_callbacks_mdd (created_at)
  where not resuelto;

alter table public.pending_callbacks_mdd enable row level security;

-- Las API routes de /api/candidatos/* corren con el cliente Supabase
-- normal del server (rol `authenticated`, sesión del usuario logueado —
-- ver lib/supabase/server.ts), no con service role. Se reutiliza
-- `is_allowed_user()` (scripts/014_harden_rls.sql) para que sólo el
-- personal whitelisted pueda tocar esta tabla, igual que el resto.
drop policy if exists "pending_callbacks_mdd_whitelist_all" on public.pending_callbacks_mdd;
create policy "pending_callbacks_mdd_whitelist_all" on public.pending_callbacks_mdd
  for all to authenticated
  using (public.is_allowed_user())
  with check (public.is_allowed_user());

comment on table public.pending_callbacks_mdd is
  'Cola de reintentos de callbacks a Mapa del Delito. Poblada cuando el '
  'UPDATE inmediato tras una decisión de /candidatos falla; reintentada '
  'por app/api/cron/retry-mdd-callbacks.';
