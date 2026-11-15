import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { buildings, parcels, pilots, rooms } from "@/db/schema";
import { apiError, asRecord, finiteNumber, requiredString } from "@/lib/api";
import { getWorldSnapshot, publishEvent } from "@/server/world";

async function ownedRoom(roomId: string, pilotId: string) {
  const rows = await db.select({ room: rooms, building: buildings }).from(rooms).innerJoin(buildings, eq(buildings.id, rooms.buildingId)).innerJoin(parcels, eq(parcels.id, buildings.parcelId)).where(and(eq(rooms.id, roomId), eq(parcels.pilotId, pilotId))).limit(1);
  if (!rows[0]) throw new Error("Room not found for this pilot");
  return rows[0];
}

function pilotFrom(request: NextRequest): string {
  const id = new URL(request.url).searchParams.get("pilotId");
  if (!id) throw new Error("Pilot ID is required");
  return id;
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ roomId: string }> }): Promise<NextResponse> {
  try {
    const { roomId } = await context.params;
    const pilotId = pilotFrom(request);
    const owned = await ownedRoom(roomId, pilotId);
    const body = asRecord(await request.json());
    const staff = Math.max(0, Math.min(20, Math.round(finiteNumber(body.staff, "Staff"))));
    if (["guard", "reception"].includes(owned.room.kind) && staff < 1) throw new Error(`${owned.room.name} requires at least one staff member`);
    const name = requiredString(body.name ?? owned.room.name, "Room name", 40);
    await db.update(rooms).set({ staff, name }).where(eq(rooms.id, roomId));
    await publishEvent(pilotId, "staff", `${name} staffing set to ${staff}.`, { roomId, staff });
    return NextResponse.json(await getWorldSnapshot(pilotId));
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ roomId: string }> }): Promise<NextResponse> {
  try {
    const { roomId } = await context.params;
    const pilotId = pilotFrom(request);
    const owned = await ownedRoom(roomId, pilotId);
    if (["guard", "reception"].includes(owned.room.kind)) {
      const siblings = await db.select().from(rooms).where(and(eq(rooms.buildingId, owned.room.buildingId), eq(rooms.kind, owned.room.kind)));
      if (siblings.length <= 1) throw new Error(`Every building must retain at least one ${owned.room.kind === "guard" ? "guard post" : "receptionist"}`);
    }
    const definitionCost = 120;
    const snapshot = await getWorldSnapshot(pilotId);
    if (!snapshot) throw new Error("Pilot not found");
    await db.delete(rooms).where(eq(rooms.id, roomId));
    await db.update(pilots).set({ credits: snapshot.pilot.credits + definitionCost }).where(eq(pilots.id, pilotId));
    await publishEvent(pilotId, "room", `${owned.room.name} removed; 120 credits recovered.`, { roomId });
    return NextResponse.json(await getWorldSnapshot(pilotId));
  } catch (error) {
    return apiError(error);
  }
}
