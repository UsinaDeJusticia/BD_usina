// Notificaciones (tablas, RPCs y trigger hacia send-push) sobre el esquema
// real de supabase/migrations, contra Postgres.
// Requiere TEST_DATABASE_URL; sin ella se saltea.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import type { Client } from "pg"
import { createMigratedDb } from "./helpers/migrated-db"

const ADMIN_URL = process.env.TEST_DATABASE_URL
const DB_NAME = `usina_notif_${process.pid}`
const run = ADMIN_URL ? describe : describe.skip

let db: Client
let drop: () => Promise<void>

const CASO = "ca000000-0000-0000-0000-00000000000a"
const ANA = "ana@usina.org"
const BETO = "Beto@Usina.org" // mayúsculas a propósito
const CARLA = "carla@usina.org"

// Stubs de pg_net y Vault (en Supabase existen; acá se simulan).
const STUBS = `
create schema if not exists net;
create table net.calls (id bigserial primary key, url text, body jsonb, headers jsonb);
create or replace function net.http_post(url text, body jsonb default '{}', params jsonb default '{}',
  headers jsonb default '{}', timeout_milliseconds integer default 5000) returns bigint
language plpgsql as $$
declare v bigint;
begin
  if url like '%explotar%' then raise exception 'pg_net caído'; end if;
  insert into net.calls(url, body, headers) values (url, body, headers) returning id into v;
  return v;
end $$;
create schema if not exists vault;
create table vault.secrets_stub (name text primary key, secret text);
create view vault.decrypted_secrets as select name, secret as decrypted_secret from vault.secrets_stub;
insert into vault.secrets_stub values ('cron_secret', 's3cr3t');
`

async function as(role: "anon" | "authenticated" | "service_role", email: string | null, sql: string, params: unknown[] = []) {
  await db.query("begin")
  try {
    await db.query(`select set_config('request.jwt.claims', $1, true)`, [email ? JSON.stringify({ email }) : ""])
    await db.query(`set local role ${role}`)
    const r = await db.query(sql, params)
    await db.query("commit")
    return { rows: r.rows, error: null as string | null }
  } catch (e: any) {
    await db.query("rollback")
    return { rows: [] as any[], error: e.message as string }
  }
}

const count = async (sql: string) => Number((await db.query(sql)).rows[0].n)

run("notificaciones", () => {
  beforeAll(async () => {
    ;({ db, drop } = await createMigratedDb(ADMIN_URL!, DB_NAME))
    await db.query(STUBS)
    await db.query(`insert into allowed_users(email) values ('${ANA}'), ('${BETO}'), ('${CARLA}')`)
    await db.query(`insert into victimas(id, nombre_completo) values ('a0000000-0000-0000-0000-00000000000a', 'Víctima Uno')`)
    await db.query(`insert into casos(id, victima_id) values ('${CASO}', 'a0000000-0000-0000-0000-00000000000a')`)
  })

  afterAll(async () => {
    await drop?.()
  })

  beforeEach(async () => {
    await db.query("truncate public.notificaciones, public.notificacion_preferencias, public.push_suscripciones, net.calls")
  })

  it("no toca los datos existentes", async () => {
    expect(await count("select count(*)::int n from casos")).toBe(1)
    expect(await count("select count(*)::int n from victimas")).toBe(1)
    expect(await count("select count(*)::int n from allowed_users")).toBe(3)
  })

  it("anon no accede a nada", async () => {
    for (const sql of [
      "select 1 from notificaciones",
      "select 1 from notificacion_preferencias",
      "select 1 from push_suscripciones",
      "select notificacion_de_prueba()",
      `select notificar_evento_caso('${CASO}', 'caso_nuevo')`,
      "select registrar_push('https://x', 'a', 'b')",
      "select crear_notificaciones('prueba', 't')",
    ]) {
      expect((await as("anon", null, sql)).error, sql).toMatch(/permission denied/)
    }
  })

  it("los usuarios no pueden crear notificaciones directamente ni llamar a la función interna", async () => {
    expect((await as("authenticated", ANA, `insert into notificaciones(user_email, tipo, titulo) values ('carla@usina.org','prueba','falsa')`)).error).toMatch(/permission denied/)
    expect((await as("authenticated", ANA, "select crear_notificaciones('aniversario', 'x')")).error).toMatch(/permission denied/)
  })

  it("crear_notificaciones respeta preferencias y defaults, normaliza emails y deduplica", async () => {
    await db.query(`insert into notificacion_preferencias(user_email, aniversarios, casos) values ('carla@usina.org', false, true)`)
    const r = await as("service_role", null, "select crear_notificaciones('aniversario', 'Mañana: X', null, '/casos/1', 'k1') n")
    expect(r.rows[0].n).toBe(2) // Ana y Beto (default true); Carla lo desactivó
    const again = await as("service_role", null, "select crear_notificaciones('aniversario', 'Mañana: X', null, '/casos/1', 'k1') n")
    expect(again.rows[0].n).toBe(0) // mismo dedupe_key
    const emails = (await db.query("select user_email from notificaciones order by 1")).rows.map((x) => x.user_email)
    expect(emails).toEqual(["ana@usina.org", "beto@usina.org"])
  })

  it("rechaza URLs externas", async () => {
    const r = await as("service_role", null, "select crear_notificaciones('aniversario', 'X', null, 'https://evil.com')")
    expect(r.error).toMatch(/check constraint/)
    const r2 = await as("service_role", null, "select crear_notificaciones('aniversario', 'X', null, '//evil.com')")
    expect(r2.error).toMatch(/check constraint/)
  })

  it("cada usuario ve, marca y borra sólo las suyas; sólo puede cambiar leida_at", async () => {
    await as("service_role", null, "select crear_notificaciones('aniversario', 'Para todos')")
    const ana = await as("authenticated", ANA, "select id, user_email from notificaciones")
    expect(ana.rows).toHaveLength(1)
    expect(ana.rows[0].user_email).toBe(ANA)

    // Beto con mayúsculas en su login igual ve la suya.
    expect((await as("authenticated", "BETO@usina.org", "select 1 from notificaciones")).rows).toHaveLength(1)

    // Marcar leída la propia: ok. La de otro: 0 filas.
    expect((await as("authenticated", ANA, "update notificaciones set leida_at = now() returning id")).rows).toHaveLength(1)
    expect(await count("select count(*)::int n from notificaciones where leida_at is not null")).toBe(1)

    // No puede reescribir el texto.
    expect((await as("authenticated", ANA, "update notificaciones set titulo = 'hackeado'")).error).toMatch(/permission denied/)

    // Borrar: sólo la propia.
    await as("authenticated", ANA, "delete from notificaciones")
    expect(await count("select count(*)::int n from notificaciones")).toBe(2)
  })

  it("un usuario fuera de la whitelist no ve nada aunque tenga filas a su nombre", async () => {
    await db.query(`insert into notificaciones(user_email, tipo, titulo) values ('random@gmail.com', 'prueba', 'x')`)
    expect((await as("authenticated", "random@gmail.com", "select 1 from notificaciones")).rows).toHaveLength(0)
    expect((await as("authenticated", "random@gmail.com", "select notificacion_de_prueba()")).error).toMatch(/No autorizado/)
  })

  it("notificar_evento_caso: avisa a los demás con 'casos' activo, agrupa ediciones", async () => {
    await db.query(`insert into notificacion_preferencias(user_email, casos) values ('ana@usina.org', true), ('carla@usina.org', true)`)
    const r = await as("authenticated", ANA, `select notificar_evento_caso('${CASO}', 'caso_nuevo') n`)
    expect(r.rows[0].n).toBe(1) // sólo Carla: Ana es la autora, Beto no lo activó
    const n = (await db.query("select user_email, titulo, cuerpo, url from notificaciones")).rows[0]
    expect(n).toEqual({ user_email: CARLA, titulo: "Caso nuevo: Víctima Uno", cuerpo: `Por ${ANA}`, url: `/casos/${CASO}` })

    // Dos ediciones seguidas: una sola notificación.
    await as("authenticated", ANA, `select notificar_evento_caso('${CASO}', 'caso_editado')`)
    await as("authenticated", ANA, `select notificar_evento_caso('${CASO}', 'caso_editado')`)
    expect(await count("select count(*)::int n from notificaciones where tipo = 'caso_editado'")).toBe(1)

    expect((await as("authenticated", ANA, `select notificar_evento_caso('${CASO}', 'aniversario')`)).error).toMatch(/Tipo inválido/)
    expect((await as("authenticated", ANA, `select notificar_evento_caso(gen_random_uuid(), 'caso_nuevo') n`)).rows[0].n).toBe(0)
  })

  it("notificacion_de_prueba crea una para el propio usuario", async () => {
    await as("authenticated", "Ana@Usina.org", "select notificacion_de_prueba()")
    expect((await db.query("select user_email, tipo from notificaciones")).rows).toEqual([{ user_email: ANA, tipo: "prueba" }])
  })

  it("registrar_push: alta, reasignación de un navegador compartido y aislamiento", async () => {
    await as("authenticated", ANA, "select registrar_push('https://push.example/abc', 'p', 'a', 'UA')")
    expect((await as("authenticated", ANA, "select endpoint from push_suscripciones")).rows).toHaveLength(1)
    expect((await as("authenticated", CARLA, "select endpoint from push_suscripciones")).rows).toHaveLength(0)

    // Carla se loguea en la misma computadora: el endpoint pasa a ella.
    await as("authenticated", CARLA, "select registrar_push('https://push.example/abc', 'p2', 'a2', 'UA')")
    expect((await db.query("select user_email, p256dh from push_suscripciones")).rows).toEqual([{ user_email: CARLA, p256dh: "p2" }])

    // No se puede registrar un endpoint no-https ni insertar directo.
    expect((await as("authenticated", ANA, "select registrar_push('http://x', 'p', 'a')")).error).toMatch(/check constraint/)
    expect((await as("authenticated", ANA, `insert into push_suscripciones(user_email, endpoint, p256dh, auth) values ('ana@usina.org','https://y','p','a')`)).error).toMatch(/permission denied/)

    // Borrar la propia sí.
    await as("authenticated", CARLA, "delete from push_suscripciones")
    expect(await count("select count(*)::int n from push_suscripciones")).toBe(0)
  })

  it("el trigger encola el push con el secreto y la URL de la función", async () => {
    await as("authenticated", ANA, "select notificacion_de_prueba()")
    const id = (await db.query("select id from notificaciones")).rows[0].id
    const call = (await db.query("select url, body, headers from net.calls")).rows[0]
    expect(call.url).toBe("https://cvxlbhykhvefufikspsm.supabase.co/functions/v1/send-push")
    expect(call.body).toEqual({ notificacion_id: id })
    expect(call.headers["x-cron-secret"]).toBe("s3cr3t")
  })

  it("sin secreto en Vault o con pg_net caído, la notificación igual se guarda", async () => {
    await db.query("delete from vault.secrets_stub")
    await as("authenticated", ANA, "select notificacion_de_prueba()")
    expect(await count("select count(*)::int n from notificaciones")).toBe(1)
    expect(await count("select count(*)::int n from net.calls")).toBe(0)
    await db.query("insert into vault.secrets_stub values ('cron_secret', 's3cr3t')")

    // pg_net falla: se registra un warning pero el insert no se cae.
    await db.query(`create or replace function net.http_post(url text, body jsonb default '{}', params jsonb default '{}',
      headers jsonb default '{}', timeout_milliseconds integer default 5000) returns bigint
      language plpgsql as $$ begin raise exception 'pg_net caído'; end $$`)
    const r = await as("authenticated", ANA, "select notificacion_de_prueba()")
    expect(r.error).toBeNull()
    expect(await count("select count(*)::int n from notificaciones")).toBe(2)
  })
})
