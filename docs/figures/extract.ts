#!/usr/bin/env node
/**
 * Regenerates the data behind docs/assets/*.png from this repository's own engine.
 *
 *   npx tsx docs/figures/extract.ts
 *
 * Writes three JSON files to docs/figures/data/:
 *   terrain.json  – a full 64x64 survey (cells + scores) plus a 330x186 relief grid
 *   assault.json  – two resolved assault reports from the same seed
 *   bounds.json   – relief statistics for the sampled window
 *
 * The plotting step is Python (matplotlib); see docs/figures/README.md.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { lonLatToWorld } from "../../src/engine/geodesy";
import { BIOMES, heightAtM, surveyParcel } from "../../src/engine/terrain";
import { resolveAssault } from "../../src/engine/simulation";

const OUT = join(process.cwd(), "docs/figures/data");
mkdirSync(OUT, { recursive: true });

const SEED = 4242;
const LAT = 56;
const LON = 126;

/* ---- 1. choose a parcel with a mixed portfolio ------------------------------ */
const candidates: { label: string; lat: number; lon: number; survey: ReturnType<typeof surveyParcel>; variety: number }[] = [];
for (let lat = -40; lat <= 60; lat += 8) {
  for (let lon = -160; lon <= 160; lon += 13) {
    const survey = surveyParcel(SEED, lonLatToWorld(lon, lat));
    const s = survey.scores;
    const variety =
      Math.min(s.water, 0.35) * 2 +
      Math.min(s.forest, 0.6) +
      Math.min(s.elevation, 0.7) +
      s.farm * 0.8 +
      s.build * 0.5 +
      s.hydro * 0.3;
    candidates.push({ label: `${lat},${lon}`, lat, lon, survey, variety });
  }
}
const best = candidates.sort((a, b) => b.variety - a.variety)[0];

/* ---- 2. relief grid for the hero / world-frame figures ---------------------- */
const center = lonLatToWorld(LON, LAT);
function grid(width: number, height: number, span: number) {
  const heights: number[] = [];
  for (let gy = 0; gy < height; gy += 1) {
    for (let gx = 0; gx < width; gx += 1) {
      const x = center.x - span / 2 + ((gx + 0.5) * span) / width;
      const y = center.y + (span * height) / width / 2 - ((gy + 0.5) * span) / width;
      heights.push(Number(heightAtM(x, y, SEED).toFixed(2)));
    }
  }
  return { width, height, span, heights };
}
const title = grid(330, 186, 30_000);
const frame = grid(320, 97, 24_000);

writeFileSync(
  join(OUT, "terrain.json"),
  JSON.stringify({
    seed: SEED,
    parcel: { label: best.label, lat: best.lat, lon: best.lon, variety: Number(best.variety.toFixed(3)) },
    view: { lat: LAT, lon: LON },
    biomes: BIOMES,
    size: best.survey.size,
    scores: best.survey.scores,
    cells: best.survey.cells,
    relief: { title, frame },
  }),
);

const landFraction = frame.heights.filter((h) => h >= 0).length / frame.heights.length;
writeFileSync(
  join(OUT, "bounds.json"),
  JSON.stringify({
    span: frame.span,
    samples: frame.heights.length,
    min: Math.min(...frame.heights),
    max: Math.max(...frame.heights),
    landFraction: Number(landFraction.toFixed(4)),
    margin: Math.min(...title.heights),
    marginMax: Math.max(...title.heights),
  }),
);

/* ---- 3. deterministic assaults from one seed -------------------------------- */
const reports = [
  resolveAssault({ seed: 90_210, defence: 120, power: 40, prestige: 30, structureCount: 6 }),
  resolveAssault({ seed: 90_210, defence: 210, power: 95, prestige: 60, structureCount: 12 }),
];
writeFileSync(join(OUT, "assault.json"), JSON.stringify(reports));

console.log(`parcel ${best.label}  scores ${JSON.stringify(best.survey.scores)}`);
console.log(`relief ${Math.min(...frame.heights).toFixed(0)} m .. ${Math.max(...frame.heights).toFixed(0)} m, land ${(landFraction * 100).toFixed(0)}%`);
for (const report of reports) {
  console.log(`${report.enemy}: strength ${report.enemyStrength} → ${report.victory ? "held" : "overrun"}`);
}
console.log(`wrote 3 files to ${OUT}`);
