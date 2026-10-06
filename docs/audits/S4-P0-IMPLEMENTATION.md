# S4-P0 implementation evidence

This document records the repository contract for match-to-chat verification. Node.js remains the only business write owner for claims, participants, rooms, messages and private evidence.

## Runtime surface

All endpoints below require an active bearer session. The claim service returns `404` for a claim, room, message or evidence request that is not owned by the authenticated participant, so an outsider cannot distinguish a missing object from an unauthorized one.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/claims` | Create a claim for an existing LOST–FOUND match. Supports `Idempotency-Key`. |
| `GET` | `/api/claims` | List claims for the authenticated claimant/finder participant set. |
| `GET` | `/api/claims/:claimId` | Read claim and participant-safe metadata. |
| `POST` | `/api/claims/:claimId/decision` | Finder performs `ACCEPT / OPEN_CONVERSATION`, initial request-more-info or initial decline. This endpoint does not verify ownership. |
| `POST` | `/api/claims/:claimId/withdraw` | Claimant withdraws an active request. |
| `GET`/`POST` | `/api/claims/:claimId/room` | Read the private room after Finder consent. Room creation is idempotent and server-owned. |
| `GET`/`POST` | `/api/claims/:claimId/messages` | Read/send private text messages. Supports message idempotency; older-page reads use the `before` + `beforeId` composite cursor. |
| `GET`/`POST` | `/api/claims/:claimId/evidence` | List/upload private images from the authorized room. |
| `GET` | `/api/claims/:claimId/evidence/:evidenceId` | Stream an image through an authorization-checked, no-store proxy. |
| `GET` | `/api/claims/:claimId/verification/templates` | Finder reads the versioned template selected from the FOUND category. |
| `GET` | `/api/claims/:claimId/verification` | Participant reads assigned questions, redacted answer metadata and append-only decision history. |
| `POST` | `/api/claims/:claimId/verification/questions` | Finder reviews/sends one template or safe custom question. Requires `Idempotency-Key`. |
| `POST` | `/api/claims/:claimId/verification/questions/:questionId/answer` | Claimant submits a private answer for hash comparison. Requires `Idempotency-Key`. |
| `POST` | `/api/claims/:claimId/verification/decision` | Finder explicitly requests more information, verifies for meetup, declines or escalates to custody. Requires reason and `Idempotency-Key`. |
| `GET` | `/api/notifications` | List the authenticated user's private claim notifications. |
| `POST` | `/api/notifications/:notificationId/read` | Mark one notification read; ownership is checked by `user_id`. |
| `POST` | `/api/notifications/read-all` | Mark all notifications for the authenticated user read. |

## State and authorization rules

1. A claim can only be created by the owner of the LOST post for a persisted match at or above the configured suggestion threshold. The FOUND owner is derived from the FOUND post; client-supplied participant IDs are not trusted.
2. Creation inserts exactly one CLAIMANT and one FINDER participant. The claimant is accepted immediately; the Finder starts as pending.
3. Finder `ACCEPT / OPEN_CONVERSATION` changes the claim to `CONVERSATION_OPEN`, accepts the Finder participant and creates one `chat_rooms` row. It is not ownership verification and is not appointment-eligible. Initial `REQUEST_MORE_INFO` uses `NEED_MORE_INFO`; initial `DECLINE` uses `REJECTED`.
4. Claimant withdrawal is allowed only from `PENDING`, `CONVERSATION_OPEN` or `NEED_MORE_INFO`. Decision and withdrawal operations lock the claim row in a transaction.
5. Every read/write checks the `claim_participants` row and accepted consent before accessing a room, message or evidence. Staff/Admin roles do not bypass routine peer-room authorization.
6. Private evidence is stored below the server upload directory with a `private://` key. Responses expose only `/api/claims/.../evidence/...`; raw storage URL and public ID are never serialized. Claim endpoints set `Cache-Control: private, no-store`.
7. Creating a claim writes one idempotent `CLAIM_REQUEST_RECEIVED` notification for the Finder. Finder `ACCEPT` writes one idempotent `CLAIM_ACCEPTED` notification for the Claimant. The PWA polls the private notification feed and shows a dismissible toast plus a notification-center badge; no browser permission or public post payload is involved.
8. The canonical final verified status is claim `ACCEPTED`. `CONVERSATION_OPEN`, `NEED_MORE_INFO`, `REJECTED` and `CANCELLED` are never appointment-eligible.
9. Question assignment, answer submission, final decision and authorized correction lock the claim row, validate participant/state, check replay metadata and write an audit event in the same transaction.
10. Expected answers are bcrypt hashes. Raw expected and claimant answers are not serialized, logged or stored in answer/audit rows. Claimants do not receive match results.
11. Custody escalation uses claim `REJECTED` plus `chat_rooms.escalated_at/by/reason`; the `CUSTODY_ESCALATED` audit event preserves the semantic reason without introducing another claim enum.

## Verification evidence

- Backend TypeScript build: `npm.cmd run build` in `apps/api-node`.
- Backend unit tests: `npm.cmd test` in `apps/api-node`; claim validator and object-level privacy tests are included. The existing MySQL integration suite remains skipped unless a dedicated integration database is supplied.
- Web type check: `npm.cmd run lint` in `apps/web`.
- Web production build: `npm.cmd run build` in `apps/web`.
- Verification browser test: `npm.cmd --workspace @lnfs/web exec playwright test tests/claims-resilience.spec.ts` from the repository root.

Before marking the ticket Done, run the existing migration set against an isolated MySQL database and manually verify claimant, Finder and third-user sessions for room/question/answer/reason denial, duplicate idempotency, stale transitions, correction, custody escalation and absence of private data in public responses/logs. No new migration is required for LNFS-53.
