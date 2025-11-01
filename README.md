# Reservely

A Vue 3 reservation web application packaged with Capacitor so it can be deployed to the web, iOS, and Android. The app currently provides three core screens:

- **Login / Sign Up** — onboarding flow for creating or restoring a session.
- **Calendar** — the primary scheduling view for selecting reservation days and time slots.
- **Account** — user profile management and a summary of saved reservations.

## Project structure

```
frontend/
├── capacitor.config.ts
├── index.html
├── package.json
├── src/
│   ├── App.vue
│   ├── assets/
│   │   └── main.css
│   ├── env.d.ts
│   ├── main.ts
│   ├── router/
│   │   └── index.ts
│   ├── stores/
│   │   ├── auth.ts
│   │   └── reservations.ts
│   └── views/
│       ├── AccountView.vue
│       ├── CalendarView.vue
│       └── LoginView.vue
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

## Getting started

> **Note:** Installing dependencies is not possible in this execution environment, but the following steps outline how to run the project locally.

1. Install dependencies:
   ```bash
   cd frontend
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
   The app will be served at `http://localhost:5173`.
3. Build the production bundle:
   ```bash
   npm run build
   ```
4. Preview the production build:
   ```bash
   npm run preview
   ```

## Mobile builds with Capacitor

1. Generate the web build that will be embedded in the native shells:
   ```bash
   npm run build
   ```
2. Synchronize Capacitor assets:
   ```bash
   npm run cap:sync
   ```
3. Add a platform (first-time only):
   ```bash
   npm run cap:add:ios
   npm run cap:add:android
   ```
4. Open the native project in Xcode or Android Studio:
   ```bash
   npm run cap:open:ios
   npm run cap:open:android
   ```

From there, the standard iOS and Android build pipelines apply.
