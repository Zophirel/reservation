# Reservation admin

Standalone administrator backoffice. It runs separately from the customer client and stores its session under a dedicated browser key.

```bash
npm install
npm run dev
```

Open `http://localhost:5174`. The backend must be running on port 3000. Set `VITE_CLIENT_URL` when the customer application is deployed elsewhere.

The interface is available in Italian and English. Translation catalogs are in `src/locales`; the selected language is saved independently as `reservio-admin-locale`.
