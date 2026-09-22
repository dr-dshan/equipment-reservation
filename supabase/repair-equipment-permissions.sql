-- Run once in Supabase SQL Editor.
-- This safely removes any OLD equipment CHECK constraint regardless of its generated name,
-- then recreates the six-equipment constraints. Existing rows are not deleted.

DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid='public.reservations'::regclass
      AND contype='c'
      AND pg_get_constraintdef(oid) ILIKE '%equipment%'
  LOOP
    EXECUTE format('ALTER TABLE public.reservations DROP CONSTRAINT %I', c.conname);
  END LOOP;

  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid='public.equipment_permissions'::regclass
      AND contype='c'
      AND pg_get_constraintdef(oid) ILIKE '%equipment%'
  LOOP
    EXECUTE format('ALTER TABLE public.equipment_permissions DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.reservations
ADD CONSTRAINT reservations_equipment_check
CHECK (equipment IN (
  'Picomaster',
  'Ellionix',
  'Magnetic Annealing',
  'AJA Oxide Sputter',
  'Magnetotransport system (L6315)',
  'Magnetotransport system (T4105)'
));

ALTER TABLE public.equipment_permissions
ADD CONSTRAINT equipment_permissions_equipment_check
CHECK (equipment IN (
  'Picomaster',
  'Ellionix',
  'Magnetic Annealing',
  'AJA Oxide Sputter',
  'Magnetotransport system (L6315)',
  'Magnetotransport system (T4105)'
));

-- Verification: this should return two rows whose definitions contain all six equipment names.
SELECT conrelid::regclass AS table_name, conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conname IN ('reservations_equipment_check','equipment_permissions_equipment_check')
ORDER BY table_name::text;
