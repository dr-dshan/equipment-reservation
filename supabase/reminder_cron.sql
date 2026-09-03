-- 5-minute reservation reminder scheduler
-- Run this AFTER the Vercel app is deployed.
-- Supabase Cron invokes the protected Vercel endpoint every minute.
-- The endpoint only sends mail for APPROVED reservations approximately 5 minutes before start.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Store these securely in Supabase Vault.
-- Replace the example values before running these two lines.
select vault.create_secret(
  'https://YOUR-VERCEL-SITE.vercel.app',
  'equipment_reservation_site_url'
);

select vault.create_secret(
  'YOUR_REMINDER_CRON_SECRET',
  'equipment_reservation_cron_secret'
);

-- Re-running this file should not leave duplicate jobs.
select cron.unschedule(jobid)
from cron.job
where jobname = 'equipment-reservation-reminder';

select cron.schedule(
  'equipment-reservation-reminder',
  '* * * * *',
  $$
    select net.http_post(
      url := (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'equipment_reservation_site_url'
      ) || '/api/reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'equipment_reservation_cron_secret'
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 5000
    ) as request_id;
  $$
);

-- Verify the scheduled job.
select jobid, jobname, schedule, active
from cron.job
where jobname = 'equipment-reservation-reminder';
