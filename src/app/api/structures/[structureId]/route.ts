import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { parcels, pilots, structures } from "@/db/schema";
import { getStructureDefinition } from "@/engine/catalogue";
import { apiError } from "@/lib/api";
import { getWorldSnapshot, publishEvent } from "@/server/world";

export async function DELETE(request: NextRequest, context: { params: Promise<{ structureId: string }> }): Promise<NextResponse> {
  try {
    const { structureId } = await context.params;
    const pilotId = new URL(request.url).searchParams.get("pilotId");
    if (!pilotId) throw new Error("Pilot ID is required");
    const rows = await db.select({ structure: structures, parcel: parcels }).from(structures).innerJoin(parcels, eq(parcels.id, structures.parcelId)).where(and(eq(structures.id, structureId), eq(parcels.pilotId, pilotId))).limit(1);
    const row = rows[0];
    if (!row) throw new Error("Structure not found for this pilot");
    const snapshot = await getWorldSnapshot(pilotId);
    if (!snapshot) throw new Error("Pilot not found");
    const definition = getStructureDefinition(row.structure.type);
    const refund = Math.floor(definition.cost * 0.4 * row.structure.level);
    await db.delete(structures).where(eq(structures.id, structureId));
    await db.update(pilots).set({ credits: snapshot.pilot.credits + refund }).where(eq(pilots.id, pilotId));
    await publishEvent(pilotId, "salvage", `${definition.label} salvaged for ${refund} credits.`, { structureId });
    return NextResponse.json(await getWorldSnapshot(pilotId));
  } catch (error) {
    return apiError(error);
  }
}
