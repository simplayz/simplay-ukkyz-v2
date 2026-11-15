import { databaseDriver, db, pgDb } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (databaseDriver === "postgres") {
      await pgDb!.execute(sql`select 1`);
    } else {
      db.get(sql`select 1`);
    }
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
