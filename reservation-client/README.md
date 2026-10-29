# Reservation client

Customer-only Vue 3 and TypeScript client for browser, iOS, and Android. The administrator backoffice is a separate application in `reservation-admin` and is not included in this build.

## Development

```bash
npm install
npm run dev
```

Vite proxies `/api` to `http://localhost:3000`. The backend must be running.

The interface is available in Italian and English. Translation catalogs are in `src/locales`; the selected language is saved as `reservio-locale`.

## Quality checks

```bash
npm run typecheck
npm test
npm run build
```

Add another UI primitive with:

```bash
npx shadcn-vue@latest add <component>
```

## Native builds

Native apps need an HTTPS backend URL because they cannot use the Vite proxy:

```bash
VITE_API_URL=https://api.example.com/api npm run mobile:sync
npm run android:open
npm run ios:open
```

Android requires Android Studio. iOS requires macOS and Xcode.
