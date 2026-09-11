# S4-P0 implementation evidence

This document records the repository contract for match-to-chat verification. Node.js remains the only business write owner for claims, participants, rooms, messages and private evidence.

## Runtime surface

All endpoints below require an active bearer session. The claim service returns `404` for a claim, room, message or evidence request that is not owned by the authenticated participant, so an outsider cannot distinguish a missing object from an unauthorized one.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/claims` | Create a claim for an existing LOST–FOUND match. Supports `Idempotency-Key`. |
| `GET` | `/api/claims` | List claims for the authenticated claimant/finder participant set. |
| `GET` | `/api/claims/:claimId` | Read claim and participant-safe metadata. |
| `POST` | `/api/claims/:claimId/decision` | Finder opens conversation, requests more information, verifies for meetup, declines or escalates to custody; requires reason and idempotency key. |
| `GET` | `/api/claims/:claimId/verification` | Participant-scoped template, sent-question, answer-metadata, review and appointment-eligibility summary. |
| `POST` | `/api/claims/:claimId/verification/questions` | Finder sends a version-checked built-in or safe custom question. |
| `POST` | `/api/claims/:claimId/verification/answers` | Claimant submits a private answer; raw answer stays in the room. |
| `POST` | `/api/claims/:claimId/verification/reviews` | Finder records human result, confidence and reason for a submitted answer. |
| `POST` | `/api/claims/:claimId/withdraw` | Claimant withdraws an active request. |
| `GET`/`POST` | `/api/claims/:claimId/room` | Read the private room after Finder consent. Room creation is idempotent and server-owned. |
| `GET`/`POST` | `/api/claims/:claimId/messages` | Read/send private text messages. Supports message idempotency; older-page reads use the `before` + `beforeId` composite cursor. |
| `GET`/`POST` | `/api/claims/:claimId/evidence` | List/upload private images from the authorized room. |
| `GET` | `/api/claims/:claimId/evidence/:evidenceId` | Stream an image through an authorization-checked, no-store proxy. |
| `GET` | `/api/notifications` | List the authenticated user's private claim notifications. |
| `POST` | `/api/notifications/:notificationId/read` | Mark one notification read; ownership is checked by `user_id`. |
| `POST` | `/api/notifications/read-all` | Mark all notifications for the authenticated user read. |

## State and authorization rules

1. A claim can only be created by the owner of the LOST post for a persisted match at or above the configured suggestion threshold. The FOUND owner is derived from the FOUND post; client-supplied participant IDs are not trusted.
2. Creation inserts exactly one CLAIMANT and one FINDER participant. The claimant is accepted immediately; the Finder starts as pending.
3. Finder `OPEN_CONVERSATION` changes the claim to `CONVERSATION_OPEN`, accepts the Finder participant and creates one `chat_rooms` row. `REQUEST_MORE_INFO` uses `NEED_MORE_INFO` and also opens the room. `VERIFY_FOR_MEETUP` is the separate audited transition to claim `ACCEPTED`; `DECLINE` changes the claim to `REJECTED` and does not open a room.
4. Claimant withdrawal is allowed only from `PENDING`, `CONVERSATION_OPEN` or `NEED_MORE_INFO`. Decision and withdrawal operations lock the claim row in a transaction.
5. Every read/write checks the `claim_participants` row and accepted consent before accessing a room, message or evidence. Staff/Admin roles do not bypass routine peer-room authorization.
6. Private evidence is stored below the server upload directory with a `private://` key. Responses expose only `/api/claims/.../evidence/...`; raw storage URL and public ID are never serialized. Claim endpoints set `Cache-Control: private, no-store`.
7. Creating a claim writes one idempotent `CLAIM_REQUEST_RECEIVED` notification for the Finder. Finder `OPEN_CONVERSATION` writes one idempotent `CLAIM_CONVERSATION_OPENED` notification for the Claimant; only `VERIFY_FOR_MEETUP` reaches claim `ACCEPTED`. The PWA polls the private notification feed and shows a dismissible toast plus a notification-center badge; no browser permission or public post payload is involved.

## Verification evidence

- Backend TypeScript build: `npm.cmd run build` in `apps/api-node`.
- Backend unit tests: `npm.cmd test` in `apps/api-node`; claim validator and object-level privacy tests are included. The existing MySQL integration suite remains skipped unless a dedicated integration database is supplied.
- Web type check: `npm.cmd run lint` in `apps/web`.
- Web production build: `npm.cmd run build` in `apps/web`.

Before marking the ticket Done, run migration `045_peer_claim_conversations.sql` against an isolated MySQL database and manually verify claimant, Finder and third-user sessions for room/message/evidence denial, duplicate idempotency, oversized/mismatched image rejection, request/acceptance notifications and absence of private data in `/api/posts` responses.
