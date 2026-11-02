# FPTU Lost & Found Mobile

Expo SDK 58 and TypeScript app for FPTU Lost & Found. Navigation uses Expo Router with one stack nested inside each bottom tab.

## Run

1. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL` to an API address reachable from the device.
   - Android emulator: `http://10.0.2.2:3001/api`
   - Expo Go on a physical device: `http://<computer-LAN-IP>:3001/api`
2. From the repository root, run `npm install` once, then `npm run dev:mobile`.
3. Open the QR code in Expo Go or press `a` to open an installed Android emulator.

`EXPO_PUBLIC_API_URL` defaults to `http://localhost:3001/api` when unset. Android emulators and physical devices should use the addresses above.

## Shared foundations

- `src/services/api.ts`: Axios client, SecureStore access token, cookie-backed refresh, API errors, and authenticated `mediaBlob(path)`.
- `src/app/(tabs)`: five primary tabs with a nested stack each. Admin and Staff tabs are role-gated.
- `src/components/ui`: shared controls and network state banners.
- `src/constants/theme.ts`: mobile color, spacing, and radius tokens.

The backend refresh endpoint rotates an HTTP-only `lnfs_refresh` cookie and returns a new access token in JSON. The client enables credentialed requests and stores the access token in SecureStore.
