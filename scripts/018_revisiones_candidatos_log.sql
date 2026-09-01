-- =============================================================================
-- Auditoría de decisiones sobre candidatos de Mapa del Delito
-- =============================================================================
-- Traza mínima: quién decidió qué sobre qué propuesta, y con qué
-- resultado. No audita lecturas (ver docs/integracion-mapa-del-delito.md,
-- "Fuera de alcance") — sólo las decisiones de revisión.
--
-- Ejecutar UNA vez en el SQL Editor de Supabase (BD Usina). Idempotente.
-- -----------------------------------------------------------------------------

create table if not exists public.revisiones_candidatos_log (
  id                uuid primary key default gen_random_uuid(),
  candidato_id      uuid not null,          -- id en propuestas_para_usina (MdD)
  decision          text not null check (decision in ('aprobada','rechazada','duplicada')),
  usina_victima_id  uuid,                    -- ficha creada, o víctima existente si fue 'duplicada'
  motivo_rechazo    text,
  decidido_por      text not null,           -- email del revisor (auth.email())
  callback_ok       boolean not null default false, -- si el UPDATE a MdD se aplicó al toque
  created_at        timestamptz not null default now()
);

create index if not exists idx_revisiones_candidato_id
  on public.revisiones_candidatos_log (candidato_id);

alter table public.revisiones_candidatos_log enable row level security;

drop policy if exists "revisiones_candidatos_log_whitelist_all" on public.revisiones_candidatos_log;
create policy "revisiones_candidatos_log_whitelist_all" on public.revisiones_candidatos_log
  for all to authenticated
  using (public.is_allowed_user())
  with check (public.is_allowed_user());

comment on table public.revisiones_candidatos_log is
  'Auditoría de decisiones tomadas en /candidatos. Requiere '
  'scripts/014_harden_rls.sql aplicado antes (usa is_allowed_user()).';
