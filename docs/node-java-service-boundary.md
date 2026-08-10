# Node.js And Java Service Boundary

Last updated: 2026-07-10

The binding decision record is [adr-001-node-java-write-ownership.md](adr-001-node-java-write-ownership.md). This document explains the broader rationale and future integration path.

## Decision

The project can be developed by both Node.js and Java/Spring Boot members in parallel.

For the current graduation MVP, the safe architecture statement is:

> The React web app uses the Node.js API as the core web-facing backend for the demo flow. The Java/Spring Boot service is a parallel business/admin extension that shares the same MySQL schema and JWT contract. It demonstrates stricter business-rule handling for selected admin flows, but the project is not presented as a fully production-grade microservice system yet.

This lets the Node specialist and Java specialist both contribute without overclaiming that the system is already a complete production microservice deployment.

## Why This Boundary Exists

The Lost & Found domain has several flows that touch the same entities: claims, appointments, handover points, warehouse items, configuration, reports, and audit/history.

If Node and Java both update the same state without ownership rules, the project can suffer from:

- inconsistent validation;
- race conditions;
- duplicated business logic;
- unclear demo behavior;
- judge questions about the actual source of truth.

The boundary below keeps the project honest and defensible.

## Runtime Positioning

| Mode | Description | Safe presentation |
| --- | --- | --- |
| MVP demo mode | Web app primarily calls Node.js API. Node owns the end-to-end web demo flow. | "Node.js is the core web-facing API for the MVP demo." |
| Parallel service mode | Java service runs as a business/admin extension with the same MySQL schema and JWT secret. | "Java implements selected business rules and admin operations as an extension." |
| Future production mode | Node can become an API gateway/BFF and delegate selected domain operations to Java, or frontend can route by domain. | "This requires integration contracts, ownership tests, and deployment hardening before claiming production microservices." |

## Ownership Matrix

| Domain / Flow | Current MVP owner | Java extension role | Notes |
| --- | --- | --- | --- |
| Auth, OTP, login, refresh token | Node.js | Reads/verifies JWT only | Java should not create separate login unless intentionally designed later. |
| User profile/avatar/activity/reputation read | Node.js | May read reputation data for admin/business rules | Keep user-facing account flow in Node for demo stability. |
| LOST/FOUND posts | Node.js | No direct owner currently | Node owns public board, create/update/close/delete/report. |
| Media upload, Cloudinary, Google Vision OCR/tags | Node.js | May consume stored metadata | Java should not duplicate upload/OCR pipelines. |
| Matching algorithm, match explanations, notifications | Node.js | May consume match data | Matching remains Node-owned for current MVP. |
| Claim creation/evidence upload/read | Node.js | Can enforce stricter transition rules when routed | Node owns current web claim flow; Java can be used for transaction-safe transition extension. |
| Claim accept/reject/request-info/cancel | Node.js for current web demo | Java has business-service implementation with locks | Do not run both as competing sources in one deployment without a routing decision. |
| Appointment lifecycle | Node.js for current web demo | Java can model stricter state machine later | Current web screens use Node routes. |
| Handover points | Node.js for current web demo | Java has admin CRUD/toggle extension | Use one route family in a given demo to avoid conflicting behavior. |
| Warehouse/storage logs | Node.js for current web demo | Java can own stricter storage-log operations later | Both share DB; integration tests are needed before production split. |
| Admin configuration/history | Node.js for current web demo | Java can provide typed config/history extension when routed | Node now exposes admin config CRUD/history for the demo; use one writer in a given deployment. |
| Realtime Socket.IO chat/notification | Node.js | No Java realtime owner | Node owns socket rooms and notification emit. |
| Scheduled jobs | Node.js for current MVP jobs | Java may add business jobs later | Avoid duplicate cron jobs touching the same statuses. |
| Dashboard/report overview | Node.js for current web demo | Java can add deeper export/report extension | Keep current demo dashboard on Node unless integrated. |

## Integration Rules

1. A flow must have one runtime writer for a given deployment.
2. Both services may read shared tables, but writes must be owned or explicitly routed.
3. Java and Node must use the same `JWT_ACCESS_SECRET` if Java endpoints are called with Node-issued tokens.
4. Node migrations remain the schema source for the current repo.
5. If Java updates the same tables as Node, add integration tests before claiming production readiness.
6. Do not start two scheduled jobs that update the same status field without a lock/ownership decision.
7. Demo scripts should state whether a step is using Node-only flow or Java extension flow.
8. Java write endpoints default to disabled. Set `JAVA_WRITES_ENABLED=true` only after the selected flow is routed away from Node.

## Recommended Thesis Explanation

Short answer:

> Because our team has both Node.js and Java specializations, we split the project into a Node.js core API for the web MVP and a Java/Spring Boot business-service extension. Node provides the stable demo flow and realtime features, while Java demonstrates selected business rules and admin operations with Spring Boot. We do not claim this is a fully production microservice architecture yet; production would require stricter service contracts, routing, integration tests, and deployment hardening.

If asked why Java is useful:

> Java is suitable for transaction-heavy business operations such as claim transitions, handover lifecycle, storage logs, configuration history, and future policy engines. It lets the Java member contribute meaningful backend/business logic without forcing the whole web MVP to depend on unfinished service orchestration.

If asked about duplicated logic:

> We recognize that risk. That is why the documentation defines Node as the current MVP owner for the web-facing flow and Java as an extension. Before production, one writer per flow must be enforced and covered by integration tests.

## What Not To Claim

- Do not claim completed production microservices.
- Do not claim Node already delegates every business operation to Java unless that integration is implemented.
- Do not claim both services can safely write the same statuses without tests.
- Do not claim Java owns auth login if Java only verifies Node-issued JWT.

## Future Integration Plan

1. Add a Java service base URL to environment configuration.
2. Decide which domain Node should delegate to Java first, such as configuration writes or claim transitions.
3. Add a Node adapter/client for that Java domain.
4. Add integration tests for JWT compatibility, role guards, and state transitions.
5. Add OpenAPI contracts for both services.
6. Add service health checks and deployment scripts.
7. Only then present the architecture as a production microservice split.
