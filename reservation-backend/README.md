# Reservation backend

The API uses PostgreSQL through Prisma. Confirmed reservations are protected by both application-level locking and a PostgreSQL exclusion constraint, so overlapping appointments cannot be created.

## Environment

Copy `.env.example` to `.env` and replace `AUTH_SECRET` and the seed administrator password. Important variables:

- `DATABASE_URL` — PostgreSQL connection string.
- `AUTH_SECRET` — signs sessions and encrypts recoverable invitation secrets.
- `PUBLIC_APP_URL` — client origin used in invitation links and QR codes.
- `CLIENT_ORIGINS` — comma-separated customer, admin, and Capacitor origins.
- `SEED_ADMIN_*` — first-administrator credentials used by `npm run db:seed`.
- `GOOGLE_CALENDAR_ENABLED` — set to `true` to synchronize confirmed reservations.
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — OAuth 2.0 client credentials.
- `GOOGLE_REFRESH_TOKEN` — offline OAuth refresh token for the Calendar account.
- `GOOGLE_CALENDAR_ID` — destination calendar ID, or `primary` for the authorized account.
- `GOOGLE_CALENDAR_REMINDER_MINUTES` — minutes before the event for the reminder, from `0` to `40320`.
- `GOOGLE_CALENDAR_REMINDER_METHOD` — `popup` or `email`.
- `GOOGLE_CALENDAR_SYNC_INTERVAL_SECONDS` — how often Google Calendar deletions are imported; defaults to `30` seconds (minimum `10`).
- `GOOGLE_CONTACTS_ENABLED` — set to `true` to enable the admin Google Contacts import.
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — OAuth client credentials shared by Calendar and Google Contacts.
- `GOOGLE_REFRESH_TOKEN` — offline refresh token authorized with the required Calendar and `https://www.googleapis.com/auth/contacts.readonly` scopes.
- `DEFAULT_PHONE_COUNTRY` — country used for local phone numbers before international normalization; defaults to `IT`.

Google Calendar synchronization uses the `https://www.googleapis.com/auth/calendar.events` scope. Create an OAuth client in Google Cloud, authorize the Calendar account for offline access, and copy the resulting refresh token into `.env`. Keep the credentials server-side and never commit them. Synchronization is bidirectional for scheduling: deleting an app-created event in Google Calendar marks its reservation as cancelled, while busy events created directly in Google Calendar block overlapping booking slots. Events marked as free do not block availability.

## Database

```bash
npm run db:generate
npm run db:deploy
npm run db:seed
```

Use `npm run db:migrate` while authoring a new Prisma migration. Production deployment should use `npm run db:deploy`.

## API areas

- `/api/auth`, `/api/invitations/:token`, `/api/me`
- `/api/services`, `/api/availability`, `/api/reservations`
- `/api/admin/dashboard`
- `/api/admin/reservations`, `services`, `availability`, `invitations`, `users`, and `settings`
- `/api/admin/contacts` — list imported device/Google contacts and confirm associations with registered users.

The mobile client requests contacts permission only when the user explicitly saves their profile, then sends device contacts to `/api/contacts/device`. Google Contacts are imported from the admin Contacts page. Imported contacts are matched by normalized international phone number; the source remains visible so device and Google records can be distinguished.

All failures use `{ code, message, fieldErrors? }`. A contested appointment returns HTTP `409` with `code: "SLOT_UNAVAILABLE"`.

To reconnect Google Calendar from the admin warning, configure `PUBLIC_ADMIN_URL` to the exact admin origin and add `<PUBLIC_ADMIN_URL>/google-oauth-callback.html` as an authorized redirect URI for the Google OAuth client. Configure `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, a stable strong `AUTH_SECRET`, and enable Calendar. The refresh token is encrypted in the database and takes effect without restarting; changing `AUTH_SECRET` makes stored tokens unreadable. If Google Contacts is enabled, the authorization also requests its read-only scope. Apply database migrations before starting the updated backend.
