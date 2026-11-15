import { NextRequest, NextResponse } from "next/server";
import { apiError, asRecord, validLocation } from "@/lib/api";
import { claimParcel } from "@/server/world";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: { params: Promise<{ pilotId: string }> }): Promise<NextResponse> {
  try {
    const { pilotId } = await context.params;
    const body = asRecord(await request.json());
    const { lat, lon } = validLocation(body.lat, body.lon);
    const snapshot = await claimParcel(pilotId, lat, lon);
    return NextResponse.json(snapshot, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
