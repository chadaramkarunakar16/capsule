# Android (Capacitor) — plan, untested

The hosted build is plain static files plus an in-browser engine, so it can live **inside** the Android app and work with no server and no computer.

1. `npm run build:static` (produces `out/`).
2. `npm i @capacitor/core @capacitor/cli @capacitor/android`
3. `npx cap init Capsule app.capsule.wardrobe --web-dir=out`
4. In `capacitor.config.ts` add `server: { androidScheme: "https" }` so OPFS, workers and the service worker run in a secure context.
5. The relay (`/proxy`) is needed for shopping search, AI and merchant previews: build with `NEXT_PUBLIC_RELAY_URL=https://<your-site>.pages.dev/proxy` so the engine calls your deployed relay (it allows the app origins `https://localhost` / `capacitor://localhost`).
6. `npx cap add android && npx cap sync && npx cap open android`, build in Android Studio (needs Java 17 and the Android SDK).

Not done: the Android "Share → Capsule" intent (the PWA share target only works for the installed web app), signing and Play listing. Whether OPFS-backed SQLite behaves in the Android WebView is untested; if it doesn't, the fallback is Capacitor's SQLite plugin behind the same engine interface.
