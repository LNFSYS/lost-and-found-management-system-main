# S4-P0 traceability addendum

This addendum is the current evidence for the S4-P0 split scope. It supersedes the older Planned notes for the claim/private-room rows until the sprint audit is regenerated.

| Requirement | Runtime evidence | Verification |
| --- | --- | --- |
| Claim creation/withdrawal | `apps/api-node/src/routes/claim.routes.ts`, `controllers/claim.controller.ts`, `services/claim.service.ts` | Match ownership check, active-state validation, transaction row lock and claimant-only withdrawal |
| One claimant/finder participant set | `migrations/040_peer_claim_conversations.sql`, `repositories/claim.repository.ts` | Role/user unique keys, server-derived Finder, participant membership checks |
| Private conversation | `chat_rooms`, `chat_messages`, claim room/message endpoints, `apps/web/src/pages/claims-page.tsx` | Finder consent creates one room; accepted participants only; text idempotency key |
| Private evidence | `claim_evidence`, evidence upload/stream endpoints, private filesystem key | JPEG/PNG/WEBP signature and size validation; no raw storage URL; private no-store proxy |
| Duplicate/privacy negative coverage | `claim.validator.test.ts`, `claim.service.test.ts`, existing `media.test.ts` | Invalid keys, oversized fields, outsider denial and no private storage key serialization |
| PWA flow | `apps/web/src/main.tsx`, `pages/claims-page.tsx`, `services/api.ts`, `styles.css` | Responsive claim list/room, Finder decision, text send, evidence upload retry and error state |
| In-app claim notifications | `notification.repository.ts`, `notification.service.ts`, `notification.routes.ts`, `components/notification-center.tsx` | Idempotent request/acceptance events, user-scoped read operations, polling badge and non-blocking toast |

Realtime push transport, browser push permissions, appointment/meetup lifecycle, custody escalation workflow, OCR/review confidence and Native Mobile remain outside this implementation. The notification behavior here is authenticated in-app polling only.
