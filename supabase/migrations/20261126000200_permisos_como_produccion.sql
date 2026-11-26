-- Iguala los permisos de una base nueva a los de producción.
--
-- Supabase da por defecto ALL a anon/authenticated sobre todo lo que se crea
-- en public; producción ya los tiene recortados (scripts 013 y 016). El dump
-- del esquema base no lo reproduce, así que sin esto una base nueva (local, CI)
-- quedaría más abierta que producción: p. ej. crear_notificaciones ejecutable
-- por authenticated.
--
-- En producción es un no-op (deja exactamente los permisos que ya tiene,
-- según `supabase db diff --linked` del 26/11/2026).

alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke all on functions from anon;
alter default privileges for role postgres in schema public revoke all on tables from anon;

revoke all on function public.crear_notificaciones(text, text, text, text, text, text) from anon, authenticated;
revoke all on function public.delete_caso(uuid) from anon;
revoke all on function public.encolar_push_notificacion() from anon;
revoke all on function public.get_dashboard_stats() from anon;
revoke all on function public.is_allowed_user() from anon;
revoke all on function public.notificacion_de_prueba() from anon;
revoke all on function public.notificar_evento_caso(uuid, text) from anon;
revoke all on function public.registrar_push(text, text, text, text) from anon;

revoke all on table
  public.allowed_users, public.casos, public.fechas_juicio, public.hechos,
  public.imputados, public.instancias_judiciales, public.notificacion_preferencias,
  public.notificaciones, public.push_suscripciones, public.recursos,
  public.seguimiento, public.victimas
from anon;

revoke all on table public.allowed_users from authenticated;
grant select, references, trigger, maintain on table public.allowed_users to authenticated;

revoke all on table public.notificacion_preferencias from authenticated;
grant insert, select, update on table public.notificacion_preferencias to authenticated;

revoke all on table public.notificaciones from authenticated;
grant select, delete on table public.notificaciones to authenticated;
grant update (leida_at) on table public.notificaciones to authenticated;

revoke all on table public.push_suscripciones from authenticated;
grant select, delete on table public.push_suscripciones to authenticated;
