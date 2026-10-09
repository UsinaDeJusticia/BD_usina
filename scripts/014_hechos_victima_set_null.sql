-- =============================================================================
-- 014: borrar una víctima no debe borrar el hecho de sus co-víctimas
-- =============================================================================
-- hechos.victima_id apunta a la PRIMERA víctima del hecho (case-form.tsx). Con
-- ON DELETE CASCADE, borrar esa víctima borraba el hecho, y con él los casos,
-- imputados y seguimiento de las demás víctimas. Con SET NULL el hecho queda y
-- sólo se pierde la referencia a la víctima borrada.
--
-- Ejecutar UNA vez en SQL Editor. Es independiente de 012 y 013.
-- -----------------------------------------------------------------------------

alter table public.hechos drop constraint if exists hechos_victima_id_fkey;

alter table public.hechos
  add constraint hechos_victima_id_fkey
  foreign key (victima_id) references public.victimas(id) on delete set null;
