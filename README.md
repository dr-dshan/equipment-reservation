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

## Reservation approval reliability update
- Admin → Recent Reservations now has Approve / Decline buttons for pending requests.
- Approval re-checks time overlap on the server.
- Email is now a notification convenience, not the only approval path.
- If the admin notification email fails, the reservation remains pending and visible in Admin.
- Resend's send result is checked and email errors are logged in Vercel.

## Self-service reservation edit/cancel
- Users can click their own calendar reservation to edit or cancel it.
- Cancellation never requires administrator approval and is stored as `cancelled` for history.
- For an approved reservation, a new interval wholly contained within the previously approved interval remains approved.
  - later start = no reapproval
  - earlier end = no reapproval
  - both = no reapproval
- Any extension outside the previously approved interval requires administrator approval again and changes status to `pending`.
- Pending reservations remain pending after edits.
- Edits are rejected if the new interval overlaps another pending/approved reservation.
- Other users cannot edit/cancel someone else's reservation.

## Fast calendar refresh and state persistence
- Reservation calendar GET responses are no longer cached for 10 seconds.
- Calendar requests use `cache: no-store` and a cache-busting query value.
- After create/edit/cancel, the calendar reloads immediately from fresh server state.
- While the page is open, visible calendars refresh every 8 seconds so another user's changes appear without F5.
- Returning to the tab/window triggers an immediate refresh.
- F5 preserves the last selected equipment, calendar view (month/week/day), and current calendar date using localStorage.
- If access to the saved equipment was removed, the app falls back to the first currently permitted equipment.

## Seven-day login + install update
- Supabase browser auth now explicitly uses persistent localStorage sessions and automatic token refresh.
- A successful login starts a 7-day application session window.
- Closing/reopening the browser or installed PWA and normal F5 reloads do not require login during that window.
- After 7 days the app signs the user out and requires login again.
- Explicit Log out still signs out immediately.
- Existing logged-in users receive a fresh 7-day window on first use of this build.
- Install App is always visible in a normal browser when the app is not already running standalone.
- Edge/Chrome opens the native install prompt when available; otherwise the button shows browser-specific install instructions.
- iPhone/iPad shows Safari → Share → Add to Home Screen instructions.

## Session restore fix
- App startup now waits for Supabase persisted-auth restoration before deciding that the user is logged out.
- `/login` also restores an existing valid session and automatically returns to the calendar.
- Sessions are persisted in localStorage with Supabase automatic refresh-token handling.
- The app still enforces the requested 7-day login window.
- Explicit Log out clears both Supabase auth and the app's 7-day marker.
- Service-worker cache version bumped so deployed clients receive the updated authentication code.

## Calendar startup default update
- The last selected equipment is still remembered.
- Mobile / installed mobile PWA opens on today's Day view.
- Desktop opens on the current Week view.
- Previous calendar date and Month/Week/Day view are no longer restored after a fresh page load or app launch.
- Users can still switch Month/Week/Day normally during the current session.

