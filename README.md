# Equipment Reservation with Admin Approval

Standalone PWA reservation system with:

- User signup/login
- Admin approval of new users
- Admin equipment permission management
- Picomaster / Ellionix / Magnetic Annealing
- Reservation request approval by email
- 5-minute reminder email

## Installation order

1. Upload this project to GitHub.
2. Create Supabase project.
3. Run `supabase/schema.sql`.
4. Create Resend API key.
5. Deploy on Vercel.
6. Add environment variables in Vercel.
7. Sign up once using the admin email.
8. In Supabase, manually set only the first admin profile status to `approved`.
9. From then on, manage all users at `/admin`.
10. After reservation flow works, run `supabase/reminder-cron.sql`.

## Environment variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_OR_SECRET_KEY

RESEND_API_KEY=re_xxxxxxxxxxxxxxxxx
RESEND_FROM=Equipment Reservation <reservation@YOUR_DOMAIN>
ADMIN_EMAIL=YOUR_EMAIL@kist.re.kr

NEXT_PUBLIC_SITE_URL=https://YOUR-VERCEL-APP.vercel.app
APPROVAL_SECRET=long-random-secret
CRON_SECRET=another-long-random-secret
```

## First admin setup

Because the admin page itself requires login, do this once:

1. Deploy the app.
2. Open `/signup`.
3. Register using the exact same email as `ADMIN_EMAIL`.
4. Go to Supabase Table Editor → `profiles`.
5. Change that user’s `status` from `pending` to `approved`.

After that, sign in and open:

`/admin`

You can approve/reject users and check equipment permissions there.

## Normal user flow

1. User opens `/signup`.
2. User enters name, email, password, supervisor.
3. User account is created as `pending`.
4. Admin gets notification email.
5. Admin opens `/admin`.
6. Admin approves user.
7. Admin checks allowed equipment.
8. User logs in and reserves only allowed equipment.

## Reservation flow

1. Approved user selects equipment.
2. User clicks time slot.
3. User enters purpose/notes.
4. Admin receives reservation email.
5. Admin clicks APPROVE or DECLINE.
6. User receives result email.
7. Approved reservations receive a reminder email about 5 minutes before start.

## Reminder setup

Edit `supabase/reminder-cron.sql`:

- Replace `https://YOUR-VERCEL-APP.vercel.app`
- Replace `YOUR_CRON_SECRET`

Run it in Supabase SQL Editor.

## Phone installation

Android Chrome:
- Open site → Install app

iPhone Safari:
- Share → Add to Home Screen
