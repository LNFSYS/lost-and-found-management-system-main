# FPTU Lost & Found Mobile

Android authentication client built with Expo SDK 57. Scope is limited to registration, login, password recovery, session security, and displaying server-issued roles. It does not expose lost/found, chat, claim, appointment, or warehouse workflows.

## Run locally

Use Node.js 22.13 or newer.

1. Copy `.env.example` to `.env`.
2. Keep `http://10.0.2.2:3001/api` when using the Android emulator. For a physical phone, use the development computer's reachable LAN address and allow the phone to reach the API port.
3. Start the API with the repository's normal development command, then run `npm run mobile:start` from the repository root and open it in Expo Go or an Android development build.

The backend must include `/api/auth/mobile/*` session endpoints. Registration OTP and password recovery use the existing auth endpoints. No database migration is required.

## Build an installable APK

Set `EXPO_PUBLIC_API_URL` to the deployed API base ending in `/api`, using HTTPS, in the EAS build environment. This value is public app configuration, not a secret. Release builds reject missing or non-HTTPS API URLs.

After logging in to Expo/EAS and linking the EAS project, run:

```sh
npx eas-cli@latest build --platform android --profile preview
```

The `preview` profile produces an internally distributable APK. The `production` profile is also configured as an APK for direct installation; it is not a Play Store AAB. Mobile has its own `package-lock.json` so React Native's React version remains isolated from the web app's React version.

Refresh tokens are stored with `expo-secure-store` using Android Keystore-backed storage. Access tokens stay in memory, and the app only shows roles returned by the API. Registration can request student or lecturer status; Staff/Admin access remains provisioned and enforced by the backend.
