import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bots } from "@/db/schema";
import { isAiModel } from "@/engine/ai";
import { apiError, asRecord, finiteNumber, requiredString } from "@/lib/api";
import { getWorldSnapshot, publishEvent } from "@/server/world";

export async function PATCH(request: NextRequest, context: { params: Promise<{ pilotId: string; botId: string }> }): Promise<NextResponse> {
  try {
    const { pilotId, botId } = await context.params;
    const body = asRecord(await request.json());
    const provider = requiredString(body.provider, "Provider", 40);
    const model = requiredString(body.model, "Model", 80);
    if (!isAiModel(provider, model)) throw new Error("The selected provider does not offer that model");
    const directive = requiredString(body.directive, "Directive", 600);
    const autonomy = Math.max(0, Math.min(100, Math.round(finiteNumber(body.autonomy, "Autonomy"))));
    const active = body.active !== false;
    const updated = await db.update(bots).set({ provider, model, directive, autonomy, active, updatedAt: new Date() }).where(and(eq(bots.id, botId), eq(bots.pilotId, pilotId))).returning();
    if (!updated[0]) throw new Error("Bot not found for this pilot");
    await publishEvent(pilotId, "ai", `${updated[0].role} ${updated[0].name} now routes to ${provider} / ${model}.`, { botId, provider, model, autonomy, active });
    return NextResponse.json(await getWorldSnapshot(pilotId));
  } catch (error) {
    return apiError(error);
  }
}
