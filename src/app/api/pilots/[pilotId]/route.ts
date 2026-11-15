import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { getWorldSnapshot } from "@/server/world";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ pilotId: string }> }): Promise<NextResponse> {
  try {
    const { pilotId } = await context.params;
    const snapshot = await getWorldSnapshot(pilotId);
    if (!snapshot) return NextResponse.json({ error: "Pilot not found" }, { status: 404 });
    return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
