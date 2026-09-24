# Markos Backend

NestJS API with strict layered architecture and zero-tolerance quality gates.

## Layered architecture (mandatory)

| Layer | Responsibility | Allowed |
|-------|----------------|---------|
| `*.controller.ts` | HTTP only | Route handlers, DTO validation, delegate to services |
| `*.service.ts` | Business logic | Orchestration, validation rules, exceptions |
| `*.repository.ts` | Database only | TypeORM queries and persistence |

### Rules

- Controllers must **never** import TypeORM, `@nestjs/typeorm`, or repositories.
- Services must **never** import TypeORM or `@nestjs/typeorm`; use repository classes.
- Repositories must **never** import services or controllers.
- Business exceptions (e.g. `NotFoundException`) belong in services, not repositories.

These boundaries are enforced by ESLint (`no-restricted-imports` per file pattern).

## Quality gates (mandatory)

All of the following must pass before every build:

```bash
npm run validate   # lint + audit + deps
npm run build      # validate, then compile
```

| Check | Script | Requirement |
|-------|--------|-------------|
| Lint | `npm run lint` | 0 errors, 0 warnings (`--max-warnings 0`) |
| Security | `npm run audit:check` | 0 vulnerabilities |
| Dependencies | `npm run deps:check` | No semver drift (`current` must equal `wanted`) |

Use `npm run lint:fix` locally to auto-fix formatting issues.

## Module layout

```
src/
  feature/
    feature.controller.ts   # HTTP
    feature.service.ts      # business logic
    feature.repository.ts   # DB access
    feature.module.ts
    dto/
    entities/
```

## Local development

```bash
npm run db:up     # Postgres on port 5435 (requires Docker)
npm run db:local  # Embedded Postgres on port 5435 (no Docker)
npm run dev       # API on port 3008 (auto-starts embedded Postgres if needed)
```

Set `SKIP_DB=true` in `.env` to run the API without Postgres (health returns `degraded` with `database: error`).

## Email campaign tracking

Campaign open/click tracking uses public endpoints at `/track/open/:token` and `/track/click/:token`.

For tracking to work outside local development, set `TRACKING_BASE_URL` in `.env` to a **publicly reachable** backend URL (for example `https://api.yourdomain.com`). If unset, it falls back to `BACKEND_URL`.

Bounce detection polls sender mailboxes over IMAP every 2 minutes (app-password SMTP mailboxes; OAuth mailboxes use Gmail/Graph API when reconnected with inbox scopes).
