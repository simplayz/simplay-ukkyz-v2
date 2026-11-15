import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { databaseDriver, db, pgDb } from "@/db";
import { assaults, parcels, pgSchema, pilots } from "@/db/schema";
import { LOCK_MS, resolveAssault } from "@/engine/simulation";
import { apiError } from "@/lib/api";
import { getWorldSnapshot, publishEvent } from "@/server/world";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: { params: Promise<{ parcelId: string }> }): Promise<NextResponse> {
  try {
    const { parcelId } = await context.params;
    const pilotId = new URL(request.url).searchParams.get("pilotId");
    if (!pilotId) throw new Error("Pilot ID is required");
    const snapshot = await getWorldSnapshot(pilotId);
    if (!snapshot?.parcel || snapshot.parcel.id !== parcelId) throw new Error("Area not found for this pilot");
    const lockedUntil = new Date(snapshot.parcel.lockedUntil).getTime();
    if (Date.now() < lockedUntil) throw new Error(`Assault unavailable until the 72-hour lock expires (${new Date(lockedUntil).toISOString()})`);
    const report = resolveAssault({
      seed: snapshot.parcel.seed + snapshot.assaults.length * 7919,
      defence: snapshot.totals.defence,
      power: snapshot.totals.power,
      prestige: snapshot.totals.prestige,
      structureCount: snapshot.structures.length,
    });
    const now = new Date();
    const nextLockedUntil = new Date(now.getTime() + LOCK_MS);
    const credits = Math.max(0, snapshot.pilot.credits + report.reward - report.loss);
    const assaultId = crypto.randomUUID();
    if (databaseDriver === "postgres") {
      await pgDb!.transaction(async (tx) => {
        await tx.insert(pgSchema.assaults).values({ id: assaultId, parcelId, report });
        await tx.update(pgSchema.pilots).set({ credits }).where(eq(pgSchema.pilots.id, pilotId));
        await tx.update(pgSchema.parcels).set({ lockedUntil: nextLockedUntil, lastTickAt: now }).where(eq(pgSchema.parcels.id, parcelId));
      });
    } else {
      db.transaction((tx) => {
        tx.insert(assaults).values({ id: assaultId, parcelId, report }).run();
        tx.update(pilots).set({ credits }).where(eq(pilots.id, pilotId)).run();
        tx.update(parcels).set({ lockedUntil: nextLockedUntil, lastTickAt: now }).where(eq(parcels.id, parcelId)).run();
      });
    }
    await publishEvent(pilotId, "assault", `${report.enemy}: ${report.victory ? `defence held, +${report.reward} credits` : `parcel overrun, −${report.loss} credits`}.`, { victory: report.victory });
    return NextResponse.json(await getWorldSnapshot(pilotId));
  } catch (error) {
    return apiError(error);
  }
}
