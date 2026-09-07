# StockRoom

Multi-location warehouse inventory control: a catalogue of items, the stock held in each
location, and an auditable ledger of every movement between them.

## What it does

- **Catalogue** — SKUs, names, units and reorder thresholds. Search by SKU or name.
- **Locations** — named storage locations grouped into zones.
- **Movements** — receive stock (`IN`), issue it (`OUT`) and move it between locations
  (`TRANSFER`). Every movement is recorded against the user who made it.
- **Low stock** — items whose total on-hand quantity has fallen to or below their reorder
  threshold, ordered by shortfall.
- **Audit log** — every movement ever recorded, filterable by item, type and date range.

Balances can never go negative: an `OUT` or `TRANSFER` larger than the source balance is
rejected and nothing is written. Movements run as serializable transactions, so two people
issuing stock at the same instant serialize rather than oversell.

## Roles

| Role | Can do |
| --- | --- |
| `USER` | Browse the catalogue and locations, record movements |
| `MANAGER` | The above, plus manage items and locations, read the audit log and low-stock report |
| `ADMIN` | The above, plus the settings screen |

Logins are platform-owned. Colossus injects `COLOSSUS_ACCOUNTS_JSON` and
`prisma/seed/seed.js` materializes one account per role at deploy; the app ships with no
credentials of its own. The first user to sign up on an empty database becomes `ADMIN`;
everyone after them is a `USER`.

## Layout

```
backend/    NestJS 11 + Prisma 6 REST API, served under /api
frontend/   Angular 19 standalone SPA, served by nginx which proxies /api to the backend
```

## Configuration

All read from the environment; nothing is committed.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Signing key for access tokens |
| `JWT_EXPIRES_IN` | Token lifetime (default `1d`) |
| `PORT` | API listen port (default `3000`) |
| `COLOSSUS_ACCOUNTS_JSON` | Platform-injected login accounts, consumed by the seed |

## Running locally

```bash
docker compose up -d          # PostgreSQL

cd backend
npm install
npx prisma migrate deploy     # apply the schema
npm run start:dev             # API on :3000

cd ../frontend
npm install
npx ng serve                  # SPA on :4200, proxying /api to :3000
```

To create the platform accounts locally, set `COLOSSUS_ACCOUNTS_JSON` and run
`npm run prisma:seed` from `backend/`. The seed is idempotent — it re-asserts each
password hash on every run and never prints a credential.

## Deploying

`colossus.yaml` describes both services to the deploy pipeline. The backend image runs
`prisma migrate deploy` before starting, so the schema is always current; the seed runs
from the platform's migrate job with the accounts injected.

## API

Every route is under `/api` and requires a bearer token except where noted.

| Method | Route | Access |
| --- | --- | --- |
| `POST` | `/api/auth/signup` | public |
| `POST` | `/api/auth/login` | public |
| `GET` | `/api/auth/me` | any |
| `POST` | `/api/auth/logout` | any |
| `GET` | `/api/items`, `/api/items/:id` | any |
| `POST` `PATCH` `DELETE` | `/api/items`, `/api/items/:id` | manager |
| `GET` | `/api/locations`, `/api/locations/:id` | any |
| `POST` `PATCH` `DELETE` | `/api/locations`, `/api/locations/:id` | manager |
| `POST` | `/api/movements` | any |
| `GET` | `/api/movements` | manager |
| `GET` | `/api/reports/low-stock` | manager |
| `GET` `PATCH` | `/api/admin/settings` | admin |
| `GET` | `/api/health`, `/api/health/deep` | public |

Interactive API docs are served at `/api/docs`.
