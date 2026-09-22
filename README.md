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


## Optimized PWA update
- Faster repeat loads via short calendar edge caching and static asset caching.
- `/api/*` is never service-worker cached.
- Admin signup/reservation Resend failures are explicitly logged in Vercel.
- Windows/Android: use the `Install app` button when shown.
- iPhone/iPad: Safari → Share → Add to Home Screen.
- Admin notifications require Production values for `RESEND_API_KEY`, `RESEND_FROM`, `ADMIN_EMAIL`, and `NEXT_PUBLIC_SITE_URL`.
- Redeploy after changing Vercel environment variables.

## Equipment visibility update
- Normal users see only equipment for which the administrator granted permission.
- Users cannot query reservation calendars for unauthorized equipment, even by calling the API directly.
- Administrators can see all equipment.
- Approved users with no equipment permission see a message asking them to contact the administrator.
- Calendar entries expose only reserver name/time/status; purpose, notes, supervisor and email are not exposed by the normal calendar API.

## AJA Oxide Sputter update

A fourth equipment item, `AJA Oxide Sputter`, has been added.

For an EXISTING Supabase installation, run this file once in Supabase SQL Editor:

`supabase/add-aja-oxide-sputter.sql`

Then deploy this code update. The Admin page will show an additional AJA Oxide Sputter permission checkbox. Users only see it when the administrator grants that permission.

## Six-equipment update

Equipment list:
- Picomaster
- Ellionix
- Magnetic Annealing
- AJA Oxide Sputter
- Magnetotransport system (L6315)
- Magnetotransport system (T4105)

For an existing deployment, run `supabase/add-equipment-items.sql` once in the Supabase SQL Editor before testing reservations for the new equipment. Then deploy the updated code to Vercel.

Each new equipment item has its own administrator permission checkbox. Normal users only see equipment for which they have permission.

## Fast admin permission update

The Admin permission checkboxes now use optimistic UI:
- checkbox changes immediately
- only the clicked user/equipment permission is saved
- the entire user list is NOT reloaded after a successful save
- only the clicked checkbox is reverted if the save fails

This removes the noticeable delay after changing equipment access.
