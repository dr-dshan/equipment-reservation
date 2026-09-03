# Equipment Reservation

A standalone, mobile-first reservation app for three shared instruments:

- Picomaster
- Ellionix
- Magnetic Annealing

It is intentionally independent from any existing laboratory website. The project is a **PWA (Progressive Web App)**, so users can open it in a browser or install it on an iPhone/Android home screen and launch it like an app.

## Included features

- Separate reservation website
- Responsive desktop + mobile interface
- Installable PWA with app icon
- Desktop default: weekly calendar
- Mobile default: daily time-grid calendar
- 30-minute clickable booking slots
- Reservation form:
  - Name
  - Email
  - Supervisor
  - Start time
  - End time
  - Purpose
  - Notes
- Public calendar shows reservation time + reservation user name
- Approved and Pending reservations use different colors
- Declined reservations disappear from the public calendar
- Allow-list (`allowed_users`) blocks unauthorized email addresses
- Overlap prevention for both Pending and Approved reservations
- Administrator email for every request
- APPROVE / DECLINE buttons in the administrator email
- Result email to the requester after approval/decline
- Approved reservations receive an automatic reminder about 5 minutes before start
- Reminder is sent only once

---

# Architecture

```text
Phone / PC
   |
   v
Next.js PWA on Vercel
   |
   +---- Supabase Postgres (reservations + authorized users)
   |
   +---- Resend (transactional email)
   |
   +---- Supabase Cron -- every minute --> /api/reminders
```

GitHub is only the source repository. Vercel hosts the application and secure API routes.

---

# 1. Requirements

Install Node.js 20 or newer and Git.

You will need accounts/projects for:

1. GitHub
2. Vercel
3. Supabase
4. Resend

---

# 2. Create the Supabase database

Create a Supabase project, open **SQL Editor**, paste the contents of:

```text
supabase/schema.sql
```

and run it.

This creates:

- `allowed_users`
- `reservations`

To authorize users, insert their email addresses:

```sql
insert into public.allowed_users (email, name)
values
  ('user1@kist.re.kr', 'User One'),
  ('user2@kist.re.kr', 'User Two');
```

You can also add/remove users later using the Supabase Table Editor.

> The current version checks whether the submitted email is on the allow-list. For stronger identity verification, Supabase Auth / email magic-link login can be added later.

---

# 3. Get Supabase keys

In the Supabase dashboard, find the project API settings and copy:

- Project URL
- anon/publishable key
- service-role/secret key

The service-role key must **never** be committed to GitHub or exposed in browser code.

---

# 4. Configure Resend

Create a Resend account and API key.

For production email, verify a sending domain/subdomain in Resend, for example:

```text
reservation.example.org
```

The app sends three types of mail:

### A. New reservation request → administrator

Includes:

- Equipment
- User
- Email
- Supervisor
- Start / end time
- Purpose
- Notes
- APPROVE button
- DECLINE button

### B. Approval / decline result → requester

The user receives the reservation result automatically.

### C. 5-minute reminder → requester

Only Approved reservations are eligible.

Example subject:

```text
Picomaster Reservation Reminder
```

There is no `[DS Han Lab]` prefix.

---

# 5. Environment variables

Copy:

```text
.env.example
```

to:

```text
.env.local
```

Fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY

RESEND_API_KEY=re_xxxxxxxxx
RESEND_FROM=Equipment Reservation <reservation@YOUR_DOMAIN>
ADMIN_EMAIL=YOUR_ADMIN_EMAIL

NEXT_PUBLIC_SITE_URL=http://localhost:3000
APPROVAL_SECRET=LONG_RANDOM_SECRET_1
REMINDER_CRON_SECRET=LONG_RANDOM_SECRET_2
```

Generate random secrets, for example:

```bash
openssl rand -hex 32
```

Use a different value for each secret.

---

# 6. Test locally

Inside the project directory:

```bash
npm install
npm run dev
```

Then open:

```text
http://localhost:3000
```

The 5-minute production cron should be configured only after deployment.

---

# 7. Push to GitHub

Create a GitHub repository, for example:

```text
equipment-reservation
```

Then:

```bash
git init
git add .
git commit -m "Initial equipment reservation app"
git branch -M main
git remote add origin https://github.com/YOUR_ID/equipment-reservation.git
git push -u origin main
```

`.env.local` is already ignored by `.gitignore`.

---

# 8. Deploy to Vercel

1. Sign in to Vercel.
2. Create a new project from the GitHub repository.
3. Add all environment variables listed above.
4. Deploy.
5. Vercel will give you an address similar to:

```text
https://equipment-reservation.vercel.app
```

6. Change the Vercel environment variable:

```env
NEXT_PUBLIC_SITE_URL=https://equipment-reservation.vercel.app
```

7. Redeploy.

This URL is used to generate the administrator's Approve / Decline links.

---

# 9. Configure the 5-minute reminder

The reminder uses **Supabase Cron**, not Vercel Cron.

Why: the reminder checker needs minute-level scheduling. Supabase Cron can run the protected `/api/reminders` endpoint every minute.

First make sure `REMINDER_CRON_SECRET` is already configured in Vercel.

Then open:

```text
supabase/reminder_cron.sql
```

and replace:

```text
https://YOUR-VERCEL-SITE.vercel.app
```

with your deployed application URL, and:

```text
YOUR_REMINDER_CRON_SECRET
```

with the exact same secret stored in Vercel.

The SQL stores both values in **Supabase Vault** and creates a cron job that calls the reminder endpoint every minute.

The endpoint only selects reservations satisfying all of the following:

- `status = approved`
- `reminder_sent_at IS NULL`
- start time is approximately 5 minutes away

When the email succeeds, `reminder_sent_at` is permanently recorded. Therefore the same reservation does not receive the reminder twice.

If an email send fails, the claim is released so a later cron execution can retry.

> Because the job runs periodically and email delivery itself is not real-time deterministic, “5 minutes before” should be understood as approximately 5 minutes before rather than guaranteed to the exact second.

---

# 10. Install it like a phone app

## Android / Chrome

After deployment over HTTPS:

1. Open the reservation site in Chrome.
2. Use the **Install App** button if Chrome exposes installability.
3. If the button is unavailable, use Chrome's menu → **Add to Home screen / Install app**.
4. Launch the new Equipment icon from the home screen.

## iPhone / Safari

1. Open the site in Safari.
2. Tap the Share button.
3. Choose **Add to Home Screen**.
4. Confirm the name.
5. Launch it from the home screen.

The PWA runs in standalone display mode and includes dedicated 192 px, 512 px, maskable, and Apple-touch icons.

---

# 11. User workflow

```text
Open app
  ↓
Choose Picomaster / Ellionix / Magnetic Annealing
  ↓
Check calendar
  ↓
Tap empty time slot
  ↓
Enter Name / Email / Supervisor / Purpose / Notes
  ↓
Request Reservation
  ↓
Pending appears on calendar
  ↓
Administrator receives email
  ↓
APPROVE or DECLINE
  ↓
User receives result email
  ↓
If Approved: reminder email ~5 min before start
```

---

# 12. Reservation conflict policy

Both Pending and Approved reservations block the selected time.

The overlap rule is:

```text
new_start < existing_end
AND
new_end > existing_start
```

The server checks conflicts once at submission and again immediately before approval.

This protects against approving an old email after another reservation has already taken that time.

---

# 13. PWA files

The app-related files are:

```text
app/manifest.ts
components/PwaInstall.tsx
public/sw.js
public/icon-192.png
public/icon-512.png
public/icon-512-maskable.png
public/apple-touch-icon.png
```

The service worker deliberately does **not** cache `/api/*` requests, so reservation data is always requested from the server rather than served as stale cached data.

---

# 14. Recommended next upgrade

The most useful next security improvement is **email magic-link authentication**. That would prove that the person submitting a booking actually controls an authorized email address, rather than merely knowing one.
