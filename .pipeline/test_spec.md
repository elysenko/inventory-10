# Test Specification

> **WARNING — `surface.json` is stale and was not used as the endpoint source of truth.**
> `.pipeline/surface.json` is unmodified scaffold output. It declares only three routes
> (`GET /health`, `GET /trpc/users.findAll`, `GET /trpc/users.findById`) and two scaffold
> components (`app-root`, `app-home`), none of which correspond to the StockRoom spec.
> The API surface below is therefore derived from `requirements/spec.md` (absent from disk;
> supplied inline in the pipeline input) reconciled with the Surface contract in
> `.pipeline/tasks.md`, which is the current authoritative route table.
> **Action for the pipeline:** regenerate `surface.json` from the implemented controllers before
> using it for coverage gating.
>
> **Two unresolved contradictions carried from `tasks.md` "Open questions" affect assertions below.**
> 1. *Role naming.* The spec says `clerk` / `manager`; the scaffold and `tasks.md` say
>    `USER` / `MANAGER` / `ADMIN` with first signup → `ADMIN`. Tests below assert **behaviour**
>    (privilege level), and accept either literal via the mapping
>    `clerk ≡ USER` and `manager ≡ MANAGER ∨ ADMIN`. Any test asserting a literal role string
>    reads it from a single shared fixture constant so one edit re-points the whole suite.
> 2. *Serve topology.* The spec assumes one container with `ServeStaticModule` serving `./client`;
>    `tasks.md` assumes the scaffolded nginx-plus-backend topology. Journey J-11 (deep-link)
>    asserts the observable outcome — `/items/<id>` returns the SPA shell, not a 404 — which holds
>    under either topology.

## Coverage summary
- Total cases: 245 (161 API · 71 UI/journey · 13 data integrity)
- API endpoints covered: 20 / 20 (against the reconciled spec+tasks route table; `surface.json` lists 3 routes, 2 of which — `/trpc/users.*` — are out of scope, see **Out of scope**)
- User journeys covered: 12

## API tests

Shared fixtures used throughout: `MANAGER_TOKEN` (a MANAGER/ADMIN-level account), `CLERK_TOKEN`
(a USER-level account), `ADMIN_TOKEN` (ADMIN specifically), `NO_TOKEN`, and `BAD_TOKEN`
(a syntactically valid JWT signed with the wrong secret). Every suite runs against a disposable
schema seeded to a known state; no test depends on another test's mutations except where a case
explicitly says "continuing from".

### `POST /api/auth/signup`
- **Happy path**:
  - `A-01` On an empty `User` table, `{email:"first@example.com", password:"Passw0rd!"}` → `201`, body `{accessToken: <non-empty string>, user:{id, email:"first@example.com", role: <privileged role>}}`; the returned role grants access to `POST /api/items` (verified by a follow-up call with the returned token → `201`).
  - `A-02` A second signup `{email:"second@example.com", password:"Passw0rd!"}` on the now-non-empty table → `201`, `user.role` is the **unprivileged** role; a follow-up `POST /api/items` with that token → `403`.
  - `A-03` `passwordHash` and `password` are absent from every signup response body (assert the serialized JSON has no key matching `/password/i`).
- **Validation failures**:
  - `A-04` `{email:"not-an-email", password:"Passw0rd!"}` → `400`, message references `email`.
  - `A-05` `{email:"x@example.com", password:"short"}` (7 chars) → `400`, message references password length; `{password:"12345678"}` (8 chars) → `201` (boundary).
  - `A-06` `{}` → `400` listing both missing fields.
  - `A-07` Extra unknown property `{email, password, role:"ADMIN"}` → the `ValidationPipe({whitelist:true})` strips `role`; response `user.role` is the unprivileged role, **not** ADMIN (privilege-escalation guard).
- **Auth failures**: n/a — route is `@Public()`.
- **Idempotency / edge cases**:
  - `A-08` Signing up an email that already exists → `409`; a follow-up count of users with that email is exactly `1`.
  - `A-09` Email uniqueness is case-insensitively enforced *or* consistently case-sensitive — assert whichever the implementation chose is stable: signup `A@example.com` after `a@example.com` either → `409`, or → `201` and login with `A@example.com` returns the second user, never the first.
  - `A-10` **First-signup race**: fire two signups concurrently against an empty DB with `Promise.all`; assert exactly one user has the privileged role and both requests resolve to `201`/`409` (never two privileged users, never a `500`).

### `POST /api/auth/login`
- **Happy path**:
  - `A-11` Correct credentials for the privileged user → `200`, `{accessToken, user:{id,email,role}}`; the JWT decodes to a payload carrying `sub`, `email`, `role`.
  - `A-12` Correct credentials for the unprivileged user → `200` with the unprivileged role.
  - `A-13` The returned `accessToken` is accepted by `GET /api/auth/me` (round-trip).
- **Validation failures**:
  - `A-14` Missing `password` → `400`.
  - `A-15` Malformed `email` → `400`.
- **Auth failures**:
  - `A-16` Correct email, wrong password → `401` with a **generic** message; assert the body does not contain the substrings `password`-specific hints such as "wrong password" or "incorrect password" and does not reveal the email exists.
  - `A-17` Unknown email → `401` with a message byte-identical to `A-16` (no user-enumeration oracle).
- **Idempotency / edge cases**:
  - `A-18` Two consecutive logins for the same user both succeed and both tokens are independently valid on `GET /api/auth/me`.

### `POST /api/auth/logout`
- **Happy path**: `A-19` With `MANAGER_TOKEN` → `204` and an empty body.
- **Validation failures**: n/a — no request body.
- **Auth failures**: `A-20` `NO_TOKEN` → `401`. `A-21` `BAD_TOKEN` → `401`.
- **Idempotency / edge cases**: `A-22` Calling logout twice with the same token → `204` both times; the token still works on `GET /api/auth/me` afterwards (documents the stateless "client discards token" contract rather than server-side revocation).

### `GET /api/auth/me`
- **Happy path**: `A-23` With `CLERK_TOKEN` → `200`, `{id, email, role}` matching the logged-in user; body contains no `passwordHash`.
- **Validation failures**: n/a.
- **Auth failures**:
  - `A-24` `NO_TOKEN` → `401`.
  - `A-25` `BAD_TOKEN` (wrong signing secret) → `401`.
  - `A-26` Malformed header `Authorization: Bearer` (no token) → `401`.
  - `A-27` An expired token (minted with `expiresIn: '-1s'`) → `401`.
  - `A-28` A token whose `sub` references a deleted/nonexistent user → `401` (strategy re-loads the user).

### `GET /api/items`
- **Happy path**:
  - `A-29` `CLERK_TOKEN`, seeded catalogue → `200`, array; each element exposes `id, sku, name, unit, reorderAt, totalQty, lowStock`.
  - `A-30` `totalQty` for a seeded item equals the sum of its `StockLevel.qty` across all locations (computed independently in the test from a direct DB read).
  - `A-31` An item with zero `StockLevel` rows appears with `totalQty: 0`.
  - `A-32` `lowStock` is `true` exactly when `totalQty <= reorderAt`: seed an item with `reorderAt:10, totalQty:10` → `lowStock:true` (boundary); `reorderAt:10, totalQty:11` → `lowStock:false`.
  - `A-33` `?q=WIDGET` returns only items whose `sku` or `name` contains the term; `?q=widget` (lowercase) returns the same set (case-insensitive).
  - `A-34` `?q=` matching nothing → `200` with `[]`, not `404`.
  - `A-35` `?low=true` returns exactly the subset where `lowStock` is `true`; `?low=false` or omitted returns all.
- **Validation failures**: `A-36` `?low=notabool` → `400` **or** treated as `false`; assert the implementation's choice is not a `500`.
- **Auth failures**: `A-37` `NO_TOKEN` → `401`. `A-38` `BAD_TOKEN` → `401`.
- **Idempotency / edge cases**: `A-39` Response body contains no `passwordHash` or user PII.

### `GET /api/items/:id`
- **Happy path**:
  - `A-40` `CLERK_TOKEN`, seeded item stocked in Zone A (30) and Zone B (12) → `200`; `totalQty: 42`; `levels` is an array of `{locationId, locationName, zone, qty}`.
  - `A-41` `sum(levels[].qty) === totalQty` asserted programmatically.
  - `A-42` `levels` includes a row per location the item has stock in, with `locationName` resolved to the real name (e.g. `"Zone A"`), not just an id.
- **Validation failures**: `A-43` A syntactically valid but nonexistent id → `404`. `A-44` A malformed id (`"not-a-uuid"`) → `404` or `400`, never `500`.
- **Auth failures**: `A-45` `NO_TOKEN` → `401`.
- **Idempotency / edge cases**: `A-46` An item with no stock rows → `200`, `totalQty: 0`, `levels: []`.

### `POST /api/items`
- **Happy path**:
  - `A-47` `MANAGER_TOKEN` + `{sku:"SKU-900", name:"Test Widget", unit:"each", reorderAt:5, description:"d"}` → `201`, body echoes the fields with a generated `id`.
  - `A-48` Continuing from `A-47`: `GET /api/items` contains exactly one element with `sku:"SKU-900"` and `totalQty: 0`.
- **Validation failures**:
  - `A-49` Empty `sku` (`""`) → `400`.
  - `A-50` Whitespace-only `sku` (`"   "`) → `400` (trim applied before the non-empty check).
  - `A-51` `sku:" SKU-901 "` → `201` and the persisted/returned `sku` is `"SKU-901"` (trimmed).
  - `A-52` Missing `name` → `400`; missing `unit` → `400`.
  - `A-53` `reorderAt: -1` → `400`; `reorderAt: 0` → `201` (boundary); `reorderAt: "5"` (string) → `201` with `reorderAt === 5` (transform); `reorderAt: 1.5` → `400` (`@IsInt`).
  - `A-54` Unknown property `{totalQty: 999}` alongside valid fields → stripped by whitelist; created item's `totalQty` is `0`.
- **Auth failures**: `A-55` `NO_TOKEN` → `401`. `A-56` `CLERK_TOKEN` → `403`. `A-57` `BAD_TOKEN` → `401` (not `403` — asserts guard ordering).
- **Idempotency / edge cases**:
  - `A-58` **Duplicate SKU**: create `SKU-001`, then POST `SKU-001` again → `4xx` (expect `409`); the error body carries a field-level message naming `sku`.
  - `A-59` Continuing from `A-58`: `GET /api/items?q=SKU-001` returns **exactly one** row — the failed create left no second row.

### `PATCH /api/items/:id`
- **Happy path**:
  - `A-60` `MANAGER_TOKEN` + `{name:"Renamed"}` → `200` with the new name; unspecified fields (`sku`, `unit`) are unchanged on a follow-up `GET`.
  - `A-61` `{reorderAt: 100}` on an item with `totalQty: 42` → subsequent `GET /api/items/:id` reports `lowStock: true` (threshold change is reflected in derived state).
- **Validation failures**: `A-62` `{reorderAt: -1}` → `400`. `A-63` `{sku: ""}` → `400`. `A-64` `{}` (empty patch) → `200` no-op or `400`; assert not `500`.
- **Auth failures**: `A-65` `CLERK_TOKEN` → `403`. `A-66` `NO_TOKEN` → `401`.
- **Idempotency / edge cases**:
  - `A-67` Patching `sku` to a value owned by another item → `409`; both items retain their original SKUs on re-read.
  - `A-68` Nonexistent id → `404`.
  - `A-69` Applying the same patch twice yields the same final state (idempotent).

### `DELETE /api/items/:id`
- **Happy path**: `A-70` `MANAGER_TOKEN` deleting an item with **no** stock rows and **no** movements → `200`/`204`; follow-up `GET /api/items/:id` → `404` and the item is absent from `GET /api/items`.
- **Validation failures**: `A-71` Nonexistent id → `404`.
- **Auth failures**: `A-72` `CLERK_TOKEN` → `403`. `A-73` `NO_TOKEN` → `401`.
- **Idempotency / edge cases**:
  - `A-74` Item holding `StockLevel.qty > 0` → `409`; re-read confirms the item and its balances still exist (block, not cascade).
  - `A-75` Item with `totalQty: 0` but at least one referencing `Movement` row → `409`; the movement row still exists afterwards (audit integrity).
  - `A-76` Deleting an already-deleted id → `404` (not `500`).

### `GET /api/locations`
- **Happy path**: `A-77` `CLERK_TOKEN` → `200`, array containing the seeded `Zone A`, `Zone B`, `Zone C`, each with `{id, name, zone}` (clerks need this to populate the movement form).
- **Validation failures**: n/a.
- **Auth failures**: `A-78` `NO_TOKEN` → `401`.
- **Idempotency / edge cases**: `A-79` Repeated calls return a stable ordering (assert deterministic order so the UI's select is stable).

### `POST /api/locations`
- **Happy path**: `A-80` `MANAGER_TOKEN` + `{name:"Zone D", zone:"D"}` → `201` with an `id`; appears in `GET /api/locations`.
- **Validation failures**: `A-81` Missing `name` → `400`. `A-82` Missing `zone` → `400`. `A-83` Empty `name` → `400`.
- **Auth failures**: `A-84` `CLERK_TOKEN` → `403`. `A-85` `NO_TOKEN` → `401`.
- **Idempotency / edge cases**: `A-86` Duplicate `name:"Zone A"` → `409`; follow-up `GET /api/locations` shows exactly one `Zone A`.

### `PATCH /api/locations/:id`
- **Happy path**: `A-87` `{zone:"D2"}` → `200` with the updated zone; `name` unchanged.
- **Validation failures**: `A-88` `{name:""}` → `400`. `A-89` Nonexistent id → `404`.
- **Auth failures**: `A-90` `CLERK_TOKEN` → `403`. `A-91` `NO_TOKEN` → `401`.
- **Idempotency / edge cases**: `A-92` Renaming to an existing location's name → `409`; both keep their original names.

### `DELETE /api/locations/:id`
- **Happy path**: `A-93` A location with all balances at `0` and no referencing movements → `200`/`204`; absent from the list afterwards.
- **Validation failures**: `A-94` Nonexistent id → `404`.
- **Auth failures**: `A-95` `CLERK_TOKEN` → `403`. `A-96` `NO_TOKEN` → `401`.
- **Idempotency / edge cases**: `A-97` A location holding `qty > 0` for any item → `409`; re-read confirms the location and the balance survive.

### `POST /api/movements`
- **Happy path** (each starts from a freshly seeded item at a known balance):
  - `A-98` `CLERK_TOKEN` + `{type:"IN", itemId, toLocId: ZoneA, qty: 50}` on an item at `0` → `201`; `GET /api/items/:id` shows Zone A `qty: 50` and `totalQty: 50`; the response includes the created movement and the affected balances.
  - `A-99` The persisted `Movement` row carries `userId` = the **token's** user (not a client-supplied value), `type`, `qty`, and a `createdAt` timestamp within 60s of now.
  - `A-100` Continuing: `{type:"OUT", itemId, fromLocId: ZoneA, qty: 20}` → `201`; Zone A balance `30`.
  - `A-101` Continuing: `{type:"TRANSFER", itemId, fromLocId: ZoneA, toLocId: ZoneB, qty: 10}` → `201`; Zone A `20`, Zone B `10`, `totalQty` unchanged at `30`.
  - `A-102` `TRANSFER` into a location with **no existing** `StockLevel` row creates the row via upsert (Zone B had no row before `A-101`).
  - `A-103` `note` is persisted and returned when supplied; `null`/absent when omitted.
- **Validation failures** (all → `400`, and each is followed by a balance re-read proving **no** mutation occurred):
  - `A-104` `type:"IN"` with a `fromLocId` present → `400`.
  - `A-105` `type:"IN"` with no `toLocId` → `400`.
  - `A-106` `type:"OUT"` with a `toLocId` present → `400`.
  - `A-107` `type:"OUT"` with no `fromLocId` → `400`.
  - `A-108` `type:"TRANSFER"` with only `fromLocId` → `400`; with only `toLocId` → `400`.
  - `A-109` `type:"TRANSFER"` with `fromLocId === toLocId` → `400`.
  - `A-110` `qty: 0` → `400`; `qty: -5` → `400`; `qty: 1` → `201` (boundary); `qty: 1.5` → `400` (`@IsInt`).
  - `A-111` `type:"SHRINKAGE"` (not in the enum) → `400`.
  - `A-112` Missing `itemId` → `400`.
  - `A-113` **Insufficient stock**: item at `5` in Zone A, `{type:"OUT", fromLocId:ZoneA, qty:10}` → `400` with a human-readable insufficient-stock message; a follow-up `GET /api/items/:id` still shows **exactly 5** (transaction aborted, balance untouched).
  - `A-114` `OUT` from a location where the item has **no** `StockLevel` row at all → `400`, and no row is created by the failed attempt.
  - `A-115` `TRANSFER` of more than the source holds → `400`; both source and destination balances unchanged.
- **Auth failures**: `A-116` `NO_TOKEN` → `401`. `A-117` `BAD_TOKEN` → `401`. `A-118` `CLERK_TOKEN` → `201` (clerks *may* record movements — asserts the route is **not** manager-gated).
- **Idempotency / edge cases**:
  - `A-119` Unknown `itemId` → `404`; unknown `toLocId` → `404`; unknown `fromLocId` → `404`.
  - `A-120` **Concurrency**: item at `10` in Zone A; fire two `OUT qty:10` requests simultaneously via `Promise.all`. Assert **exactly one** returns `2xx` and the other returns `400`; the final balance is exactly `0` and never negative at any point; neither request returns `500` (the `P2034` retry wrapper absorbs write conflicts).
  - `A-121` **Concurrency, both-satisfiable**: item at `10`, two concurrent `OUT qty:5` → both `201`, final balance exactly `0` (no lost update).
  - `A-122` Two identical `IN qty:5` requests both succeed and the balance is `10` — movements are intentionally **not** deduplicated; document this as the contract.

### `GET /api/movements`
- **Happy path**:
  - `A-123` `MANAGER_TOKEN` → `200` with `{data, total, page, pageSize}`; `pageSize` defaults to `25`; `data.length <= pageSize`.
  - `A-124` Each `data` element exposes `createdAt`, `qty`, `type`, `user:{email, role}`, `item:{sku, name}`, and resolved from/to **location names** (not bare ids).
  - `A-125` Ordering is `createdAt DESC` — record three movements in a known order and assert the response is the reverse.
  - `A-126` `?itemId=<X>` returns only movements for item X (assert every row's item id matches and that a known movement for item Y is absent).
  - `A-127` `?type=OUT` returns only `OUT` rows.
  - `A-128` `?from=<today ISO date>` includes a movement created today; `?from=<tomorrow>` excludes it.
  - `A-129` `?to=<today ISO date>` **includes** a movement created today at 23:00 (end-of-day inclusive boundary — the single highest-risk date case).
  - `A-130` Combined `?itemId=&type=&from=&to=` narrows correctly to the intersection.
  - `A-131` `?page=2&pageSize=1` with 3 movements returns the 2nd-newest row; `total` is `3` across all pages and does not shrink with paging.
- **Validation failures**: `A-132` `?page=0` or `?page=-1` → `400` or coerced to `1`, never `500`. `A-133` `?type=BOGUS` → `400`. `A-134` `?from=not-a-date` → `400`. `A-135` `?pageSize=100000` → clamped to a documented maximum or `400`, never an unbounded dump.
- **Auth failures**: `A-136` `CLERK_TOKEN` → `403` (the audit log is manager-only). `A-137` `NO_TOKEN` → `401`.
- **Idempotency / edge cases**: `A-138` A filter matching nothing → `200` with `{data: [], total: 0}`, not `404`.

### `GET /api/reports/low-stock`
- **Happy path**:
  - `A-139` `MANAGER_TOKEN` → `200`, array of rows exposing `sku`, `name`, on-hand total, `reorderAt`, and shortfall.
  - `A-140` **Boundary `<=`**: item with `reorderAt:10` and `12` on hand is **absent**; after `OUT 5` (→ `7`) it is **present**. Separately, an item sitting exactly at `reorderAt:10` with `10` on hand is **present** (inclusive boundary).
  - `A-141` An item with `40` on hand and `reorderAt:10` is **absent**.
  - `A-142` An item with **no** `StockLevel` rows at all is **present** with on-hand `0`.
  - `A-143` Rows are ordered by shortfall descending — seed two low items with different shortfalls and assert the larger shortfall sorts first.
- **Validation failures**: n/a — no parameters.
- **Auth failures**: `A-144` `CLERK_TOKEN` → `403`. `A-145` `NO_TOKEN` → `401`.
- **Idempotency / edge cases**: `A-146` With every item well-stocked, → `200` with `[]`, not `404`.

### `GET /api/admin/settings`
- **Happy path**: `A-147` `ADMIN_TOKEN` → `200` listing entries for the **postgresql** key (`DATABASE_URL`) and the **minio** keys (`MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`), each with a `configured` boolean and a **masked** value.
- **Validation failures**: n/a.
- **Auth failures**: `A-148` `MANAGER_TOKEN` (non-admin) → `403`. `A-149` `CLERK_TOKEN` → `403`. `A-150` `NO_TOKEN` → `401`.
- **Idempotency / edge cases**: `A-151` No response value equals the raw secret — assert the literal secret set in `A-152` never appears verbatim in any `GET` body.

### `PATCH /api/admin/settings`
- **Happy path**: `A-152` `ADMIN_TOKEN` + `{MINIO_ACCESS_KEY:"testkey123"}` → `200`; a follow-up `GET` shows that key as `configured: true` with a masked value (round-trip).
- **Validation failures**: `A-153` An unknown key not in the allowed credential set → `400` or is ignored; assert it is **not** blindly persisted and surfaced. `A-154` A non-string value → `400`.
- **Auth failures**: `A-155` `MANAGER_TOKEN` → `403`. `A-156` `NO_TOKEN` → `401`.
- **Idempotency / edge cases**: `A-157` Patching the same key twice leaves exactly one `SystemSetting` row for it (upsert, not insert).

### `GET /api/health`
- **Happy path**: `A-158` `NO_TOKEN` → `200` `{status:"ok"}` (asserts `@Public()` — an auth-gated health check breaks orchestration probes).
- **Validation failures**: n/a.
- **Auth failures**: n/a — public by design; `A-159` sending a `BAD_TOKEN` still → `200` (a bad header must not break the probe).

### `GET /api/health/deep`
- **Happy path**: `A-160` `NO_TOKEN` against a live DB → `200` `{status:"ok", db: <ok indicator>}`.
- **Validation failures**: n/a.
- **Auth failures**: n/a — public.
- **Idempotency / edge cases**: `A-161` With the DB unreachable (connection torn down or pointed at a dead host) → `503`, not a hang or an uncaught `500`.

## UI / journey tests

All journeys run against the built application over HTTP with a live API and DB. Selectors use the
`data-testid` attributes mandated in the `ui_agent` task list; any journey step that cannot find a
stable testid is a **failure of the UI task**, not a reason to fall back to text/CSS selectors.

### Journey: J-01 — First-run signup bootstraps the privileged account
- **Steps**: On an empty DB, navigate to `/signup` → type `owner@example.com` → type password `Passw0rd!` → type the same into confirm → submit.
- **Expected outcomes**: `U-01` redirected away from `/signup` to `/items`; `U-02` the shell header shows the brand text **StockRoom** and the logged-in user's email; `U-03` manager-only nav entries (Movements log, Low-stock report) are **visible**; `U-04` `localStorage` holds a non-empty token; `U-05` a hard page reload keeps the user signed in (bootstrap re-hydrates from `GET /api/auth/me`).
- **Negative path**: `U-06` Submitting with a password under 8 characters shows an inline field error and the form does **not** submit; `U-07` signing up with an email that already exists shows a `409` duplicate-email error **on the email field**, and the entered email remains in the form.

### Journey: J-02 — Login, logout, and session expiry
- **Steps**: Navigate to `/login` → enter seeded manager credentials → submit → observe `/items` → click Logout.
- **Expected outcomes**: `U-08` login lands on `/items`; `U-09` logout returns to `/login` and clears the token from `localStorage`; `U-10` after logout, navigating directly to `/items` redirects back to `/login`.
- **Negative path**: `U-11` Wrong password shows the API's generic 401 message inline and stays on `/login` with the email preserved; `U-12` navigating to `/items` while signed out redirects to `/login?returnUrl=%2Fitems`, and logging in from there lands back on `/items`; `U-13` with a token manually corrupted in `localStorage`, the first API call's `401` clears auth state and redirects to `/login` (rather than rendering a broken page).

### Journey: J-03 — Clerk sees a restricted application
- **Steps**: Log in as a clerk (USER) → inspect the nav → attempt direct navigation to `/items/new`, `/movements`, `/reports/low-stock`, and `/admin/settings`.
- **Expected outcomes**: `U-14` "New item", "Edit", and "Delete" controls are **absent** from `/items` for a clerk; `U-15` manager-only nav links (Movements log, Low-stock, Admin) are **absent**; `U-16` each direct manager-route navigation redirects to `/items` rather than rendering the page or showing a raw error; `U-17` the clerk **can** reach `/movements/new` and `/locations` (read + record are permitted).
- **Negative path**: `U-18` A clerk who edits `localStorage` to fake `role: "MANAGER"` may see nav links, but the underlying API call still returns `403` and the UI surfaces an error instead of silently appearing to succeed (client-side guards are convenience, not security).

### Journey: J-04 — Manager creates, edits, and deletes an item
- **Steps**: As manager → `/items` → click "New item" → fill `sku: SKU-TEST`, `name: Test Widget`, `unit: each`, `reorderAt: 5` → Save → from the list open the row's "Edit" → change name to `Renamed Widget` → Save → click "Delete" on that row → confirm in the dialog.
- **Expected outcomes**: `U-19` after Save, URL is `/items` (or `/items/:id`) and the new row is visible with the entered sku/name/unit/reorderAt and `totalQty` of `0`; `U-20` after the edit, the list shows `Renamed Widget` and the URL leaves the edit route; `U-21` clicking Delete sets `?modal=confirm-delete&id=…` in the URL and renders the confirmation dialog; `U-22` after confirming, the row disappears from the list and a reload confirms it is gone (persisted, not just optimistic).
- **Negative path**: `U-23` Creating an item with a SKU that already exists shows a field-level error **on the `sku` input**, keeps the form populated, and the list still contains exactly one row with that SKU; `U-24` submitting with an empty required field blocks submission with inline errors; `U-25` cancelling the delete dialog closes it, clears the `?modal=` param, and leaves the row intact.

### Journey: J-05 — Item detail shows the per-location breakdown
- **Steps**: As any authenticated user → `/items` → click a seeded item stocked in multiple zones → view the `locations` tab → switch to the `movements` tab via the tab control.
- **Expected outcomes**: `U-26` URL is `/items/:id`, header stats show `totalQty`, `reorderAt`, and a low-stock badge when applicable; `U-27` the breakdown table lists one row per stocked location with its zone and qty; `U-28` the footer total row equals the header `totalQty` and equals the sum of the visible per-location rows; `U-29` clicking the movements tab updates the URL to `?tab=movements` and shows that item's movement history; `U-30` reloading on `?tab=movements` restores the movements tab (URL is the source of truth).
- **Negative path**: `U-31` Navigating to `/items/does-not-exist` renders a not-found state inside the shell, not a blank page or an unhandled error.

### Journey: J-06 — Search and low-stock filter on the item list
- **Steps**: `/items` → type `widget` into the search box → observe → toggle the low-stock filter → clear the search.
- **Expected outcomes**: `U-32` the URL gains `?q=widget` and the table shows only matching rows; `U-33` reloading the page on `/items?q=widget` reproduces the filtered view (shareable URL); `U-34` toggling low-stock adds `?low=true` while **preserving** `q` (`queryParamsHandling: 'merge'`); `U-35` every visible row under `?low=true` carries the low-stock badge.
- **Negative path**: `U-36` A search matching nothing renders an explicit empty state ("no items"), not a blank table or a spinner that never resolves.

### Journey: J-07 — Manager manages locations
- **Steps**: As manager → `/locations` → "New location" → `name: Zone D`, `zone: D` → Save → Edit it → Delete a zero-stock location → attempt to delete `Zone A` (which holds stock).
- **Expected outcomes**: `U-37` the new location appears in the list and in the movement form's location selects; `U-38` the edit round-trips; `U-39` deleting a zero-stock location removes it after confirmation.
- **Negative path**: `U-40` Creating a duplicate `Zone A` shows a 409 error on the **name** field; `U-41` deleting `Zone A` (non-zero stock) surfaces the API's 409 "has stock" message inside the confirm dialog and the location remains in the list.

### Journey: J-08 — Record a movement and see the balance update
- **Steps**: As a clerk → `/movements/new` → choose type `IN` → pick an item via the typeahead → pick destination `Zone A` → qty `50` → note `opening` → Submit → navigate to that item's detail → then record an `OUT` of `20` from Zone A → then a `TRANSFER` of `10` from Zone A to Zone B.
- **Expected outcomes**: `U-42` choosing `IN` shows only the destination select (no source); choosing `OUT` shows only source; choosing `TRANSFER` shows both — mirroring the DTO rules; `U-43` after the `IN`, the item detail shows Zone A at `50` and `totalQty` `50`; `U-44` after the `OUT`, Zone A shows `30`; `U-45` after the `TRANSFER`, Zone A `20`, Zone B `10`, `totalQty` still `30`; `U-46` the movement appears at the top of the manager's `/movements` log with the acting user's email.
- **Negative path**: `U-47` Submitting an `OUT` for more than the on-hand balance shows the server's insufficient-stock message **inline** and the form retains every entered value (type, item, location, qty, note) so the user can correct the qty; `U-48` after that failure, the item detail still shows the original balance; `U-49` `TRANSFER` with the same location selected for source and destination is blocked (either the select prevents it or an inline error appears) and no movement is created.

### Journey: J-09 — Manager filters the audit log
- **Steps**: As manager → `/movements` → filter by a specific item → add type `OUT` → set a date range covering today → page forward.
- **Expected outcomes**: `U-50` columns render timestamp, user email, item, type, qty, `from → to` (location **names**), and note; `U-51` each filter writes to the query string (`?itemId=&type=&from=&to=&page=`) and the filtered view survives a reload (shareable); `U-52` only rows matching all active filters are shown; `U-53` pagination changes `?page=` and shows a different result set, with the total count stable across pages.
- **Negative path**: `U-54` A filter combination matching nothing renders an empty state, and clearing the filters restores the full log; `U-55` a clerk navigating directly to `/movements` is redirected to `/items`.

### Journey: J-10 — Low-stock report drives a restock
- **Steps**: As manager → `/reports/low-stock` → read the table → click "Record stock in" on a low item → complete the `IN` movement → return to the report.
- **Expected outcomes**: `U-56` the table shows sku, name, on-hand, reorderAt, and shortfall; `U-57` the "Record stock in" link navigates to `/movements/new?type=IN&itemId=<that item>` with the type and item **pre-filled** from the query params; `U-58` after recording enough stock to exceed `reorderAt`, the item disappears from the report on reload; `U-59` an item recorded to exactly `reorderAt` (not above) **remains** in the report (inclusive `<=` boundary, visible end-to-end).
- **Negative path**: `U-60` When nothing is low, the report renders an explicit empty state rather than a bare table header.

### Journey: J-11 — Smoke: brand marker, deep links, and SPA fallback
- **Steps**: Load `/` unauthenticated → then load `/items/<a real id>` directly as a fresh browser navigation (not an in-app route change) → then load `/no/such/route`.
- **Expected outcomes**: `U-61` `/` returns `200` and the rendered page's visible text contains the literal **StockRoom**; `U-62` the document `<title>` is `StockRoom`; `U-63` a direct browser load of `/items/<id>` returns the SPA shell with `200` (**not** `404`) and, once authenticated, renders the item detail — this is the static-serving/global-prefix risk from the spec; `U-64` an unknown route redirects to `/items` (which, unauthenticated, lands on `/login`) rather than showing a server 404; `U-65` no uncaught JavaScript errors are present in the console after the initial load.
- **Negative path**: `U-66` `/api/items` loaded directly in the browser returns the API's JSON `401`, **not** the SPA `index.html` — proving static serving does not shadow API routes.

### Journey: J-12 — Admin settings for backing services
- **Steps**: As admin → `/admin/settings` → inspect the postgresql and minio sections → enter a minio access key → Save → reload.
- **Expected outcomes**: `U-67` one section per backing service (**postgresql**, **minio**) each with a configured/unconfigured badge; `U-68` after saving, the key's badge reads configured and the displayed value is **masked** (the typed secret is not rendered back verbatim); `U-69` the change survives a reload.
- **Negative path**: `U-70` The "needs credentials to activate" placeholder banner renders **only** when the settings API actually reports unconfigured keys — with everything configured, the banner is absent; `U-71` a manager (non-admin) navigating to `/admin/settings` is redirected to `/items`.

## Data integrity tests
- `D-01` **No negative balances, ever.** After every mutating test in the suite, assert `SELECT COUNT(*) FROM "StockLevel" WHERE qty < 0` is `0`. This runs as a global afterEach so no future test can regress it silently.
- `D-02` **Failed movements leave no trace.** After each `400`-returning movement attempt (`A-104`–`A-115`), the affected `StockLevel` rows are byte-identical to their pre-request values **and** no `Movement` row was written (count unchanged). The transaction aborted fully.
- `D-03` **TRANSFER conserves total.** For any `TRANSFER`, `SUM(qty)` over all locations for that item is identical before and after.
- `D-04` **IN/OUT move the total by exactly `qty`.** `IN` increases the item's total by exactly `qty`; `OUT` decreases it by exactly `qty`.
- `D-05` **Balances reconcile with the movement ledger.** For an item touched only by test-created movements, the per-location balance equals the seeded opening balance plus the signed sum of its movements (`IN` → `+qty` at `toLocId`, `OUT` → `-qty` at `fromLocId`, `TRANSFER` → both).
- `D-06` **Compound uniqueness holds.** No two `StockLevel` rows share an `(itemId, locationId)` pair — asserted after the concurrency tests (`A-120`, `A-121`), which are the cases most likely to produce a duplicate via a racing upsert.
- `D-07` **Every movement is attributable.** No `Movement` row has a null/empty `userId`, and every `userId` resolves to an existing `User`. The `userId` always matches the JWT's subject, never a client-supplied body field (assert by POSTing `{userId: "<other user's id>"}` in the body and confirming the stored row still credits the token's user).
- `D-08` **SKU and location-name uniqueness survive contention.** After the duplicate-SKU (`A-58`) and duplicate-name (`A-86`) cases, `COUNT(*) GROUP BY sku HAVING COUNT(*) > 1` and the equivalent for `Location.name` both return zero rows.
- `D-09` **Blocked deletes preserve referential integrity.** After a `409` delete (`A-74`, `A-75`, `A-97`), the entity and every referencing `StockLevel`/`Movement` row still exist — nothing was partially cascaded before the check failed.
- `D-10` **Passwords are never stored in plaintext.** After signup, `User.passwordHash` does not equal the submitted password and matches a bcrypt format (`$2[aby]$`).
- `D-11` **Exactly one bootstrap privileged account.** After the concurrent-signup race (`A-10`), `COUNT(*) FROM "User" WHERE role = <privileged>` is exactly `1`.
- `D-12` **Seed is strictly idempotent.** Run the seed script **twice** against the same database. Assert the second run exits `0` (no unique-constraint crash) and that item, location, `StockLevel`, and `Movement` counts plus every `StockLevel.qty` are identical to after the first run — balances are not doubled. This is the spec's stated "seed on every boot" risk and must be tested directly, since the container start command re-runs it on every restart.
- `D-13` **`SystemSetting` upserts, not duplicates.** After repeated `PATCH /api/admin/settings` on the same key, exactly one row exists for that key and its `value` is the most recent write.

## Out of scope
- **`/trpc/users.findAll` and `/trpc/users.findById`** — present in the stale `surface.json` but absent from the spec. `tasks.md` flags the REST-vs-tRPC decision as an open question. No tests are written against the scaffolded tRPC router; if it survives into the build, the only assertion needed is that it does not shadow or leak through the `/api` prefix (partially covered by `U-66`).
- **Scaffold components `app-home` / testids `home-title`, `users-list`, `users-loading`, `users-error`** — these belong to the scaffold's users demo page, which the spec replaces with `/items`. Their removal is not asserted.
- **`ColossusAccount` seeding and `COLOSSUS_ACCOUNTS_JSON` login** — platform-managed and explicitly untouched by the task list; tests use accounts created through `POST /api/auth/signup` rather than depending on platform-minted credentials.
- **MinIO / object-storage behaviour** — `minio` is provisioned and its credentials are surfaced in admin settings, but the spec describes no upload, download, or file feature. Only the settings surface is tested (`A-147`–`A-157`, `J-12`).
- **Third-party integrations** — the spec states "Integrations: None" and the pipeline's integration config contains only the literal placeholder. No integration client exists to test.
- **Token revocation / server-side session invalidation** — the spec defines logout as the client discarding the token. `A-22` documents that a logged-out token still validates; this is the specified behaviour, not a bug under test.
- **Password reset, email verification, account deletion, profile editing** — the spec is silent on all of these; no routes exist for them.
- **Rate limiting and brute-force protection on `/api/auth/login`** — not specified. `A-16`/`A-17` cover the no-user-enumeration property, but no throttling is asserted.
- **`.github/workflows/colossus-deploy.yml`** — the spec states "no change; managed by Colossus". CI configuration is not under test.
- **Docker image internals** — the spec's deployment checks (image builds, `ServeStaticModule` root path vs the Dockerfile `COPY` target) are contradicted by `tasks.md`'s nginx topology. Rather than assert an unresolved implementation detail, `J-11` asserts the observable outcome (`/` serves the SPA, deep links resolve, `/api/*` is not shadowed), which must hold under either topology.
- **Performance, load, and query-plan assertions** — the spec sets no latency or throughput targets. `A-135` bounds `pageSize` for safety but asserts no timing.
- **Accessibility and responsive/visual-regression checks** — the spec defines no a11y or breakpoint requirements.
- **Currency/decimal handling** — the spec fixes all quantities as integers; no fractional-unit behaviour is specified or tested beyond rejecting non-integer `qty` (`A-110`).
