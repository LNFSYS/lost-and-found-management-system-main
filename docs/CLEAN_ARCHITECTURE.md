# LNFS Clean Architecture

Updated: 2026-09-09. Current backend: **Node.js + TypeScript modular monolith**.

## Ownership

One deployed Express API owns business writes and MySQL migrations. Java was a health-only Spring Boot skeleton with no business controller, repository or Node integration; it has been removed, including its POM and runtime configuration. The old boundary document is historical, not a deployment option.

React/TypeScript/Vite/PWA remains in `apps/web`. Native mobile remains planned. This refactor does not implement new product workflows or change HTTP contracts, frontend behavior, SQL migrations or shared database data.

## Packages

```text
apps/api-node/src/
  main/                         composition and process lifecycle
    server.ts, app.ts, http.ts   startup, HTTP assembly and route mounting
    database.ts, persistence.ts  one runtime pool, repository and UoW wiring
    services.ts, runtime.ts      provider adapters and use-case factories
  modules/
    auth/                       account, OTP, sessions, profile, avatar
    posts/                      post lifecycle, privacy, media, image draft
    matching/                   explainable rule-based scoring
    claims/                     requests, consent, private room and evidence
    notifications/              in-app notification feed
    warehouse/                  custody, retention and storage logs
    returns/                    feedback, idempotency and reputation
    admin/                      users, catalog, moderation, reports, audit
    system-config/              public/admin configuration and history
  shared/
    domain/                     auth vocabulary, semantic errors, text, media rules
    application/                transaction, private media and logger ports
    infrastructure/             SQL transaction adapter, filesystem, security, config
    interfaces/http/            auth/cookies and HTTP error mapping
  migrations/                   unchanged numbered SQL and migration tools
  integration/                  guarded local-MySQL tests
  test/                         fake ports and isolated scenario fixtures
```

Each feature uses `application`, `infrastructure` and `interfaces/http`. A `domain` package exists where there are actual domain models/rules, not empty placeholder entities: post state/access, claim consent, warehouse transitions/retention, auth sessions, image category selection and matching scoring. Straightforward query modules do not need an empty domain directory.

## Dependency Rules

```text
interfaces/http  ---> application ---> domain
infrastructure  ---> application ports / domain
main            ---> factories from all outer and inner packages
```

- Domain imports domain only. Application imports application abstractions and domain only.
- Core has no Express, mysql2, SQL pool, provider SDK, environment or direct console dependency. Logging is injected.
- Input/output DTOs are plain TypeScript. Zod is an HTTP/provider boundary tool, never a core dependency.
- Repositories implement application-owned ports with `satisfies`; application factories require their dependencies explicitly.
- SQL repositories perform persistence filtering. Post role policy produces a `PostReadScope` before queries; SQL does not determine staff/admin authorization.
- Cross-feature dependencies go through the target's `application/index.ts`. Public exports are deliberately narrow (including type-only ports); composition may import implementation factories to wire them.
- Shared cannot import business modules. No framework, generic repository, DI container or base entity was added.

`npm run check:architecture` parses TypeScript imports, re-exports, import types and literal dynamic imports. It rejects outward dependencies, core external packages/environment/console, deep cross-module imports, unresolved source imports and dependency cycles, including type-only cycles. Checker self-tests cover allowed and forbidden graphs. `npm test` invokes it, so the existing CI verify job enforces it.

## Transactions

`shared/application/transaction.ts` owns `TransactionRunner` and an opaque `TransactionContext`. Application callbacks pass that context to each repository port. `createPersistence(database)` builds every repository against the same pool and maps a context to one checked-out connection through the SQL transaction adapter.

The context exposes no SQL methods; it expires when the callback ends and overlapping transactions get different contexts. The adapter starts, commits/rolls back and releases the connection. Tests check cross-repository rollback, same-transaction reads, media row locks, concurrent last-admin protection and refresh rotation.

Existing persistence locks, SQL uniqueness and idempotency are retained. Files are saved before metadata transactions and cleaned up on rollback; post matching and deletion cleanup remain after commit. Avatar replacement retains its compensating cleanup behavior. No automatic retry of writes has been added.

## HTTP And Providers

Routes retain endpoint paths, methods, role guards, Multer limits and rate limits. Controllers parse/validate, invoke use cases and serialize responses. `AppError` contains semantic codes; only `shared/interfaces/http/error-handler.ts` maps them to the previous status/message JSON. Boundary `HttpError` remains available for transport failures such as uploads and authentication headers. Invalid admin export input still records a failed audit entry.

Main injects Gmail SMTP delivery, Gemini analysis, Cloudinary authenticated avatar storage and namespace-specific private local media storage. Provider implementations own SDK/network details. Domain image rules still validate size, MIME and signatures. Post/evidence URLs remain protected API routes, not raw filesystem/provider locations.

## Verification

Baseline before migration: 143 API tests (141 pass, two guarded DB suites skipped); API/Web builds passed. The repository had no separate API lint script; Web `lint` is TypeScript checking. This remains explicit rather than claiming a nonexistent ESLint run.

Current refactor verification and remaining limits are recorded in [the verification report](CLEAN_ARCHITECTURE_VERIFICATION.md). Browser tests cover auth resilience, post forms/matching, claim-room responses, warehouse/admin screens and mobile layout. The MySQL suite exercises real adapters, migration reconciliation and the composed HTTP runtime against disposable test data; providers are not contacted by that suite.

For isolated database tests, configure `LNFS_DB_INTEGRATION=1` plus `LNFS_TEST_DB_HOST`, `PORT`, `NAME`, `USER`, `PASSWORD`. Host must be loopback and database must end in `_test`; migration tests need create/drop permissions for their random `lnfs_reconcile_*_test` databases. Never use production/Aiven/shared databases for these tests.

## Connectivity

Read-only DNS/TCP and HTTP health/readiness/CORS probes were used during verification; no new connectivity feature or automatic retry was added. A protected catalog 401 is expected without a token.

`EAI_AGAIN`/`ENOTFOUND` indicate name-resolution failures; `ECONNRESET`/`ETIMEDOUT` indicate interrupted/timed-out connections; `EACCES` can indicate local network policy/access restrictions. These log codes alone do not identify the exact provider or prove CORS is broken. Compare the probe time with API logs, verify DB host/port/TLS, DNS, VPN/proxy/firewall and provider availability. Do not disable TLS verification or broaden CORS to bypass a network outage.

Liveness can stay 200 while readiness is 503. The refactor preserves existing error responses; it does not claim to fix an intermittent network outage that was not reproduced. Local-file references remain a multi-instance deployment limitation; shared object storage, production load/UAT, real device PWA and external provider live calls are separate verification scopes.

## Migration Map

See [the file map](CLEAN_ARCHITECTURE_FILE_MAP.md) for old-to-new paths and split responsibilities. The mechanical migration followed the dependency order: shared foundations/ports; notification and configuration; admin/warehouse/returns; matching/posts/claims/auth; HTTP composition; dependency checks and regression verification. No temporary compatibility module remains at the old layer paths.

The [draw.io source](LNFS_NODE_ONLY_ARCHITECTURE.drawio) contains System Architecture, FE Package and BE Package pages. Source dependency arrows are not the same as runtime calls through an injected port.
