import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { assaults, parcels, pilots } from "@/db/schema";
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
    const credits = Math.max(0, snapshot.pilot.credits + report.reward - report.loss);
    await db.transaction(async (tx) => {
      await tx.insert(assaults).values({ id: crypto.randomUUID(), parcelId, report });
      await tx.update(pilots).set({ credits }).where(eq(pilots.id, pilotId));
      await tx.update(parcels).set({ lockedUntil: new Date(now.getTime() + LOCK_MS), lastTickAt: now }).where(eq(parcels.id, parcelId));
    });
    await publishEvent(pilotId, "assault", `${report.enemy}: ${report.victory ? `defence held, +${report.reward} credits` : `parcel overrun, −${report.loss} credits`}.`, { victory: report.victory });
    return NextResponse.json(await getWorldSnapshot(pilotId));
  } catch (error) {
    return apiError(error);
  }
}
