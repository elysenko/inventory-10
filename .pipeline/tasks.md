# Pipeline Task Decomposition

## Summary
StockRoom is a multi-location inventory system: an Angular 19 standalone SPA over a NestJS 11 + Prisma 6 (PostgreSQL) API with JWT auth and role-based guards. Managers maintain a catalogue of items (SKU, unit, reorder threshold) and storage locations (zones); any authenticated user records stock movements (IN / OUT / TRANSFER) that mutate per-location balances inside a serializable transaction, never allowing a balance to go negative. Managers additionally get a filterable, paginated audit log of every movement and a low-stock report (`SUM(qty) <= reorderAt`). Admins get a settings screen for backing-service credentials (postgresql, minio).

## Surface contract

### Roles
`ADMIN` (platform/admin section) · `MANAGER` (spec's "manager": full catalogue + reports + audit log) · `USER` (spec's "clerk": read catalogue, record movements). Auth model is **full_auth**: public `/login` and `/signup`; first signup becomes `ADMIN`, later signups `USER`; platform-minted `ColossusAccount` logins seeded from `COLOSSUS_ACCOUNTS_JSON`. Every manager-only rule below is satisfied by `ADMIN` too.

### REST API (all under global prefix `/api`)
| Method | Path | Access |
|---|---|---|
| POST | `/api/auth/signup` | public |
| POST | `/api/auth/login` | public |
| POST | `/api/auth/logout` | auth (204) |
| GET | `/api/auth/me` | auth |
| GET | `/api/items?q=&low=` | auth |
| GET | `/api/items/:id` | auth |
| POST | `/api/items` | MANAGER/ADMIN |
| PATCH | `/api/items/:id` | MANAGER/ADMIN |
| DELETE | `/api/items/:id` | MANAGER/ADMIN |
| GET | `/api/locations` | auth |
| POST | `/api/locations` | MANAGER/ADMIN |
| PATCH | `/api/locations/:id` | MANAGER/ADMIN |
| DELETE | `/api/locations/:id` | MANAGER/ADMIN |
| POST | `/api/movements` | auth |
| GET | `/api/movements?itemId=&type=&from=&to=&page=&pageSize=` | MANAGER/ADMIN |
| GET | `/api/reports/low-stock` | MANAGER/ADMIN |
| GET | `/api/admin/settings` | ADMIN |
| PATCH | `/api/admin/settings` | ADMIN |
| GET | `/api/health`, `/api/health/deep` | public |

### Entities
`User(id, email, name?, passwordHash, role, createdAt, updatedAt)` · `Item(id, sku unique, name, description?, unit, reorderAt)` · `Location(id, name unique, zone)` · `StockLevel(id, itemId, locationId, qty, @@unique([itemId, locationId]))` · `Movement(id, type, itemId, fromLocId?, toLocId?, qty, note?, userId, createdAt)` · `SystemSetting(key, value, updatedAt)` · `ColossusAccount` (already scaffolded, untouched). Enums: `Role { USER MANAGER ADMIN }`, `MovementType { IN OUT TRANSFER }`.

### Angular routes (each with `data.flow`)
`/login` (public, `auth.login`) · `/signup` (public, `auth.signup`) · `/items?q=&low=` (auth, `items.list`) · `/items/new` (manager, `items.create`) · `/items/:id?tab=locations|movements` (auth, `items.detail`) · `/items/:id/edit` (manager, `items.edit`) · `/locations` (auth, `locations.list`) · `/locations/new` (manager, `locations.create`) · `/locations/:id/edit` (manager, `locations.edit`) · `/movements/new?type=&itemId=&fromLocId=` (auth, `movements.create`) · `/movements?itemId=&type=&from=&to=&page=` (manager, `movements.log`) · `/reports/low-stock` (manager, `reports.lowStock`) · `/admin/settings` (admin, `admin.settings`) · any route + `?modal=confirm-delete&id=` · `''` → `/items` · `**` → `/items`. Brand text **StockRoom** in the shell header and `index.html` `<title>` (smoke marker).

## db_agent tasks
- [ ] Extend `backend/prisma/schema.prisma`: keep the existing `Role { USER MANAGER ADMIN }` enum and `ColossusAccount` model as-is; change `User.role` to `Role @default(USER)` (already) and add the relation `movements Movement[]`.
- [ ] Add `enum MovementType { IN OUT TRANSFER }` and `model Item { id String @id @default(uuid()) sku String @unique name String description String? unit String reorderAt Int @default(0) createdAt/updatedAt stockLevels StockLevel[] movements Movement[] }`.
- [ ] Add `model Location { id String @id @default(uuid()) name String @unique zone String stockLevels StockLevel[] }`.
- [ ] Add `model StockLevel { id, itemId, locationId, qty Int @default(0), item/location relations, @@unique([itemId, locationId]) }` — the compound unique is required for safe balance upserts.
- [ ] Add `model Movement { id, type MovementType, itemId, fromLocId String?, toLocId String?, qty Int, note String?, userId, createdAt DateTime @default(now()), relations to Item and User, @@index([itemId, createdAt]), @@index([createdAt]) }`.
- [ ] Add `model SystemSetting { key String @id, value String, updatedAt DateTime @updatedAt }` for admin-configurable service credentials (postgresql, minio).
- [ ] Generate the migration for all new models/enums (`prisma migrate dev --name stockroom_inventory`) and verify `npx prisma generate` succeeds.
- [ ] Extend `backend/prisma/seed/seed.js` idempotently (upsert only, safe to re-run on every boot): keep the `COLOSSUS_ACCOUNTS_JSON` account materialization untouched; upsert 3 locations `Zone A`/`Zone B`/`Zone C` (each with a `zone` value) by `name` and 8 items by `sku`.
- [ ] In the seed, upsert opening `StockLevel` rows (compound key `itemId_locationId`) so balances are non-zero across the 3 locations, with at least one item at or below its `reorderAt`, plus a handful of historical `Movement` rows attributed to a seeded account so the audit log is non-empty on first load.

## backend_agent tasks
- [ ] `src/main.ts`: `app.setGlobalPrefix('api')`, global `ValidationPipe({ whitelist: true, transform: true })`, bind `0.0.0.0` on `PORT`.
- [ ] `src/app.module.ts`: wire `ConfigModule.forRoot({ isGlobal: true })`, the Prisma module, and the new Auth/Items/Locations/Movements/Reports/AdminSettings modules; register `APP_GUARD` for `JwtAuthGuard` then `RolesGuard` (deny-by-default, opt out with `@Public()`).
- [ ] `src/auth/`: `auth.module.ts` (JwtModule with `JWT_SECRET`/`JWT_EXPIRES_IN`), `jwt.strategy.ts` (validates `sub`/`email`/`role`, re-loads the user onto `req.user`), `jwt-auth.guard.ts`, `roles.guard.ts` (missing/invalid token → 401; wrong role → 403), and decorators `public.decorator.ts`, `roles.decorator.ts`, `current-user.decorator.ts`.
- [ ] `src/auth/auth.controller.ts` + `auth.service.ts` + `dto/signup.dto.ts`, `dto/login.dto.ts`: `POST /api/auth/signup` (`@Public`, email + password min 8; user count and insert in ONE transaction so `count === 0 → ADMIN`, else `USER`; duplicate email `P2002` → 409), `POST /api/auth/login` (`@Public`, bcryptjs compare, returns `{ accessToken, user: { id, email, role } }`, generic 401 on failure), `GET /api/auth/me`, `POST /api/auth/logout` → 204.
- [ ] `src/items/` module + controller + service: `GET /api/items` (auth) including `stockLevels` to compute `totalQty` and `lowStock: totalQty <= reorderAt`, supporting `?q=` (case-insensitive contains on sku/name) and `?low=true`.
- [ ] `GET /api/items/:id` — item plus `levels: [{ locationId, locationName, zone, qty }]` and `totalQty` (breakdown sums to total); 404 when missing.
- [ ] `src/items/dto/create-item.dto.ts` + `update-item.dto.ts` and the `@Roles(MANAGER, ADMIN)` `POST`/`PATCH`/`DELETE /api/items/:id`: `sku` non-empty trimmed, `name`, `description?`, `unit`, `reorderAt @IsInt @Min(0)`; duplicate SKU `P2002` → 409 with a field-level validation message (no second row created); DELETE → 409 if any `StockLevel.qty > 0` or referencing movements exist.
- [ ] `src/locations/` module + controller + service + DTOs: `GET /api/locations` for any authenticated user (populates movement-form selects); `POST`/`PATCH`/`DELETE` `@Roles(MANAGER, ADMIN)`; duplicate `name` `P2002` → 409; delete blocked (409) when stock is non-zero.
- [ ] `src/movements/dto/create-movement.dto.ts`: `type @IsEnum(MovementType)`, `itemId`, `fromLocId?`, `toLocId?`, `qty @IsInt @Min(1)`, `note?`, plus a class-level validator — `IN` requires `toLocId` and forbids `fromLocId`; `OUT` requires `fromLocId` and forbids `toLocId`; `TRANSFER` requires both with `fromLocId !== toLocId`.
- [ ] `src/movements/movements.service.ts` `create()`: run inside `prisma.$transaction(fn, { isolationLevel: 'Serializable' })` — verify item/locations exist (404), for `OUT`/`TRANSFER` read the source `StockLevel` and throw `BadRequestException` when missing or `qty < dto.qty` (aborting the tx so the stored balance is untouched), apply deltas via `tx.stockLevel.upsert` on `itemId_locationId` (`decrement` source / `increment` destination), write the `Movement` with `userId` from the JWT; return the movement plus affected balances.
- [ ] Wrap `create()` in a retry helper (up to 3 attempts on Prisma `P2034` write conflict) so concurrent writers serialize instead of 500ing.
- [ ] `src/movements/movements.controller.ts` + `dto/query-movements.dto.ts`: `POST /api/movements` (any authenticated) and `GET /api/movements` `@Roles(MANAGER, ADMIN)` with `?itemId=`, `?type=`, `?from=`/`?to=` (ISO dates, `to` inclusive to end-of-day), `?page=`, `?pageSize=` (default 25), ordered `createdAt DESC`, including `user: { email, role }`, `item: { sku, name }` and resolved from/to location names; returns `{ data, total, page, pageSize }`.
- [ ] `src/reports/` module + controller + service: `GET /api/reports/low-stock` `@Roles(MANAGER, ADMIN)` — single `$queryRaw` aggregating `StockLevel` by `itemId` joined to `Item`, returning items where `COALESCE(SUM(qty),0) <= reorderAt` (including items with no stock rows, total 0), ordered by shortfall descending, typed via a result interface.
- [ ] `src/lib/config.ts`: `resolveConfig(key: string): Promise<string | null>` — reads `process.env[key]` first; when absent or equal to `PLACEHOLDER_CONFIGURE_IN_SETTINGS`, falls back to the `SystemSetting` row for that key; returns null if neither is set. Export a `ServiceUnconfiguredError` mapped to HTTP 503.
- [ ] `src/admin/settings.controller.ts` + `settings.service.ts` `@Roles(ADMIN)`: `GET /api/admin/settings` lists the credential keys for **postgresql** (`DATABASE_URL`) and **minio** (`MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`) with masked values and a `configured` flag; `PATCH /api/admin/settings` upserts key/value pairs into `SystemSetting`.
- [ ] `src/health/health.controller.ts`: `@Public() GET /api/health` → `{ status: 'ok' }`; `@Public() GET /api/health/deep` → `SELECT 1` through Prisma, returns `{ status, db }`, 503 on failure.

## ui_agent tasks
- [ ] `frontend/src/index.html` `<title>StockRoom</title>` and `app.component.ts|html`: shell with the literal brand text **StockRoom** in the header (smoke marker), role-aware nav (Items, Locations, Movements/Reports for managers, Admin for admins), logout button, `data-testid="app-ready"` preserved.
- [ ] `frontend/src/app/app.config.ts`: `provideRouter(routes, withComponentInputBinding())` and `provideHttpClient(withInterceptors([authInterceptor]))`.
- [ ] `frontend/src/app/routes.ts` (replacing the scaffold `app.routes.ts` table): every route from the Surface contract with its guard and `data.flow`, `''` → `/items`, `**` → `/items`, lazy `loadComponent` per feature.
- [ ] `features/auth/login.component` — email/password reactive form, shows the API's generic 401 message inline, honours `?returnUrl=`, link to signup.
- [ ] `features/auth/signup.component` — email/password (min 8) + confirm, surfaces the 409 duplicate-email error on the email field.
- [ ] `features/items/item-list.component` — table of sku / name / unit / reorderAt / totalQty with a low-stock badge, search box bound to `?q=` via `Router.navigate({ queryParams, queryParamsHandling: 'merge' })`, low-stock filter toggle; "New item" / "Edit" / "Delete" rendered only for managers; empty, loading and error states.
- [ ] `features/items/item-detail.component` — header stats (totalQty, reorderAt, low-stock badge), per-location breakdown table with a footer total row, and a movements tab driven by `?tab=locations|movements`.
- [ ] `features/items/item-form.component` — one reactive-form component for create and edit driven by the presence of `:id`; maps the API's duplicate-SKU 409 to a field-level error on `sku`.
- [ ] `features/locations/location-list.component` and `location-form.component` — mirror the item list/form shape (name, zone), manager-only mutation controls, 409 name-conflict surfaced on the `name` field.
- [ ] `shared/confirm-dialog.component.ts` — deletion confirmation driven by `?modal=confirm-delete&id=`, used by item and location lists; renders the API's 409 "has stock/movements" message when deletion is blocked.
- [ ] `features/movements/movement-form.component` — IN/OUT/TRANSFER selector that conditionally shows source/destination selects mirroring the DTO rules, item typeahead, qty, note; prefills from `?type=&itemId=&fromLocId=`; on 400 shows the server's insufficient-stock message inline without clearing the form.
- [ ] `features/movements/movement-log.component` — filter bar (item, type, date range) bound to query params so a filtered view is shareable; columns timestamp, user email, item, type, qty, from → to, note; pagination bound to `?page=`.
- [ ] `features/reports/low-stock.component` — table of sku, name, on-hand, reorderAt, shortfall with a "Record stock in" link deep-linking to `/movements/new?type=IN&itemId=…`; empty state when nothing is low.
- [ ] `features/admin/settings.component` at `/admin/settings` — one section per backing service (**postgresql**, **minio**) with a configured/unconfigured badge and a credential form per service; masked current values; saves via `PATCH /api/admin/settings`. Render the placeholder banner ("The following need credentials to activate: …") only when the settings API reports unconfigured keys.
- [ ] Add stable `data-testid` attributes for every list, form, row, badge, empty state and error state named above so the tester can drive the UI deterministically.

## service_agent tasks
- [ ] `core/models.ts` — TypeScript interfaces for `User`, `Role`, `Item`, `ItemDetail`, `StockLevelView`, `Location`, `Movement`, `MovementType`, `MovementPage`, `LowStockRow`, `SettingEntry` matching the backend response shapes exactly.
- [ ] `core/api.service.ts` — typed `HttpClient` wrapper over the `/api` base with generic `get/post/patch/delete` helpers and normalized error extraction (status + server message) for form-level error display.
- [ ] `core/auth.service.ts` — signals `token`, `user`, `isManager`, `isAdmin`; `login()`/`signup()` persist the token to `localStorage` and hydrate `user` from `GET /api/auth/me` on bootstrap; `logout()` clears state and navigates to `/login`.
- [ ] `core/auth.interceptor.ts` (functional) — attaches `Authorization: Bearer` when a token exists; on 401 clears auth state and redirects to `/login?returnUrl=…`.
- [ ] `core/auth.guard.ts` (`authGuard`) and `core/role.guard.ts` (`managerGuard` requiring MANAGER/ADMIN, `adminGuard` requiring ADMIN) — clerks hitting a manager route are redirected to `/items`.
- [ ] `core/items.api.ts` — list (with `q`/`low` query params), get by id, create, update, delete against `/api/items`.
- [ ] `core/locations.api.ts` — list, create, update, delete against `/api/locations`.
- [ ] `core/movements.api.ts` — `create()` against `POST /api/movements` and paginated `list()` passing `itemId`, `type`, `from`, `to`, `page`, `pageSize` through to `GET /api/movements`.
- [ ] `core/reports.api.ts` and `core/settings.api.ts` — `GET /api/reports/low-stock`; `GET`/`PATCH /api/admin/settings`.

## tester tasks
- [ ] `backend/test/auth.e2e-spec.ts` — signup on an empty DB yields ADMIN and a second signup yields USER; login returns the correct role; unauthenticated `GET /api/items` → 401; a USER `POST /api/items` and `POST /api/locations` → 403.
- [ ] `backend/test/items.e2e-spec.ts` — a manager creates an item and it appears in the list; duplicate `SKU-001` → 4xx *and* a follow-up `GET` confirms exactly one row; a clerk's list response exposes sku, name, unit, reorderAt, totalQty.
- [ ] `backend/test/locations.e2e-spec.ts` — manager CRUD works; duplicate name → 409; deleting a location holding non-zero stock → 409.
- [ ] `backend/test/movements.e2e-spec.ts` — IN 50 into Zone A on a zero item → balance 50 plus a Movement row carrying user, qty, type, timestamp; OUT 20 → 30; TRANSFER 10 from A(30) to B(0) → A 20, B 10, total unchanged.
- [ ] `backend/test/movements-guard.e2e-spec.ts` — OUT 10 against 5 on hand → 400 *and* a re-read still shows 5; DTO validation rejects `IN` with `fromLocId`, `OUT` with `toLocId`, and `TRANSFER` with equal from/to.
- [ ] `backend/test/movements-concurrency.e2e-spec.ts` — two simultaneous OUT calls against a balance that only satisfies one: exactly one succeeds and the balance never goes negative.
- [ ] `backend/test/reports-low-stock.e2e-spec.ts` — an item at reorderAt 10 with 12 on hand appears after an OUT of 5 (boundary `<=`); an item with 40 on hand is absent; an item with no stock rows is included at total 0.
- [ ] `backend/test/audit-log.e2e-spec.ts` — log entries expose user, item, type, qty, timestamp; filtering by `itemId` and by `from`/`to` returns only matching rows; pagination returns `{ data, total, page, pageSize }`.
- [ ] `backend/test/health.e2e-spec.ts` and `admin-settings.e2e-spec.ts` — `/api/health` and `/api/health/deep` return ok against a live DB; a non-admin `GET /api/admin/settings` → 403; an admin `PATCH` then `GET` round-trips a masked, `configured: true` entry.
- [ ] Browser smoke walk — load `/`, assert the visible text contains **StockRoom**, then log in → `/items` → record a movement → confirm the balance updates; also assert the SPA deep-link `/items/<id>` renders rather than 404ing.

## Open questions
- **REST vs tRPC.** The spec defines REST controllers under `/api`, but the scaffold ships `nestjs-trpc` (`src/trpc/*`, `src/users/users.router.ts`) and `colossus.stack.json` declares `glue.api_client: "trpc"`. These tasks follow the spec (REST). Downstream agents must decide whether to delete the scaffolded tRPC users router/module or leave it inert alongside the REST controllers; leaving it requires keeping `/trpc/*` out of the global `/api` prefix.
- **Role naming.** The spec names roles `clerk`/`manager`, while the scaffold's `Role` enum and the platform account contract use `USER`/`MANAGER`/`ADMIN` (and the injected auth model is `full_auth` with admin + user). These tasks map clerk → `USER` and manager → `MANAGER`, with `ADMIN` inheriting every manager permission. Confirm whether first signup should become `ADMIN` (per the full_auth rule, adopted here) or `MANAGER` (per the spec text).
- **Serve topology.** The spec assumes one container with `ServeStaticModule` serving the Angular bundle from `./client`, but the scaffold uses `serve_topology: nginx_frontend_plus_backend_supervisor` with separate `backend/Dockerfile` and frontend nginx targets managed by Colossus. These tasks assume the scaffolded topology stands; no `ServeStaticModule` task is listed. Confirm before anyone rewrites the Dockerfiles.
- **minio.** `minio` is a provisioned backing service but the spec describes no file/object storage feature. Only the admin settings surface for its credentials is scoped here — no upload behaviour is invented.
- **Integrations.** `<spec_integrations>` contains only the literal placeholder `None` / `NONE_API_KEY`, matching the spec's "Integrations: None". No integration client module is scoped; if a real integration was intended, it must be added to the spec first.
- **File budget.** `.pipeline/surface.json` caps files at 400 lines (hard limit 500) — `movements.service.ts` and `movement-log.component.ts` are the likeliest to overflow and may need helper-file splits.
- **Seed data vs platform accounts.** The spec seeds two demo users with a known weak password, while the scaffold seeds only platform-minted `COLOSSUS_ACCOUNTS_JSON` logins. These tasks keep the platform accounts and seed no demo users; confirm whether extra demo logins are wanted.
