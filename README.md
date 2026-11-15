<div align="center">

# SIMPLAYZ

**A complete, persistent world simulator — survey real Earth coordinates, build on procedurally generated terrain, and command AI officers.**

`Next.js 16` · `React 19` · `TypeScript 5.9` · `PostgreSQL + Drizzle ORM` · `three.js` · `Tailwind CSS 4` · `Zustand`

</div>

<div align="center">

**[📊 Project deck](docs/Simplayz-Project-Deck.pptx)** · 19 slides with speaker notes, figures generated from this repository's own engine
&nbsp;·&nbsp; **[How the figures are made](docs/figures/README.md)**

</div>

![Simplayz procedural relief](docs/assets/relief-hero.png)

---

## Table of contents

1. [What Simplayz is](#1-what-simplayz-is)
2. [Feature tour](#2-feature-tour)
3. [Screens and routes](#3-screens-and-routes)
4. [System architecture](#4-system-architecture)
5. [The simulation engine](#5-the-simulation-engine)
   - [5.1 Geodesy and the world frame](#51-geodesy-and-the-world-frame)
   - [5.2 Procedural terrain](#52-procedural-terrain)
   - [5.3 Parcel surveys](#53-parcel-surveys)
   - [5.4 The structure catalogue](#54-the-structure-catalogue)
   - [5.5 Economy and lazy ticks](#55-economy-and-lazy-ticks)
   - [5.6 Building interiors](#56-building-interiors)
   - [5.7 Assault resolution](#57-assault-resolution)
   - [5.8 AI officer routing](#58-ai-officer-routing)
6. [Rendering](#6-rendering)
7. [Data model](#7-data-model)
8. [API reference](#8-api-reference)
9. [Client state and realtime](#9-client-state-and-realtime)
10. [Getting started](#10-getting-started)
11. [Configuration](#11-configuration)
12. [Verification and quality gates](#12-verification-and-quality-gates)
13. [Project layout](#13-project-layout)
14. [Design decisions worth knowing](#14-design-decisions-worth-knowing)
15. [Analysis: strengths, risks and opportunities](#15-analysis-strengths-risks-and-opportunities)
16. [Roadmap](#16-roadmap)
17. [Deliverables in this repository](#17-deliverables-in-this-repository)
18. [Credits and licensing](#18-credits-and-licensing)

---

## 1. What Simplayz is

Simplayz is a browser-based persistent world simulator. Every player is a **pilot** who drops into a Web Mercator projection of the real Earth, registers a call sign, and stakes a claim on a **40,960,000 m² parcel** (a 6.4 km × 6.4 km square, sampled as a 64 × 64 grid). The terrain under that parcel is not authored by hand and not stored as a heightmap — it is *derived* on demand from a seed plus the parcel's latitude and longitude, so the same coordinates always produce the same mountains, rivers, coastlines and biomes.

On top of that terrain the pilot places 18 kinds of structures, commissions 3 × 3 building sites, lays out 12 × 12 interior floor plans with nine room types, staffs them, accrues credits on a 15-second tick, and — once a 72-hour protection window expires — resolves four-phase assaults against raiding factions. Three persistent AI officers (CTO, CFO, COO) hold provider/model routing profiles and standing directives that the player can re-point at any of 12 model profiles.

Everything is server-authoritative and stored in PostgreSQL: there is no client-side simulation of record. The 3D view, the 2D plans, the minimap and the event feed are all projections of one canonical snapshot.

### The pitch in one paragraph

> Real coordinates in, a living claim out. Simplayz turns latitude and longitude into a defensible, economically simulated settlement with a staffed interior architecture, while a deterministic engine guarantees that every number a player sees — elevation, drainage, income, defence, assault outcome — is reproducible from a seed.

### Design pillars

| Pillar | What it means in the code |
| --- | --- |
| **Deterministic** | No `Math.random()` in the engine. Terrain is hashed value noise; assaults use a seeded `mulberry32`-style step. `verify-terrain.ts` asserts repeatability. |
| **Server-authoritative** | Credits, structures, rooms and bots are written through API routes with ownership joins. The client never invents state. |
| **World-anchored** | A claim is a real coordinate. Distances are metres, tiles are real OpenStreetMap z15 rasters, and the parcel outline is drawn on actual relief. |
| **Gracefully degrading** | Tile cache → upstream OSM → stale cache → generated PNG fallback. SSE → 25 s polling. Postgres down → `/api/health` reports it rather than crashing. |
| **Dense but readable UI** | A cartographer-style HUD system with five themes, driven entirely by CSS custom properties. |

---

## 2. Feature tour

**World and survey**
- Location by device geolocation or manual lat/lon, clamped to the Web Mercator usable band (±85.05°).
- 9-tile z15 terrain view around the pilot, each tile a 26 × 26-segment mesh displaced by procedural elevation.
- Three render modes: `FLAT` (displaced, untextured), `STACK` (relief with raster draped at 55% opacity) and `RASTER` (raster-forward orthophoto look).
- WASD pilot avatar movement, drag-to-orbit camera, hover/click cell picking with a live elevation, slope and drainage readout.

**Claims**
- One parcel per pilot, frozen at claim time into 4,096 survey cells plus eight aggregate scores.
- 72-hour assault protection on claim (and re-armed after every engagement).
- Parcel boundary drawn as a draped polyline across the 3D relief.

**Construction**
- 18 structures across five categories: civic, production, utility, defence, culture.
- Terrain-gated placement: water cells only accept tidal generators; cells with slope > 0.85 only accept ramparts, wind turbines or mines; 3 × 3 site footprints must be fully on land, non-steep and unobstructed.
- Salvage returns 40% of base cost multiplied by level.

**Interiors**
- Every site-capable structure auto-installs a 12 × 12 floor plan with a Reception and a Guard Post (both mandatory).
- Seven optional room types with fixed footprints, staff costs and credits costs, overlap-checked server-side.
- Building compliance model: staff totals, guard count, receptionist count and a 0–100 coverage percentage.

**Economy**
- 15-second tick, lazily applied on read, capped at 64 ticks per catch-up so a returning player cannot accrue unbounded income.
- Six-track resource model: income, upkeep, food, power, defence, prestige — with deficit penalties that suppress net income when food or power goes negative.

**Conflict**
- Deterministic four-phase assault: Reconnaissance → Bombardment → Breach → Resolution, each with attacker/defender pressure and narrative text.
- Five named raider factions; enemy strength scales with defender prestige and structure count, so a wealthy claim is a target.
- Victory rewards scale with enemy strength; defeat costs credits.

**AI officers**
- Three fixed roles (CTO `Ada`, CFO `Rook`, COO `Mara`), seeded at registration.
- Each holds a provider, model, free-text directive (≤600 chars), autonomy 0–100 and an active flag, validated against a 12-model catalogue across six providers.
- Explicitly a *routing profile*, not live inference — see [§5.8](#58-ai-officer-routing).

**Presentation**
- Five themes: Cartographer (default), Violet, Lilac, Custom (hue slider) and Chaos (animated background).
- SSE event stream with heartbeat and automatic polling fallback; toast notifications for every world event.
- 3D orbit previews for both the area plan and the building interior.

---

## 3. Screens and routes

| Route | Component | Purpose |
| --- | --- | --- |
| `/` | `WorldApp` | Registration modal, 3D world, live HUD, structure catalogue, claim protocol, assault panel |
| `/user/[userId]/area/[areaId]` | `AreaApp` | Area dashboard: 2D minimap, 2D development plan, 3D massing preview, building register |
| `/user/[userId]/area/[areaId]/building/[buildingId]` | `BuildingApp` | Interior planner: 12 × 12 plan, room catalogue, staffing sliders, compliance panel |
| `/user/[userId]/ai/management` | `AiManagementApp` | Three officer cards with provider/model/directive/autonomy editing and a config journal |

Navigation is a four-step breadcrumb: **World → Area → Site → AI officers**, with the header disabling links that have no target yet (§`AppHeader`).

---

## 4. System architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  BROWSER                                                                     │
│                                                                              │
│  WorldApp / AreaApp / BuildingApp / AiManagementApp   (React 19 client)      │
│      │            │                                                          │
│      │            ├── ParcelMiniMap   (canvas 2D, 64×64 biome raster)        │
│      │            ├── AreaLayout      (SVG 64×64 development grid)           │
│      │            ├── BuildingLayout  (SVG 12×12 interior grid)              │
│      │            └── PlanCanvas      (three.js orbit preview)               │
│      ├── WorldCanvas → WorldRenderer  (three.js terrain + structures)        │
│      ├── useWorldStore                (Zustand + localStorage persist)       │
│      └── useWorldConnection           (SSE + 25 s polling fallback)          │
└───────────────────────────────┬──────────────────────────────────────────────┘
                                │ fetch (JSON)  /  EventSource
┌───────────────────────────────▼──────────────────────────────────────────────┐
│  NEXT.JS 16 APP ROUTER  (Node runtime)                                       │
│                                                                              │
│  12 API routes  ──►  src/server/world.ts   (snapshot assembly, ticks, events)│
│                       src/lib/api.ts       (validation + error shaping)      │
│                              │                                               │
│   /api/tiles/[z]/[x]/[y]  ───┼──► OSM upstream (7 s timeout) + tile cache    │
│                              │        └► placeholderPng() generated fallback │
│                              ▼                                               │
│                     src/engine/*  (pure, deterministic, no I/O)              │
│                     terrain · geodesy · catalogue · rooms · simulation · ai  │
└───────────────────────────────┬──────────────────────────────────────────────┘
                                │ Drizzle ORM (node-postgres Pool, dev-globalised)
┌───────────────────────────────▼──────────────────────────────────────────────┐
│  POSTGRESQL                                                                  │
│  pilots · parcels · structures · buildings · rooms · bots · tile_cache ·      │
│  events · assaults                                                           │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Layering rule

The `engine/` directory is the heart of the project and **imports nothing from the database, the server or React**. It is pure functions over numbers: `heightAtM(x, y, seed)`, `surveyParcel(seed, center)`, `computeTotals(structures, scores)`, `resolveAssault(input)`. That is why it can be executed directly under `tsx` for verification, reused by the renderer, and reasoned about without a database.

```
engine  ──►  server  ──►  app/api  ──►  client
   ▲                                      │
   └──────────  renderer / types  ◄───────┘
```

`src/lib/types.ts` defines the DTO contract (`WorldSnapshot`, `ParcelDTO`, `StructureDTO`, …) shared by both sides. There is exactly one snapshot shape in the system.

---

## 5. The simulation engine

### 5.1 Geodesy and the world frame

`src/engine/geodesy.ts` establishes a flat metric world frame from spherical Web Mercator:

| Constant | Value | Meaning |
| --- | --- | --- |
| `EARTH_RADIUS_M` | 6,378,137 | WGS-84 semi-major axis |
| `WEB_MERCATOR_LIMIT_M` | π · R ≈ 20,037,508 | Half world width |
| `WORLD_WIDTH_M` | 2π · R ≈ 40,075,017 | World circumference |
| `PARCEL_AREA_M2` | 40,960,000 | Parcel area |
| `PARCEL_SIDE_M` | 6,400 | Derived side length |
| `PARCEL_GRID_SIZE` | 64 | Survey resolution |
| `PARCEL_CELL_M` | 100 | Metres per survey cell |

`lonLatToWorld` maps longitude/latitude into metres (`x = R·λ`, `y = R·ln tan(π/4 + φ/2)`), and `worldToLonLat` is its exact inverse — asserted to 1e-9 in the verification script. Latitudes are clamped to ±85.05112878° (the Mercator singularity guard) and longitudes normalised to (−180, 180]. `worldToTile`, `tileBounds`, `tileSizeM` and `tileCenter` implement the XYZ slippy-map convention, with modular x-wrapping and y-clamping for the poles.

`seedForLocation(pilotSeed, lat, lon)` mixes the pilot seed with lat/lon rounded to 1e-4 (≈11 m) so that a claim at a distinct coordinate yields distinct terrain, while a claim at the same coordinate by the same pilot always reproduces the same world.

### 5.2 Procedural terrain

`src/engine/terrain.ts` (~275 lines) is a self-contained noise library plus an orogeny model. There is no external noise dependency — `hash2` is an integer bit-mixer (`Math.imul` chains) returning a uniform [0, 1) value, `valueNoise` is bilinear-smoothstepped interpolation over the hash lattice, and `fbm` sums octaves at 0.5 amplitude decay and 2.03 frequency gain.

The field pipeline, in order:

1. **Domain warp.** Two low-frequency fBm samples displace the sample point by up to ±925 m, breaking the grid-aligned regularity of raw noise.
2. **Rotation.** The warped point is rotated ~10° so continental structure does not align with latitude.
3. **Continent + asymmetric + detail.** Three fBm layers at very different scales (19 km / 25 km, 6.2 km / 9.1 km, 1.35 km / 1.75 km) build a base height of roughly `(continent − 0.49) · 1650 + …`.
4. **Orogeny.** A smoothstepped mountain mask multiplies *ridged* fBm raised to the power 2.25 and scaled by 2350 m, producing sharp crests only where the mask is high.
5. **Rivers.** Two ridged line features (`exp(−|noise − 0.5| · k)`) carve 135 m plus up to 285 m extra in mountains, with a second tributary network at lower strength. Carving is gated by elevation so rivers do not appear on the sea floor.
6. **Lakes.** A smoothstepped bowl mask subtracts 95–175 m.
7. **Derived fields.** Temperature from latitude, elevation and a noise jitter; drainage from river/lake strength; soil from noise, drainage and slope; moisture; canopy from moisture, soil, altitude and temperature; urban density from a high-threshold noise band near sea level.

`classifyBiome` then assigns one of **14 biomes** through an ordered decision tree: `deep_sea`, `sea`, `lake`, `alpine`, `tundra`, `coast`, `wetland`, `urban`, `desert`, `rainforest`, `boreal_forest`, `temperate_forest`, `savanna`, `grassland`. Order matters — the tree encodes precedence (water beats alpine, alpine beats tundra, and so on).

Measured behaviour (produced by running the engine directly, seed 4242, one 26 km window at 56°N/126°E): relief spans **−298 m to 1,642 m** with 47% land cover, and a single parcel exposes five distinct biome classes. A second run at seed 4242 on a coastal parcel surfaced `grassland 60.0%`, `sea 25.3%`, `coast 8.2%`, `lake 6.4%`, `deep_sea 0.1%` — plausible, mixed, and *not* re-randomised between calls.

> **Why this matters:** terrain is a *function*, not a fixture. Nothing in `heightAtM` reads time, randomness or I/O, so the same 4,096 cells recompute identically in the renderer, the survey and the verification script — three different processes.

A subtle but important detail: `sampleTerrain` computes slope by central differences at ±32 m, while `surveyParcel` computes it from neighbouring grid cells (100 m spacing and clamped at grid edges). The two slopes are therefore slightly different views of the same surface; placement gates use the *survey* slope, which is the one persisted in the `cells` JSONB.

### 5.3 Parcel surveys

`surveyParcel(seed, center, size)` evaluates the field at 4,096 cell centres, then produces two artefacts:

**Per-cell record** (compact, `SurveyCell`):

| Key | Field | Range |
| --- | --- | --- |
| `h` | height (m) | −300 … 2,000 |
| `s` | slope (rise/run) | 0 … ~2 |
| `b` | biome index | 0 … 13 |
| `w` | water flag | 0 \| 1 |
| `d` | drainage | 0 … 1 |
| `c` | canopy | 0 … 1 |
| `u` | urban | 0 … 1 |

**Eight aggregate scores** (`TerrainScores`, each the mean of a per-cell 0–1 score, rounded to 4 dp): `elevation`, `slope`, `water`, `forest`, `farm`, `build`, `defence`, `hydro`. These scores are the *only* terrain input to the economy — `build` gates structure value, `farm` gates food, `defence` gates combat strength, `hydro` gates water-dependent yield.

Survey output is written once at claim time and never recomputed, which is what makes a claim a *fixed asset*: you chose the coordinates, you live with the survey.

### 5.4 The structure catalogue

`src/engine/catalogue.ts` is a frozen, `as const satisfies` array of 18 definitions. Every structure declares `cost`, `income`, `upkeep`, `food`, `power`, `defence`, `prestige`, an `affinity` (which terrain score amplifies it), a colour, a render height and whether it is a `site` (3 × 3, spawns a building).

| Category | Structures |
| --- | --- |
| **Civic** | Command Pavilion, Habitat Stack, Exchange Market, Research Laboratory, Field Clinic |
| **Production** | Hydroponic Gallery, Terrace Farm, Deep Mine, Lumber Camp, Fabrication Works |
| **Utility** | Solar Array, Wind Turbine, Tidal Generator |
| **Defence** | Guard Barracks, Terrain Rampart, Sentry Turret, Radar Mast |
| **Culture** | Survey Monument |

The catalogue is deliberately *economically varied* rather than balanced-flat: the highest-margin structure (Fabrication Works, +50/tick) is also among the most expensive (1,800) and power-hungry (−12); the lowest-cost structure (Terrain Rampart, 450) earns nothing but adds 12 defence. `affinity` is what couples geography to strategy — a Wind Turbine amplifies on `elevation`, a Lumber Camp on `forest`, a Hydroponic Gallery on `hydro`. Two pilots on identical budgets but different parcels should rationally build different things.

### 5.5 Economy and lazy ticks

`computeTotals` folds the placed structures into six resource tracks. For each structure:

```
affinity      = clamp(scores[definition.affinity], 0, 1)
terrainScale  = 0.65 + affinity × 0.70          →  0.65 … 1.35
levelScale    = 1 + (level − 1) × 0.35

income  += def.income  × terrainScale × levelScale
upkeep  += def.upkeep  × (1 + (level − 1) × 0.22)
food    += def.food    × (positive ? terrainScale : 1) × levelScale
power   += def.power   × (positive ? terrainScale : 1) × levelScale
defence += def.defence × (0.80 + scores.defence × 0.65) × levelScale
prestige+= def.prestige× levelScale
```

Then:

```
deficitPenalty = (power < 0 ? 0.28 : 0) + (food < 0 ? 0.22 : 0)
netIncome      = round((income − upkeep) × (1 − min(0.65, deficitPenalty)))
defence        = round((rawDefence + scores.defence × 34) × (1 + scores.slope × 0.22))
```

Two design notes. First, **terrain only amplifies, never penalises** — a bad affinity lowers output toward the 0.65 floor rather than making a structure actively harmful, so a player is never trapped by an unlucky parcel. Second, **shortages bite twice**: a power deficit caps net income at 72% and a simultaneous food deficit at 50%, both floor-capped at 35%. Upkeep scales more slowly than income (0.22 vs 0.35 per level), so vertical growth is a genuine strategy.

Ticks are *lazy*: `applyTicks` computes `floor(elapsed / 15_000)`, caps the catch-up at `MAX_LAZY_TICKS = 64` (16 minutes of simulated time), and advances `lastTickAt` by exactly the ticks consumed so no time is silently lost. A pilot who returns after a week therefore gets 64 ticks, not 40,320 — an explicit anti-idle-farming measure. `credits` is floored at 0.

### 5.6 Building interiors

`src/engine/rooms.ts` defines a 12 × 12 interior grid and nine room kinds. `reception` and `guard` are mandatory and cost 0; the other seven cost 180–440 credits and carry staff requirements:

| Room | Footprint | Staff | Cost |
| --- | --- | --- | --- |
| Reception *(required)* | 4 × 4 | 1 | 0 |
| Guard Post *(required)* | 4 × 4 | 1 | 0 |
| Operations Office | 3 × 3 | 3 | 240 |
| Server Room | 3 × 3 | 1 | 420 |
| Workshop | 4 × 3 | 2 | 360 |
| Crew Quarters | 4 × 3 | 0 | 280 |
| Storage | 3 × 3 | 0 | 180 |
| Infirmary | 3 × 4 | 2 | 390 |
| Generator Room | 3 × 3 | 1 | 440 |

`roomsOverlap` is a standard AABB intersection test. `computeBuildingStats` returns `{ staff, guards, receptionists, coverage, valid }` where `coverage = min(100, guards·24 + receptionists·20 + specialistRooms·7)` and `valid` requires at least one guard and one receptionist. The API enforces the invariant from both directions: you cannot add a second `reception` or `guard` through the "optional room" endpoint, and you cannot delete the last one of either kind.

### 5.7 Assault resolution

`resolveAssault` is a four-phase escalation driven by a seeded PRNG (`randomStep`, a 32-bit integer mixer — no `Math.random()` anywhere). Given `{ seed, defence, power, prestige, structureCount }`:

```
enemy           = one of 5 named factions, chosen by the first PRNG draw
enemyStrength   = 34 + rand·48 + prestige·0.62 + structureCount·1.8
defence         = max(4, defence + max(0, power)·0.12)
```

| Phase | Attacker | Defender | Effect on defence |
| --- | --- | --- | --- |
| Reconnaissance | `enemyStrength · (0.18 + r·0.12)` | `defence · (0.17 + r·0.13)` | −12% of unopposed surplus |
| Bombardment | `enemyStrength · (0.30 + r·0.18)` | `defence · (0.20 + r·0.18) + power·0.10` | −28% of leaked damage |
| Breach | `enemyStrength · (0.38 + r·0.20)` | `defence · (0.34 + r·0.20)` | +8% of line, −30% of breach |
| Resolution | `enemyStrength · (0.42 + r·0.22)` | `defence · (0.45 + r·0.25)` | Victory if `lastStand ≥ finalPush && defence > 0` |

Reward on victory: `450 + enemyStrength·11 + prestige·4`. Loss on defeat: `280 + enemyStrength·8`. Each phase carries authored narrative text, chosen by whether the defender met the attacker in that phase — so the report reads as a story rather than a table.

The coupling is intentional and self-balancing: **prestige makes you a bigger target but pays a better reward**, and power contributes twice (to the starting defence pool and to bombardment interception). A turtle with zero prestige faces weak raiders but earns little; a monument-builder faces stronger ones and must actually build turrets.

A verified pair of runs at seed 90,210 shows the scaling — a 6-structure/120-defence outpost faces strength 99 (defender lines 24/37/46/74 vs attackers 29/43/39/63) and holds; the same seed with 12 structures, 210 defence and 60 prestige faces strength 128 and holds with lines 43/69/82/138 versus 37/56/50/81.

### 5.8 AI officer routing

`src/engine/ai.ts` holds three data tables: six providers, 12 model profiles, three bot roles with default names and directives. Each model profile documents context window, relative cost and a one-line strength, and `isAiModel(provider, model)` validates the pair server-side so the PATCH route cannot persist an impossible combination.

| Role | Default officer | Default provider / model | Standing directive |
| --- | --- | --- | --- |
| CTO | **Ada** | OpenAI · `gpt-5-mini` | Audit build order, power resilience and technical debt |
| CFO | **Rook** | Anthropic · `claude-sonnet-4-6` | Protect the treasury; compare net ticks, upkeep and payback |
| COO | **Mara** | Google · `gemini-3-flash` | Keep food, staff and site logistics balanced |

**Honest scope.** This is a *persistent routing profile editor*, not an inference client. No provider API is contacted, no prompt is sent, and no generated text is stored. The UI states this explicitly ("Routing, not simulated inference"), and the "operational focus" cards on each officer are deterministic readouts of the real world snapshot, not LLM output. This is a deliberate and clearly-labelled stub — the natural extension point for the roadmap.

---

## 6. Rendering

### 3D world — `WorldRenderer.ts` (525 lines)

A single `three.js` scene with four groups (`terrainGroup`, `rasterGroup`, `structureGroup`, `parcelGroup`), an `OrbitControls` camera and a frame loop gated by signatures (`terrainSignature` = seed + centre, `structureSignature` = id/type/grid/level of every structure) so rebuilds only happen when something actually changed.

- **Geometry**: for each of the 9 surrounding z15 tiles, a 27 × 27 vertex grid is extruded from `heightAtM`, with UVs for raster draping and per-vertex colours for the biome ramp. Two copies are built per tile — a solid displaced mesh and a raster-draped mesh offset 1.4 m above it — which is how the three modes are switched by material opacity rather than geometry churn.
- **Relief exaggeration**: `height * RELIEF_SCALE (1.35)` above sea level, with anything below sea level flattened to 0 so the water plane reads clean.
- **Rasters**: `/api/tiles/z/x/y.png` are loaded as textures with sRGB colour space and anisotropic filtering (capped at 8×); a tile counter reports `loaded/total` to the HUD.
- **Picking**: a raycaster converts pointer position to a terrain intersection, then `worldToParcelCell` yields a survey grid cell for hover and click.
- **Avatar**: WASD moves a local group with collision-free ground-following via `localGround`.
- **Disposal**: `clearGroup` walks geometries, materials and textures and disposes them, plus a `ResizeObserver` and `dispose()` — no leaked GPU resources on route changes.

### Plans — `PlanRenderer.ts` (213 lines), `ParcelMiniMap.tsx`, `AreaLayout.tsx`, `BuildingLayout.tsx`

Four complementary 2D/3D views, all driven by the same snapshot:

- `PlanRenderer` is a *second* three.js scene for orbit previews: `mode: "area"` builds massing blocks for the whole parcel, `mode: "building"` builds room volumes inside a 12 × 12 shell.
- `ParcelMiniMap` paints the 64 × 64 biome raster to a canvas with a fixed 14-colour biome palette, elevation whitening above 500 m, an 8-cell major grid, structure markers and a crosshair focus ring for the active site.
- `AreaLayout` is a pure-SVG 64 × 64 grid with `<pattern>` defs for minor/major grids, dashed centre axes, and clickable structure groups.
- `BuildingLayout` is a pure-SVG 12 × 12 interior with room rectangles, name and staff labels, and a door mark.

The duplication (engine colour palette appears in both `PlanRenderer` and `ParcelMiniMap`) is the most obvious small refactor in the codebase — see [§15](#15-analysis-strengths-risks-and-opportunities).

### Theming — `globals.css` (266 lines)

A single `:root` block defines `--ink`, `--muted`, `--accent`, `--accent-soft`, `--panel`, `--panel-strong`, `--line`, `--danger`, `--success`, `--world-bg`, `--custom-hue`. Four `:root[data-theme="…"]` blocks override them; `@theme inline` maps the tokens into Tailwind's colour namespace so utilities like `text-accent` and `border-line` work. Because the Chaose theme animates `body`, and because the theme is applied via `data-theme`, a tiny inline script in `layout.tsx` restores the persisted theme *before first paint* — no flash of the wrong palette.

---

## 7. Data model

Nine Drizzle tables (`src/db/schema.ts`, 127 lines). All primary keys are `text` UUIDs except `events.id` (`bigserial`) and `tile_cache`'s composite key.

```
pilots 1──1 parcels 1──* structures
              │  1──* buildings 1──* rooms
              │  1──* assaults
          1──* bots
          1──* events
```

| Table | Key columns | Notes |
| --- | --- | --- |
| `pilots` | `id`, `call_sign` (unique), `seed`, `home_lat`, `home_lon`, `credits` (default 15,000) | One call sign per world entry |
| `parcels` | `id`, `pilot_id` (**unique** — one claim each), `seed`, `center_x/y`, `lat/lon`, `area_m2`, `scores` (jsonb), `cells` (jsonb), `locked_until`, `last_tick_at` | Index on `locked_until` |
| `structures` | `id`, `parcel_id`, `type`, `gx`, `gy`, `rotation`, `level` | `uniqueIndex (parcel_id, gx, gy)` — the DB *also* enforces one structure per cell |
| `buildings` | `id`, `parcel_id`, `structure_id`, `archetype`, `gx/gy`, `width/depth`, `level` | Created alongside a `site: true` structure |
| `rooms` | `id`, `building_id`, `kind`, `x`, `y`, `width`, `depth`, `staff` | Placement validated against `BUILDING_GRID_SIZE` |
| `bots` | `id`, `pilot_id`, `role`, `provider`, `model`, `directive`, `autonomy`, `active` | `uniqueIndex (pilot_id, role)` — exactly one bot per role |
| `tile_cache` | `(z, x, y)` PK, `png_base64`, `fetched_at`, `source` | 24 h freshness window |
| `events` | `bigserial id`, `pilot_id`, `kind`, `message`, `payload` (jsonb) | Index on `(pilot_id, id)` for stream cursors |
| `assaults` | `id`, `parcel_id`, `report` (jsonb), `created_at` | Full four-phase report persisted verbatim |

Design notes worth calling out: cascading deletes throughout mean a pilot deletion is atomic; the `parcels.pilot_id` unique constraint is the *hard* enforcement of one-claim-per-pilot (the API also checks it, defence in depth); and storing `cells` as JSONB trades queryability for a 4,096-element payload that is only ever read whole — the right trade at this scale, though it is the first thing to shard if parcels grow.

The schema deliberately types its JSONB columns against engine types (`$type<TerrainScores>()`, `$type<SurveyCell[]>()`, `$type<AssaultReport>()`), so a change in the engine's output shape becomes a TypeScript error at the Drizzle boundary rather than a silent runtime surprise. That is a genuinely good pattern.

---

## 8. API reference

All routes are under `src/app/api`. Ownership is verified by joining through `parcels.pilot_id` on every mutation; errors are shaped by `apiError` (message + 400, or 404 when the message mentions "not found"/"not hold").

| Method | Path | Body / query | Effect |
| --- | --- | --- | --- |
| `GET` | `/api/health` | — | `{ ok: true }` after `select 1`, else 500 |
| `POST` | `/api/pilots` | `{ callSign, lat, lon }` | Registers pilot, seeds 3 bots, publishes event; call sign sanitised to `[a-zA-Z0-9 _-]`, ≥2 chars |
| `GET` | `/api/pilots/[pilotId]` | — | Full `WorldSnapshot`, `Cache-Control: no-store` |
| `POST` | `/api/pilots/[pilotId]/claim` | `{ lat, lon }` | Surveys 4,096 cells, locks 72 h, records scores |
| `POST` | `/api/pilots/[pilotId]/structures` | `{ type, gx, gy, rotation }` | Validates terrain/cell/footprint/occupancy/affordability, inserts structure (+ building + 2 rooms if `site`), debits credits in a transaction |
| `DELETE` | `/api/structures/[structureId]?pilotId=` | — | Refunds `floor(cost × 0.4 × level)` |
| `POST` | `/api/buildings/[buildingId]/rooms?pilotId=` | `{ kind, x, y }` | Optional room only; footprint + overlap + credits checked |
| `PATCH` | `/api/rooms/[roomId]?pilotId=` | `{ name, staff }` | Staff clamped 0–20; required rooms cannot drop below 1 |
| `DELETE` | `/api/rooms/[roomId]?pilotId=` | — | Refuses to remove the last guard/reception; refunds 120 |
| `PATCH` | `/api/pilots/[pilotId]/bots/[botId]` | `{ provider, model, directive, autonomy, active }` | Validated pair, autonomy clamped 0–100, directive ≤600 |
| `POST` | `/api/parcels/[parcelId]/assault?pilotId=` | — | Requires expired lock; resolves, archives, re-arms lock, adjusts credits in a transaction |
| `GET` | `/api/tiles/[z]/[x]/[y].png` | — | See below |
| `GET` | `/api/stream?pilot=&after=` | — | SSE: `ready`, `world`, `heartbeat`, `degraded` |

### Tile pipeline

`/api/tiles/[z]/[x]/[y].png` is the best single example of the project's degradation strategy:

```
validate coords (0 ≤ z ≤ 19, x/y < 2^z)
   ├─ cache hit & < 24 h ──► 200 (source: cache, HIT)
   ├─ fetch tile.openstreetmap.org (7 s abort)
   │     ├─ 200 + PNG magic ──► store base64 ──► 200 (source: upstream)
   │     └─ non-PNG / non-200 / timeout
   │            ├─ cache present ──► 200 (source: stale, stale-if-error=7d)
   │            └─ no cache      ──► 200 (source: placeholder, generated)
```

The generated placeholder is not a grey box: `src/server/placeholder.ts` hand-writes a valid PNG (CRC32 table, IHDR/tEXt/IDAT/IEND chunks, `deflate` level 9) with a 256 × 256 grid-and-diagonal survey texture and a tEXt description naming the tile. Cache writes are wrapped so a database failure cannot stop a freshly fetched raster from rendering, and every response advertises provenance in `x-simplayz-source`, `x-simplayz-cache`, `x-simplayz-provenance`, `x-simplayz-age` and `x-simplayz-tile`, with `Access-Control-Expose-Headers` so the browser can read them.

### Streaming

`/api/stream` is a hand-rolled SSE endpoint over a `ReadableStream`, polling `events` every 2 s for rows with `id > cursor`, emitting each as a `world` event with an SSE `id`, plus a `heartbeat` every cycle. It honours both the `after` query parameter and the `Last-Event-ID` header, and emits `degraded` (rather than dying) if the database is unreachable. `X-Accel-Buffering: no` prevents proxy buffering.

---

## 9. Client state and realtime

**`useWorldStore`** (Zustand + `persist`) holds `pilotId`, `snapshot`, `location`, `mode`, `theme`, `customHue`, selection, hover, stream status and notices. Only `pilotId`, `location`, `mode`, `theme` and `customHue` are persisted — deliberately excluding the snapshot (stale data should never be rehydrated) and the notice list. The `merge` function additionally forces `snapshot: null`, `notices: []`, `selectedBuild: null` and `hoveredCell: null` on rehydration, which prevents the classic Zustand-persist bug of resurrecting a dead selection.

**`useWorldConnection(pilotId)`** is the single realtime hook:

1. Immediate `fetchSnapshot`, then an interval poll every 25 s.
2. Opens `EventSource` to `/api/stream?pilot=…&after=<highest seen event id>`.
3. On `world`, advances the cursor, raises a toast and triggers a quiet refresh — so the *server* remains the source of truth for every mutation, and the event only signals *that something changed*.
4. On error, sets status to `polling` and keeps the 25 s poll alive. The header indicator reads `live` / `polling` / `offline`.
5. Cleans up interval, source and status on unmount or pilot change.

This is the correct architecture for a game like this: events are hints, snapshots are truth. It means a dropped SSE connection degrades to a 25 s refresh cadence instead of a broken screen.

---

## 10. Getting started

### Prerequisites

- **Node.js 22+** (uses `crypto.randomUUID`, native fetch, `AbortSignal.timeout`)
- **PostgreSQL 14+**
- npm 10+

### Steps

```bash
# 1. Install
npm install

# 2. Provide a database
createdb simplayz
export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/simplayz"

# 3. Create the schema (Drizzle)
npx drizzle-kit push          # or: npx drizzle-kit generate && npx drizzle-kit migrate

# 4. Run
npm run dev                   # http://localhost:3000
```

`drizzle.config.json` ships pointing at `postgresql://postgres:postgres@127.0.0.1:5432/app_db` for local use; override `DATABASE_URL` in `.env.local` for anything else. `src/db/index.ts` throws on a missing URL by design — fail fast rather than 500 on first query.

### First run

1. Open `/` — the registration modal appears over the 3D world.
2. Set a location (device geolocation or custom lat/lon) and enter a call sign.
3. Register → you get 15,000 credits and three AI officers.
4. **Survey & lock this parcel** → 4,096 cells frozen, 72-hour protection.
5. Pick a structure from the catalogue, click a valid cell to commission it.
6. Open the **Area** plan for the 2D/3D dashboard; open a site for the interior planner.
7. Visit **AI officers** to re-point providers and write directives.

> **What the default location actually produces.** The store defaults to San Francisco (37.7749, −122.4194). Running `surveyParcel(seedForLocation(4242, 37.7749, −122.4194), …)` on that coordinate gives seed **522,624,525**: **66% grassland, 28% alpine, 3% tundra**, only 0.3% water, with `slope 0.73`, `defence 0.65` and `build 0.21`. A very steep, very defensible, poorly buildable parcel — a genuinely interesting but unforgiving first claim. Probe a few coordinates before committing; the survey is frozen once claimed.

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Next dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint (flat config, `next/core-web-vitals`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npx tsx src/engine/verify-terrain.ts` | Engine self-check (see §12) |

---

## 11. Configuration

| Variable | Required | Default in repo | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | **yes** | `postgresql://postgres:postgres@127.0.0.1:5432/app_db` (via `drizzle.config.json`) | Postgres connection string for `pg.Pool` |

There are no API keys, no provider secrets and no client-exposed environment variables — `grep` for `NEXT_PUBLIC` returns nothing. This is consistent with the AI-officer design being a routing-profile editor rather than a live inference client.

Tunable constants live in code, by design (they are engine parameters, not deployment config):

| Constant | File | Value |
| --- | --- | --- |
| `TICK_MS` | `engine/simulation.ts` | 15,000 |
| `MAX_LAZY_TICKS` | `engine/simulation.ts` | 64 |
| `LOCK_MS` | `engine/simulation.ts` | 72 h |
| `PARCEL_GRID_SIZE` | `engine/geodesy.ts` | 64 |
| `PARCEL_CELL_M` | `engine/geodesy.ts` | 100 m |
| `BUILDING_GRID_SIZE` | `engine/rooms.ts` | 12 |
| `TILE_ZOOM` / `TILE_SEGMENTS` | `renderer/WorldRenderer.ts` | 15 / 26 |
| `RELIEF_SCALE` | `renderer/WorldRenderer.ts` | 1.35 |
| `FRESH_MS` | `api/tiles/.../route.ts` | 24 h |

---

## 12. Verification and quality gates

`src/engine/verify-terrain.ts` is a runnable assertion suite over the pure engine (no database, no browser):

- **Projection round-trip** — `worldToLonLat(lonLatToWorld(p))` within 1e-9 for San Francisco, Paris and Tokyo.
- **Determinism** — `heightAtM` called twice per sample must be bit-identical, across three seeds and a 61 × 61 sample window.
- **Finiteness** — every height must be finite.
- **Survey repeatability** — `surveyParcel` must produce `deepEqual` output on repeat calls.
- **Survey shape** — exactly 4,096 cells; every score normalised to [0, 1].
- **World plausibility** — relief range > 700 m, global min < 0, global max > 250 m, and exactly 14 biomes defined.

Run it with:

```bash
npx tsx src/engine/verify-terrain.ts
# → "terrain verification passed" + per-seed score dumps
```

This is a strong pattern for a project like this — the *maths* has a test harness even though the HTTP layer does not. The HTTP and UI layers are protected by `tsc --noEmit` and ESLint instead, which is appropriate given TypeScript strict mode and the DTO-based boundary.

---

## 13. Project layout

```
simplay-ukkyz-v2/
├── README.md
├── docs/
│   ├── Simplayz-Project-Deck.pptx  # 19-slide project deck
│   ├── assets/                     # generated figures used by this README / the deck
│   └── figures/                    # extract.ts · render.py · build_deck.py · data/
├── drizzle.config.json             # Drizzle dialect + credentials
├── eslint.config.mjs               # flat config, next/core-web-vitals
├── next.config.ts
├── package.json                    # 11 runtime deps, 11 dev deps
├── postcss.config.mjs              # @tailwindcss/postcss
├── tsconfig.json                   # strict, bundler resolution, @/* → ./src/*
└── src/
    ├── app/
    │   ├── globals.css             # theme tokens + 266 lines of HUD system
    │   ├── layout.tsx              # metadata, pre-paint theme script, ToastHub
    │   ├── page.tsx                # → WorldApp
    │   ├── api/
    │   │   ├── health/route.ts
    │   │   ├── pilots/route.ts
    │   │   ├── pilots/[pilotId]/route.ts
    │   │   ├── pilots/[pilotId]/claim/route.ts
    │   │   ├── pilots/[pilotId]/structures/route.ts
    │   │   ├── pilots/[pilotId]/bots/[botId]/route.ts
    │   │   ├── buildings/[buildingId]/rooms/route.ts
    │   │   ├── parcels/[parcelId]/assault/route.ts
    │   │   ├── rooms/[roomId]/route.ts
    │   │   ├── structures/[structureId]/route.ts
    │   │   ├── stream/route.ts     # SSE
    │   │   └── tiles/[z]/[x]/[y]/route.ts
    │   └── user/[userId]/
    │       ├── ai/management/page.tsx
    │       └── area/[areaId]/
    │           ├── page.tsx
    │           └── building/[buildingId]/page.tsx
    ├── components/                 # 12 components (WorldApp, AreaApp, BuildingApp, …)
    ├── db/
    │   ├── index.ts                # pooled Drizzle client (dev-globalised)
    │   └── schema.ts               # 9 tables + relations
    ├── engine/                     # ★ pure simulation, no I/O
    │   ├── ai.ts                   # providers, models, bot roles
    │   ├── catalogue.ts            # 18 structures
    │   ├── geodesy.ts              # Web Mercator ↔ metres ↔ tiles
    │   ├── rooms.ts                # 9 room kinds, overlap, coverage
    │   ├── simulation.ts           # totals, lazy ticks, assaults
    │   ├── terrain.ts              # noise, fBm, orogeny, biomes, survey
    │   └── verify-terrain.ts       # assertion suite
    ├── hooks/useWorldConnection.ts  # SSE + polling
    ├── lib/                        # api helpers, client fetch/format, DTO types
    ├── renderer/                   # WorldRenderer (3D), PlanRenderer (3D previews)
    ├── server/                     # world.ts (snapshots), placeholder.ts (PNG)
    └── store/useWorldStore.ts      # Zustand store
```

**48 source files, 3,852 lines.** Roughly: engine 702, renderer 738, components 957, app 775, data/server/lib/store/hooks 680. That is a good ratio — the domain logic is ~18% of the code and the presentation layer is deliberately the largest slice.

---

## 14. Design decisions worth knowing

**1. Terrain is a pure function of (seed, x, y).** No heightmap assets, no generation step, no migration when the world changes. Cost: every query re-evaluates noise (cheap at 4,096 samples). Benefit: infinite world, zero storage, guaranteed reproducibility across client, server and tests.

**2. The survey is frozen at claim time.** This makes a parcel a *fixed asset* — you cannot re-roll your geography by refreshing. It also means the 4,096-cell JSONB payload is written exactly once and read whole, which is why JSONB is the right storage choice.

**3. Ticks are lazy and capped.** `applyTicks` runs on read, so there is no background scheduler, no cron, no worker process. The 64-tick cap bounds both the catch-up computation and idle income. Cost: a returning player loses simulation time. Benefit: a single stateless API behind a load balancer behaves identically to a single instance.

**4. Two slope definitions are intentional.** Placement gates use the survey slope (100 m cell neighbours); visual/atmospheric terrain uses the 32 m central difference. The survey is the authority because it is what is persisted.

**5. The event log is both an audit trail and the transport.** `events` drives the SSE stream, the toast feed and the "configuration journal" UI. It is append-only and never read for game logic — a clean separation of narrative from state.

**6. Real-time is a hint, not a source of truth.** SSE triggers a refetch; it never patches the snapshot. That single rule eliminates an entire class of client/server divergence bugs.

**7. Drizzle JSONB columns are typed against engine types.** `$type<AssaultReport>()` means an engine refactor breaks `tsc`, not production.

**8. Everything degrades.** Tiles → cache → stale → generated PNG. Stream → polling. Database down → `/api/health` 500 and a `degraded` SSE event rather than a crash.

**9. Marketing honesty is enforced in the UI.** The AI management page states in the product itself that routing profiles are stored but no inference is performed. That is unusual and worth preserving.

---

## 15. Analysis: strengths, risks and opportunities

### Strengths

| Area | Assessment |
| --- | --- |
| **Domain purity** | `engine/` is a genuinely clean core: deterministic, dependency-light, testable under `tsx`. This is why the project is credible as a *simulator* rather than a mock-up. |
| **Coupling of geography to strategy** | The `affinity` multiplier plus per-structure terrain gates mean location choices have real economic consequences. Most browser builders skip this. |
| **Server authority** | Every mutation is validated against ownership joins *and* terrain constraints *and* affordability, inside transactions where multiple rows change. |
| **Progressive degradation** | Four-level tile fallback and SSE→polling fallback are production instincts, not demo instincts. |
| **UI system** | 266 lines of tokenised CSS covers five themes, a HUD language, catalogue rows, metric grids and 3D canvases. No CSS framework sprawl. |
| **Type boundary** | One `WorldSnapshot` DTO shared by API, store, components and renderer, with a single `apiRequest` helper and a single error shaper. |
| **Honest scope** | The AI feature is documented as a stub *in the product*, not just in the README. |

### Risks and rough edges

| # | Observation | Impact | Suggested fix |
| --- | --- | --- | --- |
| 1 | **Level exists but never increases** — `structures.level` is read in three places but nothing increments it, so the whole `levelScale` half of the economy is dormant. | Medium — an advertised progression axis is unreachable. | Add `POST /api/structures/[id]/upgrade` with cost curve and a UI action. |
| 2 | **No HTTP/handler tests.** Only the pure engine is asserted. | Medium | Add route-level tests (snapshot assembly, ownership 404s, transaction rollback). |
| 3 | **No concurrency guard on credits.** `getWorldSnapshot` → check → `update` is a read-modify-write without a row lock or optimistic version. Two parallel requests can both spend the same credits. | Medium — a determined client could double-spend. | `SELECT … FOR UPDATE` inside the existing transactions, or a `version` column with `where version = n`. |
| 4 | **Client-supplied `pilotId`** in query strings is trusted for ownership (it *is* joined against parcels, so nobody can touch another pilot's parcel, but there is no authentication at all). | High for production, low for a demo. | Real session identity; derive `pilotId` from the session, never from the URL. |
| 5 | **Duplicate biome palette** in `PlanRenderer.ts` and `ParcelMiniMap.tsx` (14 hex values, twice). | Low | Export a single `BIOME_COLORS` from `engine/terrain.ts`. |
| 6 | **`assaults.report` is unbounded JSONB** and the API returns only the last 6, but rows accumulate forever. | Low | Retention policy or a cap per parcel. |
| 7 | **`events` grows without limit** and the stream polls it every 2 s per connected client. | Low–Medium at scale | Prune/partition; consider `LISTEN/NOTIFY` or an SSE fan-out hub. |
| 8 | **Fixed world scale.** `PARCEL_SIDE_M` (6.4 km) and the 3 × 3 footprint mean a "building" is 300 m across — architecturally enormous. | Cosmetic | Document the abstraction, or decouple visual massing scale from simulation units. |
| 9 | **Single claim per pilot**, enforced by a unique index, with no transfer/abandon flow except deleting the pilot. | Low | Add `DELETE /api/parcels/[id]` with a cooldown. |
| 10 | **No rate limiting** on registration, tile fetch or stream. | Medium | Per-IP token bucket; cap concurrent SSE connections per pilot. |
| 11 | **Accessibility**: the 3D canvases are decorative-plus-interactive; the SVG plans have `aria-label`s and `role="button"` per building (good), but the canvas minimap has no keyboard path. | Low–Medium | Add a focusable grid overlay or a parallel list view for placement. |
| 12 | **`placeholderPng` is regenerated on every failed tile request** with no caching (correctly `no-store`), which is CPU-noticeable under a tile-storm. | Low | Cache placeholders per z/x/y in an LRU. |

**Overall read:** this is a well-architected single-tenant simulator with an unusually clean domain core and a genuinely production-minded failure model. The gaps are the ones you would expect at this stage — no auth, no level progression, no handler tests, no concurrency guarantee on credits — and none of them are structural. The hard part (a deterministic, physically-plausible, strategically-meaningful world) is done.

---

## 16. Roadmap

**Near term**
- Structure upgrade endpoint + UI (activates `levelScale`).
- `SELECT … FOR UPDATE` on credit mutations.
- Session-based identity replacing URL `pilotId`.
- Shared `BIOME_COLORS` export.

**Medium term**
- Live AI inference behind the existing routing profiles (server-side, key-held, streaming into the event log).
- Multi-parcel territories and adjacency bonuses.
- Async PvP: raid another pilot's *actual* parcel rather than a generated faction.
- Level/XP progression for pilots; structure specialisation trees.

**Long term**
- Web Workers for survey computation (4,096 cells is fine now; 16,384 would not be).
- Instanced rendering for large structure counts.
- Partitioned `events`, `LISTEN/NOTIFY`-backed stream hub.
- Shareable parcel permalinks and a world map of claimed territories.

---

## 17. Deliverables in this repository

| File | What it is |
| --- | --- |
| `AGENTS.md` | **Agent orientation** — invariants, file map with line counts and exports, recipes, known traps. ~3.3k tokens; designed to replace exploration of the source tree |
| `llms.txt` | Machine-readable index in the [llms.txt](https://llmstxt.org) convention |
| `README.md` | This document — full architecture and code analysis (~14k tokens; prefer `AGENTS.md` for task work) |
| `docs/Simplayz-Project-Deck.pptx` | 19-slide analysis deck (16:9, speaker notes on every slide) |
| `docs/assets/*.png` | Figures used by the README and the deck |
| `docs/figures/extract.ts` | Runs `src/engine/*` and emits the raw data behind every figure |
| `docs/figures/render.py` | Renders that data to PNG (numpy + matplotlib) |
| `docs/figures/build_deck.py` | Rebuilds the deck from those PNGs (python-pptx) |
| `docs/figures/README.md` | Pipeline, slide map and palette documentation |

Because `extract.ts` imports the engine directly, the deck's numbers are **reproducible** rather than illustrative:

```bash
npx tsx docs/figures/extract.ts        # engine → docs/figures/data/*.json (~12 s)
python3 docs/figures/render.py         # data → docs/assets/*.png
python3 docs/figures/build_deck.py     # assets → docs/Simplayz-Project-Deck.pptx
```

---

## 18. Credits and licensing

- **Application code:** this repository (`simplayz/simplay-ukkyz-v2`). No license file is currently present — add one before distributing.
- **Map rasters:** © OpenStreetMap contributors, tiles served via the Simplayz cache. Attribution is rendered in the UI and must be retained ([OSM copyright](https://www.openstreetmap.org/copyright)).
- **Frameworks:** Next.js, React, Drizzle ORM, three.js, Zustand, Tailwind CSS, lucide-react — each under its own license.
- **Figures in `docs/assets/`** were generated from this repository's own engine output (terrain surveys, assault resolution, structure catalogue) and are therefore reproducible: re-run `docs/figures/extract.ts` and you get byte-identical data.

<div align="center">

**Simplayz** — survey a real coordinate, and make it worth defending.

</div>
