# Equipment Reservation deployment

## 1. Preserve and migrate the database

Back up the Supabase database, then run `supabase/migration-auto-approval-maintenance.sql` once in the Supabase SQL editor. The migration only adds columns, a table, and indexes; it does not delete or replace existing data.

## 2. Environment variables

Configure every variable shown in `.env.example` in the deployment environment. `CRON_SECRET` must be a long random value. Keep the Supabase service-role key and Resend key server-only.

## 3. Deploy

Install dependencies with `npm install`, then deploy the project to Vercel. This package is configured for Vercel Hobby, so it deliberately contains no Vercel cron definitions.

Use `supabase/reminder-cron.sql` for the minute-level scheduler: replace the example app URL and secret, then run it in Supabase. The secret must exactly match the Vercel `CRON_SECRET` environment variable.

## 4. Smoke test

1. Sign in as the administrator and create a short Maintenance / Block Time.
2. Confirm the block appears in red on the equipment calendar and overlapping booking attempts fail.
3. Create a non-conflicting reservation and confirm the administrator receives the immediate email.
4. Wait approximately one to two scheduler cycles and confirm the reservation becomes approved and the requester receives the result email.
5. Create a reservation beginning 5–6 minutes ahead and confirm the existing reminder arrives about 5 minutes before start.

The scheduler runs once per minute, so “1 minute” approval can occur shortly after the one-minute eligibility point depending on cron timing.
