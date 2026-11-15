# Figures and deck

Every figure in this folder is generated from **this repository's own engine** — the same functions the server runs at claim time. Nothing here is a mockup, a stock image or a hand-drawn chart. Re-running the pipeline reproduces the numbers exactly.

```
docs/
├── Simplayz-Project-Deck.pptx   19 slides + speaker notes
├── assets/*.png                 figures embedded in the deck (and referenced from README.md)
└── figures/
    ├── extract.ts               engine → data/*.json
    ├── render.py                data/*.json → assets/*.png   (numpy + matplotlib)
    ├── build_deck.py            assets/*.png → Simplayz-Project-Deck.pptx (python-pptx)
    └── data/*.json              committed engine output, so render.py works standalone
```

## Regenerate everything

```bash
npx tsx docs/figures/extract.ts        # ~12 s: surveys a 17 x 13 candidate grid, samples relief, resolves assaults
python3 docs/figures/render.py         # needs numpy + matplotlib
python3 docs/figures/build_deck.py     # needs python-pptx
```

`extract.ts` imports `src/engine/*` directly — no database, no dev server, no environment variables. `data/*.json` is committed so the Python steps work even without a Node toolchain.

## What each figure actually is

| File | Source | Notes |
| --- | --- | --- |
| `assets/hero-title.png` | `heightAtM()` × 61,380 samples | 30 km window at 56°N/126°E, seed 4242; hillshaded with `LightSource`, coastline contour at 0 m |
| `assets/relief-hero.png` | `heightAtM()` × 31,040 samples | Same field, 24 km window, 13.2 × 4.0 in |
| `assets/parcel-square.png` | `surveyParcel()` | The 64 × 64 biome raster of the best-mixed candidate parcel (score 1.37) |
| `assets/parcel-biome-map.png` | `surveyParcel()` | Same raster with the survey caption baked in |
| `assets/parcel-scores.png` | `surveyParcel().scores` + cell biomes | Eight aggregate scores and realised biome coverage |
| `assets/catalogue-economics.png` | `STRUCTURE_CATALOGUE` parsed from `src/engine/catalogue.ts` | Cost vs gross margin, bubble area ∝ defence |
| `assets/assault-phases.png` | `resolveAssault()` × 2 | Seed 90,210 at defence 120/210 — both engagements held |

## Deck structure

| # | Slide | Claims |
| --- | --- | --- |
| 01 | Title | 48 files · 3,852 lines · 9 tables · 12 routes |
| 02 | Executive summary | The four claims that make it credible |
| 03 | Product surface | Six systems, one `WorldSnapshot` |
| 04 | Player journey | World → Area → Site → AI officers |
| 05 | The world frame | Web Mercator constants and tile maths |
| 06 | Procedural terrain | Six-stage field, 14 biomes |
| 07 | Parcel survey | 4,096 cells + 8 scores, frozen at claim |
| 08 | Geography → strategy | Measured engine output |
| 09 | Structure catalogue | 18 instruments, cost vs margin |
| 10 | Economy & time | Lazy ticks, deficit penalties |
| 11 | Building interiors | 9 rooms, coverage model |
| 12 | Conflict | Four phases, deterministic |
| 13 | AI officers | Routing profiles, honest scope |
| 14 | System architecture | Four layers, one dependency direction |
| 15 | Data model | 9 tables, cascading ownership |
| 16 | API surface | 12 routes, validation before write |
| 17 | Rendering & resilience | 3 modes, 4 tile fallbacks |
| 18 | Assessment | Strengths, risks, verdict |
| 19 | Roadmap | Near / medium / long term, run commands |

Speaker notes are attached to every slide.

## Palette

Taken from `src/app/globals.css` (Cartographer theme) so the deck matches the product:

| Token | Hex | Used for |
| --- | --- | --- |
| background | `#101d24` | slide ground |
| deep | `#0b1418` | hero image ground |
| panel | `#14262c` | cards, code blocks |
| ink | `#e8eee7` | headings, body |
| muted | `#8d9d93` | secondary text |
| accent | `#e6c879` | kickers, rules, highlights |
| line | `#2b4540` | borders, grid |
| good | `#7ccaa4` | defender, strengths |
| danger | `#ef806d` | attacker, risks |

## Caveats

- The relief images are rendered from `heightAtM()` at a coarser grid than the app's 26 × 26-segment meshes; they are honest samples of the field, not screenshots of the WebGL scene.
- `hero-title.png` is 1.5 MB and `relief-hero.png` is 684 KB; both are referenced by `README.md`, so they are committed rather than generated on demand.
- `build_deck.py` hard-codes text and geometry. If the engine changes materially (e.g. the structure catalogue grows), re-run the pipeline and re-check the text on slides 08, 09 and 12.
