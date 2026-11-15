import assert from "node:assert/strict";
import { lonLatToWorld, worldToLonLat } from "./geodesy";
import { BIOMES, heightAtM, sampleTerrain, surveyParcel } from "./terrain";

const locations = [
  { lon: -122.4194, lat: 37.7749 },
  { lon: 2.3522, lat: 48.8566 },
  { lon: 139.6917, lat: 35.6895 },
];

for (const location of locations) {
  const world = lonLatToWorld(location.lon, location.lat);
  const roundTrip = worldToLonLat(world.x, world.y);
  assert.ok(Math.abs(roundTrip.lon - location.lon) < 1e-9, "longitude round trip");
  assert.ok(Math.abs(roundTrip.lat - location.lat) < 1e-9, "latitude round trip");
}

let globalMin = Infinity;
let globalMax = -Infinity;
const foundBiomes = new Set<string>();
for (const seed of [1, 42, 8675309]) {
  const center = lonLatToWorld(-122.4194 + seed * 0.00001, 37.7749);
  for (let y = -12_000; y <= 12_000; y += 400) {
    for (let x = -12_000; x <= 12_000; x += 400) {
      const a = heightAtM(center.x + x, center.y + y, seed);
      const b = heightAtM(center.x + x, center.y + y, seed);
      assert.equal(a, b, `height determinism for seed ${seed}`);
      assert.ok(Number.isFinite(a), "height must be finite");
      globalMin = Math.min(globalMin, a);
      globalMax = Math.max(globalMax, a);
      foundBiomes.add(sampleTerrain(center.x + x, center.y + y, seed).biome);
    }
  }
  const surveyA = surveyParcel(seed, center);
  const surveyB = surveyParcel(seed, center);
  assert.deepEqual(surveyA, surveyB, `survey determinism for seed ${seed}`);
  assert.equal(surveyA.cells.length, 4096);
  for (const score of Object.values(surveyA.scores)) {
    assert.ok(score >= 0 && score <= 1, "survey scores normalized");
  }
  console.log(`seed ${seed}: ${JSON.stringify(surveyA.scores)}`);
}

assert.ok(globalMax - globalMin > 700, `relief range too small: ${globalMax - globalMin}`);
assert.ok(globalMin < 0 && globalMax > 250, "expected both water and substantial relief");
assert.equal(BIOMES.length, 14);
console.log(`relief ${globalMin.toFixed(1)}m .. ${globalMax.toFixed(1)}m; observed ${foundBiomes.size}/14 biomes`);
console.log("terrain verification passed");
