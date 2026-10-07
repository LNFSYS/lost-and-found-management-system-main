# 3. Business Use Case Catalogue - FPTU Lost & Found System (LNFS)

Current statuses retain the appointment, peer handover, audit and item-journey follow-up on 6 October 2026, originally based on `dev@195b134`, plus the local 7 October matching notification follow-up. See [the implementation and rollout record](../runbooks/appointment-journey-rollout.md). The preceding [71-row status review](../audits/uc-status-review-2026-10-06.md) remains a historical snapshot; its earlier 97 Implemented goals were retained, not newly re-certified. General Staff escalation, counter-proposal/rescheduling, full disposition screens and delivery-channel coverage remain separate gaps. Migrations 061/062/063 and the 16 warehouse-media transfers retain their dated rollout evidence; this matching follow-up introduces no migration. Candidate CI/deployment, non-warehouse legacy media and manual acceptance remain separate. See [the database rollout record](../runbooks/database-warehouse-recovery.md).

- **Implemented:** 129 use cases
- **Partial:** 21 use cases
- **Planned:** 18 use cases
- **Total:** 168 business use cases

Statuses describe implementation, not release acceptance: **Implemented** means an active authorized workflow covers the stated actor goal (API and Web for user-facing goals, worker for scheduler goals) with relevant regression evidence. **Partial** means a meaningful runtime slice exists but some stated actor/behavior/UI scope is missing. **Planned** means no active workflow for the goal; schema, event writers or a differently authorized workflow alone do not complete it. Provider/manual UAT, policy approval, CI and deployment are recorded separately even for Implemented goals. No new UC ID or product goal is introduced by this status correction.

`Claimant` means the LOST owner seeking the item. `Finder` means the FOUND owner or the actual non-owner contacting a LOST post through an approved photo-backed conversation; the latter does not need to publish a FOUND post. These are workflow roles, not proof of ownership or live possession. Legacy participant labels are resolved from actual post ownership and authorized participants without rewriting history. PWA, mobile browser, and a future native application are delivery channels, not business use cases, and are therefore excluded from this catalogue.

## 3.1 Historical Source-Control Ownership Audit

The retained 21 September snapshot (not a fresh author audit) contains 73 commits across all references after normalizing author identities: Quan 55, Khoa 12, Dat 5, and Luong 1. Commit count is included only as an audit fact; ownership below is based on changed business modules, tests, routes, and UI rather than raw commit volume.

| Contributor | Completed UC evidence already integrated into `dev` | Primary commits |
| --- | --- | --- |
| Quan | Authentication; Web post workflows; matching and Gemini draft; handover points; cross-cutting security, database, Cloudinary, CI, and Clean Architecture hardening across the implemented modules. | `1cd77ce`, `a60d420`, `4d6841b`, `d91ac91`, `489cdc9`, `d5d50ea`, `1f18578`, `949cdc1` |
| Khoa | Profile/activity baseline; category/area/building administration; warehouse operations; claim/private-room/evidence/notification flow; moderation and dashboard baseline. | `97c9c72`, `a83b9eb`, `6e3491b`, `fb0d877`, `51dfb3a` |
| Dat | Post/private-media API baseline; user and role administration; system configuration; return feedback and reputation. | `a630fad`, `89cc72b`, `696afef`, `c0be32f` |
| Luong | The retained September audit found guided-question work on `origin/feat/lnfs-53`; that historical commit was not an ancestor of the audited dev snapshot. Current guided verification and the local post-intake Staff verification are recorded separately below; the September attribution is not a current runtime-status claim. | Historical `6c6fe92`; local custody verification `497e846` |

### Remaining Work Allocation

Completed UC work above is not reassigned. The 39 currently Partial/Planned UCs retain their existing assignees; newly implemented rows are removed from the remaining list, not reassigned. UC-168 stays with Khoa for complete delivery preferences. Local implementation attribution is not a new author/commit audit.

| Assignee | Remaining UC IDs | Count | Main responsibility |
| --- | --- | ---: | --- |
| Luong | UC-110 to UC-118; UC-129, UC-132 | 11 | Confidence support, general Staff escalation, multiple-claimant comparison/reservation and counter-proposal/rescheduling. |
| Quan | UC-097; UC-101 to UC-105; UC-164 | 7 | New-match notifications/model operations and full authorized claim-history scope. |
| Khoa | UC-119, UC-123, UC-125, UC-142, UC-168 | 5 | Immediate Web realtime, complete claim/appointment producers, intake scheduling and delivery preferences. |
| Dat | UC-147 to UC-162 | 16 | Custody notifications, overdue handling, legal holds, disposition orders, evidence, and donation campaigns. |
| **Total** | **Partial/Planned rows only** | **39** | **All currently Partial or Planned business UCs are assigned once.** |

### 3.2 Authentication & Authorization

**Commit evidence:** Quan implemented the authentication/session baseline in `1cd77ce`; Khoa added profile/activity support in `51dfb3a`; Quan hardened session and Cloudinary avatar handling in `c023ab6`, `70e7965`, and later refactors.

**Remaining work:** None in the current business catalogue.

| ID | Use Case | Actors | Use Case Description | Status |
| --- | --- | --- | --- | --- |
| UC-001 | Request registration OTP | Guest | Send a one-time registration code to the supplied email address. | Implemented |
| UC-002 | Register an account | Guest | Verify the registration OTP, create the user account, assign the base and audience roles, and start a session. | Implemented |
| UC-003 | Log in with email and password | Guest | Authenticate an active account and create an access-token and refresh-token session. | Implemented |
| UC-004 | Refresh the login session | Authenticated User | Rotate the current refresh token and issue a new access token. | Implemented |
| UC-005 | Log out | Authenticated User | Revoke the current refresh token and clear the authentication cookie. | Implemented |
| UC-006 | Request password reset | Guest | Send a password-reset code to the registered email without exposing whether the account exists. | Implemented |
| UC-007 | Reset password | Guest | Verify the reset code, set a new password, and invalidate existing sessions. | Implemented |
| UC-008 | View current account | Authenticated User | Retrieve the signed-in user's identity, status, and assigned roles. | Implemented |
| UC-009 | Update personal profile | Authenticated User | Update the signed-in user's supported personal information. | Implemented |
| UC-010 | Update profile avatar | Authenticated User | Validate and upload a new avatar, replace its stored metadata, and remove the previous asset when possible. | Implemented |
| UC-011 | View protected profile avatar | Authenticated User | Retrieve the signed-in user's avatar through the authenticated media endpoint. | Implemented |
| UC-012 | View personal activity and reputation | Authenticated User | View own post activity, return feedback, and reputation summary. | Implemented |

### 3.3 Public Board & LOST/FOUND Post Management

**Commit evidence:** Dat implemented the post and private-media API baseline in `a630fad`; Quan implemented the Web board, post form, details, matching integration, and later Cloudinary reconciliation in `a60d420`, `4d6841b`, and `949cdc1`.

**Remaining work:** None in the current business catalogue.

| ID | Use Case | Actors | Use Case Description | Status |
| --- | --- | --- | --- | --- |
| UC-013 | Browse the LOST/FOUND board | Guest / Authenticated User | View active LOST and FOUND posts that are allowed on the public board. | Implemented |
| UC-014 | Search and filter posts | Guest / Authenticated User | Search, filter, sort, and paginate board posts by supported criteria. | Implemented |
| UC-015 | View post details | Guest / Authenticated User | Open one post and view the information permitted for the current viewer. | Implemented |
| UC-016 | View post form reference data | Authenticated User | Retrieve categories, campus locations, handover points, and public validation configuration used by the post form. | Implemented |
| UC-018 | Create a LOST post | Authenticated User | Create a validated LOST report with category, incident time, campus location, contact data, and description. | Implemented |
| UC-019 | Create a FOUND post | Authenticated User | Create a validated FOUND report with category, incident time, storage or handover location, contact data, and description. | Implemented |
| UC-020 | View my posts | Authenticated User | List and filter posts owned by the signed-in user. | Implemented |
| UC-021 | Update my post | Post Owner | Edit an owned post while preserving ownership and business validation rules. | Implemented |
| UC-022 | Close or remove my post | Post Owner | Soft-delete an eligible owned post with atomic custody/item, active case, appointment, dispute and legal-hold checks; retain completed operational history. | Implemented |
| UC-023 | Upload post image | Post Owner | Validate and attach an image to an owned post through protected media storage. | Implemented |
| UC-024 | View protected post media | Guest / Authenticated User | Retrieve post media through the API after applying the post's visibility and privacy rules. | Implemented |
| UC-025 | Delete post image | Post Owner | Remove an image from an owned post and delete the corresponding stored asset when possible. | Implemented |

### 3.4 Matching & Recommendations

**Commit evidence:** Quan implemented and hardened persisted matching, scoring, access control, and explanations in `4d6841b` and `489cdc9`.

**Runtime evidence:** UC-098 to UC-100 are Implemented: actor-scoped feedback/dismissal, Web controls, paginated HTTP results and a fenced, bounded refresh worker are active on `dev`. Migration 060 is applied on Aiven; historical receipts are in [matching review](../audits/matching-feedback-review.md). Source-owner filtering before pagination has owner/Staff/Admin regressions. Exact baseline CI and remaining manual/operational acceptance are separated in [the status review](../audits/uc-status-review-2026-10-06.md). On 7 October, UC-097 moves to Partial: local new-match producer, transactional email and Web popup exist, but candidate CI, deployment and matching inbox acceptance remain unverified. See [matching notification rules](../workflows/matching-notification-rules.md). No new UC ID is introduced.

| ID | Use Case | Actors | Use Case Description | Status |
| --- | --- | --- | --- | --- |
| UC-026 | View matching suggestions | Post Owner / Staff / Admin | View active LOST-FOUND candidates calculated for an accessible source post. | Implemented |
| UC-027 | Recalculate matching suggestions | Post Owner / Staff / Admin | Request a rate-limited recalculation of matching candidates for an accessible post. | Implemented |
| UC-028 | View matching explanation | Post Owner / Staff / Admin | Review the overall tier, component scores, and redacted reasons behind a matching suggestion. | Implemented |
| UC-029 | Generate matches after post changes | System | Run matching on a best-effort basis after a post is created or updated without rolling back the valid post. | Implemented |
| UC-030 | Calculate matching score | System | Compare LOST and FOUND posts using normalized text, category, location, time, image tags, and safe OCR signals. | Implemented |
| UC-031 | Store active match results | System | Persist calculated active LOST-FOUND results while retaining permitted inactive saved history; deleted/hidden/private candidates remain guarded. | Implemented |
| UC-097 | Notify owner about a new match | System, Post Owner | Notify both active post owners once when a calculated pair reaches 60%; honor preferences and recheck open posts before email. | Partial |
| UC-098 | Dismiss a match suggestion | Post Owner | Hide a suggestion that the owner has reviewed and determined is not relevant. Dismissal is scoped to the actor and source post and does not resurface during later refreshes. | Implemented |
| UC-099 | Submit match feedback | Post Owner | Mark a suggestion once as useful, irrelevant, or incorrect using an idempotent correlation key; feedback remains separate from ownership and workflow state. | Implemented |
| UC-100 | Refresh matches periodically | Scheduler | Recalculate eligible active LOST and FOUND candidates with just-in-time fenced leases, heartbeat, bounded retries and graceful shutdown, without deciding ownership. | Implemented |

### 3.5 Matching Model & AI Operations

**Commit evidence:** Quan implemented the Gemini-assisted editable post draft in `4d6841b`. No commit proves a custom trained matching model or approved training lifecycle.

**Remaining work:** UC-101 to UC-105 are assigned to Quan.

| ID | Use Case | Actors | Use Case Description | Status |
| --- | --- | --- | --- | --- |
| UC-017 | Analyze item images with Gemini | Authenticated User | Use the image upload/analysis controls before manual post fields to request an editable draft from visible image content. Analysis runs only on explicit request; the user must review and correct suggestions because accuracy is not guaranteed. | Implemented |
| UC-101 | Collect eligible matching examples | System, Admin | Collect reviewed matching outcomes that satisfy privacy and quality rules for training preparation. | Planned |
| UC-102 | Label matching outcomes | Admin, Staff | Label reviewed candidate pairs as positive, negative, or uncertain training examples. | Planned |
| UC-103 | Anonymize matching training data | System | Remove or mask personal and sensitive information before examples are used for model training. | Planned |
| UC-104 | Train a custom matching model | Admin, System | Start a controlled training job from an approved and versioned training dataset. | Planned |
| UC-105 | Evaluate and version a matching model | Admin, System | Compare model metrics, record the result, and activate only an approved model version. | Planned |

### 3.6 Claims & Ownership Verification

**Commit evidence:** Khoa implemented the claim lifecycle and participant-isolated rooms in `6e3491b` and `fb0d877`; Quan hardened claim integrity and ported the active runtime to modular Clean Architecture. Luong's historical guided-question work is recorded in `6c6fe92`; that commit's ancestry does not mean the current guided templates/human-decision runtime is absent. Local `497e846` adds explicit Staff verification after physical intake without rewriting Finder identity or earlier decisions.

**Remaining work:** UC-110 to UC-118 remain assigned to Luong. UC-106 to UC-109 have active participant question/answer/evidence workflows. UC-114 is Partial: post-intake Staff approval exists, but general escalation rejection/more-information handling is absent. No automatic ownership decision is made on intake; manual role/privacy acceptance is still a separate release gate.

| ID | Use Case | Actors | Use Case Description | Status |
| --- | --- | --- | --- | --- |
| UC-032 | View my claim requests | Claimant / Finder | List claim requests in which the signed-in user is an authorized participant. | Implemented |
| UC-033 | View claim request details | Claimant / Finder | View one authorized claim, its current state, participants, related posts, and allowed actions. | Implemented |
| UC-034 | Create a claim request | Claimant / Finder | Request an exchange for an eligible post or LOST-FOUND match while preventing self-claims and duplicates. Direct non-owner LOST contact requires server-approved photo similarity at least 50% and analysis confidence at least 60%; approval opens the conversation and attaches the checked image without sending the typed draft or verifying ownership. | Implemented |
| UC-035 | Accept a claim request | Finder | Accept the claimant's request, grant participant consent, and open the private exchange room. | Implemented |
| UC-036 | Request more claim information | Finder | Ask the claimant for more information and open the private room for direct clarification. | Implemented |
| UC-037 | Decline a claim request | Finder | Reject a pending claim request and store the decision and optional reason in the audit trail. | Implemented |
| UC-038 | Withdraw a claim request | Claimant | Cancel an owned claim when its current state permits withdrawal. | Implemented |
| UC-039 | View private claim rooms | Claimant / Finder | List private rooms belonging to claims in which the signed-in user is a participant. | Implemented |
| UC-040 | Open a private claim room | Claimant / Finder | Enter an authorized consented room with actual ownership roles. Direct non-owner LOST contact enforces the server-approved 50% photo/60% confidence gate on creation and further gated writes. Reads cannot approve pending legacy consent; communication approval never verifies ownership. The receiving LOST owner sees a safety reminder to request current photos and avoid payments/sensitive disclosures. | Implemented |
| UC-106 | View guided verification questions | Finder | View safe templates/custom prompts without expected answers. In photo-approved LOST contact, only the Finder sees three suggestions derived from the fresh image-analysis response; ordinary reads/replays do not generate fallback suggestions. The panel collapses after use and can reopen. | Implemented |
| UC-107 | Ask a guided verification question | Finder | Send a structured verification question through the active question modal, or click a photo-analysis suggestion to send ordinary private text while preserving the typed draft. Suggested text does not create an answered assignment or verification score; failed sends reopen for idempotent retry. | Implemented |
| UC-108 | Answer a guided verification question | Claimant | Reply through the private question-message composer or authorized answer API. Persist answer progress without exposing expected-answer hashes; raw answers stay in the participant-protected conversation and human review decides ownership. | Implemented |
| UC-109 | Review private claim evidence | Finder | Review claimant answers in the authorized conversation and protected evidence previews before explicitly deciding the next claim state. | Implemented |
| UC-110 | Calculate verification confidence | System | Calculate a support score from answered questions and evidence without making the ownership decision. | Planned |
| UC-111 | Escalate a claim for staff support | Claimant, Finder | Escalate an unresolved, suspicious, or disputed verification case with a required reason. Finder custody escalation and participant moderation reports exist; a general two-participant Staff support-case workflow remains missing. | Partial |
| UC-112 | List escalated claims | Staff, Admin | View claims escalated for staff support, filtered by state, age, or assigned handler. | Planned |
| UC-113 | View an escalated claim | Staff, Admin | View the permitted claim context, evidence summary, messages, and audit history for an escalated case. Custody context and item-bound return-claim summaries exist; general escalated-case detail and authorized conversation/audit access remain missing. | Partial |
| UC-114 | Record an escalation decision | Staff, Admin | Explicitly verify a consented claimant after physical intake of an eligible FOUND or the exact photo-backed LOST custody item, with an in-person rationale, case/hold checks and independent Staff audit. Preserve Finder identity and legacy history; intake/photo approval does not decide ownership. General escalation rejection and more-information decisions remain pending. | Partial |
| UC-115 | View claimants for a found item | Finder | View all separate claim requests received for one FOUND post without merging their private evidence. Participant claims are listed independently; a source-item claimant list/filter remains missing. | Partial |
| UC-116 | Compare claimant verification results | Finder | Compare status and verification progress across claimants while keeping each private conversation isolated. Per-room status/answer progress exists; the cross-claim comparison view remains missing. | Partial |
| UC-117 | Reserve an item for one claimant | Finder | Temporarily reserve the item for one accepted claimant before arranging a meetup. | Planned |
| UC-118 | Release reservation and reopen another claim | Finder | Release a reservation after cancellation or no-show and continue with another eligible claimant. | Planned |

### 3.7 Private Communication, Evidence & Notifications

**Commit evidence:** Khoa implemented private text rooms, protected evidence, and in-app claim notifications in `6e3491b` and `fb0d877`; Quan added cursor, idempotency, privacy, reliability, and architecture hardening.

**Remaining work:** UC-119, UC-123 and UC-125 are assigned to Khoa. UC-120 to UC-122 and UC-124 have active runtime for their stated goals.

**Runtime follow-up - 6 October:** UC-120 has an authenticated multipart image-message endpoint and Web composer/preview, participant-protected delivery, stable retry keys and accompanying PHOTO evidence. Both consented active participants can use it; the approved LOST photo is also an IMAGE message. UC-121 reads persisted counterpart unread counts; UC-122 marks counterpart messages READ on an authorized room read. UC-124 produces privacy-safe new-message notifications. These are Implemented actor goals, not production/provider/manual acceptance. UC-119 stays Partial because Web uses polling, not an immediate SSE message subscriber; push and block are separate gaps.

| ID | Use Case | Actors | Use Case Description | Status |
| --- | --- | --- | --- | --- |
| UC-041 | View direct messages | Claimant / Finder | Retrieve cursor-paginated messages from an authorized private claim room; render private IMAGE messages through participant-protected media access and preview, never raw storage references. | Implemented |
| UC-042 | Send a direct message | Claimant / Finder | Send an idempotent private text message. For non-owner LOST senders the server also enforces the contact-photo gate, including legacy rooms. | Implemented |
| UC-043 | View claim evidence | Claimant / Finder | List private evidence belonging to an authorized claim room. | Implemented |
| UC-044 | Upload claim evidence | Claimant / Finder | Both consented active participants may validate/upload private PHOTO evidence in an authorized claim room. The composer evidence action opens/focuses its upload form; it is distinct from sending an IMAGE chat message. Evidence alone does not verify ownership. | Implemented |
| UC-045 | View protected claim evidence | Claimant / Finder | Retrieve an evidence image only after participant and room authorization. | Implemented |
| UC-046 | View notifications | Authenticated User | View the signed-in user's notification feed and unread total. | Implemented |
| UC-047 | Mark a notification as read | Authenticated User | Mark one owned notification as read. | Implemented |
| UC-048 | Mark all notifications as read | Authenticated User | Clear the unread state of all notifications owned by the signed-in user. | Implemented |
| UC-119 | Receive new private messages immediately | Claimant, Finder | Receive newly sent conversation messages without manually refreshing the page. Server SSE exists; Web currently polls the room every ten seconds, so immediate event-driven Web delivery is incomplete. | Partial |
| UC-120 | Send an image in a private conversation | Claimant, Finder | Select/preview an image and send it inside a consented active private room through the authenticated multipart endpoint. Persist IMAGE and protected PHOTO evidence atomically; replay the same request without duplication and prevent late callbacks from altering another room. | Implemented |
| UC-121 | View unread conversation count | Claimant, Finder | View persisted counterpart unread-message counts and the unread filter for authorized private conversations. | Implemented |
| UC-122 | Mark a conversation as read | Claimant, Finder | An authorized room-message read marks counterpart messages READ with a read timestamp for the current participant and cancels delayed-unread room email. | Implemented |
| UC-123 | Receive claim status notifications | Claimant, Finder | Receive notifications when a claim is created, updated, accepted, declined, withdrawn, or escalated. | Partial |
| UC-124 | Receive new-message notifications | Claimant, Finder | Receive a persisted, deduplicated privacy-safe notification when the counterpart sends a private message; optional email and post-commit realtime delivery do not expose its content. | Implemented |
| UC-125 | Receive appointment and handover notifications | Claimant, Finder | Transactional in-app/email outbox covers proposals, acceptance, rejection, cancellation, reminders, no-show and peer outcomes. Counter-proposal/rescheduling producers and full delivery-channel coverage remain missing. | Partial |

### 3.8 Handover, Appointment & Direct Return

**Local runtime evidence:** the appointments module/routes and Web list/detail/proposal/actions implement the goals below with authorized roles, optimistic versions, request-key replay and immutable events. Reminders reuse the existing transactional outbox. Unit, HTTP, isolated SQL and browser evidence are recorded in [the rollout runbook](../runbooks/appointment-journey-rollout.md). This is uncommitted local code, not deployed acceptance; Aiven still requires migration 063.

**Remaining work:** UC-129 and UC-132 remain assigned to Luong. Neither cancelling then creating another attempt nor rejecting a proposal is an implementation of negotiated rescheduling/counter-proposal.

**Proposal versus appointment:** The top-of-chat Finder decision can explicitly propose a communication-only meetup after LOST photo approval without minimum verification answers. That decision alone does not book time/place or authorize warehouse release. The separate appointment link opens a real proposal with an active handover point and future time; the counterpart must accept. Ordinary FOUND verification retains its answer gate. Completion still needs actual physical checks and both confirmations; pending disputes, competing claims, inactive participants or custody block it. UC-140 has appointment discovery and an in-workflow HANDOVER report link.

| ID | Use Case | Actors | Use Case Description | Status |
| --- | --- | --- | --- | --- |
| UC-126 | List my appointments | Claimant, Finder | View participant-scoped paginated appointment cards with public item photo (when available), title, schedule, place and status through the calendar navigation or conversation link. Private evidence is not used as a thumbnail. | Implemented |
| UC-127 | View appointment detail | Claimant, Finder | View and enlarge the public item photo when available, alongside place, time, participant responses, state and immutable attempt history. Missing/private images use an explicit placeholder. Legacy appointments without workflow metadata are explicitly read-only. | Implemented |
| UC-128 | Propose a meetup appointment | Claimant, Finder | Propose a future time and active handover point for an eligible accepted conversation, without treating a communication-only photo proposal as ownership proof. | Implemented |
| UC-129 | Counter-propose an appointment | Claimant, Finder | Suggest a different place or time instead of accepting the current proposal. | Planned |
| UC-130 | Accept an appointment proposal | Claimant, Finder | The counterpart accepts an eligible pending future proposal; the proposer cannot accept their own proposal. | Implemented |
| UC-131 | Decline an appointment proposal | Claimant, Finder | The counterpart declines a pending proposal while preserving claim and appointment history. | Implemented |
| UC-132 | Reschedule a confirmed appointment | Claimant, Finder | Propose and mutually confirm a replacement time or handover point. | Planned |
| UC-133 | Cancel an appointment | Claimant, Finder | Cancel with a 3-500 character reason and notify both parties before physical acknowledgement, or after both explicitly report negative handover. A one-sided mismatch/positive acknowledgement cannot be silently cancelled. | Implemented |
| UC-134 | Send appointment reminders | Scheduler | Queue one reminder per participant before an accepted appointment, using configured lead time and the existing optional email outbox/preferences. Provider delivery is best effort, not guaranteed arrival before the meeting. | Implemented |
| UC-135 | Record an appointment no-show | Claimant, Finder | After 15 minutes, record the other party's absence when neither has acknowledged handover; end the attempt without resolving the item or automatically penalizing anyone. | Implemented |
| UC-136 | Confirm item handed over | Finder | Explicitly confirm physical checking and handover after the accepted meeting time; Finder alone cannot complete the return. | Implemented |
| UC-137 | Confirm item received | Claimant | Explicitly confirm physical checking and receipt after the accepted meeting time. | Implemented |
| UC-138 | Hold conflicting handover confirmations | System | Preserve pending/mismatched responses and history without returning the item; corrections require explicit review, and open reports still block completion. | Implemented |
| UC-139 | Complete a direct return | System | Atomically complete the appointment and resolve related posts only with both valid positive physical confirmations; enable existing participant feedback. | Implemented |
| UC-140 | Report a handover issue | Claimant, Finder | Open an authorized HANDOVER report from appointment detail for dispute, wrong item, unsafe meeting or failed handover. | Implemented |

### 3.9 Warehouse Intake, Custody & Transfer

**Commit evidence:** Quan implemented public handover-point access in `d91ac91`; Khoa implemented Staff warehouse receive/store/return, retention deadline, and storage logs in `a83b9eb` with follow-up fixes; Quan later ported and hardened the module.

**Remaining work:** UC-142 is assigned to Khoa; UC-147 is assigned to Dat. Request, queue, context review, reject/cancel and physical intake (UC-141, UC-143 to UC-146) are Implemented for the stated goals.

**Runtime evidence:** an owned eligible FOUND or an unlinked direct LOST conversation with the actual Finder's consumed approved photo may queue physical intake without pre-approval. The no-FOUND path retains NULL physical post IDs and binds the request/item to the exact claim/room/Finder; LOST is comparison context, not a synthetic physical source. Source/contact photos remain separate from mandatory new Staff condition photos. Only physical confirmation creates one RECEIVED item. Legacy ACCEPTED requests remain receivable; accept is compatibility-only. Migration 061 was applied on 4 October; these later extensions require no new DDL. UC-142 is Partial for missing time/holiday scheduling; UC-147 is Partial for incomplete movement/release producers. Provider/manual acceptance is separate from status. See [intake evidence](../workflows/warehouse-intake-evidence.md) and [photo custody rules](../workflows/lost-contact-photo-rules.md).

| ID | Use Case | Actors | Use Case Description | Status |
| --- | --- | --- | --- | --- |
| UC-049 | View active handover points | Guest / Authenticated User | Retrieve handover points that are currently available for public use. | Implemented |
| UC-050 | View warehouse reference data | Staff / Admin | Retrieve categories, campus locations, handover points, and item counts used by warehouse operations. | Implemented |
| UC-051 | Browse warehouse items | Staff / Admin | List/filter warehouse records newest physical-receipt time first. Show a responsive three-item desktop row with image, title, category, receipt time, status and operational actions; open complete information/photos/history in a detail modal instead of long card descriptions. | Implemented |
| UC-052 | Receive a warehouse item | Staff / Admin | Receive an account-free walk-in with condition, quantity, accessories and 1-5 private Staff intake photos. Review optional image-analysis suggestions and explicitly confirm actual receipt to create one RECEIVED item; source/claim is not required. | Implemented |
| UC-053 | Update warehouse item details | Staff / Admin | Update permitted warehouse information such as location, condition notes, and storage code. | Implemented |
| UC-054 | Move an item to stored state | Staff / Admin | Apply the valid warehouse state transition from received to stored and append a storage log. | Implemented |
| UC-055 | Confirm a warehouse return | Staff / Admin | Return retained RECEIVED/STORED/CLAIMED/EXPIRED property after verifying the actual recipient, recording identity/contact and private proof, and checking reservations, competing cases and legal hold. Online claims require explicit Finder or post-intake Staff verification; offline return creates no synthetic claim or feedback participant. | Implemented |
| UC-056 | View warehouse storage logs | Staff / Admin | Open item details to view full description, permitted source/contact/intake/return photos and immutable storage/action history through protected access. | Implemented |
| UC-057 | Calculate item retention deadline | System | Calculate and store the retention deadline from the receiving time and configured category policy. | Implemented |
| UC-141 | Request transfer to staff custody | Finder | Request transfer of an owned eligible FOUND or an item in the exact unlinked direct LOST room backed by the actual Finder's consumed approved contact photo. No FOUND creation is required for that route; photo/request alone does not establish possession, change physical custody or approve ownership. | Implemented |
| UC-142 | Select staff intake point and time | Finder, Staff | Select an active handover point and view office hours. Proposed-time and holiday-aware scheduling remain pending. | Partial |
| UC-143 | List custody transfer requests | Staff, Admin | View server-paginated pending, accepted, rejected, cancelled and intaked requests with authorized details. | Implemented |
| UC-144 | Review a custody transfer request | Staff, Admin | Open authorized original post information/photos or protected CONTACT_PHOTO context for no-FOUND custody, separately from Staff receipt observations. Review does not create custody or require pre-approval; the historical accept API is compatibility-only. | Implemented |
| UC-145 | Reject or cancel a custody transfer request | Finder, Staff, Admin | Reject or cancel a transfer with a stored reason before receipt, restoring escalation projections while retaining audit history. Staff enters a refusal reason; the current Finder cancel control records its standard cancellation reason. | Implemented |
| UC-146 | Confirm staff intake | Staff, Admin | Confirm physical receipt from PENDING or legacy ACCEPTED with 1-5 new Staff condition photos, quantity/accessories and independent observations. Source/contact photos cannot substitute for receipt evidence. Create one RECEIVED item and mark INTAKED; preserve source or NULL physical-post linkage, actual Finder/claim/room and replay history. Intake is not ownership verification. | Implemented |
| UC-147 | Receive custody status notifications | Finder, Claimant | Receive authorized transactional request/intake/return updates; full movement/release/provider acceptance remains pending. | Partial |

### 3.10 Feedback & Reputation

**Commit evidence:** Dat implemented return feedback and reputation in `c0be32f`; Quan hardened idempotency, transactions, audit behavior, and Clean Architecture integration in `8f2c20e`, `fd8e25c`, and `1f18578`.

**Remaining work:** None in this feedback scope; new peer completion is implemented locally under Section 3.8, with schema/deployment and provider/manual acceptance recorded separately.

| ID | Use Case | Actors | Use Case Description | Status |
| --- | --- | --- | --- | --- |
| UC-058 | Check return-feedback eligibility | Return Participant | Check whether the signed-in participant may submit feedback for a completed return appointment. | Implemented |
| UC-059 | Submit return feedback | Return Participant | Submit one rating and comment for the other participant after an eligible completed return. | Implemented |
| UC-060 | Update reputation after feedback | System | Store the feedback, update the recipient's reputation summary, and append an idempotent reputation event. | Implemented |

### 3.11 User & Role Administration

**Commit evidence:** Dat implemented user, role, and access administration in `89cc72b`; Quan hardened authorization, last-admin safeguards, audit handling, and architecture integration in `65e31fa`, `d5d50ea`, and `1f18578`.

**Remaining work:** None in the current business catalogue.

| ID | Use Case | Actors | Use Case Description | Status |
| --- | --- | --- | --- | --- |
| UC-062 | List and search user accounts | Admin | Browse and filter user accounts available to administration. | Implemented |
| UC-063 | Create a user account | Admin | Create a user with validated profile, role, and account status data. | Implemented |
| UC-064 | View user account details | Admin | Inspect one user's profile, roles, and account status. | Implemented |
| UC-065 | Update user information | Admin | Update a user's supported profile fields within an audited transaction. | Implemented |
| UC-066 | Change user role | Admin | Reassign a user's role while enforcing role vocabulary and last-active-admin safeguards. | Implemented |
| UC-067 | Enable or disable user account | Admin | Change a user's account status and invalidate access when required. | Implemented |
| UC-068 | Delete user account | Admin | Delete an eligible user while enforcing reference and last-active-admin safeguards. | Implemented |

### 3.12 Master Data & Location Administration

**Commit evidence:** Khoa implemented category, area, and building administration in `97c9c72`; Quan implemented handover-point CRUD, map image, marker placement, usage guards, and public access in `d91ac91`.

**Remaining work:** None in the current business catalogue.

| ID | Use Case | Actors | Use Case Description | Status |
| --- | --- | --- | --- | --- |
| UC-061 | View administrative catalog | Admin | View item categories, campus areas, buildings, handover points, and related administrative reference data. | Implemented |
| UC-069 | Create item category | Admin | Add a top-level group or a valid child item category. | Implemented |
| UC-070 | Update item category | Admin | Edit category information or availability while preserving the two-level catalog rules. | Implemented |
| UC-071 | Delete item category | Admin | Delete an unreferenced category or reject the operation when protected references exist. | Implemented |
| UC-072 | Create campus area | Admin | Add a campus area used by posts, buildings, handover points, and warehouse records. | Implemented |
| UC-073 | Update campus area | Admin | Edit the name or availability of a campus area. | Implemented |
| UC-074 | Delete campus area | Admin | Delete an unreferenced campus area or reject the operation when dependent records exist. | Implemented |
| UC-075 | Create campus building | Admin | Add a building under a valid campus area. | Implemented |
| UC-076 | Update campus building | Admin | Edit a building while ensuring it remains associated with a valid area. | Implemented |
| UC-077 | Delete campus building | Admin | Delete an unreferenced building or reject the operation when dependent records exist. | Implemented |
| UC-078 | Create handover point | Admin | Add a handover point with a valid campus location and operating information. | Implemented |
| UC-079 | Update handover point | Admin | Edit handover details, map marker coordinates, operating hours, or active status. | Implemented |
| UC-080 | Upload handover map image | Admin | Validate and attach a campus map image to a handover point. | Implemented |
| UC-081 | Delete handover point | Admin | Delete an eligible handover point while protecting referenced operational data. | Implemented |

### 3.13 Moderation & User Reports

**Runtime evidence:** Admin list/review từ LNFS-59 được giữ nguyên. PAR-01 bổ sung API và PWA cho submit/list/detail/withdraw, server-side target derivation cho post/claim/message/handover, idempotency, privacy-safe context và Admin detail/audit history. Bằng chứng kiểm thử nằm tại `report.use-cases.test.ts`, `report.validator.test.ts`, `app.test.ts` và `reports-page.spec.ts`.

**Verified scope:** UC-093 đến UC-096 và UC-165 có runtime code cùng automated test; manual provider/database rehearsal vẫn thuộc release checklist.

| ID | Use Case | Actors | Use Case Description | Status |
| --- | --- | --- | --- | --- |
| UC-082 | View user reports | Admin | List and filter submitted moderation reports and their current review state. | Implemented |
| UC-083 | Review report and apply moderation | Admin | Review a report, apply the supported action to its derived target, and record the moderation audit trail. | Implemented |
| UC-093 | Submit a user report | Authenticated User | Report a suspicious post, claim, message, or handover issue with a reason and supporting description. | Implemented |
| UC-094 | View my submitted reports | Authenticated User | View reports submitted by the current user and their processing status. | Implemented |
| UC-095 | View my report detail | Authenticated User | View the reason, evidence, status, and resolution of one submitted report. | Implemented |
| UC-096 | Withdraw a pending report | Authenticated User | Withdraw a report that has not yet been reviewed by an administrator. | Implemented |
| UC-165 | View moderation report detail | Admin | View report content, related entity, evidence, reporter context, resolution, and audit history. | Implemented |

### 3.14 Dashboard, Statistics & Audit

**Commit evidence:** Khoa implemented dashboard KPI/trends and aggregate export in `51dfb3a`; Quan fixed trend behavior and hardened audit operations in `a4e5579`, `5c2e903`, and `d5d50ea`.

**Remaining work:** UC-164 remains assigned to Quan. Local cross-system audit search/export is ADMIN-only and does not add missing catalogue/domain audit writers.

| ID | Use Case | Actors | Use Case Description | Status |
| --- | --- | --- | --- | --- |
| UC-084 | View administration dashboard | Admin | View system KPIs, status totals, and time-window trends. | Implemented |
| UC-085 | Export system statistics | Admin | Export an allowlisted statistical dataset in the supported CSV or JSON format and audit the operation. | Implemented |
| UC-163 | View administrative audit logs | Admin | Search/filter actor, action, entity, source, time and existing reason across the protected audit projection. Reasons are searchable server-side but private notes/JSON are not returned. | Implemented |
| UC-164 | View claim and verification history | Authorized Participant, Staff, Admin | View permitted state changes and decisions for a claim without exposing unrelated private data. Participant verification history and latest decision display exist; a full history UI and general Staff/Admin case-history access remain missing. | Partial |
| UC-166 | Export audit and moderation data | Admin | Export allowlisted filtered CSV/JSON metadata, capped at 5000 rows with explicit overflow error, CSV formula protection and audited export. | Implemented |

### 3.15 System Configuration

**Commit evidence:** Dat implemented public and administrative system configuration in `696afef`; Quan hardened typed values, protected keys, history, audit, and architecture integration in `65e31fa` and `1f18578`.

**Remaining work:** None in the current business catalogue.

| ID | Use Case | Actors | Use Case Description | Status |
| --- | --- | --- | --- | --- |
| UC-086 | View public system configuration | Web Client | Retrieve the allowlisted public configuration used for client-side validation and display. | Implemented |
| UC-087 | List system configurations | Admin | Browse and filter runtime configuration entries. | Implemented |
| UC-088 | Create system configuration | Admin | Create a typed configuration entry and record its initial history and audit data. | Implemented |
| UC-089 | View system configuration details | Admin | Inspect one runtime configuration entry and its current typed value. | Implemented |
| UC-090 | View configuration history | Admin | View the paginated change history of a configuration entry. | Implemented |
| UC-091 | Update system configuration | Admin | Change a typed runtime value and record the actor, reason, previous value, and new value. | Implemented |
| UC-092 | Delete system configuration | Admin | Delete an eligible configuration entry and record the administrative action. | Implemented |

### 3.16 Warehouse Retention & Disposition

**Runtime evidence:** retention-deadline visibility and custody overdue reminders exist. Canonical Staff/Admin APIs implement legal hold, per-item disposition request, independent approval and proof-gated execution with deadline/case/hold checks. They are meaningful Partial implementations, not absent code. Dedicated overdue/eligibility views, Admin order/hold screens, rejection/cancellation and donation-campaign lifecycle remain incomplete. See [the status review](../audits/uc-status-review-2026-10-06.md).

**Remaining work:** UC-148 to UC-162 are assigned to Dat.

| ID | Use Case | Actors | Use Case Description | Status |
| --- | --- | --- | --- | --- |
| UC-148 | List overdue warehouse items | Staff, Admin | View custody records whose retention deadline has passed and that are not legally blocked. Dashboard overdue totals, deadline indicators and EXPIRED status filtering exist; no authoritative deadline-and-hold overdue list filter exists. EXPIRED status alone is not that filter. | Partial |
| UC-149 | View overdue item detail | Staff, Admin | View deadline, storage history, claim conflicts, appointments, holds, and disposition eligibility. Item detail/photos/logs exist; the complete conflict/hold/eligibility context does not. | Partial |
| UC-150 | Send retention deadline alerts | Scheduler | Notify staff before and after a custody record reaches its retention deadline. Deduplicated post-deadline custody-item reminders exist; pre-deadline and general walk-in coverage are missing. | Partial |
| UC-151 | Check disposition eligibility | Staff, Admin | Verify retention, claim, appointment, dispute, and legal-hold rules before disposition starts. Execution rechecks these gates atomically; a dedicated eligibility preview/actor screen is missing. | Partial |
| UC-152 | Apply or remove a legal hold | Admin | Block or unblock disposition with a documented reason, authorization, and storage-log entry through the canonical Admin-only API. The Admin hold-control screen is missing. | Partial |
| UC-153 | Create a disposition order | Admin | Create a donation, disposal, or transfer order for eligible warehouse items. Per-item approval requests exist; a complete eligible-item order workflow and Admin screen are missing. | Partial |
| UC-154 | View disposition order detail | Staff, Admin | View included items, reason, approval state, evidence, and processing history. | Planned |
| UC-155 | Approve a disposition order | Admin | A different Admin approves a pending per-item request through the canonical API; execution rechecks eligibility. The order review/approval screen is missing. | Partial |
| UC-156 | Reject a disposition order | Admin | Reject an order with a recorded reason while leaving item custody records unchanged. | Planned |
| UC-157 | Cancel a disposition order | Admin | Cancel an approved but unprocessed order with a reason and audit entry. | Planned |
| UC-158 | Record disposition evidence | Staff, Admin | Canonical execution validates and attaches private proof to the approved item, records its terminal outcome and logs history. A dedicated disposition evidence/completion screen is missing. | Partial |
| UC-159 | Create a donation campaign | Admin | Create a donation campaign with a name, receiving organization, schedule, and eligibility rules. | Planned |
| UC-160 | Update a donation campaign | Admin | Update the campaign information while preserving its change history. | Planned |
| UC-161 | Assign or remove campaign items | Staff, Admin | Add eligible custody items to or remove unprocessed items from a donation campaign. | Planned |
| UC-162 | Complete a donation campaign | Admin | Close the campaign after required approvals and evidence are recorded for all processed items. | Planned |

### 3.17 End-to-End Item Journey

**Local runtime evidence:** the activity module projects permitted post, matching availability, claim, conversation creation, decisions, appointment attempts, custody, warehouse, return and feedback into one chronological API/Web view. "Xem hành trình vật phẩm" is available on My Posts. The summary independently derives custodian/location class, receipt/return time, custody duration and feedback eligibility. Matching availability is a coarse current-record event, not a reconstructed immutable matching-job history. Missing legacy events are not invented; ambiguous physical candidates remain UNKNOWN. See [rollout and acceptance limits](../runbooks/appointment-journey-rollout.md).

**Relationship to existing use cases:** UC-167 is a read-only projection and does not replace the state-changing use cases that produce its events. Matching-quality feedback remains UC-098 to UC-100, while post-return participant feedback remains UC-058 to UC-060. Appointment, no-show, direct handover, and custody outcomes remain owned by UC-126 to UC-147.

**State progression rules:** A terminal claim, appointment attempt, transfer request, or handover attempt is never moved backward to an earlier status. Retrying creates a new linked attempt while preserving the prior event. A cancellation, no-show, failed handover, or conflicting confirmation must not mark the item returned. The current custodian is derived from authoritative events: the Finder retains the item until confirmed Staff intake or completed direct handover; Staff holds it after intake; return feedback is available only after an authorized completed-return outcome. The timeline must redact private messages, verification answers, evidence, contact data, and unrelated claims.

| ID | Use Case | Actors | Use Case Description | Status |
| --- | --- | --- | --- | --- |
| UC-167 | View end-to-end item journey | LOST Post Owner, Finder | View the permitted chronological journey and current-custody summary from My Posts, including linked warehouse history. Only owned posts and actual participant cases are accessible; private messages, answers, recipient details, proof/media and unrelated cases remain redacted. Historical gaps stay explicit. | Implemented |

### 3.18 Notification Delivery Preferences

**Remaining work:** UC-168 is assigned to Khoa. Runtime implementation is present in the Node.js API and Web/PWA preference screen, including transactional outbox, claim status coverage, category-safe digesting, privacy-safe HTML/text links, and bounded worker behavior. It stays Partial because full producer/provider evidence and SMTP exactly-once capability are not yet available.

**Relationship to existing use cases:** UC-168 controls how an authenticated user receives events; it does not create duplicate use cases for each channel. Match, claim, message, appointment, handover, custody, overdue, return, and feedback events remain owned by UC-097, UC-123 to UC-125, UC-134, UC-147, UC-150, and UC-058 to UC-060. In-app notifications remain the canonical user-visible record; PWA push and email are delivery channels.

**Delivery rules:** Security messages required for account access cannot be disabled. For other categories, the user may choose immediate delivery, delayed email only while the related notification remains unread, digest delivery, quiet hours, or opt out of the optional channel. Changing a preference affects future delivery attempts only and does not delete notification or audit history. Email content must be privacy-safe and direct the recipient to an authenticated application view instead of embedding private evidence, message text, verification answers, contact details, or precise item locations.

| ID | Use Case | Actors | Use Case Description | Status |
| --- | --- | --- | --- | --- |
| UC-168 | Manage notification delivery preferences | Authenticated User | Configure optional in-app, PWA push, immediate email, delayed-unread email, digest, and quiet-hour preferences by event category while mandatory security delivery remains enabled. | Partial |

### Integrated Safety Evidence and Remaining Gates

The custody safety work originally developed on `feat/lnfs-55` is integrated into `dev`, covering UC-026–031, UC-040/042, UC-051–057, UC-058–060, UC-141–147, UC-150–155/158 and UC-168. Follow-up commits add Staff verification, retained EXPIRED return, slow-SMTP fencing and source-owner pagination. No new actor goal or UC ID is introduced. Custody request, claim, warehouse and post states remain separate: request/accept do not change the physical custodian; intake does not resolve a post or decide ownership. A separate Staff verification records an explicit decision; canonical completed return resolves linked posts and authorizes only real participant feedback. Offline recipients need no account or invented claim.

Full Admin disposition-order/evidence screens, all overdue task categories and provider/manual QA remain incomplete. Shared schema through 062 is applied; that does not complete those actor goals or deploy remote API/Web. Recompute totals with `node scripts/check-uc-catalogue.mjs`; it reads UC rows rather than an assumed fixed catalogue size. Current evidence and remaining rollout gates: [full-system audit](../audits/full-system-audit-2026-10-04.md).

### Actor Journey Audit Follow-Up

BR-70/71 extend existing UC-022/034/035/040/042/055/114/146 safeguards; no new actor goal or UC ID is added. Lượng's two scoped commits implement consistent LOST/custody identities and read-only legacy access. Đạt's two scoped commits implement atomic source deletion protection and document reconciliation. Existing historical UC assignment remains unchanged; these repairs do not turn every affected Partial UC into Implemented. Catalogue totals remain 168: 97 Implemented, 17 Partial, 54 Planned.

## Audit Safeguards - 5 October 2026

Existing BR-06/29, FR-RT-01/FR-MEDIA-02 and private chat goals are strengthened without adding UC IDs: authenticated SSE expires with its token and revalidates its session before delivery/heartbeat; stale send, decision and evidence callbacks cannot alter a different room. Warehouse intake/return uploads use authenticated Cloudinary when configured and refuse local writes in production; old local evidence remains readable but requires a reviewed migration/backup before replacing its source instance. Regression evidence and remaining exact-commit CI/provider/manual gates are in [the 5 October audit follow-up](../audits/full-system-audit-2026-10-05.md) and [warehouse media rollout](../runbooks/warehouse-media-rollout.md). Status totals remain unchanged; these bug fixes do not certify full realtime, provider or deployment acceptance.

Authorized follow-up: all 16 inventoried warehouse-local references were copied and conditionally updated after encrypted database/volume backup and isolated restore. Real provider/API role, independent-process and restart checks plus post-check passed; originals and private manifests are retained. This evidence does not promote UC statuses or certify production deployment, non-warehouse legacy media or physical/manual UAT. Existing catalogue totals remain 168 (97 Implemented, 17 Partial, 54 Planned).

The audited code candidate `dev@dc92525` is pushed and has exact remote CI evidence: MySQL 8.0/8.4 each 375 passed/no skips, browser 69 passed. [The receipt](../audits/full-system-audit-2026-10-05.md) records the checkout SHA and run/artifact links. Later candidates and deployment still need their own acceptance; catalogue status counts are unchanged.

## Earlier Workflow Reconciliation - 6 October 2026

Retained receipt of the earlier, narrower photo/chat description update, superseded for statuses/counts by the comprehensive status review below. Existing IDs cover the requested workflows; no duplicate UC ID was added. At that point UC-120 changed from Planned to Partial and no UC became Implemented: **168 UCs: 97 Implemented, 18 Partial, 53 Planned**, with 71 remaining allocations. These are historical counts, not the current catalogue totals.

| Current scope | Existing UC mapping | Implementation / evidence | Remaining boundary |
| --- | --- | --- | --- |
| Image-first editable post analysis with accuracy/review reminder | UC-017, UC-018, UC-019 | `story-post-form.tsx`; `story-post-form.spec.ts` | Analysis is optional assistance, never automatic publication or ownership proof. |
| >=50% LOST photo contact / >=60% confidence, immediate room and checked image | UC-034, UC-040, UC-042, UC-044, UC-120 | `contact-photo.use-cases.ts`; `contact-photo.use-cases.test.ts`; `custody-safety.integration.test.ts`; `lost-contact-photo.spec.ts` | No live-possession/ownership guarantee; physical verification remains necessary. |
| Finder-only photo-analysis prompts, one-click text and collapse/retry | UC-106, UC-107, UC-042 | `contact-photo-questions.ts`; `claims-page.tsx`; `lost-contact-photo.spec.ts` | Safe prompts derive from AI-observed image features, not stored/free-form AI questions. No generic fallback on reads; no answered assignment or score. |
| Protected/idempotent chat images and separate focused evidence form | UC-041, UC-044, UC-045, UC-120 | `claim.routes.ts`; `claim.use-cases.ts`; `claim-chat-image.tsx`; `lost-custody-return.integration.test.ts`; `claims-resilience.spec.ts` | Real-provider, deployment/manual privacy acceptance remain open; unread/seen and push are separate. |
| Top Finder controls / communication-only meetup | UC-035, UC-036, UC-037, UC-106, UC-141 | `claim-verification-panel.tsx`; `claim-verification.use-cases.test.ts`; warehouse verified-recipient SQL regressions | The decision is not ownership verification, a booked time/place or permission to release property. Separate booking/physical-confirmation runtime is documented below. |
| No-FOUND photo custody, physical intake, explicit Staff verification and retained return | UC-114, UC-141 to UC-147, UC-052, UC-055, UC-058 to UC-060 | `photo-custody-source.ts`; `lost-custody-return.integration.test.ts`; `custody-safety.integration.test.ts`; `staff-page.spec.ts` | Preserve Finder history, dispute/hold/competing-case/proof gates. Quarantined historical links require separate review. |
| Compact inventory and full-detail accessible modals | UC-051, UC-056, UC-052, UC-146 | `staff-page.tsx`; `warehouse-intake-dialog.tsx`; `use-modal-focus.ts`; `staff-page.spec.ts` | Keyboard regressions are not full screen-reader/device or WCAG certification. |
| Preserve uploads when DB acknowledgement is unknown | UC-010, UC-023, UC-044, UC-052, UC-055, UC-034, UC-120 | `media-upload.ts`; `media-upload-regression.test.ts`; `media-upload-outcomes.integration.test.ts`; [reconciliation runbook](../runbooks/media-upload-reconciliation.md) | Retain uncertain assets/operation evidence, reconcile against authoritative data and retry safely; no success fabrication or age-only deletion. Production failover/operator acceptance remains separate. |

See [BR-53/65/68/69 and media rules](business-rules.md), [FR-CHAT-01/02 and custody requirements](requirements.md), [traceability](traceability-matrix.md), [current photo workflow verification](../workflows/lost-contact-photo-rules.md) and [B1/B2/B3 repair evidence](../audits/full-system-re-audit-2026-10-05.md). Matching diagnostics only improve sanitized failure reporting under UC-100; they do not prove that a past network failure is permanently resolved. Local normal tests/build/browser and isolated SQL receipts have distinct scopes; exact candidate CI, production/manual UAT and historical 053/055 acceptance remain separate gates.

## Comprehensive Status Review - 6 October 2026

Historical baseline review before the new appointment/journey implementation below; preserve its original counts and CI receipts.

The [71-row Vietnamese review](../audits/uc-status-review-2026-10-06.md) supersedes the earlier narrow reconciliation for current implementation status. Sixteen existing goals now have sufficient active runtime evidence for Implemented; fourteen previously Planned goals have a meaningful but incomplete runtime slice and become Partial. Others retain their status with explicit missing scope. Totals are **168: 113 Implemented, 20 Partial, 35 Planned**; 55 remaining allocations preserve their assignees. This recognizes existing work, not 30 newly built features or release certification.

The inspected baseline is `195b134c34c3cee559187bfee13d05e78abf3bfe`, with [successful exact-SHA CI](https://github.com/LNFSYS/lost-and-found-management-system-main/actions/runs/37408974894): MySQL 8.0/8.4 each 437 pass/no skips, browser 85 pass. This documentation review reran normal `npm test`: 379 pass, 0 fail, 20 opt-in SQL entries skipped, architecture 196 production files/0 violations and Web typecheck pass. No shared DB write, migration replay, new API/UI code, commit, push or main merge was performed. Baseline CI is not CI for a future documentation commit; provider/manual/deployment and historical migration limits remain separate.

## Appointment and Journey Implementation - 6 October 2026

New local authorized workflows implement UC-126/127/128/130/131/133, UC-134 through UC-140, UC-163/166/167. Fifteen formerly Planned goals and one formerly Partial goal become Implemented; UC-125 becomes Partial because negotiated counter-proposal/rescheduling and complete channel coverage remain missing. Catalogue: **168 = 129 Implemented + 20 Partial + 19 Planned**; 39 remaining assignments retain their owners. No new UC ID, author claim or historical score change. Migration 063 is isolated-tested only; no Aiven write, commit, push or main merge. Fresh test/build receipts and manual/provider/deployment gaps are in [appointment-journey-rollout.md](../runbooks/appointment-journey-rollout.md).
