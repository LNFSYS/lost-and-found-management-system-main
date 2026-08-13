# Use Case Checklist

| Done | UC | Use case |
| --- | --- | --- |
| [x] | UC-001 | Authenticate JWT in Node.js API |
| [x] | UC-002 | Authorize Admin/Staff/User in Node.js API |
| [ ] | UC-003 | Request additional claim information |
| [ ] | UC-004 | Accept claim with row lock |
| [ ] | UC-005 | Reject claim with reason |
| [ ] | UC-006 | Cancel claim when in valid state |
| [ ] | UC-007 | Lock claim writes during state transition |
| [ ] | UC-008 | Create handover point in Java service |
| [ ] | UC-009 | Update handover point in Java service |
| [ ] | UC-010 | Toggle handover point in Java service |
| [ ] | UC-011 | Confirm item received at handover point |
| [ ] | UC-012 | Update item to stored status |
| [ ] | UC-013 | Record item condition notes upon receipt |
| [ ] | UC-014 | Confirm item returned to recipient |
| [ ] | UC-015 | Write storage log for warehouse operations |
| [ ] | UC-016 | Check warehouse item retention deadline |
| [ ] | UC-017 | Determine eligibility for overdue item processing |
| [ ] | UC-018 | Create overdue item disposal order |
| [ ] | UC-019 | Create donation batch for items |
| [ ] | UC-020 | Send warehouse alerts to staff/admin |
| [ ] | UC-021 | Create return appointment after accepted claim |
| [ ] | UC-022 | Reject appointment with reason |
| [ ] | UC-023 | Reschedule or cancel return appointment |
| [ ] | UC-024 | Complete appointment and update to resolved |
| [ ] | UC-025 | Calculate reputation score after business event |
| [ ] | UC-026 | Collect AI training data |
| [ ] | UC-027 | Label match correct/incorrect data |
| [ ] | UC-028 | Anonymize AI training data |
| [ ] | UC-029 | Train AI model from labeled data |
| [ ] | UC-030 | Evaluate and save AI model version |
| [x] | UC-031 | Request registration OTP via email |
| [x] | UC-032 | Verify OTP and create account |
| [x] | UC-033 | Log in with email and password |
| [x] | UC-034 | Refresh access token |
| [x] | UC-035 | Log out and revoke refresh token |
| [x] | UC-036 | Reset password via OTP |
| [x] | UC-037 | Provide user profile API |
| [ ] | UC-038 | Provide user avatar API |
| [ ] | UC-039 | Provide activity, reputation, and post-return feedback review |
| [x] | UC-040 | Create lost item post via API |
| [x] | UC-041 | Create found item post via API |
| [x] | UC-042 | Update post via API |
| [x] | UC-043 | Close or soft-delete post via API |
| [x] | UC-044 | Return post detail via API |
| [x] | UC-045 | Return current user's posts |
| [x] | UC-046 | Return public Lost & Found board |
| [x] | UC-047 | Search, filter, and sort posts |
| [x] | UC-048 | Upload post images |
| [ ] | UC-049 | Upload claim evidence images |
| [ ] | UC-050 | Delete post images from Cloudinary |
| [ ] | UC-051 | Provide public config for client validation |
| [ ] | UC-052 | Submit claim for a FOUND post |
| [ ] | UC-053 | Prevent duplicate claims for same post |
| [ ] | UC-054 | Control claim evidence view permissions |
| [x] | UC-055 | Provide handover point list API |
| [ ] | UC-056 | Manage handover points via Admin API |
| [ ] | UC-057 | Store campus map image and handover point marker coordinates |
| [ ] | UC-058 | Count stored items at handover point |
| [ ] | UC-059 | Manage warehouse items via API |
| [ ] | UC-060 | Update warehouse item status |
| [ ] | UC-061 | Save warehouse item retention deadline |
| [x] | UC-062 | Restrict staff permissions below admin |
| [ ] | UC-063 | Manage users via Admin API |
| [x] | UC-064 | Manage item categories via Admin API |
| [x] | UC-065 | Manage campus areas and buildings via Admin API |
| [ ] | UC-066 | Moderate posts and handle reports via Admin API |
| [x] | UC-067 | Provide admin dashboard overview data |
| [ ] | UC-068 | Run matching after post create or update |
| [ ] | UC-069 | Normalize Vietnamese text for matching algorithm |
| [ ] | UC-070 | Calculate tiered match score by text, category, location, time, image tags, and OCR |
| [ ] | UC-071 | Save matching results |
| [ ] | UC-072 | Return similar item suggestions |
| [ ] | UC-073 | Send notification when new match found |
| [ ] | UC-074 | Check match suggestions on 10-minute cycle |
| [ ] | UC-075 | Re-run matching manually for admin |
| [ ] | UC-076 | Explain why two posts match |
| [ ] | UC-077 | Set up Socket.IO server |
| [ ] | UC-078 | Authenticate socket via JWT |
| [ ] | UC-079 | Create and join chat room by claim |
| [ ] | UC-080 | Send and receive realtime messages |
| [ ] | UC-081 | Send images in realtime chat |
| [ ] | UC-082 | Display seen status and unread count in realtime |
| [ ] | UC-083 | Send realtime notifications for chat, claim, and appointment |
| [ ] | UC-084 | Export statistics report via API |
| [ ] | UC-085 | Manage system configuration via API |
| [ ] | UC-086 | Analyze item images with Google Vision |
| [ ] | UC-087 | Extract OCR from evidence images |
| [ ] | UC-088 | Suggest tags and categories from item images |
| [ ] | UC-089 | Verify claim evidence uploaded by claimant |
| [ ] | UC-090 | Calculate ownership review confidence percentage |
| [ ] | UC-091 | Use AI tags as metadata for matching |
| [ ] | UC-092 | Display review confidence percentage to finder/staff |
| [ ] | UC-093 | Register, log in, and store token securely on mobile |
| [ ] | UC-094 | View and update profile, avatar, activity, and reputation on mobile |
| [ ] | UC-095 | View board, search, filter, sort, and open post detail on mobile |
| [ ] | UC-096 | Create and manage LOST/FOUND posts on mobile |
| [ ] | UC-097 | Upload images from camera/gallery with mobile validation |
| [ ] | UC-098 | Submit claim, upload evidence, and view claim status on mobile |
| [ ] | UC-099 | View handover map/points and create return appointment on mobile |
| [ ] | UC-100 | Chat realtime, receive notifications, and handle offline/retry on mobile |
