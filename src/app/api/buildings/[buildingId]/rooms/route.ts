import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { buildings, parcels, pilots, rooms } from "@/db/schema";
import { BUILDING_GRID_SIZE, getRoomDefinition, isRoomKind, roomsOverlap } from "@/engine/rooms";
import { apiError, asRecord, finiteNumber } from "@/lib/api";
import { getWorldSnapshot, publishEvent } from "@/server/world";

export async function POST(request: NextRequest, context: { params: Promise<{ buildingId: string }> }): Promise<NextResponse> {
  try {
    const { buildingId } = await context.params;
    const body = asRecord(await request.json());
    if (!isRoomKind(body.kind) || ["reception", "guard"].includes(body.kind)) throw new Error("Choose an optional room type; required rooms are already installed");
    const pilotId = requiredPilot(request);
    const owned = await db.select({ building: buildings }).from(buildings).innerJoin(parcels, eq(parcels.id, buildings.parcelId)).where(and(eq(buildings.id, buildingId), eq(parcels.pilotId, pilotId))).limit(1);
    if (!owned[0]) throw new Error("Building not found for this pilot");
    const x = Math.floor(finiteNumber(body.x, "Room X"));
    const y = Math.floor(finiteNumber(body.y, "Room Y"));
    const definition = getRoomDefinition(body.kind);
    if (x < 0 || y < 0 || x + definition.width > BUILDING_GRID_SIZE || y + definition.depth > BUILDING_GRID_SIZE) throw new Error("Room does not fit inside the 12×12 site");
    const existing = await db.select().from(rooms).where(eq(rooms.buildingId, buildingId));
    const candidate = { kind: body.kind, staff: definition.staff, x, y, width: definition.width, depth: definition.depth };
    if (existing.some((room) => roomsOverlap(candidate, room))) throw new Error("Room overlaps an existing interior zone");
    const snapshot = await getWorldSnapshot(pilotId);
    if (!snapshot || snapshot.pilot.credits < definition.cost) throw new Error(`Insufficient credits: ${definition.cost} required`);
    await db.insert(rooms).values({ id: crypto.randomUUID(), buildingId, ...candidate, name: definition.label });
    await db.update(pilots).set({ credits: snapshot.pilot.credits - definition.cost }).where(eq(pilots.id, pilotId));
    await publishEvent(pilotId, "room", `${definition.label} added to ${owned[0].building.name}.`, { buildingId, kind: body.kind, x, y });
    return NextResponse.json(await getWorldSnapshot(pilotId), { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

function requiredPilot(request: NextRequest): string {
  const pilotId = new URL(request.url).searchParams.get("pilotId");
  if (!pilotId) throw new Error("Pilot ID is required");
  return pilotId;
}
