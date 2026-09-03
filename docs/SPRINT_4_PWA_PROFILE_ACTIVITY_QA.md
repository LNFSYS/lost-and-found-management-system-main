# Sprint 4 PWA/Profile/Activity QA

Cập nhật implementation: **03/09/2026**. Automated API/Web checks đã pass; các mục manual bên dưới chỉ được đánh dấu hoàn thành khi có screenshot hoặc log đính kèm. Avatar runtime dùng Cloudinary authenticated delivery.

## Scope

- Responsive Web/PWA only.
- Native Android, iOS, Expo and React Native are out of scope.
- Node.js owns auth, profile, avatar and activity APIs.
- Java remains health skeleton only.

## Automated Checks

- `npm --workspace @lnfs/api-node run test`
- `npm --workspace @lnfs/api-node run build`
- `npm --workspace @lnfs/web run lint`
- `npm --workspace @lnfs/web run build`
- `npm --workspace @lnfs/web run e2e:home`

## Manual Browser QA

1. Open Chrome or Edge desktop at the web URL and confirm `/manifest.webmanifest` loads.
2. In DevTools Application tab, confirm service worker `/sw.js` is registered.
3. Confirm app can still load when service worker is unsupported or disabled.
4. Login, open `/profile`, and verify private data is not rendered while the route guard is restoring session.
5. Expire or remove the access token while keeping the refresh cookie, then open `/profile`; verify refresh succeeds or the user is redirected to login.
6. Remove/expire the refresh cookie, then open `/profile`; verify the user is redirected to login without private profile data flashing.
7. Update allowed profile fields: full name, student/staff code and phone.
8. Cấu hình Cloudinary test account, sau đó upload valid avatar JPEG, PNG and WEBP under 1MB; xác nhận metadata không chứa secret.
9. Try invalid avatar content with a fake image MIME or a file over 1MB; verify the API rejects it and the UI shows an error.
10. Open DevTools Network, go offline, then attempt a profile/avatar mutation; verify no success message is shown and retry is explicit.
11. Confirm `/api/auth/activity` returns only the current user's counts, reputation and generic event labels.
12. Try adding `?userId=<other-id>` to `/api/auth/activity`; verify the result is still scoped to the authenticated user.
13. Confirm service worker cache does not contain `/api/auth/*`, avatar blobs, chat messages, evidence or private API payloads.
14. Repeat `/profile` on a mobile viewport, checking button text, avatar, form fields and activity cards do not overlap.

## Evidence To Attach

- DevTools screenshots: manifest, service worker, cache entries.
- Network screenshots: expired-token refresh, offline mutation 503/error state.
- Profile screenshots: desktop and mobile.
- Avatar rejection screenshot và Cloudinary upload/cleanup evidence.
- Activity API response with no private chat/evidence fields.
