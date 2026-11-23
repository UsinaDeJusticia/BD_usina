-- =============================================================================
-- 016 — Notificaciones: centro en la app + Web Push
-- =============================================================================
-- Requiere 013 (public.is_allowed_user) y 014 (secreto `cron_secret` en Vault).
-- Todo en UNA transacción. No modifica ninguna tabla existente ni sus datos:
-- sólo crea tablas, funciones y un trigger nuevos.
--
-- TABLAS
--   notificaciones             una fila por notificación y destinatario.
--   notificacion_preferencias  qué tipos quiere recibir cada usuario.
--   push_suscripciones         dispositivos registrados para Web Push.
--
-- QUIÉN ESCRIBE
--   Los usuarios no pueden insertar notificaciones directamente (evita que
--   alguien le mande notificaciones falsas a otro). Se crean sólo desde:
--     - crear_notificaciones()   interna; la usa la edge function diaria
--                                (aniversarios, audiencias) con service_role.
--     - notificar_evento_caso()  la llama la app al crear/editar un caso.
--     - notificacion_de_prueba() cada usuario se manda una a sí mismo.
--
-- PUSH
--   Un trigger AFTER INSERT en notificaciones llama (pg_net, asíncrono) a la
--   edge function `send-push`, autenticada con el mismo `cron_secret` de 014.
--   Si pg_net o el secreto faltan, la notificación igual queda en la app.
--   Un error al encolar el push NUNCA hace fallar el insert.
-- -----------------------------------------------------------------------------

begin;

-- 1. Tablas -------------------------------------------------------------------

create table if not exists public.notificaciones (
  id               uuid primary key default gen_random_uuid(),
  user_email       text not null check (user_email = lower(user_email)),
  tipo             text not null
                   check (tipo in ('aniversario', 'audiencia', 'caso_nuevo', 'caso_editado', 'prueba')),
  titulo           text not null check (char_length(titulo) between 1 and 200),
  cuerpo           text check (cuerpo is null or char_length(cuerpo) <= 1000),
  -- Sólo rutas internas de la app: nada de URLs externas en un click de push.
  url              text check (url is null or (url like '/%' and url not like '//%')),
  -- Para no repetir la misma notificación (p.ej. el cron corre dos veces).
  dedupe_key       text,
  leida_at         timestamptz,
  push_enviada_at  timestamptz,
  created_at       timestamptz not null default now()
);

create index if not exists idx_notificaciones_user_created
  on public.notificaciones (lower(user_email), created_at desc);
create index if not exists idx_notificaciones_user_unread
  on public.notificaciones (lower(user_email)) where leida_at is null;
create unique index if not exists idx_notificaciones_dedupe
  on public.notificaciones (lower(user_email), dedupe_key) where dedupe_key is not null;

create table if not exists public.notificacion_preferencias (
  user_email   text primary key check (user_email = lower(user_email)),
  aniversarios boolean not null default true,
  audiencias   boolean not null default true,
  casos        boolean not null default false,
  updated_at   timestamptz not null default now()
);

create table if not exists public.push_suscripciones (
  id               uuid primary key default gen_random_uuid(),
  user_email       text not null check (user_email = lower(user_email)),
  endpoint         text not null unique check (endpoint like 'https://%'),
  p256dh           text not null,
  auth             text not null,
  user_agent       text,
  created_at       timestamptz not null default now(),
  last_success_at  timestamptz
);

create index if not exists idx_push_suscripciones_user
  on public.push_suscripciones (lower(user_email));

-- 2. RLS ----------------------------------------------------------------------

alter table public.notificaciones enable row level security;
alter table public.notificacion_preferencias enable row level security;
alter table public.push_suscripciones enable row level security;

do $$
declare
  t text;
  pol record;
begin
  foreach t in array array['notificaciones', 'notificacion_preferencias', 'push_suscripciones'] loop
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', pol.policyname, t);
    end loop;
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on public.%I from anon', t);
    end if;
    execute format('revoke all on public.%I from authenticated', t);
  end loop;
end $$;

-- notificaciones: cada uno ve, marca como leída y borra SOLO las suyas.
create policy notificaciones_select_own on public.notificaciones
  for select to authenticated
  using (lower(user_email) = lower(coalesce((select auth.email()), '')) and (select public.is_allowed_user()));
create policy notificaciones_update_own on public.notificaciones
  for update to authenticated
  using (lower(user_email) = lower(coalesce((select auth.email()), '')) and (select public.is_allowed_user()))
  with check (lower(user_email) = lower(coalesce((select auth.email()), '')));
create policy notificaciones_delete_own on public.notificaciones
  for delete to authenticated
  using (lower(user_email) = lower(coalesce((select auth.email()), '')) and (select public.is_allowed_user()));

grant select, delete on public.notificaciones to authenticated;
-- Sólo se puede tocar la columna leida_at (no el texto ni el destinatario).
grant update (leida_at) on public.notificaciones to authenticated;

-- preferencias: cada uno las suyas.
create policy notificacion_preferencias_own on public.notificacion_preferencias
  for all to authenticated
  using (lower(user_email) = lower(coalesce((select auth.email()), '')) and (select public.is_allowed_user()))
  with check (lower(user_email) = lower(coalesce((select auth.email()), '')) and (select public.is_allowed_user()));
grant select, insert, update on public.notificacion_preferencias to authenticated;

-- suscripciones: ver y borrar las propias; alta vía registrar_push().
create policy push_suscripciones_select_own on public.push_suscripciones
  for select to authenticated
  using (lower(user_email) = lower(coalesce((select auth.email()), '')) and (select public.is_allowed_user()));
create policy push_suscripciones_delete_own on public.push_suscripciones
  for delete to authenticated
  using (lower(user_email) = lower(coalesce((select auth.email()), '')) and (select public.is_allowed_user()));
grant select, delete on public.push_suscripciones to authenticated;

-- 3. Funciones ----------------------------------------------------------------

-- Interna: crea una notificación para cada usuario de la whitelist que tenga
-- activada la categoría. Devuelve cuántas creó. No la puede llamar la app.
create or replace function public.crear_notificaciones(
  p_tipo          text,
  p_titulo        text,
  p_cuerpo        text default null,
  p_url           text default null,
  p_dedupe_key    text default null,
  p_excluir_email text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.notificaciones (user_email, tipo, titulo, cuerpo, url, dedupe_key)
  select lower(au.email), p_tipo, p_titulo, p_cuerpo, p_url, p_dedupe_key
  from public.allowed_users au
  left join public.notificacion_preferencias np on lower(np.user_email) = lower(au.email)
  where (p_excluir_email is null or lower(au.email) <> lower(p_excluir_email))
    and case
          when p_tipo = 'aniversario' then coalesce(np.aniversarios, true)
          when p_tipo = 'audiencia' then coalesce(np.audiencias, true)
          when p_tipo in ('caso_nuevo', 'caso_editado') then coalesce(np.casos, false)
          else false
        end
  on conflict do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.crear_notificaciones(text, text, text, text, text, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.crear_notificaciones(text, text, text, text, text, text) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on function public.crear_notificaciones(text, text, text, text, text, text) from authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.crear_notificaciones(text, text, text, text, text, text) to service_role';
  end if;
end $$;

-- La llama la app después de crear o editar un caso. Avisa a los DEMÁS
-- usuarios que activaron "casos". Las ediciones del mismo caso se agrupan:
-- como mucho una notificación por caso cada 10 minutos.
create or replace function public.notificar_evento_caso(p_caso_id uuid, p_tipo text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nombre text;
  v_titulo text;
  v_bucket text;
begin
  if not public.is_allowed_user() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_tipo not in ('caso_nuevo', 'caso_editado') then
    raise exception 'Tipo inválido' using errcode = '22023';
  end if;

  select coalesce(nullif(trim(v.nombre_completo), ''), 'Sin nombre')
    into v_nombre
  from public.casos c
  left join public.victimas v on v.id = c.victima_id
  where c.id = p_caso_id;

  if not found then
    return 0;
  end if;

  v_titulo := case when p_tipo = 'caso_nuevo' then 'Caso nuevo: ' else 'Caso actualizado: ' end || v_nombre;
  v_bucket := to_char(date_trunc('hour', now()) + floor(extract(minute from now()) / 10) * interval '10 minutes',
                      'YYYYMMDDHH24MI');

  return public.crear_notificaciones(
    p_tipo,
    left(v_titulo, 200),
    'Por ' || coalesce(auth.email(), 'un integrante del equipo'),
    '/casos/' || p_caso_id::text,
    p_tipo || ':' || p_caso_id::text || case when p_tipo = 'caso_editado' then ':' || v_bucket else '' end,
    auth.email()
  );
end;
$$;

-- Cada usuario puede mandarse una notificación de prueba (para verificar push).
create or replace function public.notificacion_de_prueba()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_allowed_user() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  insert into public.notificaciones (user_email, tipo, titulo, cuerpo, url)
  values (lower(auth.email()), 'prueba', 'Notificación de prueba',
          'Si ves esto, las notificaciones funcionan en este dispositivo.', '/notificaciones')
  returning id into v_id;
  return v_id;
end;
$$;

-- Alta/reasignación de un dispositivo. Si el mismo navegador estaba
-- registrado por otra persona (computadora compartida), pasa al usuario actual.
create or replace function public.registrar_push(
  p_endpoint   text,
  p_p256dh     text,
  p_auth       text,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_allowed_user() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  insert into public.push_suscripciones (user_email, endpoint, p256dh, auth, user_agent)
  values (lower(auth.email()), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set user_email = excluded.user_email,
        p256dh     = excluded.p256dh,
        auth       = excluded.auth,
        user_agent = excluded.user_agent,
        created_at = now();
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.notificar_evento_caso(uuid, text)',
    'public.notificacion_de_prueba()',
    'public.registrar_push(text, text, text, text)'
  ] loop
    execute format('revoke all on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon', f);
    end if;
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- 4. Trigger que dispara el envío push ----------------------------------------

create or replace function public.encolar_push_notificacion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
begin
  -- Sin pg_net (p.ej. entorno local) o sin secreto: queda sólo en la app.
  if to_regprocedure('net.http_post(text, jsonb, jsonb, jsonb, integer)') is null then
    return new;
  end if;

  begin
    execute 'select decrypted_secret from vault.decrypted_secrets where name = $1'
      into v_secret using 'cron_secret';
  exception when others then
    v_secret := null;
  end;
  if v_secret is null then
    return new;
  end if;

  begin
    execute 'select net.http_post(url := $1, body := $2, params := $3, headers := $4, timeout_milliseconds := $5)'
      using 'https://cvxlbhykhvefufikspsm.supabase.co/functions/v1/send-push',
            jsonb_build_object('notificacion_id', new.id),
            '{}'::jsonb,
            jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
            5000;
  exception when others then
    -- Nunca bloquear el alta de la notificación por un problema de push.
    raise warning 'encolar_push_notificacion: %', sqlerrm;
  end;
  return new;
end;
$$;

revoke all on function public.encolar_push_notificacion() from public;

drop trigger if exists trg_notificaciones_push on public.notificaciones;
create trigger trg_notificaciones_push
  after insert on public.notificaciones
  for each row execute function public.encolar_push_notificacion();

commit;

-- -----------------------------------------------------------------------------
-- Verificación (sólo lectura):
--   select tablename, policyname, cmd from pg_policies
--   where tablename in ('notificaciones','notificacion_preferencias','push_suscripciones');
--
-- Prueba funcional (desde la app, logueado): /notificaciones → "Enviar prueba".
-- -----------------------------------------------------------------------------
