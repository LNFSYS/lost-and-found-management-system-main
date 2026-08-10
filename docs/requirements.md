# Functional and Non-Functional Requirements

Last audit: 2026-08-03

This document uses the canonical 100-UC set from `docs/Checklist/master-dev-checklist.md`. Each UC has exactly one primary owner and the set is grouped by current team member assignment: TL, VQ, QD, and AK.

## Legend

| Field | Meaning |
| --- | --- |
| Priority `P0` | Required for MVP/demo core flow |
| Priority `P1` | Important for the nearest complete release |
| Priority `P2` | Extension or future scope |
| Status `Implemented` | Already present in the repo |
| Status `Partial` | Partially implemented; missing flow/UI/hardening |
| Status `Planned` | Not yet fully implemented |

## Functional Requirements

| ID | Requirement | UC coverage | Priority | Status |
| --- | --- | --- | --- | --- |
| FR-AUTH-01 | The system must support OTP registration with any valid user email, account creation, audience role selection, blocking re-registration of active emails, and user activation. FPT/edu email is not mandatory because students may not receive a campus email account. | UC-031, UC-032 | P0 | Implemented |
| FR-AUTH-02 | The system must support login, token refresh, logout, forgot/reset password, profile, avatar, activity, and reputation APIs. | UC-033, UC-034, UC-035, UC-036, UC-037, UC-038, UC-039 | P0 | Implemented |
| FR-ROLE-01 | APIs must enforce role-based access for USER/STUDENT/LECTURER/STAFF/ADMIN; STAFF has lower privileges than ADMIN. | UC-001, UC-002, UC-062 | P0 | Implemented |
| FR-BOARD-01 | The public board must support listing, Vietnamese text search, single or multi-category filtering, location/type/status filters, sorting, pagination, a dedicated detail route, and share link. | UC-044, UC-046, UC-047, UC-069 | P0 | Implemented |
| FR-POST-01 | Logged-in users must be able to create/update/close/soft-delete LOST/FOUND posts with valid required data. | UC-040, UC-041, UC-042, UC-043 | P0 | Implemented |
| FR-MEDIA-01 | The system must upload, validate MIME/size/file signature, store, display, and delete item images, evidence images, and avatars. | UC-038, UC-048, UC-049, UC-050, UC-087 | P0 | Implemented for MVP |
| FR-AI-01 | The system must call Vision/OCR, store AI tags, suggest categories, let the user accept/edit a category suggestion, and provide AI metadata for matching. | UC-086, UC-087, UC-088, UC-091 | P1 | Implemented for MVP |
| FR-AI-02 | Future custom AI work should prepare a training pipeline with collection, labeling, anonymization, training, evaluation, and versioning before any custom model is claimed. Current repo has a data/export and lightweight local reranker foundation, not production custom AI. | UC-026, UC-027, UC-028, UC-029, UC-030 | P2 | Partial foundation |
| FR-AI-03 | The system must let the FOUND owner or Staff create and approve item-specific verification questions, keep expected answers hashed, pin the approved question version to each claim, limit answer attempts, and expose only advisory confidence to authorized reviewers. | UC-049, UC-052, UC-054, UC-089, UC-090, UC-092 | P1 | Implemented for MVP |
| FR-AI-04 | Staff/Admin must be able to view privacy-preserving campus LOST anomaly alerts and public related-post summaries based on time, area/building and category. Admin may enter a sourced campus event and run analysis; alerts require a configurable bounded threshold, baseline, dedupe, cooldown, explanation and human disposition. | UC-067, UC-073, UC-083, UC-084, UC-085 | P1 | Implemented for MVP |
| FR-AI-05 | Staff/Admin must be able to scan one image, a captured phone-camera frame, a prerecorded video frame, or a small image batch and receive ranked LOST candidates above a bounded configurable threshold from Google Vision metadata/OCR-assisted similarity. The scan must not store raw input by default or change post/claim state. | UC-059, UC-070, UC-076, UC-084, UC-086, UC-091 | P1 | Implemented for MVP |
| FR-MATCH-01 | The system must enqueue matching after create/update/upload, prefilter a bounded candidate set, compute tiered scores in a retryable worker, include image/OCR signals, save materialized results, batch-read suggestions, explain reasons, and allow manual re-run. | UC-068, UC-069, UC-070, UC-071, UC-072, UC-074, UC-075, UC-076 | P0 | Implemented |
| FR-NOTI-01 | The system must send matching notifications and support realtime notifications for chat, claims, and appointments; polling is only a fallback. | UC-073, UC-074, UC-083, UC-020 | P1 | Partial |
| FR-CLAIM-01 | Claimants must be able to submit claims for FOUND posts with ownership descriptions/evidence, and the system must prevent duplicate claims. | UC-049, UC-052, UC-053 | P0 | Implemented |
| FR-CLAIM-02 | The system must guard claim/evidence view permissions and handle request-info/accept/reject/cancel transitions based on valid states. | UC-003, UC-004, UC-005, UC-006, UC-007, UC-054 | P0 | Implemented |
| FR-CLAIM-03 | The system must analyze uploaded claim evidence, calculate an advisory review confidence percentage, and show that percentage to the finder/staff reviewer without automatically approving ownership. | UC-089, UC-090, UC-092 | P1 | Implemented |
| FR-HANDOVER-01 | Users must be able to view/select handover points; admins must manage handover points, campus map images, marker coordinates, and stored-item counts. | UC-008, UC-009, UC-010, UC-055, UC-056, UC-057, UC-058 | P0 | Implemented |
| FR-WAREHOUSE-01 | Staff/Admin must manage warehouse items, status changes, receive/store/return operations, storage logs, and policy-based retention deadlines. | UC-011, UC-012, UC-013, UC-014, UC-015, UC-059, UC-060, UC-061 | P0 | Implemented |
| FR-WAREHOUSE-02 | The system must handle overdue warehouse items through a dedicated disposition form, create disposal/donation/transfer records with notes, block processing while claims/appointments are active, and alert staff/admin. | UC-016, UC-017, UC-018, UC-019, UC-020 | P1 | Implemented for MVP |
| FR-APPT-01 | The system must support creating, accepting, rejecting, rescheduling/canceling, and completing return appointments after valid claim decisions; enforce one active appointment per claim; record the completion actor; and attach a protected handover/return proof image to accepted or completed appointments. | UC-021, UC-022, UC-023, UC-024 | P1 | Implemented |
| FR-RT-01 | The system must have Socket.IO JWT auth, accepted-claim room gating, realtime text/image messaging, protected image identifiers, seen/unread status, and user-scoped notifications. | UC-077, UC-078, UC-079, UC-080, UC-081, UC-082, UC-083 | P1 | Implemented for MVP |
| FR-ADMIN-01 | Admin/Staff APIs and web UI must support users, categories, locations, moderation, reports, dashboard overview/charts, CSV statistics export, system configuration, and config history. Config rollback and deeper analytics remain backlog. | UC-063, UC-064, UC-065, UC-066, UC-067, UC-084, UC-085 | P1 | Partial |
| FR-REP-01 | The system must compute reputation scores after valid business events, expose reputation score/history data to users, collect feedback after completed return appointments, and let Admin/Staff review negative return feedback. | UC-025, UC-039 | P2 | Implemented |
| FR-DEMO-01 | The system must have seed/demo data and demo accounts sufficient for presenting the core flow, plus migration smoke verification for a fresh database. | UC-031, UC-032, UC-040, UC-041, UC-059 | P1 | Implemented |
| FR-MOBILE-01 | Expo mobile MVP should cover auth/profile, board/post/upload/search, claim/handover/appointment/chat/notification, while native push/offline/device hardening remains backlog. | UC-093, UC-094, UC-095, UC-096, UC-097, UC-098, UC-099, UC-100 | P2 | Partial |

## Non-Functional Requirements

| ID | Requirement | UC coverage | Priority | Status |
| --- | --- | --- | --- | --- |
| NFR-SEC-01 | Passwords, refresh tokens, OTPs, and secret verification values must be hashed or protected; raw sensitive data must not be stored unnecessarily. | UC-031, UC-032, UC-033, UC-034, UC-035, UC-040, UC-049 | P0 | Implemented |
| NFR-SEC-02 | APIs requiring auth must validate JWT; missing permissions must return clear 401/403 responses; sensitive auth/post/claim/upload APIs must have basic rate limits. | UC-001, UC-002, UC-054, UC-062, UC-078 | P0 | Implemented |
| NFR-PRIV-01 | Claim evidence, contact info, private media, chat rooms, and notifications must only be returned to authorized users; public post contact info must be masked by default. | UC-049, UC-054, UC-079, UC-083, UC-089 | P0 | Implemented for MVP; production privacy policy remains future hardening |
| NFR-DATA-01 | Foreign keys and critical state fields for posts, claims, handover, warehouse, appointments, and chat must maintain data integrity. | UC-007, UC-015, UC-052, UC-059, UC-071, UC-079 | P0 | Implemented |
| NFR-PERF-01 | Board/search/matching/warehouse/notification queries must use indexes and pagination; text search uses MySQL FULLTEXT; matching uses a bounded SQL candidate prefilter before tag aggregation, background queue, materialized results, and batch suggestion reads. CI must record P50/P95/P99 and error rate for a bounded performance smoke. | UC-046, UC-047, UC-068, UC-072, UC-084 | P0 | Implemented for MVP scale; 10k/100k dataset benchmark remains hardening |
| NFR-RT-01 | Socket realtime must have JWT authentication and event revalidation, accepted-claim gating, room isolation, unread state, and no cross-room leaks. Multi-instance deployments must use the Redis adapter. | UC-077, UC-078, UC-079, UC-080, UC-082, UC-083 | P1 | Implemented; reconnect/soak matrix pending |
| NFR-OPS-01 | The API must provide request IDs, structured production logs, liveness, dependency-aware readiness, protected operational metrics and graceful shutdown. Release CI must build API/web containers and versioned source artifacts. | UC-067, UC-068, UC-077, UC-083, UC-084 | P1 | Implemented in code/CI; hosted staging and provider restore drill pending |
| NFR-AI-01 | AI/matching/evidence scoring serves only as decision support; it must not automatically approve claims, verify ownership, or return items. | UC-070, UC-076, UC-089, UC-090, UC-092 | P0 | Implemented |
| NFR-AI-02 | AI-assisted verification, Radar and Visual Hunt must be separately feature-flagged, role/rate limited and explainable. Raw Visual Hunt frames are ephemeral, face recognition is prohibited, private expected answers are never returned, and Radar aggregates must not expose claimant/evidence data. | UC-049, UC-054, UC-067, UC-078, UC-084, UC-089 | P0 | Implemented for MVP |
| NFR-AUDIT-01 | Sensitive operations such as claim transitions, role/status changes, warehouse processing, configuration, and evidence review must have log/audit trails. Moderation/export depth remains hardening. | UC-003, UC-004, UC-005, UC-006, UC-015, UC-066, UC-085 | P1 | Partial |

## Notes

- The canonical UC set currently has exactly 100 UCs: `UC-001` through `UC-100`.
- Do not create UCs above `UC-100` unless the master checklist is intentionally re-baselined.
- Do not assign UCs to Tran Nguyen Phong as he has left the team.
- Current MVP wording should use "Google Vision assisted OCR/tags" and "rule-based/hybrid matching", not "custom trained AI model".

## Private Assistance Requirements (2026-08-03)

| ID | Requirement | Related UC | Priority | Status |
| --- | --- | --- | --- | --- |
| FR-AI-06 | An authenticated user may request an ephemeral AI-assisted draft from a validated image. Provider/fallback status, redacted OCR, privacy warnings and explainable suggestions must be returned; no post is created automatically. | UC-019, UC-020, UC-070, UC-076 | P1 | Implemented |
| FR-POST-07 | A FOUND author may select `PRIVATE_DETAILS`; backend public serializers must hide exact location, original media, contact, OCR and identifying details while matching retains internal access. | UC-020, UC-022, UC-023, UC-076 | P0 | Implemented |
| FR-CLAIM-09 | Student/Lecturer users may manage owner-scoped private proofs and attach active proofs to editable claims. Private media must use authenticated proxy delivery and archive must preserve claim history. | UC-045, UC-048, UC-049, UC-054 | P0 | Implemented |
| FR-CLAIM-10 | Authorized reviewers may view an explainable Evidence Consistency Map; claimants receive only a general review state and no expected answer or reviewer-only signal. | UC-049, UC-052, UC-054, UC-089 | P0 | Implemented |

## User Recovery Assistance Requirements (2026-08-03)

| ID | Requirement | Related UC | Priority | Status |
| --- | --- | --- | --- | --- |
| FR-AI-07 | The owner of an active LOST post may answer, skip, undo and review item-specific Search Companion questions. Private answers may improve an advisory match preview, but only public-safe values may be applied to the post and no candidate details may be disclosed through the questions. | UC-040, UC-041, UC-068, UC-070, UC-076 | P1 | Implemented in code; database E2E pending clean migration |
| FR-POST-08 | An authenticated finder may explicitly capture or upload one image, receive advisory LOST candidates, edit a FOUND draft and publish it once. The scan image is ephemeral, weak matches remain hidden, publishing is idempotent and does not establish ownership or change a LOST post state. | UC-040, UC-041, UC-068, UC-070, UC-076, UC-086 | P1 | Implemented in code; database E2E pending clean migration |
| FR-RECOVERY-01 | Authorized participants may view a Recovery Timeline derived from persisted post, match, claim, evidence, appointment, warehouse and feedback events. The timeline must omit private notes and storage identifiers and provide only a human-workflow next action. | UC-021, UC-024, UC-045, UC-052, UC-054, UC-059, UC-073 | P1 | Implemented in code; database E2E pending clean migration |

Release note: migrations 035-036 must initialize their seven assistance flags as disabled. Enabling a flag requires checksum-clean migration smoke and the corresponding isolated database E2E.
