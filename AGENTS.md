# AGENTS.md

Orientation for AI agents. **Read this instead of exploring the tree.** It exists to keep sessions cheap: the source is ~58k tokens, so unscoped exploration is the dominant cost.

If you only read one thing: the map below plus the invariants in §2 are enough to make a correct change without reading `src/` end to end.

---

## 1. What this is

**Simplayz** — a persistent world simulator. Next.js 16 (App Router) + React 19 + TypeScript 5.9 + PostgreSQL/Drizzle + three.js + Zustand + Tailwind 4.

A pilot claims a 6.4 km × 6.4 km parcel at a real lat/lon. Terrain is a *pure function* of `(seed, x, y)` — no heightmap assets. On top: an economy (lazy 15 s ticks), 18 structures, 9 room types on a 12 × 12 interior grid, deterministic 4-phase assaults, and 3 AI officer routing profiles.

48 source files · 3,852 lines · 12 API routes · 4 pages · 9 DB tables.

---

## 2. Invariants — do not break these

1. **`src/engine/*` is pure.** It must not import `@/db`, `next`, `react`, or anything with I/O. It is executed directly under `tsx` by `src/engine/verify-terrain.ts` and `docs/figures/extract.ts`. Adding a DB call or `process.env` read there breaks both.
2. **No `Math.random()` in `src/engine/`.** Determinism is a hard requirement — terrain and assaults are seeded. Assaults use the local `randomStep()` mixer in `simulation.ts`.
3. **`WorldSnapshot` is the only state shape.** Defined in `src/lib/types.ts`. API routes, the Zustand store, renderers and 2D plans all consume it. Do not introduce a second response shape.
4. **Every mutating route returns the full refreshed snapshot** (`await getWorldSnapshot(pilotId)`), not a partial patch. The client replaces its snapshot wholesale.
5. **Ownership is a SQL join, never a client claim.** Mutations join through `parcels.pilot_id`. There is no auth layer; `pilotId` is trusted from the path or query string.
6. **Route errors go through `apiError(error)`** from `src/lib/api.ts`. It emits `{ error: message }`, 400 by default, promoted to 404 when the message contains `not found` / `not hold`.
7. **JSONB columns are typed against engine types** (`$type<AssaultReport>()`). Keep that coupling — it turns engine refactors into compile errors.
8. **One claim per pilot** is enforced twice: a `UNIQUE` index on `parcels.pilot_id` *and* an API pre-check. Keep both.

---

## 3. File map — path · lines · exports

`engine/` holds all domain logic. Read these before touching `components/`.

```
src/engine/            PURE. no I/O. deterministic.
  geodesy.ts       88   EARTH_RADIUS_M WEB_MERCATOR_LIMIT_M WORLD_WIDTH_M PARCEL_AREA_M2
                        PARCEL_SIDE_M PARCEL_GRID_SIZE PARCEL_CELL_M LonLat WorldPoint TileCoord
                        seedForLocation clampLatitude normalizeLongitude lonLatToWorld worldToLonLat
                        tileSizeM worldToTile tileBounds tileCenter parcelCellToWorld worldToParcelCell
  terrain.ts      275   BIOMES Biome TerrainSample TerrainScores SurveyCell ParcelSurvey
                        hash2 valueNoise fbm heightAtM classifyBiome sampleTerrain surveyParcel surveyCellToWorld
  simulation.ts   144   TICK_MS(15000) MAX_LAZY_TICKS(64) LOCK_MS(72h) SimulationTotals computeTotals
                        TickState TickResult applyTicks AssaultInput AssaultPhase AssaultReport resolveAssault
  catalogue.ts     56   STRUCTURE_CATALOGUE(18) StructureDefinition StructureType StructureCategory
                        PlacedStructure isStructureType getStructureDefinition
  rooms.ts         52   BUILDING_GRID_SIZE(12) ROOM_CATALOGUE(9) RoomDefinition RoomKind
                        isRoomKind getRoomDefinition roomsOverlap computeBuildingStats
  ai.ts            39   AI_PROVIDERS(6) AI_MODELS(12) BOT_ROLES(3) BOT_DEFAULTS isAiModel
  verify-terrain.ts 48  assertion suite; run with npx tsx src/engine/verify-terrain.ts

src/server/           snapshot assembly + side effects
  world.ts        168   seedFromText publishEvent getWorldSnapshot registerPilot claimParcel assertPilotOwnsParcel
  placeholder.ts   54   placeholderPng        (hand-written PNG fallback for tiles)

src/db/
  schema.ts       127   pilots parcels structures buildings rooms bots tileCache events assaults (+relations)
  index.ts         25   pool db               (pooled Drizzle client, dev-globalised)

src/lib/
  types.ts        105   PilotDTO ParcelDTO StructureDTO RoomDTO BuildingDTO BotDTO EventDTO AssaultDTO
                        WorldSnapshot ApiFailure
  api.ts           30   apiError asRecord requiredString finiteNumber validLocation
  client.ts        30   apiRequest fetchSnapshot formatNumber formatCountdown

src/store/useWorldStore.ts  72  useWorldStore ThemeName WorldLocation Notice   (Zustand + persist)
src/hooks/useWorldConnection.ts 69  useWorldConnection                        (SSE + 25 s poll fallback)

src/renderer/
  WorldRenderer.ts 525  WorldRenderer RenderMode WorldCallbacks WorldState RELIEF_SCALE TILE_ZOOM
  PlanRenderer.ts  213  PlanRenderer

src/components/     (client components; WorldApp is the big one)
  WorldApp.tsx    286   WorldApp
  BuildingApp.tsx 132   BuildingApp
  AreaApp.tsx     114   AreaApp
  AiManagementApp.tsx 94  AiManagementApp
  ParcelMiniMap.tsx 76  ParcelMiniMap
  AreaLayout.tsx   48   AreaLayout
  ThemeControls.tsx 44  ThemeControls
  WorldCanvas.tsx  44   WorldCanvas
  BuildingLayout.tsx 39 BuildingLayout
  PlanCanvas.tsx   30   PlanCanvas
  ToastHub.tsx     26   ToastHub
  AppHeader.tsx    24   AppHeader
```

### API routes (12)

Query-param style: `?pilotId=` · path-param style: `/pilots/[pilotId]/`

```
POST   /api/pilots                                  register (callSign, lat, lon) + seeds 3 bots
GET    /api/pilots/[pilotId]                        snapshot
POST   /api/pilots/[pilotId]/claim                  survey 4,096 cells, lock 72 h
POST   /api/pilots/[pilotId]/structures             place structure (site:true also creates building+2 rooms)
PATCH  /api/pilots/[pilotId]/bots/[botId]           provider/model/directive/autonomy/active
DELETE /api/structures/[structureId]?pilotId=       refund floor(cost*0.4*level)
POST   /api/buildings/[buildingId]/rooms?pilotId=   optional room only (not reception/guard)
PATCH  /api/rooms/[roomId]?pilotId=                 name + staff (0–20)
DELETE /api/rooms/[roomId]?pilotId=                 refuses to remove last guard/reception
POST   /api/parcels/[parcelId]/assault?pilotId=     requires expired lock
GET    /api/tiles/[z]/[x]/[y].png                   cache → OSM → stale → generated PNG
GET    /api/stream?pilot=&after=                    SSE: ready/world/heartbeat/degraded
GET    /api/health                                  select 1
```

### Pages (4)

`/` → `WorldApp` · `/user/[userId]/area/[areaId]` → `AreaApp` · `.../building/[buildingId]` → `BuildingApp` · `/user/[userId]/ai/management` → `AiManagementApp`

---

## 4. Recipes

**Add or change an economy number** → `src/engine/simulation.ts` (`computeTotals`) for the formula, or `src/engine/catalogue.ts` for per-structure values. Do not touch the UI.

**Add a structure type** → append to `STRUCTURE_CATALOGUE` in `src/engine/catalogue.ts`. `StructureType` is derived from the array, so types update automatically. Placement gates live in `src/app/api/pilots/[pilotId]/structures/route.ts`. UI catalogue filtering is already generic — `WorldApp` and `AreaApp` read the array.

**Add a room type** → append to `ROOM_CATALOGUE` in `src/engine/rooms.ts`. `RoomKind` derives from it. `reception` and `guard` are mandatory and cost 0; the API rejects them via the optional-room endpoint.

**Add a field to the snapshot** → column in `src/db/schema.ts` → DTO in `src/lib/types.ts` → mapping in `getWorldSnapshot` (`src/server/world.ts`). Those three, in that order; `tsc` enforces the rest.

**Add a route** → new `route.ts` under `src/app/api/...`. Copy the shape of the nearest existing mutation: read params → validate with `asRecord`/`requiredString`/`finiteNumber` → ownership join → business checks → `db.transaction` if more than one row changes → `publishEvent` → return `NextResponse.json(await getWorldSnapshot(pilotId))` → `catch (error) { return apiError(error) }`. Add `export const dynamic = "force-dynamic"` if it reads the DB.

**Change a tick/lock constant** → `TICK_MS`, `MAX_LAZY_TICKS`, `LOCK_MS` in `src/engine/simulation.ts`. `LOCK_MS` is also referenced by the assault route.

**Change terrain** → `src/engine/terrain.ts`. Then run the verification (below); it asserts determinism, finiteness, a 4,096-cell survey and a >700 m relief range. Changing noise will change *every* existing parcel's scores only for *new* claims — surveys are frozen in `parcels.cells`.

**Theme / palette change** → tokens in `src/app/globals.css`. There are five `:root[data-theme=...]` blocks. Biome colours are duplicated in `src/renderer/PlanRenderer.ts` and `src/components/ParcelMiniMap.tsx`.

---

## 5. Commands

```bash
npm run dev                 # next dev
npm run typecheck           # tsc --noEmit        ← cheapest correctness gate
npm run lint                # eslint (flat config)
npm run build               # next build          ← slow; only when needed
npx tsx src/engine/verify-terrain.ts   # engine assertions, no DB needed
npx drizzle-kit push        # apply schema (needs DATABASE_URL)
```

`DATABASE_URL` is **required**; `src/db/index.ts` throws without it. `drizzle.config.json` defaults to `postgresql://postgres:postgres@127.0.0.1:5432/app_db`.

Prefer `npm run typecheck` over `npm run build` for verification — it is far cheaper and catches most regressions.

---

## 6. Where NOT to look

| Path | Why | Cost |
| --- | --- | --- |
| `README.md` | 734 lines / **14.3k tokens** — human-facing analysis, redundant with this file | huge |
| `package-lock.json` | 292 KB | enormous |
| `docs/figures/data/*.json` | generated engine output | ~12k tokens |
| `docs/figures/build_deck.py` | 897 lines of slide geometry | large |
| `src/components/WorldApp.tsx` | 286 lines / 5.8k tokens — read only the slice you need |
| `src/renderer/WorldRenderer.ts` | 525 lines of three.js — never needed for a logic change |

Never grep `docs/` or `*.lock` for app logic.

---

## 7. Known traps

- **`structures.level` is dormant.** It exists in the schema and is read by `computeTotals` (`levelScale`), but no endpoint increments it. Any "upgrade" feature is greenfield, not a fix.
- **Credits use read-modify-write** without a row lock — see the note in `README.md` §15. A concurrent-budget fix needs `SELECT … FOR UPDATE` inside the existing transactions.
- **Two slope definitions, both intentional.** `sampleTerrain` uses ±32 m central differences (visual); `surveyParcel` uses 100 m cell neighbours (persisted). Placement gates read the *survey* slope.
- **Terrain is metric, not lat/lon.** Never mix degrees into `src/engine/geodesy.ts` functions — convert at the boundary with `lonLatToWorld`.
- **Aerial `parcels.cells` is a frozen 4,096-element JSONB blob.** It is read whole, never queried. Do not add SQL filtering over it.
- **No auth.** `pilotId` in the URL is trusted. Do not describe changes as "secured".
- **Default location is San Francisco**, which yields a steep, poorly-buildable parcel (build 0.21, slope 0.73) — useful to know before adding onboarding flows.

---

## 8. Style

- TypeScript strict, no `any`. Path alias `@/*` → `./src/*`.
- Pure functions in `engine/`, side effects in `server/`, thin routes in `app/api/`.
- Comments explain *why*, not *what*. Match existing density — the codebase is sparing.
- No new dependencies without explicit instruction. Current runtime deps: next, react, react-dom, three, zustand, drizzle-orm, pg, lucide-react, dotenv, tsx, @types/three.
- Prettier is not configured; matching surrounding style is the convention.

---

## 9. Working cheaply with this repo

When asked for a change: **name the 1–3 files you will edit before reading anything else**, then read only those. If a symbol in §3 is enough to answer, answer without opening a file.

If a task genuinely spans many files, state the intended file list first, then proceed — do not begin with a tree walk.
