# Equipment Reservation Complete

This is a standalone PWA equipment reservation system.

Equipment:
- Picomaster
- Ellionix
- Magnetic Annealing

Main features:
- PC weekly calendar
- Mobile day calendar
- Home-screen installation as a PWA
- Name / Email / Supervisor / Purpose / Notes
- Equipment-specific user permission
- Pending / Approved reservation colors
- Reservation requester name shown on calendar
- Admin approval email with APPROVE / DECLINE buttons
- User result email after approval or decline
- 5-minute reservation reminder email
- Reminder sent only once per approved reservation

---

# 1. Upload this project to GitHub

Create a new GitHub repository:

`equipment-reservation`

Upload all files in this folder.

Do not upload `.env.local`.

---

# 2. Create Supabase project

Create a new Supabase project.

Then open:

`SQL Editor → New query`

Paste and run:

`supabase/schema.sql`

This creates:

- `users`
- `equipment_permissions`
- `reservations`

RLS is enabled. The browser does not access tables directly. The Next.js server uses the service-role key.

---

# 3. Register users and equipment permissions

Use:

`supabase/example-users.sql`

as a template.

Example:

```sql
insert into public.users (email, name)
values ('hanwool@kist.re.kr', 'Hanwool Seong')
on conflict (email) do update
set name = excluded.name,
    active = true;

insert into public.equipment_permissions (user_id, equipment, allowed)
select id, 'Picomaster', true
from public.users
where email = 'hanwool@kist.re.kr'
on conflict (user_id, equipment) do update
set allowed = true;
```

This means Hanwool can reserve Picomaster.

To allow one user to reserve all three equipment:

```sql
insert into public.equipment_permissions (user_id, equipment, allowed)
select u.id, e.equipment, true
from public.users u
cross join (
  values ('Picomaster'), ('Ellionix'), ('Magnetic Annealing')
) as e(equipment)
where u.email = 'user@kist.re.kr'
on conflict (user_id, equipment) do update
set allowed = true;
```

To remove permission:

```sql
update public.equipment_permissions
set allowed = false
where user_id = (
  select id from public.users where email = 'user@kist.re.kr'
)
and equipment = 'Ellionix';
```

---

# 4. Create Resend API key

Create a Resend API key.

You need:

```env
RESEND_API_KEY=re_xxxxxxxxx
RESEND_FROM=Equipment Reservation <reservation@your-domain.com>
```

For testing, use the address allowed by your Resend setup.
For production, verify a sending domain in Resend.

---

# 5. Environment variables

In local development, copy:

`.env.example`

to:

`.env.local`

Fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_OR_SECRET_KEY

RESEND_API_KEY=re_xxxxxxxxxxxxxxxxx
RESEND_FROM=Equipment Reservation <reservation@YOUR_DOMAIN>
ADMIN_EMAIL=YOUR_EMAIL@kist.re.kr

NEXT_PUBLIC_SITE_URL=http://localhost:3000
APPROVAL_SECRET=replace-with-a-long-random-secret
CRON_SECRET=replace-with-another-long-random-secret
```

Generate secrets:

```bash
openssl rand -hex 32
openssl rand -hex 32
```

---

# 6. Run locally

Install Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open:

`http://localhost:3000`

---

# 7. Deploy on Vercel

1. Go to Vercel.
2. Add New Project.
3. Import your GitHub repository.
4. Add all environment variables.
5. Deploy.

After deployment, copy the final Vercel URL.

Example:

`https://equipment-reservation.vercel.app`

Then set:

```env
NEXT_PUBLIC_SITE_URL=https://equipment-reservation.vercel.app
```

Redeploy.

This is required for email APPROVE / DECLINE links.

---

# 8. Test reservation flow

1. Add your email to `users`.
2. Add equipment permission in `equipment_permissions`.
3. Open the Vercel site.
4. Select an equipment.
5. Make a reservation request.
6. Confirm that the calendar shows Pending.
7. Check admin email.
8. Click APPROVE.
9. Confirm that the calendar changes to Approved.
10. Confirm user result email.

---

# 9. Enable 5-minute reminders

After Vercel deployment works, open:

`supabase/reminder-cron.sql`

Replace:

```text
https://YOUR-VERCEL-APP.vercel.app
```

with your actual Vercel URL.

Replace:

```text
YOUR_CRON_SECRET
```

with the same value as your Vercel environment variable:

```env
CRON_SECRET
```

Then run the SQL in Supabase SQL Editor.

The cron job calls:

`/api/reminders`

every minute.

The reminder API finds approved reservations starting in about 5 minutes and sends one email.

Email subjects:

- `Picomaster Reservation Reminder`
- `Ellionix Reservation Reminder`
- `Magnetic Annealing Reservation Reminder`

No `[DS Han Lab]` text is used.

---

# 10. Install on phone

Android Chrome:
- Open the site.
- Tap Install app or Add to Home screen.

iPhone Safari:
- Open the site.
- Tap Share.
- Tap Add to Home Screen.

The installed app name is:

`Equipment Reservation`

---

# 11. Important security notes

Never put these in GitHub:

```env
SUPABASE_SERVICE_ROLE_KEY
RESEND_API_KEY
APPROVAL_SECRET
CRON_SECRET
```

Only put them in:

- `.env.local` on your computer
- Vercel Environment Variables

The approval email links use a random token.
Only a hash of the token is stored in the database.
After approve/decline, the token is removed.

---

# 12. Recommended next upgrade

The current version checks whether the submitted email has permission for the selected equipment.

For stronger security, add Supabase email-login later.
Then users can only reserve equipment after proving ownership of their email address.
