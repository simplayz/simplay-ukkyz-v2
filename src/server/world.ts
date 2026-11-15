import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { assaults, bots, buildings, events, parcels, pilots, rooms, structures } from "@/db/schema";
import { BOT_DEFAULTS, BOT_ROLES } from "@/engine/ai";
import { computeTotals, LOCK_MS } from "@/engine/simulation";
import { applyTicks } from "@/engine/simulation";
import { lonLatToWorld, PARCEL_AREA_M2, seedForLocation } from "@/engine/geodesy";
import { surveyParcel } from "@/engine/terrain";
import type { BuildingDTO, EventDTO, WorldSnapshot } from "@/lib/types";

export function seedFromText(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash ^ (hash >>> 16)) || 1;
}

const iso = (date: Date): string => date.toISOString();

export async function publishEvent(pilotId: string, kind: string, message: string, payload?: Record<string, unknown>): Promise<void> {
  await db.insert(events).values({ pilotId, kind, message, payload });
}

export async function getWorldSnapshot(pilotId: string): Promise<WorldSnapshot | null> {
  const pilot = await db.query.pilots.findFirst({ where: { id: pilotId } });
  if (!pilot) return null;
  const parcel = await db.query.parcels.findFirst({ where: { pilotId } });
  const placed = parcel ? await db.select().from(structures).where(eq(structures.parcelId, parcel.id)) : [];
  const zeroScores = { elevation: 0, slope: 0, water: 0, forest: 0, farm: 0, build: 0, defence: 0, hydro: 0 };
  const totals = computeTotals(placed, parcel?.scores ?? zeroScores);
  let credits = pilot.credits;
  let ticksApplied = 0;
  let lastTickAt = parcel?.lastTickAt;

  if (parcel) {
    const tick = applyTicks({ credits, lastTickAt: parcel.lastTickAt, totals });
    ticksApplied = tick.ticks;
    credits = tick.credits;
    lastTickAt = tick.lastTickAt;
    if (tick.ticks > 0) {
      await db.update(pilots).set({ credits }).where(eq(pilots.id, pilot.id));
      await db.update(parcels).set({ lastTickAt: tick.lastTickAt }).where(eq(parcels.id, parcel.id));
    }
  }

  const buildingRows = parcel ? await db.select().from(buildings).where(eq(buildings.parcelId, parcel.id)).orderBy(buildings.createdAt) : [];
  const roomRows = buildingRows.length
    ? await db.select().from(rooms).where(inArray(rooms.buildingId, buildingRows.map((building) => building.id)))
    : [];
  const buildingDtos: BuildingDTO[] = buildingRows.map((building) => ({
    id: building.id,
    parcelId: building.parcelId,
    structureId: building.structureId,
    name: building.name,
    archetype: building.archetype,
    gx: building.gx,
    gy: building.gy,
    width: building.width,
    depth: building.depth,
    level: building.level,
    rooms: roomRows.filter((room) => room.buildingId === building.id).map((room) => ({
      id: room.id,
      buildingId: room.buildingId,
      kind: room.kind,
      name: room.name,
      x: room.x,
      y: room.y,
      width: room.width,
      depth: room.depth,
      staff: room.staff,
    })),
  }));
  const botRows = await db.select().from(bots).where(eq(bots.pilotId, pilotId));
  const eventRows = await db.select().from(events).where(eq(events.pilotId, pilotId)).orderBy(desc(events.id)).limit(16);
  const assaultRows = parcel ? await db.select().from(assaults).where(eq(assaults.parcelId, parcel.id)).orderBy(desc(assaults.createdAt)).limit(6) : [];
  const eventDtos: EventDTO[] = eventRows.reverse().map((event) => ({
    id: event.id,
    kind: event.kind,
    message: event.message,
    payload: event.payload,
    createdAt: iso(event.createdAt),
  }));

  return {
    pilot: { id: pilot.id, callSign: pilot.callSign, seed: pilot.seed, homeLat: pilot.homeLat, homeLon: pilot.homeLon, credits, createdAt: iso(pilot.createdAt) },
    parcel: parcel ? {
      id: parcel.id,
      pilotId: parcel.pilotId,
      name: parcel.name,
      seed: parcel.seed,
      centerX: parcel.centerX,
      centerY: parcel.centerY,
      lat: parcel.lat,
      lon: parcel.lon,
      areaM2: parcel.areaM2,
      scores: parcel.scores,
      cells: parcel.cells,
      lockedUntil: iso(parcel.lockedUntil),
      lastTickAt: iso(lastTickAt ?? parcel.lastTickAt),
      createdAt: iso(parcel.createdAt),
    } : null,
    structures: placed.map((structure) => ({ id: structure.id, parcelId: structure.parcelId, type: structure.type, gx: structure.gx, gy: structure.gy, rotation: structure.rotation, level: structure.level })),
    buildings: buildingDtos,
    bots: botRows.map((bot) => ({ id: bot.id, pilotId: bot.pilotId, role: bot.role, name: bot.name, provider: bot.provider, model: bot.model, directive: bot.directive, autonomy: bot.autonomy, active: bot.active, updatedAt: iso(bot.updatedAt) })),
    totals,
    events: eventDtos,
    assaults: assaultRows.map((assault) => ({ id: assault.id, report: assault.report, createdAt: iso(assault.createdAt) })),
    serverTime: new Date().toISOString(),
    ticksApplied,
  };
}

export async function registerPilot(callSign: string, lat: number, lon: number, requestedSeed?: number): Promise<WorldSnapshot> {
  const id = crypto.randomUUID();
  const seed = requestedSeed ?? seedFromText(`${callSign}:${lat.toFixed(4)}:${lon.toFixed(4)}`);
  await db.insert(pilots).values({ id, callSign, seed, homeLat: lat, homeLon: lon });
  await db.insert(bots).values(BOT_ROLES.map((role) => ({
    id: crypto.randomUUID(),
    pilotId: id,
    role,
    name: BOT_DEFAULTS[role].name,
    provider: BOT_DEFAULTS[role].provider,
    model: BOT_DEFAULTS[role].model,
    directive: BOT_DEFAULTS[role].directive,
  })));
  await publishEvent(id, "pilot", `${callSign} registered. Ada, Rook and Mara are standing by.`);
  const snapshot = await getWorldSnapshot(id);
  if (!snapshot) throw new Error("Pilot registration could not be reloaded");
  return snapshot;
}

export async function claimParcel(pilotId: string, lat: number, lon: number): Promise<WorldSnapshot> {
  const pilot = await db.query.pilots.findFirst({ where: { id: pilotId } });
  if (!pilot) throw new Error("Pilot not found");
  const existing = await db.query.parcels.findFirst({ where: { pilotId } });
  if (existing) throw new Error("This pilot already holds a parcel");
  const center = lonLatToWorld(lon, lat);
  const seed = seedForLocation(pilot.seed, lat, lon);
  const survey = surveyParcel(seed, center);
  const id = crypto.randomUUID();
  const now = new Date();
  await db.insert(parcels).values({
    id,
    pilotId,
    name: `Area ${pilot.callSign.toUpperCase()}-01`,
    seed,
    centerX: center.x,
    centerY: center.y,
    lat,
    lon,
    areaM2: PARCEL_AREA_M2,
    scores: survey.scores,
    cells: survey.cells,
    lockedUntil: new Date(now.getTime() + LOCK_MS),
    lastTickAt: now,
  });
  await publishEvent(pilotId, "survey", `64×64 survey frozen. Parcel protection is active for 72 hours.`, { parcelId: id, scores: survey.scores });
  const snapshot = await getWorldSnapshot(pilotId);
  if (!snapshot) throw new Error("Claim could not be reloaded");
  return snapshot;
}

export async function assertPilotOwnsParcel(pilotId: string, parcelId: string): Promise<void> {
  const owned = await db.query.parcels.findFirst({ where: { id: parcelId, pilotId } });
  if (!owned) throw new Error("Area not found for this pilot");
}
