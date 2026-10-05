# 3. Business Use Case Catalogue - FPTU Lost & Found System (LNFS)

Mappings reconciled on 4 October 2026 against merged `dev` baseline `fd122e6` and local physical-intake/contact-photo follow-ups documented in [warehouse-intake-evidence.md](warehouse-intake-evidence.md) and [lost-contact-photo-rules.md](lost-contact-photo-rules.md). Earlier audit fixes remain documented in [dev-main-audit-fixes.md](dev-main-audit-fixes.md). UC-098 to UC-100 remain Partial for manual role/privacy QA and operational acceptance. UC-106 has a limited safe LOST-question runtime slice; UC-114 covers post-intake Staff approval only. Custody UC-141 to UC-147 retain remaining acceptance gaps. Warehouse release history remains in [LNFS-55-SAFETY-VERIFICATION.md](LNFS-55-SAFETY-VERIFICATION.md). `Implemented` requires active runtime evidence, not schema presence alone; no existing Implemented status certifies deployment of new extensions. Additive migrations 061/062 were applied on the shared DB on 4 October 2026 after backup and isolated rehearsal; manual/provider acceptance and durable media/application deployment remain pending. See [the rollout record](database-warehouse-recovery.md).

- **Implemented:** 97 use cases
- **Partial:** 17 use cases
- **Planned:** 54 use cases
- **Total:** 168 business use cases

`Claimant` means the owner of the LOST post. `Finder` means the owner of the matched FOUND post. PWA, mobile browser, and a future native application are delivery channels, not business use cases, and are therefore excluded from this catalogue.

## 3.1 Historical Source-Control Ownership Audit

The retained 21 September snapshot (not a fresh author audit) contains 73 commits across all references after normalizing author identities: Quan 55, Khoa 12, Dat 5, and Luong 1. Commit count is included only as an audit fact; ownership below is based on changed business modules, tests, routes, and UI rather than raw commit volume.

| Contributor | Completed UC evidence already integrated into `dev` | Primary commits |
| --- | --- | --- |
| Quan | Authentication; Web post workflows; matching and Gemini draft; handover points; cross-cutting security, database, Cloudinary, CI, and Clean Architecture hardening across the implemented modules. | `1cd77ce`, `a60d420`, `4d6841b`, `d91ac91`, `489cdc9`, `d5d50ea`, `1f18578`, `949cdc1` |
| Khoa | Profile/activity baseline; category/area/building administration; warehouse operations; claim/private-room/evidence/notification flow; moderation and dashboard baseline. | `97c9c72`, `a83b9eb`, `6e3491b`, `fb0d877`, `51dfb3a` |
| Dat | Post/private-media API baseline; user and role administration; system configuration; return feedback and reputation. | `a630fad`, `89cc72b`, `696afef`, `c0be32f` |
| Luong | The retained September audit found guided-question work on `origin/feat/lnfs-53`; that historical commit was not an ancestor of the audited dev snapshot. Current guided verification and the local post-intake Staff verification are recorded separately below; the September attribution is not a current runtime-status claim. | Historical `6c6fe92`; local custody verification `497e846` |

### Remaining Work Allocation

Completed UC work above is not reassigned. The 71 Partial/Planned UCs in the retained dev catalogue are divided by cohesive workflow, with UC-167 assigned to Quan for the cross-module journey projection and UC-168 assigned to Khoa for notification delivery preferences.

| Assignee | Remaining UC IDs | Count | Main responsibility |
| --- | --- | ---: | --- |
| Luong | UC-106 to UC-118; UC-126 to UC-133 | 21 | Complete guided verification acceptance gaps, broader Staff escalation decisions, multiple-claimant handling and appointment negotiation. |
| Quan | UC-097 to UC-105; UC-134 to UC-140; UC-163, UC-164, UC-166, UC-167 | 20 | Matching feedback/model operations, direct-handover completion, audit/moderation visibility, and the end-to-end item journey projection. |
| Khoa | UC-119 to UC-125; UC-141 to UC-146; UC-168 | 14 | User-report lifecycle, realtime/private communication extensions, Staff custody transfer/intake, and notification delivery preferences. |
| Dat | UC-147 to UC-162 | 16 | Custody notifications, overdue handling, legal holds, disposition orders, evidence, and donation campaigns. |
| **Total** | **Partial/Planned rows only** | **71** | **All currently Partial or Planned business UCs are assigned once.** |

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

**Runtime evidence:** UC-098 to UC-100 have actor-scoped feedback/dismissal, paginated HTTP results and a fenced, bounded refresh worker merged into `dev` by PR #79. Migration 060 is applied on Aiven; code/test and rollout evidence are in [matching review](matching-feedback-review.md). Source-owner filtering before pagination is additionally covered for owner/Staff/Admin in local `2bd63cc`. Full manual role/privacy QA, operational acceptance and remote CI for the follow-up commits remain separate gates. UC-097 notifications remain outside this scope; no new UC ID is introduced.

| ID | Use Case | Actors | Use Case Description | Status |
| --- | --- | --- | --- | --- |
| UC-026 | View matching suggestions | Post Owner / Staff / Admin | View active LOST-FOUND candidates calculated for an accessible source post. | Implemented |
| UC-027 | Recalculate matching suggestions | Post Owner / Staff / Admin | Request a rate-limited recalculation of matching candidates for an accessible post. | Implemented |
| UC-028 | View matching explanation | Post Owner / Staff / Admin | Review the overall tier, component scores, and redacted reasons behind a matching suggestion. | Implemented |
| UC-029 | Generate matches after post changes | System | Run matching on a best-effort basis after a post is created or updated without rolling back the valid post. | Implemented |
| UC-030 | Calculate matching score | System | Compare LOST and FOUND posts using normalized text, category, location, time, image tags, and safe OCR signals. | Implemented |
| UC-031 | Store active match results | System | Persist calculated active LOST-FOUND results while retaining permitted inactive saved history; deleted/hidden/private candidates remain guarded. | Implemented |
| UC-097 | Notify owner about a new match | System, Post Owner | Notify the owner when a newly calculated candidate reaches the configured matching threshold. | Planned |
| UC-098 | Dismiss a match suggestion | Post Owner | Hide a suggestion that the owner has reviewed and determined is not relevant. Dismissal is scoped to the actor and source post and does not resurface during later refreshes. | Partial |
| UC-099 | Submit match feedback | Post Owner | Mark a suggestion once as useful, irrelevant, or incorrect using an idempotent correlation key; feedback remains separate from ownership and workflow state. | Partial |
| UC-100 | Refresh matches periodically | Scheduler | Recalculate eligible active LOST and FOUND candidates with just-in-time fenced leases, heartbeat, bounded retries and graceful shutdown, without deciding ownership. | Partial |

### 3.5 Matching Model & AI Operations

**Commit evidence:** Quan implemented the Gemini-assisted editable post draft in `4d6841b`. No commit proves a custom trained matching model or approved training lifecycle.

**Remaining work:** UC-101 to UC-105 are assigned to Quan.

| ID | Use Case | Actors | Use Case Description | Status |
| --- | --- | --- | --- | --- |
| UC-017 | Analyze item images with Gemini | Authenticated User | Upload up to the allowed number of images and receive an editable draft based only on visible image content. | Implemented |
| UC-101 | Collect eligible matching examples | System, Admin | Collect reviewed matching outcomes that satisfy privacy and quality rules for training preparation. | Planned |
| UC-102 | Label matching outcomes | Admin, Staff | Label reviewed candidate pairs as positive, negative, or uncertain training examples. | Planned |
| UC-103 | Anonymize matching training data | System | Remove or mask personal and sensitive information before examples are used for model training. | Planned |
| UC-104 | Train a custom matching model | Admin, System | Start a controlled training job from an approved and versioned training dataset. | Planned |
| UC-105 | Evaluate and version a matching model | Admin, System | Compare model metrics, record the result, and activate only an approved model version. | Planned |

### 3.6 Claims & Ownership Verification

**Commit evidence:** Khoa implemented the claim lifecycle and participant-isolated rooms in `6e3491b` and `fb0d877`; Quan hardened claim integrity and ported the active runtime to modular Clean Architecture. Luong's historical guided-question work is recorded in `6c6fe92`; that commit's ancestry does not mean the current guided templates/human-decision runtime is absent. Local `497e846` adds explicit Staff verification after physical intake without rewriting Finder identity or earlier decisions.

**Remaining work:** UC-106 to UC-118 remain assigned to Luong for the full guided-question/multiple-claimant goals. UC-114 is Partial: post-intake Staff approval exists; general escalation rejection/more-information handling and full role/privacy acceptance still need work. No automatic ownership decision is made on intake.

| ID | Use Case | Actors | Use Case Description | Status |
| --- | --- | --- | --- | --- |
| UC-032 | View my claim requests | Claimant / Finder | List claim requests in which the signed-in user is an authorized participant. | Implemented |
| UC-033 | View claim request details | Claimant / Finder | View one authorized claim, its current state, participants, related posts, and allowed actions. | Implemented |
| UC-034 | Create a claim request | Claimant / Finder | Request an exchange for an eligible post or LOST-FOUND match while preventing self-claims and duplicates. Direct non-owner LOST contact requires a server-approved photo above 60%. | Implemented |
| UC-035 | Accept a claim request | Finder | Accept the claimant's request, grant participant consent, and open the private exchange room. | Implemented |
| UC-036 | Request more claim information | Finder | Ask the claimant for more information and open the private room for direct clarification. | Implemented |
| UC-037 | Decline a claim request | Finder | Reject a pending claim request and store the decision and optional reason in the audit trail. | Implemented |
| UC-038 | Withdraw a claim request | Claimant | Cancel an owned claim when its current state permits withdrawal. | Implemented |
| UC-039 | View private claim rooms | Claimant / Finder | List private rooms belonging to claims in which the signed-in user is a participant. | Implemented |
| UC-040 | Open a private claim room | Claimant / Finder | Enter an authorized consented room with actual ownership roles. Direct non-owner LOST contact additionally needs a server-approved photo above 60%; reads cannot approve pending legacy consent and communication approval never verifies ownership. | Implemented |
| UC-106 | View guided verification questions | Finder | View safe existing category prompts in a photo-approved LOST conversation without revealing expected answers. Full guided-question actor acceptance remains pending. | Partial |
| UC-107 | Ask a guided verification question | Finder | Send a structured verification question to a claimant in the private conversation. | Partial |
| UC-108 | Answer a guided verification question | Claimant | Answer a verification question without seeing the finder-defined expected answer. | Planned |
| UC-109 | Review private claim evidence | Finder | Review claimant answers and protected evidence before deciding the next claim state. | Partial |
| UC-110 | Calculate verification confidence | System | Calculate a support score from answered questions and evidence without making the ownership decision. | Planned |
| UC-111 | Escalate a claim for staff support | Claimant, Finder | Escalate an unresolved, suspicious, or disputed verification case with a required reason. | Planned |
| UC-112 | List escalated claims | Staff, Admin | View claims escalated for staff support, filtered by state, age, or assigned handler. | Planned |
| UC-113 | View an escalated claim | Staff, Admin | View the permitted claim context, evidence summary, messages, and audit history for an escalated case. | Planned |
| UC-114 | Record an escalation decision | Staff, Admin | Explicitly verify a consented claimant after physical custody intake, including LOST contact with linked FOUND and normalized legacy roles, with an in-person rationale, case/hold checks and independent Staff audit. General escalation rejection and more-information decisions remain pending. | Partial |
| UC-115 | View claimants for a found item | Finder | View all separate claim requests received for one FOUND post without merging their private evidence. | Planned |
| UC-116 | Compare claimant verification results | Finder | Compare status and verification progress across claimants while keeping each private conversation isolated. | Planned |
| UC-117 | Reserve an item for one claimant | Finder | Temporarily reserve the item for one accepted claimant before arranging a meetup. | Planned |
| UC-118 | Release reservation and reopen another claim | Finder | Release a reservation after cancellation or no-show and continue with another eligible claimant. | Planned |

### 3.7 Private Communication, Evidence & Notifications

**Commit evidence:** Khoa implemented private text rooms, protected evidence, and in-app claim notifications in `6e3491b` and `fb0d877`; Quan added cursor, idempotency, privacy, reliability, and architecture hardening.

**Remaining work:** UC-119 to UC-125 are assigned to Khoa.

| ID | Use Case | Actors | Use Case Description | Status |
| --- | --- | --- | --- | --- |
| UC-041 | View direct messages | Claimant / Finder | Retrieve cursor-paginated text messages from an authorized private claim room. | Implemented |
| UC-042 | Send a direct message | Claimant / Finder | Send an idempotent private text message. For non-owner LOST senders the server also enforces the contact-photo gate, including legacy rooms. | Implemented |
| UC-043 | View claim evidence | Claimant / Finder | List private evidence belonging to an authorized claim room. | Implemented |
| UC-044 | Upload claim evidence | Claimant / Finder | Validate and upload a private evidence image to an authorized claim room. | Implemented |
| UC-045 | View protected claim evidence | Claimant / Finder | Retrieve an evidence image only after participant and room authorization. | Implemented |
| UC-046 | View notifications | Authenticated User | View the signed-in user's notification feed and unread total. | Implemented |
| UC-047 | Mark a notification as read | Authenticated User | Mark one owned notification as read. | Implemented |
| UC-048 | Mark all notifications as read | Authenticated User | Clear the unread state of all notifications owned by the signed-in user. | Implemented |
| UC-119 | Receive new private messages immediately | Claimant, Finder | Receive newly sent conversation messages without manually refreshing the page. | Partial |
| UC-120 | Send an image in a private conversation | Claimant, Finder | Upload and send an authorized image message inside the related claim room. | Planned |
| UC-121 | View unread conversation count | Claimant, Finder | View the number of unread messages for each authorized private conversation. | Planned |
| UC-122 | Mark a conversation as read | Claimant, Finder | Mark messages in an opened conversation as read for the current participant. | Planned |
| UC-123 | Receive claim status notifications | Claimant, Finder | Receive notifications when a claim is created, updated, accepted, declined, withdrawn, or escalated. | Partial |
| UC-124 | Receive new-message notifications | Claimant, Finder | Receive a notification when the other participant sends a new private message. | Planned |
| UC-125 | Receive appointment and handover notifications | Claimant, Finder | Receive notifications for proposals, confirmations, changes, reminders, and handover results. | Planned |

### 3.8 Handover, Appointment & Direct Return

**Commit evidence:** The database contains appointment and return-related migrations, but `dev` has no active appointment module, route, or complete Web workflow. Migration-only evidence is not counted as implementation.

**Remaining work:** UC-126 to UC-133 are assigned to Luong; UC-134 to UC-140 are assigned to Quan.

| ID | Use Case | Actors | Use Case Description | Status |
| --- | --- | --- | --- | --- |
| UC-126 | List my appointments | Claimant, Finder | View appointments related to the current user's accepted claim requests. | Planned |
| UC-127 | View appointment detail | Claimant, Finder | View the agreed place, time, participants, current state, and change history of one appointment. | Planned |
| UC-128 | Propose a meetup appointment | Claimant, Finder | Propose a meeting time and active handover point after verification is accepted. | Planned |
| UC-129 | Counter-propose an appointment | Claimant, Finder | Suggest a different place or time instead of accepting the current proposal. | Planned |
| UC-130 | Accept an appointment proposal | Claimant, Finder | Accept the current proposal so the appointment becomes mutually confirmed. | Planned |
| UC-131 | Decline an appointment proposal | Claimant, Finder | Decline a proposal while preserving the claim and appointment history. | Planned |
| UC-132 | Reschedule a confirmed appointment | Claimant, Finder | Propose and mutually confirm a replacement time or handover point. | Planned |
| UC-133 | Cancel an appointment | Claimant, Finder | Cancel an appointment with a reason and notify the other participant. | Planned |
| UC-134 | Send appointment reminders | Scheduler | Notify both participants before a confirmed appointment according to the configured reminder time. | Planned |
| UC-135 | Record an appointment no-show | Claimant, Finder | Record that the other participant did not attend and preserve the event for dispute handling. | Planned |
| UC-136 | Confirm item handed over | Finder | Confirm that the finder physically handed the item to the claimant. | Planned |
| UC-137 | Confirm item received | Claimant | Confirm that the claimant physically received the item from the finder. | Planned |
| UC-138 | Hold conflicting handover confirmations | System | Keep the case pending when the two confirmations conflict instead of marking the item returned. | Planned |
| UC-139 | Complete a direct return | System | Mark the item returned only after both finder and claimant confirmations are valid. | Planned |
| UC-140 | Report a handover issue | Claimant, Finder | Report a dispute, wrong item, unsafe meeting, or failed handover for staff support. | Planned |

### 3.9 Warehouse Intake, Custody & Transfer

**Commit evidence:** Quan implemented public handover-point access in `d91ac91`; Khoa implemented Staff warehouse receive/store/return, retention deadline, and storage logs in `a83b9eb` with follow-up fixes; Quan later ported and hardened the module.

**Remaining work:** UC-141 to UC-146 are assigned to Khoa; UC-147 is assigned to Dat.

**Runtime evidence:** owned FOUND requests queue physical intake without pre-approval. The new reconciliation flow keeps source data separate, requires Staff intake photos and observations and creates one RECEIVED item only at confirmation. Legacy ACCEPTED requests remain receivable; accept is a compatibility API, not a required UI step. Additive migration 061 supports the new evidence contract and was applied on the shared DB on 4 October 2026. These seven UCs remain Partial; schema readiness does not complete manual acceptance. UC-142 is point/office-hours selection, not holiday-aware scheduling. See [intake evidence](warehouse-intake-evidence.md).

| ID | Use Case | Actors | Use Case Description | Status |
| --- | --- | --- | --- | --- |
| UC-049 | View active handover points | Guest / Authenticated User | Retrieve handover points that are currently available for public use. | Implemented |
| UC-050 | View warehouse reference data | Staff / Admin | Retrieve categories, campus locations, handover points, and item counts used by warehouse operations. | Implemented |
| UC-051 | Browse warehouse items | Staff / Admin | List and filter warehouse custody records. | Implemented |
| UC-052 | Receive a warehouse item | Staff / Admin | Receive an account-free walk-in with condition, quantity, accessories and 1-5 private Staff intake photos. Review optional image-analysis suggestions and explicitly confirm actual receipt to create one RECEIVED item; source/claim is not required. | Implemented |
| UC-053 | Update warehouse item details | Staff / Admin | Update permitted warehouse information such as location, condition notes, and storage code. | Implemented |
| UC-054 | Move an item to stored state | Staff / Admin | Apply the valid warehouse state transition from received to stored and append a storage log. | Implemented |
| UC-055 | Confirm a warehouse return | Staff / Admin | Return retained RECEIVED/STORED/CLAIMED/EXPIRED property after verifying the actual recipient, recording identity/contact and private proof, and checking reservations, competing cases and legal hold. Online claims require explicit Finder or post-intake Staff verification; offline return creates no synthetic claim or feedback participant. | Implemented |
| UC-056 | View warehouse storage logs | Staff / Admin | View the immutable action history for a warehouse item. | Implemented |
| UC-057 | Calculate item retention deadline | System | Calculate and store the retention deadline from the receiving time and configured category policy. | Implemented |
| UC-141 | Request transfer to staff custody | Finder | Ask to transfer an owned active FOUND item to an official handover point when direct return is unsuitable; request alone does not change physical custody. | Partial |
| UC-142 | Select staff intake point and time | Finder, Staff | Select an active handover point and view office hours. Proposed-time and holiday-aware scheduling remain pending. | Partial |
| UC-143 | List custody transfer requests | Staff, Admin | View server-paginated pending, accepted, rejected, cancelled and intaked requests with authorized details. | Partial |
| UC-144 | Review a custody transfer request | Staff, Admin | Open authorized source information/photos for reconciliation without creating custody or requiring pre-approval. The historical accept API is compatibility-only. | Partial |
| UC-145 | Reject or cancel a custody transfer request | Finder, Staff, Admin | Reject or cancel a transfer with a reason before receipt, restoring escalation projections while retaining audit history. | Partial |
| UC-146 | Confirm staff intake | Staff | Confirm physical receipt from PENDING or legacy ACCEPTED with Staff-uploaded condition photos, quantity/accessories and independent observations. Create one RECEIVED item and mark INTAKED; preserve original post/Finder/claim and exact replay history. | Partial |
| UC-147 | Receive custody status notifications | Finder, Claimant | Receive authorized transactional request/intake/return updates; full movement/release/provider acceptance remains pending. | Partial |

### 3.10 Feedback & Reputation

**Commit evidence:** Dat implemented return feedback and reputation in `c0be32f`; Quan hardened idempotency, transactions, audit behavior, and Clean Architecture integration in `8f2c20e`, `fd8e25c`, and `1f18578`.

**Remaining work:** None in the current business catalogue; end-to-end use still depends on completing Section 3.8.

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

**Remaining work:** UC-163, UC-164, and UC-166 are assigned to Quan.

| ID | Use Case | Actors | Use Case Description | Status |
| --- | --- | --- | --- | --- |
| UC-084 | View administration dashboard | Admin | View system KPIs, status totals, and time-window trends. | Implemented |
| UC-085 | Export system statistics | Admin | Export an allowlisted statistical dataset in the supported CSV or JSON format and audit the operation. | Implemented |
| UC-163 | View administrative audit logs | Admin | Search actor, action, entity, time, and reason across protected administrative operations. | Planned |
| UC-164 | View claim and verification history | Authorized Participant, Staff, Admin | View permitted state changes and decisions for a claim without exposing unrelated private data. | Planned |
| UC-166 | Export audit and moderation data | Admin | Export filtered audit or moderation records for authorized review and project evidence. | Planned |

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

**Commit evidence:** Khoa implemented retention-deadline calculation and overdue visibility as part of the warehouse baseline. No commit on `dev` implements the full overdue-alert, legal-hold, disposition-order, evidence, or donation-campaign lifecycle.

**Remaining work:** UC-148 to UC-162 are assigned to Dat.

| ID | Use Case | Actors | Use Case Description | Status |
| --- | --- | --- | --- | --- |
| UC-148 | List overdue warehouse items | Staff, Admin | View custody records whose retention deadline has passed and that are not legally blocked. | Planned |
| UC-149 | View overdue item detail | Staff, Admin | View deadline, storage history, claim conflicts, appointments, holds, and disposition eligibility. | Planned |
| UC-150 | Send retention deadline alerts | Scheduler | Notify staff before and after a custody record reaches its retention deadline. | Planned |
| UC-151 | Check disposition eligibility | Staff, Admin | Verify retention, claim, appointment, dispute, and legal-hold rules before disposition starts. | Planned |
| UC-152 | Apply or remove a legal hold | Admin | Block or unblock disposition with a documented reason, authorization, and audit entry. | Planned |
| UC-153 | Create a disposition order | Admin | Create a donation, disposal, or transfer order for eligible warehouse items. | Planned |
| UC-154 | View disposition order detail | Staff, Admin | View included items, reason, approval state, evidence, and processing history. | Planned |
| UC-155 | Approve a disposition order | Admin | Approve an eligible disposition order before physical processing. | Planned |
| UC-156 | Reject a disposition order | Admin | Reject an order with a recorded reason while leaving item custody records unchanged. | Planned |
| UC-157 | Cancel a disposition order | Admin | Cancel an approved but unprocessed order with a reason and audit entry. | Planned |
| UC-158 | Record disposition evidence | Staff, Admin | Upload evidence and completion details for an authorized donation, disposal, or transfer. | Planned |
| UC-159 | Create a donation campaign | Admin | Create a donation campaign with a name, receiving organization, schedule, and eligibility rules. | Planned |
| UC-160 | Update a donation campaign | Admin | Update the campaign information while preserving its change history. | Planned |
| UC-161 | Assign or remove campaign items | Staff, Admin | Add eligible custody items to or remove unprocessed items from a donation campaign. | Planned |
| UC-162 | Complete a donation campaign | Admin | Close the campaign after required approvals and evidence are recorded for all processed items. | Planned |

### 3.17 End-to-End Item Journey

**Commit evidence:** Existing post, matching, claim, chat, appointment-schema, warehouse, return-feedback, and audit records provide partial source events. No integrated API or Web/PWA view currently projects those records into one participant-safe journey from post creation through return feedback.

**Relationship to existing use cases:** UC-167 is a read-only projection and does not replace the state-changing use cases that produce its events. Matching-quality feedback remains UC-098 to UC-100, while post-return participant feedback remains UC-058 to UC-060. Appointment, no-show, direct handover, and custody outcomes remain owned by UC-126 to UC-147.

**State progression rules:** A terminal claim, appointment attempt, transfer request, or handover attempt is never moved backward to an earlier status. Retrying creates a new linked attempt while preserving the prior event. A cancellation, no-show, failed handover, or conflicting confirmation must not mark the item returned. The current custodian is derived from authoritative events: the Finder retains the item until confirmed Staff intake or completed direct handover; Staff holds it after intake; return feedback is available only after an authorized completed-return outcome. The timeline must redact private messages, verification answers, evidence, contact data, and unrelated claims.

| ID | Use Case | Actors | Use Case Description | Status |
| --- | --- | --- | --- | --- |
| UC-167 | View end-to-end item journey | LOST Post Owner, Finder | View a chronological, privacy-safe timeline showing post publication, matching progress, claim and conversation activity, verification outcome, appointment attempts, cancellation or no-show outcomes, the current item custodian and location class, Staff intake and custody duration, completed return, and post-return feedback eligibility without rewriting prior events. | Planned |

### 3.18 Notification Delivery Preferences

**Remaining work:** UC-168 is assigned to Khoa. Runtime implementation is present in the Node.js API and Web/PWA preference screen, including transactional outbox, claim status coverage, category-safe digesting, privacy-safe HTML/text links, and bounded worker behavior. It stays Partial because full producer/provider evidence and SMTP exactly-once capability are not yet available.

**Relationship to existing use cases:** UC-168 controls how an authenticated user receives events; it does not create duplicate use cases for each channel. Match, claim, message, appointment, handover, custody, overdue, return, and feedback events remain owned by UC-097, UC-123 to UC-125, UC-134, UC-147, UC-150, and UC-058 to UC-060. In-app notifications remain the canonical user-visible record; PWA push and email are delivery channels.

**Delivery rules:** Security messages required for account access cannot be disabled. For other categories, the user may choose immediate delivery, delayed email only while the related notification remains unread, digest delivery, quiet hours, or opt out of the optional channel. Changing a preference affects future delivery attempts only and does not delete notification or audit history. Email content must be privacy-safe and direct the recipient to an authenticated application view instead of embedding private evidence, message text, verification answers, contact details, or precise item locations.

| ID | Use Case | Actors | Use Case Description | Status |
| --- | --- | --- | --- | --- |
| UC-168 | Manage notification delivery preferences | Authenticated User | Configure optional in-app, PWA push, immediate email, delayed-unread email, digest, and quiet-hour preferences by event category while mandatory security delivery remains enabled. | Partial |

### Integrated Safety Evidence and Remaining Gates

The custody safety work originally developed on `feat/lnfs-55` is integrated into `dev`, covering UC-026–031, UC-040/042, UC-051–057, UC-058–060, UC-141–147, UC-150–155/158 and UC-168. Follow-up commits add Staff verification, retained EXPIRED return, slow-SMTP fencing and source-owner pagination. No new actor goal or UC ID is introduced. Custody request, claim, warehouse and post states remain separate: request/accept do not change the physical custodian; intake does not resolve a post or decide ownership. A separate Staff verification records an explicit decision; canonical completed return resolves linked posts and authorizes only real participant feedback. Offline recipients need no account or invented claim.

Full Admin disposition-order/evidence screens, all overdue task categories and provider/manual QA remain incomplete. Shared schema through 062 is applied; that does not complete those actor goals or deploy remote API/Web. Recompute totals with `node scripts/check-uc-catalogue.mjs`; it reads UC rows rather than an assumed fixed catalogue size. Current evidence and remaining rollout gates: [full-system audit](full-system-audit-2026-10-04.md).

### Actor Journey Audit Follow-Up

BR-70/71 extend existing UC-022/034/035/040/042/055/114/146 safeguards; no new actor goal or UC ID is added. Lượng's two scoped commits implement consistent LOST/custody identities and read-only legacy access. Đạt's two scoped commits implement atomic source deletion protection and document reconciliation. Existing historical UC assignment remains unchanged; these repairs do not turn every affected Partial UC into Implemented. Catalogue totals remain 168: 97 Implemented, 17 Partial, 54 Planned.

## Audit Safeguards - 5 October 2026

Existing BR-06/29, FR-RT-01/FR-MEDIA-02 and private chat goals are strengthened without adding UC IDs: authenticated SSE expires with its token and revalidates its session before delivery/heartbeat; stale send, decision and evidence callbacks cannot alter a different room. Warehouse intake/return uploads use authenticated Cloudinary when configured and refuse local writes in production; old local evidence remains readable but requires a reviewed migration/backup before replacing its source instance. Regression evidence and remaining exact-commit CI/provider/manual gates are in [the 5 October audit follow-up](full-system-audit-2026-10-05.md) and [warehouse media rollout](warehouse-media-rollout.md). Status totals remain unchanged; these bug fixes do not certify full realtime, provider or deployment acceptance.

Authorized follow-up: all 16 inventoried warehouse-local references were copied and conditionally updated after encrypted database/volume backup and isolated restore. Real provider/API role, independent-process and restart checks plus post-check passed; originals and private manifests are retained. This evidence does not promote UC statuses or certify production deployment, non-warehouse legacy media or physical/manual UAT. Existing catalogue totals remain 168 (97 Implemented, 17 Partial, 54 Planned).
