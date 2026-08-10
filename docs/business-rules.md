# Business Rules

Last audit: 2026-08-03

Business rules are grouped by major business area and trace back to the canonical 100-UC set in `docs/Checklist/master-dev-checklist.md`. Each UC has exactly one primary owner.

| BR | Business Rule | UC coverage | Status |
| --- | --- | --- | --- |
| BR-01 | Registration must go through a valid email OTP; FPT/edu email is not mandatory because students may not receive a campus email account; active emails cannot re-register; new users receive the `USER` role plus an audience role of `STUDENT` or `LECTURER`. | UC-031, UC-032 | Implemented |
| BR-02 | Passwords, refresh tokens, OTPs, and password resets must be handled securely: hashed, rotated/revoked, time-limited, and sessions revoked when necessary. | UC-033, UC-034, UC-035, UC-036 | Implemented |
| BR-03 | Users may only log in when their account is `ACTIVE`; APIs requiring authentication must validate JWT and role permissions. | UC-001, UC-002, UC-033, UC-062 | Implemented |
| BR-04 | `STAFF` has lower privileges than `ADMIN`; staff focuses on warehouse/handover operations and must not access sensitive admin functions. | UC-002, UC-059, UC-060, UC-062, UC-063, UC-066 | Partial |
| BR-05 | The public board must display only valid public posts that are not soft-deleted or hidden, and must support search, type/location/status filters, one or more categories, sorting, and pagination. | UC-044, UC-046, UC-047 | Implemented |
| BR-06 | Users must be logged in to create/edit/close/delete posts; each post belongs to exactly one type: `LOST` or `FOUND`. | UC-040, UC-041, UC-042, UC-043 | Implemented |
| BR-07 | Posts require title, description, category, contact info, a non-future incident time, and a valid location. | UC-040, UC-041 | Implemented |
| BR-08 | `LOST` posts should include ownership verification details; `FOUND` posts must specify where the item is currently held or an active handover point. | UC-040, UC-041, UC-055, UC-058 | Implemented |
| BR-09 | Media uploads must conform to format/size/count limits and pass JPEG/PNG/WEBP file-signature validation; item images and private evidence images must be separated. Only the claimant may upload claim evidence, and only while the claim is `PENDING` or `NEED_MORE_INFO`; owner/Staff/Admin may review but not upload on the claimant's behalf. | UC-048, UC-049, UC-050, UC-051, UC-087 | Implemented for MVP |
| BR-10 | Claim evidence, private media, contact info, chat rooms, and notifications must only be visible to authorized users. Protected image proxying accepts only the configured Cloudinary HTTPS source; chat history/socket payloads expose only a server-validated public ID, never a raw private storage URL. | UC-049, UC-054, UC-078, UC-079, UC-083 | Implemented for MVP |
| BR-11 | AI Vision/OCR/matching and evidence scoring serve only as suggestions; they must not automatically determine ownership, mark an item as returned, or authorize item handover. | UC-070, UC-076, UC-089, UC-090, UC-092 | Implemented |
| BR-12 | Post create/update/upload must enqueue retryable background matching. Matching uses configurable weights/threshold tiers and image/OCR signals, SQL candidate prefiltering, batch suggestion reads, materialized results, and explainable reasons; processing errors must not fail post creation. | UC-068, UC-069, UC-070, UC-071, UC-072, UC-073, UC-076 | Implemented |
| BR-13 | Matches should be checked on login/web open and at a reasonable interval such as 10 minutes; dismissed popups must not immediately reopen. | UC-073, UC-074, UC-083 | Implemented |
| BR-14 | Claims apply only to eligible `FOUND` posts; owners cannot claim their own posts; each user may claim a given post only once. | UC-052, UC-053 | Implemented |
| BR-15 | Claim transitions must follow valid state rules and use locks/audit to prevent race conditions. | UC-003, UC-004, UC-005, UC-006, UC-007 | Implemented |
| BR-16 | Evidence review must compare claim evidence, descriptions, time, location, private signals, AI/OCR signals, and matching data before showing an advisory review confidence percentage. | UC-089, UC-090, UC-092 | Implemented |
| BR-17 | Handover points must exist, have active status, map markers, and stored-item counts so users/admins can clearly locate them. | UC-008, UC-009, UC-010, UC-055, UC-056, UC-057, UC-058 | Implemented |
| BR-18 | Warehouse items may only be linked to valid found-item flows; all important status changes must use standard enums, follow the warehouse state machine, and write audit logs. | UC-011, UC-012, UC-013, UC-014, UC-015, UC-059, UC-060 | Implemented |
| BR-19 | Each warehouse item must have a retention deadline; retention policy depends on item class such as document/card, electronics/high-value, general item, or perishable/hygiene/unsafe item. | UC-016, UC-017, UC-061 | Implemented |
| BR-20 | Overdue items must be processed through an explicit disposition form: disposal order, donation batch, transfer, or extension depending on campus policy. Terminal disposition cannot use the generic status endpoint and is blocked while related claims or appointments are active. | UC-018, UC-019, UC-020 | Implemented for MVP |
| BR-21 | Appointments may only proceed after an accepted claim, with controlled create/accept/reject/reschedule/cancel/complete states. A claim may have at most one active appointment (`PENDING`, `ACCEPTED`, or `RESCHEDULED`), and completion/storage audit must record the actual acting user. | UC-021, UC-022, UC-023, UC-024 | Implemented |
| BR-22 | Socket.IO must authenticate via JWT, isolate rooms by claim, and not leak events to unrelated users. | UC-077, UC-078, UC-079 | Implemented |
| BR-23 | Realtime chat opens only when the claim is `ACCEPTED` and the actor is claimant, post owner, Staff, or Admin. Text/image messages are persisted and broadcast only to the claim room; image payloads cannot provide arbitrary URLs. Seen/unread state is reflected in the web UI. | UC-079, UC-080, UC-081, UC-082 | Implemented |
| BR-24 | Realtime notifications belong to individual users and may cover matching, chat, claims, appointments, and warehouse alerts. | UC-020, UC-073, UC-083 | Partial |
| BR-25 | Admins manage users, roles, categories, campus locations, handover points, moderation, reports, dashboard metrics, export, and configuration. | UC-056, UC-063, UC-064, UC-065, UC-066, UC-067, UC-084, UC-085 | Partial |
| BR-26 | Reputation changes only after valid business events and is visible to users through score/history; accepted or completed appointments may store a handover proof image, and return feedback can be collected after completed appointments and reviewed by Admin/Staff. Admin-flagged negative feedback may affect reputation, but feedback and reputation must not automatically determine item returns. | UC-025, UC-039 | Implemented |
| BR-27 | Future custom AI training data must be collected, labeled, anonymized, trained, evaluated, and versioned before any custom model is trusted or advertised. The current repo has foundation scripts/data capture only, not production custom AI. | UC-026, UC-027, UC-028, UC-029, UC-030 | Partial foundation |
| BR-28 | Expo mobile MVP must share auth, validation, privacy, handover, appointment, chat, and notification contracts with the web/backend; native push/offline hardening remains backlog. | UC-093, UC-094, UC-095, UC-096, UC-097, UC-098, UC-099, UC-100 | Partial |
| BR-29 | Demo data must include accounts and data sufficient for core demo purposes but must not contain real sensitive information. | UC-031, UC-032, UC-040, UC-041, UC-059 | Implemented |
| BR-30 | Testing/hardening must cover claim transitions, warehouse lifecycle, matching thresholds, accepted-claim chat gating, evidence privacy, release checks, and migration from a blank DB. CI must use an isolated MySQL service rather than the shared demo database. | UC-007, UC-015, UC-054, UC-071, UC-078, UC-089 | Implemented for core smoke; browser/load depth remains future work |
| BR-31 | Verification questions must be based on private item attributes, reviewed by the FOUND owner or Staff, and pinned to the claim. Expected answers are bcrypt-hashed, claimants never receive correctness feedback, attempts are limited, and an unanswered required question blocks claim acceptance while the feature is enabled. Answer persistence must lock and recheck claimant and claim status in the same transaction. | UC-049, UC-052, UC-054, UC-089, UC-090, UC-092 | Implemented for MVP |
| BR-32 | Campus Radar may analyze only non-personal LOST aggregates. An event or weather explanation requires a real, recorded source; alerts use baseline comparison, sliding windows, dedupe and cooldown and always require Staff/Admin acknowledgement or disposition. | UC-067, UC-073, UC-083, UC-084, UC-085 | Implemented for MVP |
| BR-33 | Visual Hunt is a Staff/Admin decision-support tool. It analyzes an explicitly captured/uploaded frame or bounded image batch, returns candidates with matched signals, and must never auto-match, resolve, return or notify on low confidence. Raw input is not persisted and face recognition is prohibited. | UC-059, UC-070, UC-076, UC-084, UC-086, UC-091 | Implemented for MVP |
| BR-34 | The three AI-assisted tools must have independent kill switches. Disabling verification questions removes their score contribution; disabling Radar or Visual Hunt blocks their backend endpoints as well as hiding their UI. Admin-editable Radar and Visual Hunt thresholds must be rejected outside their documented effective ranges, including rollback. | UC-062, UC-066, UC-070, UC-084, UC-085 | Implemented |

## Notes

- The canonical UC set currently has exactly 100 UCs: `UC-001` through `UC-100`.
- Do not assign UCs to Tran Nguyen Phong as he has left the team.
- If a minor rule arises, add it to an existing BR group instead of creating a new micro-UC.
- Current MVP uses Google Vision assisted OCR/tags plus rule-based/hybrid matching with tiered score explanations; custom AI training and native mobile remain planned scope.

## Private Assistance Rules (2026-08-03)

| ID | Rule | Related UC | Status |
| --- | --- | --- | --- |
| BR-35 | Private Proof Vault records belong to one user. Secrets are hash-only, raw storage identifiers are never returned, and claim participants/reviewers access media only through an authenticated proxy. | UC-045, UC-048, UC-049, UC-054 | Implemented |
| BR-36 | Proof attachment is claimant-only while a claim is editable. Attach/archive operations lock claim/proof rows; archive never deletes the claim snapshot or history. | UC-048, UC-049, UC-054 | Implemented |
| BR-37 | `PRIVATE_DETAILS` applies only to FOUND posts. Public serializers and matching notifications must not disclose exact location, original media, contact, OCR or identifying text; owner/Staff/Admin retain authorized access. | UC-020, UC-022, UC-023, UC-076 | Implemented |
| BR-38 | AI-assisted draft and Evidence Consistency Map are advisory. Unsafe input is rejected, provider failure is reported honestly, claimant data is role-redacted, and human decision is mandatory. | UC-049, UC-054, UC-070, UC-076, UC-089 | Implemented |

## User Recovery Assistance Rules (2026-08-03)

| ID | Rule | Related UC | Status |
| --- | --- | --- | --- |
| BR-39 | Search Companion is owner-only and applies only to active LOST posts. Questions must be generated from the LOST item context, not from hidden FOUND details. Serial input is reduced to its final four characters, private answers remain outside the public post, and recalculation never writes match results or sends notifications. | UC-040, UC-041, UC-068, UC-070, UC-076 | Implemented in code; database E2E pending |
| BR-40 | Finder Quick Scan requires an explicit user capture/upload. Raw frames are not persisted, Safe Search and media validation run before analysis, only LOST candidates at or above the suggestion threshold are disclosed, and publish uses a locked idempotent transaction. Only analyzed/draft-ready sessions may prepare a draft; published/expired sessions are terminal. A scan must never auto-match, auto-resolve or prove ownership. | UC-040, UC-041, UC-068, UC-070, UC-076, UC-086 | Implemented in code; database E2E pending |
| BR-41 | Recovery Timeline is a derived read model, not a second workflow state machine. Only the post owner, related claimant and authorized Staff/Admin may read it; claimant visibility is limited to the relevant claim and the response excludes evidence URLs, storage identifiers, private answers and internal notes. | UC-021, UC-024, UC-045, UC-052, UC-054, UC-059, UC-073 | Implemented in code; database E2E pending |

Release rule: migrations 035-036 initialize new assistance flags as disabled. Human-reviewed isolated smoke/E2E evidence is required before enabling them on a demo or pilot schema.
