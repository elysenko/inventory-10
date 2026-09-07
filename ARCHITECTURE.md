# Architecture

## Requested stack
- `enterprise` (Angular 19 + NestJS + tRPC + Prisma + PostgreSQL) — for StockRoom, per the technical plan.

## Scaffolding status
- `enterprise` — ✅ newly scaffolded from `template-enterprise`. The project directory was empty of source
  (only `.git`, `.github`, and a one-line `README.md` stub existed) prior to this run.

## Layout
- `frontend/` — Angular 19 standalone SPA (project name: `frontend` in `angular.json`). Ships a stub
  `app-root` / `app-home` (`Users` list wired to the `users.findAll` tRPC procedure) that the coder
  agent will replace with the StockRoom UI (auth, items, locations, movements, reports) described in
  the plan.
- `backend/` — NestJS 11 API with a tRPC router (`nestjs-trpc`) and a stub `users` module/router, plus a
  `health` module (`GET /health`, `@nestjs/terminus`). Prisma schema lives at `backend/prisma/schema.prisma`
  and currently only defines the template's placeholder `User` model — the coder agent must replace it
  with the plan's `User`/`Item`/`Location`/`StockLevel`/`Movement` models and add JWT auth, guards, and
  the items/locations/movements/reports modules.
- `.pipeline/surface.json` — manifest of routes, components, and `data-testid`s generated from the
  template's stub source. The coder agent must keep this in sync as it adds real routes/components.
- `.colossus-acceptance.json` — post-deploy render-gate contract. `ready_testid` is `app-ready` (already
  present on `app-root` — do not remove it). `expect_text` is seeded empty; the coder agent must fill it
  with real front-page content once StockRoom's actual UI replaces the stub `Users` list.
- `colossus.yaml` — build manifest for deploy agents (Angular frontend + NestJS backend, ports 80/3001).

## Next steps for the coder agent
1. Replace the Prisma schema (`backend/prisma/schema.prisma`) with the plan's models and write
   `backend/prisma/seed.ts`.
2. Implement the backend modules described in the plan (auth, items, locations, movements, reports,
   health) on top of the existing NestJS/tRPC/Prisma scaffold.
3. Implement the Angular UI (shell, auth guards/interceptor, feature routes) per the plan's route table,
   replacing the stub `home` component.
4. Update `.pipeline/surface.json` and `.colossus-acceptance.json` (`expect_text`) to reflect the real
   routes, components, test ids, and front-page content.
5. Copy `.env.example` → `.env` (root) and set `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT` —
   no `.env.template` ships with this template, so the coder agent must author `.env.example` per the plan.
6. Local dev: `docker-compose up` for Postgres, then `npx prisma migrate dev` inside `backend/`.

## Template sources
- `template-enterprise` from the scaffold-templates repository (Angular 19 + NestJS 11 + tRPC +
  Prisma + PostgreSQL).
