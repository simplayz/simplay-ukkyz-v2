import {
  PARCEL_CELL_M,
  PARCEL_GRID_SIZE,
  PARCEL_SIDE_M,
  worldToLonLat,
  type WorldPoint,
} from "./geodesy";

export const BIOMES = [
  "deep_sea",
  "sea",
  "lake",
  "coast",
  "wetland",
  "urban",
  "desert",
  "alpine",
  "tundra",
  "boreal_forest",
  "rainforest",
  "temperate_forest",
  "savanna",
  "grassland",
] as const;

export type Biome = (typeof BIOMES)[number];

export type TerrainSample = {
  height: number;
  slope: number;
  drainage: number;
  soil: number;
  canopy: number;
  urban: number;
  water: boolean;
  sea: boolean;
  biome: Biome;
};

export type TerrainScores = {
  elevation: number;
  slope: number;
  water: number;
  forest: number;
  farm: number;
  build: number;
  defence: number;
  hydro: number;
};

export type SurveyCell = {
  h: number;
  s: number;
  b: number;
  w: 0 | 1;
  d: number;
  c: number;
  u: number;
};

export type ParcelSurvey = {
  seed: number;
  center: WorldPoint;
  size: number;
  scores: TerrainScores;
  cells: SurveyCell[];
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const smoothstep = (a: number, b: number, value: number): number => {
  const t = clamp01((value - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
const round = (value: number, places = 4): number => Number(value.toFixed(places));

export function hash2(ix: number, iy: number, seed: number): number {
  let h = Math.imul(ix | 0, 0x1f123bb5) ^ Math.imul(iy | 0, 0x5f356495) ^ Math.imul(seed | 0, 0x6c8e9cf5);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h ^= h >>> 16;
  return (h >>> 0) / 4_294_967_295;
}

export function valueNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  return mix(mix(a, b, ux), mix(c, d, ux), uy);
}

export function fbm(x: number, y: number, seed: number, octaves = 5): number {
  let value = 0;
  let amplitude = 0.5;
  let total = 0;
  let frequency = 1;
  for (let octave = 0; octave < octaves; octave += 1) {
    value += valueNoise(x * frequency, y * frequency, seed + octave * 1013) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2.03;
  }
  return value / total;
}

function ridgedFbm(x: number, y: number, seed: number, octaves = 4): number {
  let sum = 0;
  let weight = 0;
  let amplitude = 0.55;
  let frequency = 1;
  for (let octave = 0; octave < octaves; octave += 1) {
    const ridge = 1 - Math.abs(valueNoise(x * frequency, y * frequency, seed + octave * 733) * 2 - 1);
    sum += ridge * ridge * amplitude;
    weight += amplitude;
    amplitude *= 0.52;
    frequency *= 2.08;
  }
  return sum / weight;
}

type RawField = Omit<TerrainSample, "slope" | "biome"> & { temperature: number; continent: number };

function rawField(x: number, y: number, seed: number): RawField {
  const warpX = (fbm(x / 7200 + 17.1, y / 7200 - 9.7, seed + 11, 3) - 0.5) * 1850;
  const warpY = (fbm(x / 7200 - 31.4, y / 7200 + 22.8, seed + 29, 3) - 0.5) * 1850;
  const qx = x + warpX;
  const qy = y + warpY;
  const rx = qx * 0.9848 - qy * 0.1736;
  const ry = qx * 0.1736 + qy * 0.9848;

  const continent = fbm(rx / 19_000, ry / 25_000, seed + 101, 5);
  const asymmetric = fbm(rx / 6200, ry / 9100, seed + 211, 5);
  const detail = fbm(qx / 1350, qy / 1750, seed + 307, 4);
  const mountainMask = smoothstep(0.49, 0.71, fbm(rx / 11_000 + 8, ry / 15_000, seed + 401, 4));
  const ridges = ridgedFbm(rx / 2700, ry / 3900, seed + 503, 5);
  const orogeny = mountainMask * (ridges ** 2.25) * 2350;

  let height = (continent - 0.49) * 1650 + (asymmetric - 0.5) * 510 + (detail - 0.5) * 105 + orogeny;
  height += Math.sin((qx + qy * 0.37) / 8100) * 48 * mountainMask;

  const riverLine = Math.abs(valueNoise(rx / 7600 + 12.7, ry / 9800 - 4.2, seed + 601) - 0.5);
  const riverStrength = Math.exp(-riverLine * 72) * smoothstep(-40, 260, height);
  const tributary = Math.abs(valueNoise(qx / 2600, qy / 3400, seed + 607) - 0.5);
  const tributaryStrength = Math.exp(-tributary * 105) * 0.32 * smoothstep(30, 420, height);
  height -= (riverStrength + tributaryStrength) * (135 + mountainMask * 285);

  const lakeBowl = smoothstep(0.67, 0.82, fbm(qx / 2300 + 4, qy / 2300 - 7, seed + 701, 4));
  height -= lakeBowl * (95 + 80 * (1 - mountainMask));

  const latitude = Math.abs(worldToLonLat(0, y).lat) / 90;
  const temperature = clamp01(1 - latitude * 1.16 - Math.max(0, height) / 2600 + (fbm(qx / 12_000, qy / 12_000, seed + 809, 3) - 0.5) * 0.18);
  const drainage = clamp01(0.14 + riverStrength * 0.9 + tributaryStrength * 0.5 + lakeBowl * 0.52 + (fbm(qx / 3600, qy / 3600, seed + 811, 4) - 0.5) * 0.36);
  const soil = clamp01(fbm(qx / 4200 + 2, qy / 4200, seed + 907, 4) * 0.68 + drainage * 0.25 + (1 - mountainMask) * 0.12 - Math.max(0, height - 650) / 1700);
  const moisture = clamp01(drainage * 0.55 + fbm(qx / 5200, qy / 5200, seed + 1009, 4) * 0.55);
  const canopy = clamp01((moisture * 0.78 + soil * 0.36 - 0.35) * (1 - smoothstep(720, 1280, height)) * (0.55 + temperature * 0.65));
  const urban = clamp01((fbm(rx / 10_500, ry / 10_500, seed + 1103, 4) - 0.57) * 4.2) * (1 - smoothstep(160, 430, height)) * smoothstep(0.18, 0.65, soil);
  const sea = continent < 0.465 && height < 0;

  return { height, drainage, soil, canopy, urban, water: height < 0, sea, temperature, continent };
}

export function heightAtM(x: number, y: number, seed: number): number {
  return rawField(x, y, seed).height;
}

export function classifyBiome(field: RawField, slope: number): Biome {
  if (field.sea && field.height < -180) return "deep_sea";
  if (field.sea && field.height < 0) return "sea";
  if (field.height < 0) return "lake";
  if (field.height > 1080 || slope > 1.15) return "alpine";
  if (field.temperature < 0.16 && field.height > 90) return "tundra";
  if (field.height < 15) return "coast";
  if (field.drainage > 0.79 && field.height < 95 && slope < 0.24) return "wetland";
  if (field.urban > 0.7 && field.height < 230 && slope < 0.3) return "urban";
  if (field.soil < 0.28 && field.canopy < 0.22 && field.temperature > 0.47) return "desert";
  if (field.canopy > 0.69 && field.temperature > 0.63 && field.drainage > 0.43) return "rainforest";
  if (field.temperature < 0.38 && field.canopy > 0.33) return "boreal_forest";
  if (field.canopy > 0.49) return "temperate_forest";
  if (field.temperature > 0.65 && field.canopy < 0.4) return "savanna";
  return "grassland";
}

export function sampleTerrain(x: number, y: number, seed: number): TerrainSample {
  const field = rawField(x, y, seed);
  const step = 32;
  const dx = (heightAtM(x + step, y, seed) - heightAtM(x - step, y, seed)) / (step * 2);
  const dy = (heightAtM(x, y + step, seed) - heightAtM(x, y - step, seed)) / (step * 2);
  const slope = Math.hypot(dx, dy);
  return {
    height: field.height,
    slope,
    drainage: field.drainage,
    soil: field.soil,
    canopy: field.canopy,
    urban: field.urban,
    water: field.water,
    sea: field.sea,
    biome: classifyBiome(field, slope),
  };
}

export function surveyParcel(seed: number, center: WorldPoint, size = PARCEL_SIDE_M): ParcelSurvey {
  const cells: SurveyCell[] = [];
  const heights = new Float64Array(PARCEL_GRID_SIZE * PARCEL_GRID_SIZE);
  const step = size / PARCEL_GRID_SIZE;
  const raw: RawField[] = [];

  for (let gy = 0; gy < PARCEL_GRID_SIZE; gy += 1) {
    for (let gx = 0; gx < PARCEL_GRID_SIZE; gx += 1) {
      const x = center.x - size / 2 + (gx + 0.5) * step;
      const y = center.y + size / 2 - (gy + 0.5) * step;
      const field = rawField(x, y, seed);
      const index = gy * PARCEL_GRID_SIZE + gx;
      heights[index] = field.height;
      raw.push(field);
    }
  }

  const totals = { elevation: 0, slope: 0, water: 0, forest: 0, farm: 0, build: 0, defence: 0, hydro: 0 };
  for (let gy = 0; gy < PARCEL_GRID_SIZE; gy += 1) {
    for (let gx = 0; gx < PARCEL_GRID_SIZE; gx += 1) {
      const index = gy * PARCEL_GRID_SIZE + gx;
      const left = heights[gy * PARCEL_GRID_SIZE + Math.max(0, gx - 1)];
      const right = heights[gy * PARCEL_GRID_SIZE + Math.min(PARCEL_GRID_SIZE - 1, gx + 1)];
      const up = heights[Math.max(0, gy - 1) * PARCEL_GRID_SIZE + gx];
      const down = heights[Math.min(PARCEL_GRID_SIZE - 1, gy + 1) * PARCEL_GRID_SIZE + gx];
      const slope = Math.hypot((right - left) / (step * 2), (down - up) / (step * 2));
      const field = raw[index];
      const land = field.height >= 0 ? 1 : 0;
      const slopeScore = clamp01(slope / 0.65);
      const elevation = clamp01(Math.max(0, field.height) / 950);
      const farm = land * clamp01(field.soil * 0.78 + field.drainage * 0.3 - slopeScore * 0.65);
      const build = land * clamp01(0.88 - slopeScore * 0.85 + field.urban * 0.18 - Math.max(0, field.height - 350) / 1400);
      const defence = land * clamp01(elevation * 0.48 + slopeScore * 0.4 + field.canopy * 0.16 + (1 - field.urban) * 0.08);
      const hydro = clamp01(field.drainage * 0.72 + (field.water ? 0.55 : 0) + field.soil * 0.08);
      totals.elevation += elevation;
      totals.slope += slopeScore;
      totals.water += field.water ? 1 : 0;
      totals.forest += field.canopy * land;
      totals.farm += farm;
      totals.build += build;
      totals.defence += defence;
      totals.hydro += hydro;
      cells.push({
        h: round(field.height, 2),
        s: round(slope),
        b: BIOMES.indexOf(classifyBiome(field, slope)),
        w: field.water ? 1 : 0,
        d: round(field.drainage),
        c: round(field.canopy),
        u: round(field.urban),
      });
    }
  }

  const count = PARCEL_GRID_SIZE * PARCEL_GRID_SIZE;
  const scores = Object.fromEntries(
    Object.entries(totals).map(([key, value]) => [key, round(value / count)]),
  ) as unknown as TerrainScores;
  return { seed, center, size, scores, cells };
}

export function surveyCellToWorld(survey: ParcelSurvey, gx: number, gy: number): WorldPoint {
  return {
    x: survey.center.x - survey.size / 2 + (gx + 0.5) * PARCEL_CELL_M,
    y: survey.center.y + survey.size / 2 - (gy + 0.5) * PARCEL_CELL_M,
  };
}
