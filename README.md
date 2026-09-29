# Screen Guard

An offline-first Android screen-lock app (React Native + Expo). It locks selected apps behind a Fingerprint, Pattern, or PIN credential, stores the credential verifier in Android Keystore (via Expo SecureStore), and uses a display-over-other-apps overlay plus usage-access monitoring to show the lock screen before a protected app opens.

## Folder structure

```
src/
  app/
    App.tsx                  app bootstrap
    navigation/
      Navigation.tsx         orchestrator (state, effects, render)
      shared.ts              shared types, constants, helpers
      components/            reusable UI (each with its own .scss)
        BottomNav, PermissionSetupModal, PinDisplay, PinPad, PatternPad
      screens/               app screens (each with its own .scss)
        SetupScreen, ValidationPage, CredentialSetupScreen,
        AppsScreen, StatisticsScreen, LockScreen, SettingsScreen
  services/
    api.ts                   optional backend connectivity (status only)
    lockCredentials.ts       salted verifier in SecureStore
    wallpapers.ts            photo picker + durable file copy
    native/
      installedApps.ts       installed-app list / launch
      appLock.ts             overlay, usage-access, monitor control
  styles/_variables.scss    shared SCSS variables
  theme/index.ts             color tokens
  types/index.ts             shared types (+ scss module declaration)
android/                     native Android project
backend/                     optional Node backend (not required for locking)
```

## How protection works

- Credential verifier is salted + SHA-256 hashed and stored in Android Keystore; the raw PIN/pattern is never stored or uploaded.
- A foreground **monitor service** (usage access) detects a protected app opening and shows a **native overlay** (SYSTEM_ALERT_WINDOW).
- Screen Guard's own app is protected by default from the second launch onward.
- Unlocking starts a session (no re-entry until the lock screen is closed).

## Requirements

- Overlay permission ("Display over other apps")
- Usage access
- Notifications (for the monitor's ongoing notification)

The app shows a setup wizard for these on first launch; Settings can reopen them.

## Scripts

- `npm run start` — Metro dev server
- `npm run android` — build & run debug on a device/emulator
- `npm run android:release` — build the release APK
- `npm run typecheck` — TypeScript check

The build machine is memory-constrained, so `metro.config.js` pins Metro to a single worker and the scripts cap the Node heap.

## Optional backend

Locking works fully offline. The backend (`npm run backend`) is optional and only provides device-level sync/status; it is not required to unlock apps.
