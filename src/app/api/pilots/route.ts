import { NextRequest, NextResponse } from "next/server";
import { apiError, asRecord, requiredString, validLocation } from "@/lib/api";
import { registerPilot } from "@/server/world";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = asRecord(await request.json());
    const callSign = requiredString(body.callSign, "Call sign", 24).replace(/[^a-zA-Z0-9 _-]/g, "");
    if (callSign.length < 2) throw new Error("Call sign needs at least two usable characters");
    const { lat, lon } = validLocation(body.lat, body.lon);
    const snapshot = await registerPilot(callSign, lat, lon);
    return NextResponse.json(snapshot, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
