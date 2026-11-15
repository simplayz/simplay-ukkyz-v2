export const EARTH_RADIUS_M = 6_378_137;
export const WEB_MERCATOR_LIMIT_M = Math.PI * EARTH_RADIUS_M;
export const WORLD_WIDTH_M = Math.PI * 2 * EARTH_RADIUS_M;
export const PARCEL_AREA_M2 = 40_960_000;
export const PARCEL_SIDE_M = Math.sqrt(PARCEL_AREA_M2);
export const PARCEL_GRID_SIZE = 64;
export const PARCEL_CELL_M = PARCEL_SIDE_M / PARCEL_GRID_SIZE;

export type LonLat = { lon: number; lat: number };
export type WorldPoint = { x: number; y: number };
export type TileCoord = { z: number; x: number; y: number };

export function seedForLocation(pilotSeed: number, lat: number, lon: number): number {
  let h = pilotSeed | 0;
  h ^= Math.imul(Math.round(lat * 10_000), 0x45d9f3b);
  h ^= Math.imul(Math.round(lon * 10_000), 0x27d4eb2d);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return Math.abs(h ^ (h >>> 16)) || 1;
}

export function clampLatitude(lat: number): number {
  return Math.max(-85.05112878, Math.min(85.05112878, lat));
}

export function normalizeLongitude(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

export function lonLatToWorld(lon: number, lat: number): WorldPoint {
  const lambda = (normalizeLongitude(lon) * Math.PI) / 180;
  const phi = (clampLatitude(lat) * Math.PI) / 180;
  return {
    x: EARTH_RADIUS_M * lambda,
    y: EARTH_RADIUS_M * Math.log(Math.tan(Math.PI / 4 + phi / 2)),
  };
}

export function worldToLonLat(x: number, y: number): LonLat {
  return {
    lon: normalizeLongitude((x / EARTH_RADIUS_M) * (180 / Math.PI)),
    lat: (2 * Math.atan(Math.exp(y / EARTH_RADIUS_M)) - Math.PI / 2) * (180 / Math.PI),
  };
}

export function tileSizeM(zoom: number): number {
  return WORLD_WIDTH_M / 2 ** zoom;
}

export function worldToTile(x: number, y: number, zoom: number): TileCoord {
  const size = tileSizeM(zoom);
  const count = 2 ** zoom;
  return {
    z: zoom,
    x: ((Math.floor((x + WEB_MERCATOR_LIMIT_M) / size) % count) + count) % count,
    y: Math.max(0, Math.min(count - 1, Math.floor((WEB_MERCATOR_LIMIT_M - y) / size))),
  };
}

export function tileBounds(tile: TileCoord): { minX: number; maxX: number; minY: number; maxY: number } {
  const size = tileSizeM(tile.z);
  const wrappedX = ((tile.x % 2 ** tile.z) + 2 ** tile.z) % 2 ** tile.z;
  const minX = wrappedX * size - WEB_MERCATOR_LIMIT_M;
  const maxY = WEB_MERCATOR_LIMIT_M - tile.y * size;
  return { minX, maxX: minX + size, minY: maxY - size, maxY };
}

export function tileCenter(tile: TileCoord): WorldPoint {
  const bounds = tileBounds(tile);
  return { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
}

export function parcelCellToWorld(
  center: WorldPoint,
  gridX: number,
  gridY: number,
): WorldPoint {
  return {
    x: center.x - PARCEL_SIDE_M / 2 + (gridX + 0.5) * PARCEL_CELL_M,
    y: center.y + PARCEL_SIDE_M / 2 - (gridY + 0.5) * PARCEL_CELL_M,
  };
}

export function worldToParcelCell(point: WorldPoint, center: WorldPoint): { x: number; y: number } | null {
  const x = Math.floor((point.x - center.x + PARCEL_SIDE_M / 2) / PARCEL_CELL_M);
  const y = Math.floor((center.y + PARCEL_SIDE_M / 2 - point.y) / PARCEL_CELL_M);
  if (x < 0 || y < 0 || x >= PARCEL_GRID_SIZE || y >= PARCEL_GRID_SIZE) return null;
  return { x, y };
}
