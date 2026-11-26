-- Lo mínimo de Supabase que necesitan las migraciones de supabase/migrations
-- para aplicarse sobre un Postgres común: roles, auth.email(), el esquema
-- storage y los privilegios por defecto que Supabase da en public.
--
-- NO define tablas de la app: esas salen de las migraciones reales
-- (tests/helpers/migrated-db.ts), así los tests prueban el esquema verdadero.
--
-- Los roles son globales del cluster y varios archivos de tests corren en
-- paralelo: se toleran el "ya existe" y la carrera.
do $$
declare r text;
begin
  foreach r in array array['anon','authenticated','service_role'] loop
    begin
      execute format('create role %I nologin%s', r, case when r = 'service_role' then ' bypassrls' else '' end);
    exception when duplicate_object or unique_violation then null;
    end;
  end loop;
end $$;

create schema auth;
create function auth.email() returns text language sql stable
  as $$ select nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'email' $$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.email() to anon, authenticated, service_role;

create schema storage;
grant usage on schema storage to anon, authenticated, service_role;
create table storage.buckets (
  id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id), name text, metadata jsonb
);
alter table storage.objects enable row level security;
grant all on storage.objects to anon, authenticated, service_role;

-- Como Supabase: todo lo que se crea en public queda abierto por defecto a los
-- roles de la API. La migración de permisos lo recorta como en producción.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
