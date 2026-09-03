-- Run this only after the Vercel deployment is working.
-- Replace the URL and CRON_SECRET below.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'equipment-reservation-reminder-every-minute',
  '* * * * *',
  $$
  select
    net.http_post(
      url := 'https://YOUR-VERCEL-APP.vercel.app/api/reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', 'YOUR_CRON_SECRET'
      ),
      body := '{}'::jsonb
    );
  $$
);

-- To remove the job later:
-- select cron.unschedule('equipment-reservation-reminder-every-minute');
