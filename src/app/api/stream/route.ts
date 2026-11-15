import { and, asc, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { events } from "@/db/schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const pilotId = url.searchParams.get("pilot");
  if (!pilotId) return Response.json({ error: "Pilot is required" }, { status: 400 });
  let cursor = Number(url.searchParams.get("after") ?? request.headers.get("last-event-id") ?? 0) || 0;
  const encoder = new TextEncoder();
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, data: unknown, id?: number): void => {
        if (closed) return;
        const prefix = id ? `id: ${id}\n` : "";
        controller.enqueue(encoder.encode(`${prefix}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      send("ready", { pilotId, pollingFallbackMs: 25_000 });
      const poll = async (): Promise<void> => {
        if (closed) return;
        try {
          const rows = await db.select().from(events).where(and(eq(events.pilotId, pilotId), gt(events.id, cursor))).orderBy(asc(events.id)).limit(40);
          for (const row of rows) {
            cursor = Math.max(cursor, row.id);
            send("world", { id: row.id, kind: row.kind, message: row.message, payload: row.payload, createdAt: row.createdAt.toISOString() }, row.id);
          }
          send("heartbeat", { at: new Date().toISOString(), cursor });
        } catch {
          send("degraded", { message: "Event database temporarily unavailable; 25 s snapshot polling remains active." });
        }
        if (!closed) setTimeout(() => void poll(), 2000);
      };
      void poll();
      request.signal.addEventListener("abort", () => {
        closed = true;
        try { controller.close(); } catch { /* already closed */ }
      });
    },
    cancel() { closed = true; },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
