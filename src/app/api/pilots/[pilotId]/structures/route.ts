import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { databaseDriver, db, pgDb } from "@/db";
import { buildings, pgSchema, pilots, rooms, structures } from "@/db/schema";
import { getStructureDefinition, isStructureType, type StructureType } from "@/engine/catalogue";
import { PARCEL_GRID_SIZE } from "@/engine/geodesy";
import { apiError, asRecord, finiteNumber } from "@/lib/api";
import { getWorldSnapshot, publishEvent } from "@/server/world";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: { params: Promise<{ pilotId: string }> }): Promise<NextResponse> {
  try {
    const { pilotId } = await context.params;
    const body = asRecord(await request.json());
    if (!isStructureType(body.type)) throw new Error("Unknown structure type");
    const type: StructureType = body.type;
    const gx = Math.floor(finiteNumber(body.gx, "Grid X"));
    const gy = Math.floor(finiteNumber(body.gy, "Grid Y"));
    const rotation = Math.floor(finiteNumber(body.rotation ?? 0, "Rotation")) % 4;
    if (gx < 0 || gy < 0 || gx >= PARCEL_GRID_SIZE || gy >= PARCEL_GRID_SIZE) throw new Error("Structure is outside the parcel grid");
    const snapshot = await getWorldSnapshot(pilotId);
    if (!snapshot?.parcel) throw new Error("Claim a parcel before building");
    const definition = getStructureDefinition(type);
    if (snapshot.pilot.credits < definition.cost) throw new Error(`Insufficient credits: ${definition.cost} required`);
    const cell = snapshot.parcel.cells[gy * PARCEL_GRID_SIZE + gx];
    if (cell.w && type !== "tidal_generator") throw new Error("Only tidal generators can occupy water cells");
    if (!cell.w && type === "tidal_generator") throw new Error("Tidal generators require a water cell");
    if (cell.s > 0.85 && !["rampart", "wind_turbine", "mine"].includes(type)) throw new Error("This cell is too steep for the selected structure");
    const occupied = snapshot.structures.some((structure) => structure.gx === gx && structure.gy === gy);
    if (occupied) throw new Error("That grid cell is already occupied");
    if (definition.site) {
      if (gx + 3 > PARCEL_GRID_SIZE || gy + 3 > PARCEL_GRID_SIZE) throw new Error("The 3×3 building footprint crosses the parcel boundary");
      for (let y = gy; y < gy + 3; y += 1) {
        for (let x = gx; x < gx + 3; x += 1) {
          const footprintCell = snapshot.parcel.cells[y * PARCEL_GRID_SIZE + x];
          if (footprintCell.w) throw new Error("Every cell in a building footprint must be on land");
          if (footprintCell.s > 0.85) throw new Error("The building footprint includes a cell that is too steep");
          if (snapshot.structures.some((structure) => structure.gx === x && structure.gy === y)) throw new Error("The 3×3 building footprint overlaps an existing structure");
        }
      }
      if (snapshot.buildings.some((building) => gx < building.gx + building.width && gx + 3 > building.gx && gy < building.gy + building.depth && gy + 3 > building.gy)) throw new Error("The building footprint overlaps another building site");
    } else if (snapshot.buildings.some((building) => gx >= building.gx && gx < building.gx + building.width && gy >= building.gy && gy < building.gy + building.depth)) {
      throw new Error("This cell lies inside an existing building footprint");
    }

    const parcelId = snapshot.parcel.id;
    const nextCredits = snapshot.pilot.credits - definition.cost;
    const buildingName = `${definition.label} ${snapshot.buildings.length + 1}`;
    const structureId = crypto.randomUUID();
    if (databaseDriver === "postgres") {
      await pgDb!.transaction(async (tx) => {
        await tx.insert(pgSchema.structures).values({ id: structureId, parcelId, type, gx, gy, rotation });
        await tx.update(pgSchema.pilots).set({ credits: nextCredits }).where(eq(pgSchema.pilots.id, pilotId));
        if (definition.site) {
          const buildingId = crypto.randomUUID();
          await tx.insert(pgSchema.buildings).values({
            id: buildingId,
            parcelId,
            structureId,
            name: buildingName,
            archetype: type,
            gx,
            gy,
            width: 3,
            depth: 3,
          });
          await tx.insert(pgSchema.rooms).values([
            { id: crypto.randomUUID(), buildingId, kind: "reception", name: "Reception", x: 0, y: 8, width: 4, depth: 4, staff: 1 },
            { id: crypto.randomUUID(), buildingId, kind: "guard", name: "Guard Post", x: 8, y: 8, width: 4, depth: 4, staff: 1 },
          ]);
        }
      });
    } else {
      db.transaction((tx) => {
        tx.insert(structures).values({ id: structureId, parcelId, type, gx, gy, rotation }).run();
        tx.update(pilots).set({ credits: nextCredits }).where(eq(pilots.id, pilotId)).run();
        if (definition.site) {
          const buildingId = crypto.randomUUID();
          tx.insert(buildings).values({
            id: buildingId,
            parcelId,
            structureId,
            name: buildingName,
            archetype: type,
            gx,
            gy,
            width: 3,
            depth: 3,
          }).run();
          tx.insert(rooms).values([
            { id: crypto.randomUUID(), buildingId, kind: "reception", name: "Reception", x: 0, y: 8, width: 4, depth: 4, staff: 1 },
            { id: crypto.randomUUID(), buildingId, kind: "guard", name: "Guard Post", x: 8, y: 8, width: 4, depth: 4, staff: 1 },
          ]).run();
        }
      });
    }
    await publishEvent(pilotId, "build", `${definition.label} commissioned at grid ${gx + 1}:${gy + 1}.`, { structureId, gx, gy, type: body.type });
    const updated = await getWorldSnapshot(pilotId);
    return NextResponse.json(updated, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
