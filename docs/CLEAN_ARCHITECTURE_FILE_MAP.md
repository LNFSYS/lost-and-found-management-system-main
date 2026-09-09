# Clean Architecture File Map

Refactor date: 2026-09-09. Paths are relative to `apps/api-node/src`. Public HTTP contracts and numbered SQL migrations are unchanged.

| Previous path | Current path |
| --- | --- |
| `app.test.ts` | `main/app.test.ts` |
| `app.ts` | `main/app.ts` |
| `config/cors.test.ts` | `shared/infrastructure/config/cors.test.ts` |
| `config/cors.ts` | `shared/infrastructure/config/cors.ts` |
| `config/db.test.ts` | `shared/infrastructure/config/db.test.ts` |
| `config/db.ts` | `shared/infrastructure/config/db.ts` |
| `config/env.test.ts` | `shared/infrastructure/config/env.test.ts` |
| `config/env.ts` | `shared/infrastructure/config/env.ts` |
| `controllers/admin-catalog.controller.ts` | `modules/admin/interfaces/http/admin-catalog.controller.ts` |
| `controllers/admin-reporting.controller.ts` | `modules/admin/interfaces/http/admin-reporting.controller.ts` |
| `controllers/admin-user.controller.ts` | `modules/admin/interfaces/http/admin-user.controller.ts` |
| `controllers/auth.controller.ts` | `modules/auth/interfaces/http/auth.controller.ts` |
| `controllers/claim.controller.ts` | `modules/claims/interfaces/http/claim.controller.ts` |
| `controllers/notification.controller.ts` | `modules/notifications/interfaces/http/notification.controller.ts` |
| `controllers/post.controller.ts` | `modules/posts/interfaces/http/post.controller.ts` |
| `controllers/return-feedback.controller.ts` | `modules/returns/interfaces/http/return-feedback.controller.ts` |
| `controllers/system-config.controller.ts` | `modules/system-config/interfaces/http/system-config.controller.ts` |
| `controllers/warehouse.controller.ts` | `modules/warehouse/interfaces/http/warehouse.controller.ts` |
| `integration/database.integration.test.ts` | `integration/database.integration.test.ts` |
| `integration/migration-reconciliation.integration.test.ts` | `integration/migration-reconciliation.integration.test.ts` |
| `middlewares/auth.middleware.test.ts` | `shared/interfaces/http/auth.middleware.test.ts` |
| `middlewares/auth.middleware.ts` | `shared/interfaces/http/auth.middleware.ts` |
| `migrations/claim-schema-verification.ts` | `migrations/claim-schema-verification.ts` |
| `migrations/migration-runner.test.ts` | `migrations/migration-runner.test.ts` |
| `migrations/migration-runner.ts` | `migrations/migration-runner.ts` |
| `migrations/migration-state.ts` | `migrations/migration-state.ts` |
| `migrations/reconcile-claim-migration.ts` | `migrations/reconcile-claim-migration.ts` |
| `migrations/run-migrations.ts` | `migrations/run-migrations.ts` |
| `migrations/run-reconciliation.ts` | `migrations/run-reconciliation.ts` |
| `repositories/admin-audit.repository.ts` | `modules/admin/infrastructure/admin-audit.repository.ts` |
| `repositories/admin-catalog.repository.ts` | `modules/admin/infrastructure/admin-catalog.repository.ts` |
| `repositories/admin-reporting.repository.ts` | `modules/admin/infrastructure/admin-reporting.repository.ts` |
| `repositories/admin-user.repository.test.ts` | `modules/admin/infrastructure/admin-user.repository.test.ts` |
| `repositories/admin-user.repository.ts` | `modules/admin/infrastructure/admin-user.repository.ts` |
| `repositories/auth.repository.test.ts` | `modules/auth/infrastructure/auth.repository.test.ts` |
| `repositories/auth.repository.ts` | `modules/auth/infrastructure/auth.repository.ts` |
| `repositories/claim.repository.test.ts` | `modules/claims/infrastructure/claim.repository.test.ts` |
| `repositories/claim.repository.ts` | `modules/claims/infrastructure/claim.repository.ts` |
| `repositories/matching.repository.test.ts` | `modules/matching/infrastructure/matching.repository.test.ts` |
| `repositories/matching.repository.ts` | `modules/matching/infrastructure/matching.repository.ts` |
| `repositories/notification.repository.ts` | `modules/notifications/infrastructure/notification.repository.ts` |
| `repositories/post.repository.test.ts` | `modules/posts/infrastructure/post.repository.test.ts` |
| `repositories/post.repository.ts` | `modules/posts/infrastructure/post.repository.ts` |
| `repositories/return-feedback.repository.ts` | `modules/returns/infrastructure/return-feedback.repository.ts` |
| `repositories/system-config.repository.ts` | `modules/system-config/infrastructure/system-config.repository.ts` |
| `repositories/user.repository.ts` | `modules/auth/infrastructure/user.repository.ts` |
| `repositories/warehouse.repository.test.ts` | `modules/warehouse/infrastructure/warehouse.repository.test.ts` |
| `repositories/warehouse.repository.ts` | `modules/warehouse/infrastructure/warehouse.repository.ts` |
| `routes/admin.routes.ts` | `modules/admin/interfaces/http/admin.routes.ts` |
| `routes/auth.routes.ts` | `modules/auth/interfaces/http/auth.routes.ts` |
| `routes/claim.routes.ts` | `modules/claims/interfaces/http/claim.routes.ts` |
| `routes/config.routes.ts` | `modules/system-config/interfaces/http/config.routes.ts` |
| `routes/handover.routes.ts` | `modules/admin/interfaces/http/handover.routes.ts` |
| `routes/notification.routes.ts` | `modules/notifications/interfaces/http/notification.routes.ts` |
| `routes/post.routes.ts` | `modules/posts/interfaces/http/post.routes.ts` |
| `routes/return.routes.ts` | `modules/returns/interfaces/http/return.routes.ts` |
| `routes/staff.routes.ts` | `modules/warehouse/interfaces/http/staff.routes.ts` |
| `server.ts` | `main/server.ts` |
| `services/admin-catalog.service.test.ts` | `modules/admin/application/admin-catalog.use-cases.test.ts` |
| `services/admin-catalog.service.ts` | `modules/admin/application/admin-catalog.use-cases.ts` |
| `services/admin-reporting.service.test.ts` | `modules/admin/application/admin-reporting.use-cases.test.ts` |
| `services/admin-reporting.service.ts` | `modules/admin/application/admin-reporting.use-cases.ts` |
| `services/admin-user.service.test.ts` | `modules/admin/application/admin-user.use-cases.test.ts` |
| `services/admin-user.service.ts` | `modules/admin/application/admin-user.use-cases.ts` |
| `services/auth.service.test.ts` | `modules/auth/application/auth.use-cases.test.ts` |
| `services/auth.service.ts` | `modules/auth/application/auth.use-cases.ts` |
| `services/claim.service.test.ts` | `modules/claims/application/claim.use-cases.test.ts` |
| `services/claim.service.ts` | `modules/claims/application/claim.use-cases.ts` |
| `services/email.service.ts` | `modules/auth/infrastructure/email.service.ts` |
| `services/gemini-image.service.test.ts` | `modules/posts/infrastructure/gemini-image.service.test.ts` |
| `services/gemini-image.service.ts` | `modules/posts/infrastructure/gemini-image-analyzer.ts` |
| `services/matching.engine.test.ts` | `modules/matching/domain/matching.engine.test.ts` |
| `services/matching.engine.ts` | `modules/matching/domain/matching.engine.ts` |
| `services/matching.service.test.ts` | `modules/matching/application/matching.use-cases.test.ts` |
| `services/matching.service.ts` | `modules/matching/application/matching.use-cases.ts` |
| `services/notification.service.test.ts` | `modules/notifications/application/notification.use-cases.test.ts` |
| `services/notification.service.ts` | `modules/notifications/application/notification.use-cases.ts` |
| `services/post.service.test.ts` | `modules/posts/application/post.use-cases.test.ts` |
| `services/post.service.ts` | `modules/posts/application/post.use-cases.ts` |
| `services/return-feedback.service.test.ts` | `modules/returns/application/return-feedback.use-cases.test.ts` |
| `services/return-feedback.service.ts` | `modules/returns/application/return-feedback.use-cases.ts` |
| `services/system-config.service.test.ts` | `modules/system-config/application/system-config.use-cases.test.ts` |
| `services/system-config.service.ts` | `modules/system-config/application/system-config.use-cases.ts` |
| `services/warehouse.service.test.ts` | `modules/warehouse/application/warehouse.use-cases.test.ts` |
| `services/warehouse.service.ts` | `modules/warehouse/application/warehouse.use-cases.ts` |
| `shared/application/transaction.ts` | `shared/application/transaction.ts` |
| `test/setup-env.ts` | `test/setup-env.ts` |
| `types/auth.ts` | `shared/domain/auth.ts` |
| `utils/auth-cookie.test.ts` | `shared/interfaces/http/auth-cookie.test.ts` |
| `utils/auth-cookie.ts` | `shared/interfaces/http/auth-cookie.ts` |
| `utils/cloudinary-avatar-storage.test.ts` | `modules/auth/infrastructure/cloudinary-avatar-storage.test.ts` |
| `utils/cloudinary-avatar-storage.ts` | `modules/auth/infrastructure/cloudinary-avatar-storage.ts` |
| `utils/http-error.ts` | `shared/interfaces/http/http-error.ts` |
| `utils/media-storage.test.ts` | `shared/infrastructure/media-storage.test.ts` |
| `utils/media-storage.ts` | `shared/infrastructure/media-storage.ts` |
| `utils/media.test.ts` | `shared/domain/media.test.ts` |
| `utils/media.ts` | `shared/domain/media.ts` |
| `utils/security.test.ts` | `shared/infrastructure/security.test.ts` |
| `utils/security.ts` | `shared/infrastructure/security.ts` |
| `utils/text.ts` | `shared/domain/text.ts` |
| `validators/admin-catalog.validator.test.ts` | `modules/admin/interfaces/http/admin-catalog.validator.test.ts` |
| `validators/admin-catalog.validator.ts` | `modules/admin/interfaces/http/admin-catalog.validator.ts` |
| `validators/admin-reporting.validator.ts` | `modules/admin/interfaces/http/admin-reporting.validator.ts` |
| `validators/admin-user.validator.test.ts` | `modules/admin/interfaces/http/admin-user.validator.test.ts` |
| `validators/admin-user.validator.ts` | `modules/admin/interfaces/http/admin-user.validator.ts` |
| `validators/auth.validator.test.ts` | `modules/auth/interfaces/http/auth.validator.test.ts` |
| `validators/auth.validator.ts` | `modules/auth/interfaces/http/auth.validator.ts` |
| `validators/claim.validator.test.ts` | `modules/claims/interfaces/http/claim.validator.test.ts` |
| `validators/claim.validator.ts` | `modules/claims/interfaces/http/claim.validator.ts` |
| `validators/notification.validator.ts` | `modules/notifications/interfaces/http/notification.validator.ts` |
| `validators/post.validator.test.ts` | `modules/posts/interfaces/http/post.validator.test.ts` |
| `validators/post.validator.ts` | `modules/posts/interfaces/http/post.validator.ts` |
| `validators/return-feedback.validator.ts` | `modules/returns/interfaces/http/return-feedback.validator.ts` |
| `validators/system-config.validator.test.ts` | `modules/system-config/interfaces/http/system-config.validator.test.ts` |
| `validators/system-config.validator.ts` | `modules/system-config/interfaces/http/system-config.validator.ts` |
| `validators/warehouse.validator.ts` | `modules/warehouse/interfaces/http/warehouse.validator.ts` |

## Responsibility Splits

- Each SQL repository now implements its sibling application-owned `*.repository.port.ts`; no core SQL type is exposed.
- Each old service became a required-dependency `create*UseCases` factory. SQL/network/filesystem adapters are composed in `main/persistence.ts` and `main/services.ts`.
- Zod validator-inferred DTOs became plain `*.dto.ts`; validators remain under `interfaces/http`.
- Gemini service split into `image-analysis.use-cases.ts`, `image-analyzer.port.ts`, `domain/image-category.ts` and `infrastructure/gemini-image-analyzer.ts`.
- Post types/state/access moved to `posts/domain`; claim consent/status moved to `claims/domain`; warehouse retention/state moved to `warehouse/domain`; auth session policy moved to `auth/domain`.
- `HttpError` is now HTTP-only; semantic `shared/domain/app-error.ts` is mapped at the edge with unchanged responses.
- Media storage uses an application port and namespace-specific filesystem adapters; logger and transaction ports are shared application abstractions.
- System-config routes now own `/api/admin/configs`; main mounts that router before `/api/admin` with the same guards.
- Module-to-module imports use narrow `application/index.ts` exports. Main alone wires concrete adapters.
- Old layer directories and all Java skeleton files are removed. Migration SQL IDs/content/checksums remain unchanged.
