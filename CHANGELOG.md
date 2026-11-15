# Changelog

All notable changes to **Simplayz** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased] - 2026-11-15

### Added
- Centralized typed page and API route builders in `src/lib/routes.ts` (`pages.*` and `api.*`) and enabled `typedRoutes: true` in `next.config.ts`, replacing all hardcoded `/user/...` and `/api/...` URL templates across components, client helpers, hooks, and renderers.
- Baseline SQLite migration (`drizzle/20261115081818_low_malice/migration.sql` and `snapshot.json`) generated with Drizzle Kit v1.0 RC folder-per-migration layout covering all 9 tables, foreign-key cascade constraints, and unique/composite indexes.
- Driver-aware database migration runner (`src/db/migrate.ts`) supporting both SQLite (`drizzle-orm/better-sqlite3/migrator` with `PRAGMA foreign_keys = ON`, `WAL`, and `busy_timeout = 5000`) and PostgreSQL (`drizzle-orm/node-postgres/migrator` when `DATABASE_DRIVER=postgres`).
- TypeScript Drizzle Kit config (`drizzle.config.ts`) respecting `DATABASE_DRIVER`, `SQLITE_PATH`, and `DATABASE_URL` on Node.js 22 ESM, alongside updated `drizzle.config.json` (`"out": "./drizzle"`).
- Database workflow npm scripts in `package.json`: `db:generate`, `db:migrate`, and `db:push`.
- Automatic SQLite migration application on startup in `src/db/index.ts` when `./drizzle` is present (with fallback to idempotent `CREATE TABLE IF NOT EXISTS` bootstrap for pre-existing untracked databases).

### Changed
- Upgraded `drizzle-orm` from `0.45.2` to `1.0.0-rc.5` (`drizzle-orm@rc`) and `drizzle-kit` from `0.31.10` to `1.0.0-rc.5` (`drizzle-kit@rc`).
- Migrated relational definitions in `src/db/schema.ts` from Drizzle v0 `relations()` to Drizzle v1 RQB v2 `defineRelations()` (`sqliteRelations` and `pgRelations`).
- Updated Drizzle client initialization in `src/db/index.ts` to the v1 `{ client, relations }` configuration signature for both `better-sqlite3` and `node-postgres`.
- Updated `db.query.*.findFirst({ where })` calls in `src/server/world.ts` and `src/app/api/tiles/[z]/[x]/[y]/route.ts` to Drizzle v1 RQB v2 object filter syntax.

---

## [0.3.0] - 2026-11-15 (PR #3)

### Added
- Default SQLite persistence (`better-sqlite3`) with `DATABASE_DRIVER` runtime switch (`sqlite` default; `postgres` / `postgresql` / `pg` for PostgreSQL).
- Dual `sqliteSchema` (`sqliteTable`) and `pgSchema` (`pgTable`) definitions in `src/db/schema.ts` with `$defaultFn(() => new Date())` across all 10 default timestamp columns.

### Changed
- Converted `db.transaction(...)` blocks in `src/app/api/parcels/[parcelId]/assault/route.ts` and `src/app/api/pilots/[pilotId]/structures/route.ts` to synchronous `.run()` execution on SQLite while retaining async `pgDb.transaction(...)` for PostgreSQL.
- Updated `/api/health` (`select 1`) and `/api/tiles/[z]/[x]/[y]` cache provenance header to support both SQLite and PostgreSQL.

---

## [0.2.0] - 2026-11-15 (PR #1, PR #2)

### Added
- `AGENTS.md` and `llms.txt` repository orientation guides with architecture invariants, file map, and modification recipes (PR #2).
- Technical architecture `README.md`, reproducible terrain/assault extraction & figure scripts (`docs/figures/`), and 19-slide project deck (`docs/Simplayz-Project-Deck.pptx`) (PR #1).

---

## [0.1.0] - 2026-11-15

### Added
- Initial **Simplayz** persistent world simulator built on Next.js 16 (App Router), React 19, TypeScript 5.9, Three.js, Zustand, Tailwind CSS 4, and Drizzle ORM.
- Deterministic pure-function terrain engine (`src/engine/`), lazy 15-second economy ticks, 18 structures, 12×12 interior room grid (9 room types), 4-phase seeded assaults, 3 AI officer profiles, cached OpenStreetMap tile proxy with procedural PNG fallback, and SSE event streaming.
