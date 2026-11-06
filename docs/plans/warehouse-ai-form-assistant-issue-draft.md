# Issue Draft: AI Chat Assistants for Warehouse Intake and Return

**Proposed title:** `[S6][FE/BE][AI] Add chat-based AI form assistants to warehouse intake and item return`

**Type:** Feature  
**Area:** Staff / Warehouse  
**Status:** Draft only; not yet created on GitHub.

## Problem

Staff currently enter intake and return details directly into long forms while talking with the finder or recipient. This makes it easy to miss or misplace details and slows down counter service.

## Proposal

Add two separate AI chat boxes in the Staff warehouse workspace:

1. **Intake assistant:** Staff chats with the assistant while receiving a found item. It extracts explicitly stated details and offers to populate the intake form.
2. **Return assistant:** Staff chats with the assistant while handing a stored item back. It extracts explicitly stated recipient and handover details and offers to populate the return form.

The assistant is a form-filling aid, not an autonomous warehouse operator. Staff reviews every suggested value and submits the existing form themselves.

## Suggested Field Mapping

### Intake

- Item name, description and category
- Found location: area, building and room/location text
- Finder name and contact, when provided
- Physical condition, received quantity and included accessories
- Actual received time, only when explicitly stated
- Handover point only when the staff member selects/confirms it

The assistant must not create or infer intake evidence photos. Required staff-uploaded photos and the physical-inspection confirmation remain mandatory.

### Return

- Recipient name, phone and identity/student number only when explicitly provided
- Existing claim/recipient selection as a suggestion only; never choose a claimant based on a name match alone
- Handover note and actual handover time, when explicitly stated

The recipient's identity verification, claim verification, staff confirmation and required proof photos remain manual, mandatory steps. The assistant must not mark an item returned.

## Acceptance Criteria

- [ ] The Staff warehouse interface presents two clearly separated assistant contexts: intake and return.
- [ ] Staff can chat naturally in Vietnamese and correct or clarify details conversationally.
- [ ] The assistant proposes structured field values with a clear review/apply action; it never silently overwrites form inputs.
- [ ] Missing or ambiguous values remain empty and trigger a clarification question instead of being guessed.
- [ ] Staff can edit or reject each proposed value before applying it.
- [ ] Applying suggestions does not submit, save, receive, verify, or return the item; existing explicit staff confirmation remains required.
- [ ] Existing server-side validation, authorization, claim checks, physical review, and photo-evidence requirements remain authoritative.
- [ ] Intake and return assistants do not share conversation context or data across items, claims, staff sessions, or workflows.
- [ ] Sensitive identity and contact data are excluded from AI requests unless strictly necessary; document numbers and phone numbers are entered/reviewed in the existing protected fields.
- [ ] Assistant failures, timeouts, or unavailable AI leave the form usable and preserve all manually entered values.
- [ ] Chat content and extracted data follow an explicit retention policy and are not added to public item history or audit exports as raw transcripts.
- [ ] Tests cover extraction, ambiguity, correction, authorization boundaries, AI failure, and the invariant that only Staff can confirm intake/return.

## Existing UI Context

- Intake dialog: `apps/web/src/components/warehouse-intake-dialog.tsx`
- Intake fields include item/location/finder details, condition, quantity, accessories and actual receipt time.
- Return form and verification: `apps/web/src/pages/staff-page.tsx`
- Return requires recipient details, explicit identity/proof verification and handover evidence photos.

## Notes

This is a proposed new AI-assisted workflow; no AI form-filling runtime is claimed to exist yet. Confirm the approved AI provider, privacy/retention policy, and whether transcript persistence is needed before implementation.
