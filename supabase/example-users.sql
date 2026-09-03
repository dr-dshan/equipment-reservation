-- Example user registration.
-- Replace the emails/names below with real users.

insert into public.users (email, name)
values
  ('hanwool@kist.re.kr', 'Hanwool Seong'),
  ('wonyoung@kist.re.kr', 'Won-Young Choi'),
  ('seungjin@kist.re.kr', 'Seung-Jin Kang')
on conflict (email) do update
set name = excluded.name,
    active = true;

-- Hanwool: Picomaster + Ellionix
insert into public.equipment_permissions (user_id, equipment, allowed)
select id, 'Picomaster', true from public.users where email = 'hanwool@kist.re.kr'
on conflict (user_id, equipment) do update set allowed = true;

insert into public.equipment_permissions (user_id, equipment, allowed)
select id, 'Ellionix', true from public.users where email = 'hanwool@kist.re.kr'
on conflict (user_id, equipment) do update set allowed = true;

-- Won-Young: Magnetic Annealing
insert into public.equipment_permissions (user_id, equipment, allowed)
select id, 'Magnetic Annealing', true from public.users where email = 'wonyoung@kist.re.kr'
on conflict (user_id, equipment) do update set allowed = true;

-- Seung-Jin: all equipment
insert into public.equipment_permissions (user_id, equipment, allowed)
select u.id, e.equipment, true
from public.users u
cross join (
  values ('Picomaster'), ('Ellionix'), ('Magnetic Annealing')
) as e(equipment)
where u.email = 'seungjin@kist.re.kr'
on conflict (user_id, equipment) do update set allowed = true;
