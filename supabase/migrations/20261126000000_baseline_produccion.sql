

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "admin_backup";


ALTER SCHEMA "admin_backup" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."crear_notificaciones"("p_tipo" "text", "p_titulo" "text", "p_cuerpo" "text" DEFAULT NULL::"text", "p_url" "text" DEFAULT NULL::"text", "p_dedupe_key" "text" DEFAULT NULL::"text", "p_excluir_email" "text" DEFAULT NULL::"text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."crear_notificaciones"("p_tipo" "text", "p_titulo" "text", "p_cuerpo" "text", "p_url" "text", "p_dedupe_key" "text", "p_excluir_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_caso"("p_caso_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare
  v_caso            public.casos%rowtype;
  v_victima_shared  boolean := false;
  v_hecho_shared    boolean := false;
  v_victima_other_hechos boolean := false;
  v_imps            uuid[]  := '{}';
  v_snapshot        jsonb;
  v_has_instancias  boolean := to_regclass('public.instancias_judiciales') is not null;
  v_instancias      jsonb   := '[]'::jsonb;
begin
  -- Autorización explícita (security definer ignora RLS).
  if not public.is_allowed_user() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  select * into v_caso from public.casos where id = p_caso_id for update;
  if not found then
    raise exception 'Caso no encontrado' using errcode = 'P0002';
  end if;

  if v_caso.victima_id is not null then
    select exists (select 1 from public.casos where victima_id = v_caso.victima_id and id <> p_caso_id)
      into v_victima_shared;
  end if;
  if v_caso.hecho_id is not null then
    select exists (select 1 from public.casos where hecho_id = v_caso.hecho_id and id <> p_caso_id)
      into v_hecho_shared;
    select coalesce(array_agg(id), '{}') into v_imps
      from public.imputados where hecho_id = v_caso.hecho_id;
  end if;

  if v_has_instancias and not v_hecho_shared and cardinality(v_imps) > 0 then
    execute 'select coalesce(jsonb_agg(to_jsonb(i)), ''[]''::jsonb)
             from public.instancias_judiciales i where imputado_id = any($1)'
      into v_instancias using v_imps;
  end if;

  -- Snapshot de TODO lo que se va a borrar, antes de borrar.
  v_snapshot := jsonb_build_object(
    'caso', to_jsonb(v_caso),
    'victima_compartida', v_victima_shared,
    'hecho_compartido', v_hecho_shared,
    'victima', case when v_victima_shared then null else
      (select to_jsonb(v) from public.victimas v where v.id = v_caso.victima_id) end,
    'recursos_victima', case when v_victima_shared then '[]'::jsonb else
      (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from public.recursos r
        where r.victima_id = v_caso.victima_id) end,
    'hecho', case when v_hecho_shared then null else
      (select to_jsonb(h) from public.hechos h where h.id = v_caso.hecho_id) end,
    'imputados', case when v_hecho_shared then '[]'::jsonb else
      (select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb) from public.imputados i
        where i.hecho_id = v_caso.hecho_id) end,
    'fechas_juicio', case when v_hecho_shared then '[]'::jsonb else
      (select coalesce(jsonb_agg(to_jsonb(f)), '[]'::jsonb) from public.fechas_juicio f
        where f.imputado_id = any(v_imps)) end,
    'instancias_judiciales', v_instancias,
    'seguimiento', case when v_hecho_shared then '[]'::jsonb else
      (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from public.seguimiento s
        where s.hecho_id = v_caso.hecho_id) end,
    'recursos_hecho', case when v_hecho_shared then '[]'::jsonb else
      (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from public.recursos r
        where r.hecho_id = v_caso.hecho_id or r.imputado_id = any(v_imps)) end
  );

  insert into admin_backup.casos_eliminados (caso_id, eliminado_por, snapshot)
  values (p_caso_id, auth.email(), v_snapshot);

  -- Recursos de la víctima (si no está en otro caso).
  if v_caso.victima_id is not null and not v_victima_shared then
    delete from public.recursos where victima_id = v_caso.victima_id;
  end if;

  delete from public.casos where id = p_caso_id;

  if v_caso.hecho_id is not null then
    if not v_hecho_shared then
      delete from public.recursos
        where hecho_id = v_caso.hecho_id or imputado_id = any(v_imps);
      if v_has_instancias and cardinality(v_imps) > 0 then
        execute 'delete from public.instancias_judiciales where imputado_id = any($1)' using v_imps;
      end if;
      delete from public.fechas_juicio where imputado_id = any(v_imps);
      delete from public.imputados where hecho_id = v_caso.hecho_id;
      delete from public.seguimiento where hecho_id = v_caso.hecho_id;
      delete from public.hechos where id = v_caso.hecho_id;
    elsif v_caso.victima_id is not null then
      -- Hecho compartido: si apuntaba a esta víctima, pasarlo a otra víctima
      -- del mismo hecho ANTES de borrar la víctima (evita el cascade).
      update public.hechos h
        set victima_id = (
          select c.victima_id from public.casos c
          where c.hecho_id = v_caso.hecho_id and c.victima_id is not null
          order by c.created_at limit 1)
        where h.id = v_caso.hecho_id and h.victima_id = v_caso.victima_id;
    end if;
  end if;

  if v_caso.victima_id is not null and not v_victima_shared then
    -- Si algún otro hecho todavía apunta a esta víctima, NO se borra: el
    -- cascade se llevaría ese hecho. Se conserva la víctima.
    select exists (select 1 from public.hechos where victima_id = v_caso.victima_id)
      into v_victima_other_hechos;
    if not v_victima_other_hechos then
      delete from public.victimas where id = v_caso.victima_id;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'victima_eliminada', v_caso.victima_id is not null and not v_victima_shared and not v_victima_other_hechos,
    'hecho_eliminado', v_caso.hecho_id is not null and not v_hecho_shared
  );
end;
$_$;


ALTER FUNCTION "public"."delete_caso"("p_caso_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."encolar_push_notificacion"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
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
$_$;


ALTER FUNCTION "public"."encolar_push_notificacion"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_dashboard_stats"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    AS $$
  with kpis as (
    select
      (select count(*) from public.victimas) as total_cases,
      (select count(*) from public.victimas
         where created_at >= now() - interval '1 year') as cases_last_year,
      (select count(*) from public.imputados
         where coalesce(estado_procesal, '') <> 'Condenado') as cases_without_conviction,
      (select count(*) from public.imputados
         where estado_procesal = 'En investigación') as cases_in_investigation
  ),
  by_year as (
    select coalesce(
      jsonb_agg(jsonb_build_object('year', year::text, 'cases', cases) order by year),
      '[]'::jsonb
    ) as data
    from (
      select extract(year from fecha_hecho)::int as year, count(*)::int as cases
      from public.hechos
      where fecha_hecho is not null
      group by extract(year from fecha_hecho)
    ) y
  ),
  by_province as (
    select coalesce(
      jsonb_agg(jsonb_build_object('provincia', provincia, 'cases', cases) order by cases desc),
      '[]'::jsonb
    ) as data
    from (
      select provincia, count(*)::int as cases
      from public.hechos
      where provincia is not null
      group by provincia
    ) p
  ),
  by_status as (
    select coalesce(
      jsonb_agg(jsonb_build_object('status', status, 'cases', cases) order by cases desc),
      '[]'::jsonb
    ) as data
    from (
      select coalesce(estado_procesal, 'Otros') as status, count(*)::int as cases
      from public.imputados
      group by coalesce(estado_procesal, 'Otros')
    ) s
  )
  select jsonb_build_object(
    'kpis', jsonb_build_object(
      'totalCases',              k.total_cases,
      'casesLastYear',           k.cases_last_year,
      'casesWithoutConviction',  k.cases_without_conviction,
      'casesInInvestigation',    k.cases_in_investigation
    ),
    'casesByYear',     y.data,
    'casesByProvince', p.data,
    'casesByStatus',   s.data
  )
  from kpis k, by_year y, by_province p, by_status s;
$$;


ALTER FUNCTION "public"."get_dashboard_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_allowed_user"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1
    from public.allowed_users au
    where lower(au.email) = lower(coalesce(auth.email(), ''))
  );
$$;


ALTER FUNCTION "public"."is_allowed_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notificacion_de_prueba"() RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."notificacion_de_prueba"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notificar_evento_caso"("p_caso_id" "uuid", "p_tipo" "text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."notificar_evento_caso"("p_caso_id" "uuid", "p_tipo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."registrar_push"("p_endpoint" "text", "p_p256dh" "text", "p_auth" "text", "p_user_agent" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."registrar_push"("p_endpoint" "text", "p_p256dh" "text", "p_auth" "text", "p_user_agent" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "admin_backup"."casos_eliminados" (
    "id" bigint NOT NULL,
    "caso_id" "uuid" NOT NULL,
    "eliminado_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "eliminado_por" "text",
    "snapshot" "jsonb" NOT NULL
);


ALTER TABLE "admin_backup"."casos_eliminados" OWNER TO "postgres";


ALTER TABLE "admin_backup"."casos_eliminados" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "admin_backup"."casos_eliminados_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "admin_backup"."policies_013" (
    "backed_up_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "schemaname" "name",
    "tablename" "name",
    "policyname" "name",
    "permissive" "text",
    "roles" "name"[],
    "cmd" "text",
    "qual" "text",
    "with_check" "text"
);


ALTER TABLE "admin_backup"."policies_013" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."allowed_users" (
    "email" "text" NOT NULL
);


ALTER TABLE "public"."allowed_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."casos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "victima_id" "uuid",
    "hecho_id" "uuid",
    "numero_involucrados" integer DEFAULT 1,
    "estado_general" "text" DEFAULT 'En Proceso'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "estado" character varying(50) DEFAULT 'pendiente'::character varying
);


ALTER TABLE "public"."casos" OWNER TO "postgres";


COMMENT ON COLUMN "public"."casos"."estado" IS 'Estado actual del caso: En investigación, Elevado a Juicio, Sentencia, Cerrado/Archivado';



CREATE TABLE IF NOT EXISTS "public"."fechas_juicio" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "imputado_id" "uuid",
    "fecha_audiencia" "date" NOT NULL,
    "descripcion" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."fechas_juicio" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hechos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "victima_id" "uuid",
    "fecha_hecho" "date",
    "fecha_fallecimiento" "date",
    "provincia" "text",
    "municipio" "text",
    "lugar_especifico" "text",
    "resumen_hecho" "text",
    "numero_causa" "text",
    "caratula" "text",
    "email_fiscalia" "text",
    "telefono_fiscalia" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tipo_crimen" "text",
    "tipo_arma" "text",
    "tipo_lugar" "text",
    "lugar_otro" "text",
    "localidad_barrio" "text",
    "estado_caso" "text"
);


ALTER TABLE "public"."hechos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."imputados" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "hecho_id" "uuid",
    "apellido_nombre" "text",
    "menor_edad" boolean DEFAULT false,
    "nacionalidad" "text",
    "juzgado_ufi" "text",
    "estado_procesal" "text",
    "fecha_veredicto" "date",
    "pena" "text",
    "juicio_abreviado" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "prision_perpetua" boolean DEFAULT false,
    "tribunal_fallo" "text",
    "documento_identidad" "text",
    "es_extranjero" boolean DEFAULT false,
    "detenido_previo" boolean DEFAULT false,
    "fallecido" boolean DEFAULT false,
    "es_reincidente" boolean DEFAULT false,
    "alias" "text",
    "edad" "text",
    "cargos" "text"
);


ALTER TABLE "public"."imputados" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."instancias_judiciales" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "numero_causa" "text",
    "fiscal" "text",
    "fiscalia" "text",
    "caratula" "text",
    "orden_nivel" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "imputado_id" "uuid"
);


ALTER TABLE "public"."instancias_judiciales" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notificacion_preferencias" (
    "user_email" "text" NOT NULL,
    "aniversarios" boolean DEFAULT true NOT NULL,
    "audiencias" boolean DEFAULT true NOT NULL,
    "casos" boolean DEFAULT false NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "notificacion_preferencias_user_email_check" CHECK (("user_email" = "lower"("user_email")))
);


ALTER TABLE "public"."notificacion_preferencias" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notificaciones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_email" "text" NOT NULL,
    "tipo" "text" NOT NULL,
    "titulo" "text" NOT NULL,
    "cuerpo" "text",
    "url" "text",
    "dedupe_key" "text",
    "leida_at" timestamp with time zone,
    "push_enviada_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "notificaciones_cuerpo_check" CHECK ((("cuerpo" IS NULL) OR ("char_length"("cuerpo") <= 1000))),
    CONSTRAINT "notificaciones_tipo_check" CHECK (("tipo" = ANY (ARRAY['aniversario'::"text", 'audiencia'::"text", 'caso_nuevo'::"text", 'caso_editado'::"text", 'prueba'::"text"]))),
    CONSTRAINT "notificaciones_titulo_check" CHECK ((("char_length"("titulo") >= 1) AND ("char_length"("titulo") <= 200))),
    CONSTRAINT "notificaciones_url_check" CHECK ((("url" IS NULL) OR (("url" ~~ '/%'::"text") AND ("url" !~~ '//%'::"text")))),
    CONSTRAINT "notificaciones_user_email_check" CHECK (("user_email" = "lower"("user_email")))
);


ALTER TABLE "public"."notificaciones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_suscripciones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_email" "text" NOT NULL,
    "endpoint" "text" NOT NULL,
    "p256dh" "text" NOT NULL,
    "auth" "text" NOT NULL,
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_success_at" timestamp with time zone,
    CONSTRAINT "push_suscripciones_endpoint_check" CHECK (("endpoint" ~~ 'https://%'::"text")),
    CONSTRAINT "push_suscripciones_user_email_check" CHECK (("user_email" = "lower"("user_email")))
);


ALTER TABLE "public"."push_suscripciones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recursos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "hecho_id" "uuid",
    "imputado_id" "uuid",
    "tipo" "text" NOT NULL,
    "titulo" "text" NOT NULL,
    "url" "text",
    "fuente" "text",
    "descripcion" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "archivo_path" "text",
    "archivo_nombre" "text",
    "archivo_tipo" "text",
    "archivo_size" bigint,
    "victima_id" "uuid"
);


ALTER TABLE "public"."recursos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."seguimiento" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "hecho_id" "uuid",
    "miembro_asignado" "text",
    "contacto_familia" "text",
    "notas_seguimiento" "text",
    "tipo_acompanamiento" "text"[],
    "abogado_querellante" "text",
    "amicus_curiae" boolean DEFAULT false,
    "como_llego_caso" "text",
    "primer_contacto" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "telefono_contacto" "text",
    "email_contacto" "text",
    "direccion_contacto" "text",
    "telefono_miembro" "text",
    "email_miembro" "text",
    "fecha_asignacion" "date",
    "proximas_acciones" "text",
    "parentesco_contacto" "text",
    "parentesco_otro" "text",
    "abogado_amicus_firmante" "text",
    "tiene_abogado_querellante" "text",
    "datos_abogados_querellantes" "jsonb",
    "lista_miembros_asignados" "jsonb",
    "lista_contactos_familiares" "jsonb",
    "abogado_usina_amicus" "text",
    "otra_intervencion" boolean DEFAULT false,
    "otra_intervencion_descripcion" "text"
);


ALTER TABLE "public"."seguimiento" OWNER TO "postgres";


COMMENT ON COLUMN "public"."seguimiento"."otra_intervencion" IS 'Indica si hubo otra intervención adicional por parte de UJ';



COMMENT ON COLUMN "public"."seguimiento"."otra_intervencion_descripcion" IS 'Descripción detallada de la otra intervención realizada';



CREATE TABLE IF NOT EXISTS "public"."victimas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre_completo" "text",
    "edad" integer,
    "fecha_nacimiento" "date",
    "profesion" "text",
    "redes_sociales" "text",
    "nacionalidad" "text",
    "notas_adicionales" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "provincia_residencia" "text",
    "municipio_residencia" "text",
    "fecha_fallecimiento" "date",
    "fecha_hecho" "date",
    "foto_path" "text",
    CONSTRAINT "victimas_foto_path_check" CHECK ((("foto_path" IS NULL) OR (("foto_path" ~~ 'fotos-perfil/%'::"text") AND ("foto_path" !~~ '%..%'::"text"))))
);


ALTER TABLE "public"."victimas" OWNER TO "postgres";


COMMENT ON COLUMN "public"."victimas"."foto_path" IS 'Ruta en el bucket privado archivos-casos de la foto de perfil recortada (fotos-perfil/...). Null = sin foto.';



ALTER TABLE ONLY "admin_backup"."casos_eliminados"
    ADD CONSTRAINT "casos_eliminados_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."allowed_users"
    ADD CONSTRAINT "allowed_users_pkey" PRIMARY KEY ("email");



ALTER TABLE ONLY "public"."casos"
    ADD CONSTRAINT "casos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fechas_juicio"
    ADD CONSTRAINT "fechas_juicio_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hechos"
    ADD CONSTRAINT "hechos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."imputados"
    ADD CONSTRAINT "imputados_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."instancias_judiciales"
    ADD CONSTRAINT "instancias_judiciales_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notificacion_preferencias"
    ADD CONSTRAINT "notificacion_preferencias_pkey" PRIMARY KEY ("user_email");



ALTER TABLE ONLY "public"."notificaciones"
    ADD CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_suscripciones"
    ADD CONSTRAINT "push_suscripciones_endpoint_key" UNIQUE ("endpoint");



ALTER TABLE ONLY "public"."push_suscripciones"
    ADD CONSTRAINT "push_suscripciones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recursos"
    ADD CONSTRAINT "recursos_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."recursos"
    ADD CONSTRAINT "recursos_url_http_check" CHECK ((("url" IS NULL) OR ("url" = ''::"text") OR ("url" ~* '^https?://'::"text") OR ("url" ~~ '/api/files/%'::"text"))) NOT VALID;



ALTER TABLE ONLY "public"."seguimiento"
    ADD CONSTRAINT "seguimiento_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."victimas"
    ADD CONSTRAINT "victimas_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "idx_allowed_users_email" ON "public"."allowed_users" USING "btree" ("email");



CREATE INDEX "idx_casos_created_at_desc" ON "public"."casos" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_casos_hecho_id" ON "public"."casos" USING "btree" ("hecho_id");



CREATE INDEX "idx_casos_victima_id" ON "public"."casos" USING "btree" ("victima_id");



CREATE INDEX "idx_fechas_juicio_imputado_id" ON "public"."fechas_juicio" USING "btree" ("imputado_id");



CREATE INDEX "idx_hechos_victima_id" ON "public"."hechos" USING "btree" ("victima_id");



CREATE INDEX "idx_imputados_hecho_id" ON "public"."imputados" USING "btree" ("hecho_id");



CREATE INDEX "idx_instancias_judiciales_imputado_id" ON "public"."instancias_judiciales" USING "btree" ("imputado_id");



CREATE UNIQUE INDEX "idx_notificaciones_dedupe" ON "public"."notificaciones" USING "btree" ("lower"("user_email"), "dedupe_key") WHERE ("dedupe_key" IS NOT NULL);



CREATE INDEX "idx_notificaciones_user_created" ON "public"."notificaciones" USING "btree" ("lower"("user_email"), "created_at" DESC);



CREATE INDEX "idx_notificaciones_user_unread" ON "public"."notificaciones" USING "btree" ("lower"("user_email")) WHERE ("leida_at" IS NULL);



CREATE INDEX "idx_push_suscripciones_user" ON "public"."push_suscripciones" USING "btree" ("lower"("user_email"));



CREATE INDEX "idx_recursos_hecho_id" ON "public"."recursos" USING "btree" ("hecho_id");



CREATE INDEX "idx_recursos_imputado_id" ON "public"."recursos" USING "btree" ("imputado_id");



CREATE INDEX "idx_recursos_victima_id" ON "public"."recursos" USING "btree" ("victima_id") WHERE ("victima_id" IS NOT NULL);



CREATE INDEX "idx_seguimiento_hecho_id" ON "public"."seguimiento" USING "btree" ("hecho_id");



CREATE OR REPLACE TRIGGER "trg_notificaciones_push" AFTER INSERT ON "public"."notificaciones" FOR EACH ROW EXECUTE FUNCTION "public"."encolar_push_notificacion"();



ALTER TABLE ONLY "public"."casos"
    ADD CONSTRAINT "casos_hecho_id_fkey" FOREIGN KEY ("hecho_id") REFERENCES "public"."hechos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."casos"
    ADD CONSTRAINT "casos_victima_id_fkey" FOREIGN KEY ("victima_id") REFERENCES "public"."victimas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fechas_juicio"
    ADD CONSTRAINT "fechas_juicio_imputado_id_fkey" FOREIGN KEY ("imputado_id") REFERENCES "public"."imputados"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hechos"
    ADD CONSTRAINT "hechos_victima_id_fkey" FOREIGN KEY ("victima_id") REFERENCES "public"."victimas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."imputados"
    ADD CONSTRAINT "imputados_hecho_id_fkey" FOREIGN KEY ("hecho_id") REFERENCES "public"."hechos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."instancias_judiciales"
    ADD CONSTRAINT "instancias_judiciales_imputado_id_fkey" FOREIGN KEY ("imputado_id") REFERENCES "public"."imputados"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recursos"
    ADD CONSTRAINT "recursos_hecho_id_fkey" FOREIGN KEY ("hecho_id") REFERENCES "public"."hechos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recursos"
    ADD CONSTRAINT "recursos_imputado_id_fkey" FOREIGN KEY ("imputado_id") REFERENCES "public"."imputados"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."recursos"
    ADD CONSTRAINT "recursos_victima_id_fkey" FOREIGN KEY ("victima_id") REFERENCES "public"."victimas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."seguimiento"
    ADD CONSTRAINT "seguimiento_hecho_id_fkey" FOREIGN KEY ("hecho_id") REFERENCES "public"."hechos"("id") ON DELETE CASCADE;



ALTER TABLE "public"."allowed_users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "allowed_users_select_self" ON "public"."allowed_users" FOR SELECT TO "authenticated" USING (("lower"("email") = "lower"(COALESCE(( SELECT "auth"."email"() AS "email"), ''::"text"))));



ALTER TABLE "public"."casos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "casos_whitelist_all" ON "public"."casos" TO "authenticated" USING (( SELECT "public"."is_allowed_user"() AS "is_allowed_user")) WITH CHECK (( SELECT "public"."is_allowed_user"() AS "is_allowed_user"));



ALTER TABLE "public"."fechas_juicio" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "fechas_juicio_whitelist_all" ON "public"."fechas_juicio" TO "authenticated" USING (( SELECT "public"."is_allowed_user"() AS "is_allowed_user")) WITH CHECK (( SELECT "public"."is_allowed_user"() AS "is_allowed_user"));



ALTER TABLE "public"."hechos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "hechos_whitelist_all" ON "public"."hechos" TO "authenticated" USING (( SELECT "public"."is_allowed_user"() AS "is_allowed_user")) WITH CHECK (( SELECT "public"."is_allowed_user"() AS "is_allowed_user"));



ALTER TABLE "public"."imputados" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "imputados_whitelist_all" ON "public"."imputados" TO "authenticated" USING (( SELECT "public"."is_allowed_user"() AS "is_allowed_user")) WITH CHECK (( SELECT "public"."is_allowed_user"() AS "is_allowed_user"));



ALTER TABLE "public"."instancias_judiciales" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "instancias_judiciales_whitelist_all" ON "public"."instancias_judiciales" TO "authenticated" USING (( SELECT "public"."is_allowed_user"() AS "is_allowed_user")) WITH CHECK (( SELECT "public"."is_allowed_user"() AS "is_allowed_user"));



ALTER TABLE "public"."notificacion_preferencias" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notificacion_preferencias_own" ON "public"."notificacion_preferencias" TO "authenticated" USING ((("lower"("user_email") = "lower"(COALESCE(( SELECT "auth"."email"() AS "email"), ''::"text"))) AND ( SELECT "public"."is_allowed_user"() AS "is_allowed_user"))) WITH CHECK ((("lower"("user_email") = "lower"(COALESCE(( SELECT "auth"."email"() AS "email"), ''::"text"))) AND ( SELECT "public"."is_allowed_user"() AS "is_allowed_user")));



ALTER TABLE "public"."notificaciones" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notificaciones_delete_own" ON "public"."notificaciones" FOR DELETE TO "authenticated" USING ((("lower"("user_email") = "lower"(COALESCE(( SELECT "auth"."email"() AS "email"), ''::"text"))) AND ( SELECT "public"."is_allowed_user"() AS "is_allowed_user")));



CREATE POLICY "notificaciones_select_own" ON "public"."notificaciones" FOR SELECT TO "authenticated" USING ((("lower"("user_email") = "lower"(COALESCE(( SELECT "auth"."email"() AS "email"), ''::"text"))) AND ( SELECT "public"."is_allowed_user"() AS "is_allowed_user")));



CREATE POLICY "notificaciones_update_own" ON "public"."notificaciones" FOR UPDATE TO "authenticated" USING ((("lower"("user_email") = "lower"(COALESCE(( SELECT "auth"."email"() AS "email"), ''::"text"))) AND ( SELECT "public"."is_allowed_user"() AS "is_allowed_user"))) WITH CHECK (("lower"("user_email") = "lower"(COALESCE(( SELECT "auth"."email"() AS "email"), ''::"text"))));



ALTER TABLE "public"."push_suscripciones" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "push_suscripciones_delete_own" ON "public"."push_suscripciones" FOR DELETE TO "authenticated" USING ((("lower"("user_email") = "lower"(COALESCE(( SELECT "auth"."email"() AS "email"), ''::"text"))) AND ( SELECT "public"."is_allowed_user"() AS "is_allowed_user")));



CREATE POLICY "push_suscripciones_select_own" ON "public"."push_suscripciones" FOR SELECT TO "authenticated" USING ((("lower"("user_email") = "lower"(COALESCE(( SELECT "auth"."email"() AS "email"), ''::"text"))) AND ( SELECT "public"."is_allowed_user"() AS "is_allowed_user")));



ALTER TABLE "public"."recursos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "recursos_whitelist_all" ON "public"."recursos" TO "authenticated" USING (( SELECT "public"."is_allowed_user"() AS "is_allowed_user")) WITH CHECK (( SELECT "public"."is_allowed_user"() AS "is_allowed_user"));



ALTER TABLE "public"."seguimiento" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "seguimiento_whitelist_all" ON "public"."seguimiento" TO "authenticated" USING (( SELECT "public"."is_allowed_user"() AS "is_allowed_user")) WITH CHECK (( SELECT "public"."is_allowed_user"() AS "is_allowed_user"));



ALTER TABLE "public"."victimas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "victimas_whitelist_all" ON "public"."victimas" TO "authenticated" USING (( SELECT "public"."is_allowed_user"() AS "is_allowed_user")) WITH CHECK (( SELECT "public"."is_allowed_user"() AS "is_allowed_user"));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."crear_notificaciones"("p_tipo" "text", "p_titulo" "text", "p_cuerpo" "text", "p_url" "text", "p_dedupe_key" "text", "p_excluir_email" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."crear_notificaciones"("p_tipo" "text", "p_titulo" "text", "p_cuerpo" "text", "p_url" "text", "p_dedupe_key" "text", "p_excluir_email" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_caso"("p_caso_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_caso"("p_caso_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_caso"("p_caso_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."encolar_push_notificacion"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."encolar_push_notificacion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."encolar_push_notificacion"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_dashboard_stats"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_dashboard_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_dashboard_stats"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_allowed_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_allowed_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_allowed_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."notificacion_de_prueba"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notificacion_de_prueba"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notificacion_de_prueba"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."notificar_evento_caso"("p_caso_id" "uuid", "p_tipo" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notificar_evento_caso"("p_caso_id" "uuid", "p_tipo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."notificar_evento_caso"("p_caso_id" "uuid", "p_tipo" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."registrar_push"("p_endpoint" "text", "p_p256dh" "text", "p_auth" "text", "p_user_agent" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."registrar_push"("p_endpoint" "text", "p_p256dh" "text", "p_auth" "text", "p_user_agent" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."registrar_push"("p_endpoint" "text", "p_p256dh" "text", "p_auth" "text", "p_user_agent" "text") TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."allowed_users" TO "authenticated";
GRANT ALL ON TABLE "public"."allowed_users" TO "service_role";



GRANT ALL ON TABLE "public"."casos" TO "authenticated";
GRANT ALL ON TABLE "public"."casos" TO "service_role";



GRANT ALL ON TABLE "public"."fechas_juicio" TO "authenticated";
GRANT ALL ON TABLE "public"."fechas_juicio" TO "service_role";



GRANT ALL ON TABLE "public"."hechos" TO "authenticated";
GRANT ALL ON TABLE "public"."hechos" TO "service_role";



GRANT ALL ON TABLE "public"."imputados" TO "authenticated";
GRANT ALL ON TABLE "public"."imputados" TO "service_role";



GRANT ALL ON TABLE "public"."instancias_judiciales" TO "authenticated";
GRANT ALL ON TABLE "public"."instancias_judiciales" TO "service_role";



GRANT ALL ON TABLE "public"."notificacion_preferencias" TO "service_role";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."notificacion_preferencias" TO "authenticated";



GRANT ALL ON TABLE "public"."notificaciones" TO "service_role";
GRANT SELECT,DELETE ON TABLE "public"."notificaciones" TO "authenticated";



GRANT UPDATE("leida_at") ON TABLE "public"."notificaciones" TO "authenticated";



GRANT ALL ON TABLE "public"."push_suscripciones" TO "service_role";
GRANT SELECT,DELETE ON TABLE "public"."push_suscripciones" TO "authenticated";



GRANT ALL ON TABLE "public"."recursos" TO "authenticated";
GRANT ALL ON TABLE "public"."recursos" TO "service_role";



GRANT ALL ON TABLE "public"."seguimiento" TO "authenticated";
GRANT ALL ON TABLE "public"."seguimiento" TO "service_role";



GRANT ALL ON TABLE "public"."victimas" TO "authenticated";
GRANT ALL ON TABLE "public"."victimas" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






