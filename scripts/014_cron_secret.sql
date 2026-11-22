-- =============================================================================
-- 014 — Proteger la edge function `check-anniversaries` con un secreto
-- =============================================================================
-- PROBLEMA
--   La función corre con `verify_jwt: true`, pero el JWT que usa el cron es la
--   anon key, que es pública. Cualquiera podía invocarla en loop: spam a los
--   destinatarios y consumo de la cuota de Resend.
--
-- SOLUCIÓN (compatible hacia atrás)
--   La función ahora exige el header `x-cron-secret` SÓLO si el secret
--   `CRON_SECRET` está configurado en la función. Mientras no lo esté, se
--   comporta exactamente como antes. Por eso el orden de los pasos importa:
--   primero el cron empieza a mandar el header (inofensivo) y recién después
--   se activa la verificación. Así no se pierde ningún email diario.
--
-- No toca datos de casos.
-- -----------------------------------------------------------------------------

-- Paso 1 — Generar un secreto aleatorio y guardarlo en Vault (una sola vez).
-- -----------------------------------------------------------------------------
-- Genera el valor en SQL (copialo del resultado para el paso 3):
--
--   select replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '') as nuevo_secreto;
--
-- Guardarlo en Vault:
--
--   select vault.create_secret('<SECRETO>', 'cron_secret',
--     'Secreto compartido pg_cron -> edge function check-anniversaries');

-- Paso 2 — Hacer que el job mande el header (ejecutable tal cual).
-- -----------------------------------------------------------------------------
-- Busca el job por nombre y reemplaza SÓLO el comando (mismo schedule).
-- Si el secreto no existe en Vault, el header va vacío y la función (todavía
-- sin CRON_SECRET) lo ignora.
do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname = 'alerta-aniversarios';
  if v_jobid is null then
    raise notice '014: no existe el job alerta-aniversarios; ver 009_schedule_check_anniversaries.sql';
    return;
  end if;

  perform cron.alter_job(
    job_id  := v_jobid,
    command := $cmd$
  select net.http_post(
    url     := 'https://cvxlbhykhvefufikspsm.supabase.co/functions/v1/check-anniversaries',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'cron_anon_key'
      ),
      'x-cron-secret', coalesce((
        select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'
      ), '')
    ),
    body := '{}'::jsonb
  );
$cmd$
  );
end $$;

-- Paso 3 — Activar la verificación en la función.
-- -----------------------------------------------------------------------------
-- Dashboard de Supabase → Edge Functions → Secrets → agregar:
--   CRON_SECRET = <SECRETO del paso 1>
-- (o por CLI: supabase secrets set CRON_SECRET=<SECRETO>)
--
-- Y desplegar la versión nueva de la función:
--   supabase functions deploy check-anniversaries
--
-- Opcional: ANNIVERSARY_RECIPIENTS = "a@ejemplo.org,b@ejemplo.org" para
-- cambiar los destinatarios sin tocar código.

-- Paso 4 — Verificar.
-- -----------------------------------------------------------------------------
-- Invocación manual del job (manda el email si hay aniversarios mañana):
--   select net.http_post(...mismo comando de arriba...);
--
-- Después de la próxima corrida:
--   select status, return_message, start_time
--   from cron.job_run_details
--   where jobid = (select jobid from cron.job where jobname = 'alerta-aniversarios')
--   order by start_time desc limit 5;
--
--   select status_code, content from net._http_response order by created desc limit 5;
--   -> status_code 200. Un 401 significa que CRON_SECRET (función) y
--      cron_secret (Vault) no coinciden.
