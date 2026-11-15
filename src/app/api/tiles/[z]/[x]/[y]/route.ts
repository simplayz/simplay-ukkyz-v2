import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { tileCache } from "@/db/schema";
import { placeholderPng } from "@/server/placeholder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const FRESH_MS = 24 * 60 * 60 * 1000;

function pngResponse(png: Buffer, source: string, ageSeconds: number, z: number, x: number, y: number): Response {
  const placeholder = source === "placeholder";
  return new Response(new Uint8Array(png), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(png.byteLength),
      "Cache-Control": placeholder ? "no-store, max-age=0" : source === "stale" ? "public, max-age=60, stale-if-error=604800" : "public, max-age=86400, stale-if-error=604800",
      "x-simplayz-source": source,
      "x-simplayz-cache": source === "cache" ? "HIT" : source === "stale" ? "STALE" : "MISS",
      "x-simplayz-provenance": source === "upstream" ? "OpenStreetMap Standard" : source === "placeholder" ? "Simplayz generated fallback; not cached" : "PostgreSQL tile_cache / OpenStreetMap Standard",
      "x-simplayz-age": String(Math.max(0, Math.round(ageSeconds))),
      "x-simplayz-tile": `${z}/${x}/${y}`,
      "Access-Control-Expose-Headers": "x-simplayz-source,x-simplayz-cache,x-simplayz-provenance,x-simplayz-age,x-simplayz-tile",
    },
  });
}

export async function GET(_request: Request, context: { params: Promise<{ z: string; x: string; y: string }> }): Promise<Response> {
  const params = await context.params;
  const z = Number(params.z);
  const x = Number(params.x);
  const y = Number(params.y.replace(/\.png$/i, ""));
  if (![z, x, y].every(Number.isInteger) || z < 0 || z > 19 || x < 0 || y < 0 || x >= 2 ** z || y >= 2 ** z) {
    return Response.json({ error: "Invalid tile coordinate" }, { status: 400 });
  }
  let cached: typeof tileCache.$inferSelect | undefined;
  try {
    cached = await db.query.tileCache.findFirst({ where: and(eq(tileCache.z, z), eq(tileCache.x, x), eq(tileCache.y, y)) });
  } catch {
    cached = undefined;
  }
  const age = cached ? Date.now() - cached.fetchedAt.getTime() : Infinity;
  if (cached && age < FRESH_MS) return pngResponse(Buffer.from(cached.pngBase64, "base64"), "cache", age / 1000, z, x, y);

  try {
    const upstream = await fetch(`https://tile.openstreetmap.org/${z}/${x}/${y}.png`, {
      headers: { "User-Agent": "Simplayz/1.0 (persistent world simulator; internal cached tiles)", Accept: "image/png,image/*" },
      signal: AbortSignal.timeout(7000),
      cache: "no-store",
    });
    if (!upstream.ok) throw new Error(`OSM status ${upstream.status}`);
    const contentType = upstream.headers.get("content-type") ?? "";
    const bytes = Buffer.from(await upstream.arrayBuffer());
    if (!contentType.includes("image") || bytes.length < 100 || bytes.subarray(1, 4).toString("ascii") !== "PNG") throw new Error("Upstream did not return a PNG");
    const encoded = bytes.toString("base64");
    try {
      await db.insert(tileCache).values({ z, x, y, pngBase64: encoded, fetchedAt: new Date(), source: "osm" }).onConflictDoUpdate({ target: [tileCache.z, tileCache.x, tileCache.y], set: { pngBase64: encoded, fetchedAt: new Date(), source: "osm" } });
    } catch {
      // A cache write failure must not prevent the freshly fetched raster from rendering.
    }
    return pngResponse(bytes, "upstream", 0, z, x, y);
  } catch {
    if (cached) return pngResponse(Buffer.from(cached.pngBase64, "base64"), "stale", age / 1000, z, x, y);
    return pngResponse(placeholderPng(z, x, y), "placeholder", 0, z, x, y);
  }
}
