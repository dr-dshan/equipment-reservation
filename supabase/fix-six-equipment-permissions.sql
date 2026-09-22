-- Safe migration for the six-equipment build.
-- Run once in Supabase SQL Editor if the new permission checkboxes do not save.

alter table public.reservations
  drop constraint if exists reservations_equipment_check;
alter table public.reservations
  add constraint reservations_equipment_check
  check (equipment in (
    'Picomaster','Ellionix','Magnetic Annealing','AJA Oxide Sputter',
    'Magnetotransport system (L6315)','Magnetotransport system (T4105)'
  ));

alter table public.equipment_permissions
  drop constraint if exists equipment_permissions_equipment_check;
alter table public.equipment_permissions
  add constraint equipment_permissions_equipment_check
  check (equipment in (
    'Picomaster','Ellionix','Magnetic Annealing','AJA Oxide Sputter',
    'Magnetotransport system (L6315)','Magnetotransport system (T4105)'
  ));
