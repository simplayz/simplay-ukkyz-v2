import "dotenv/config";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import { migrate as migrateSqlite } from "drizzle-orm/better-sqlite3/migrator";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { pgRelations, resolveDatabaseDriver, sqliteRelations } from "./schema";

function resolveSqliteMigrationPath(): string {
  const explicit = process.env.SQLITE_PATH?.trim();
  if (explicit) {
    return explicit.startsWith("file:") ? explicit.slice(5) : explicit;
  }
  const rawUrl = process.env.DATABASE_URL?.trim();
  if (!rawUrl || rawUrl.startsWith("postgres://") || rawUrl.startsWith("postgresql://")) {
    return "./simplayz.db";
  }
  return rawUrl.startsWith("file:") ? rawUrl.slice(5) : rawUrl;
}

async function runMigrations(): Promise<void> {
  const driver = resolveDatabaseDriver();
  const migrationsFolder = resolve(process.cwd(), process.env.DRIZZLE_MIGRATIONS_DIR ?? "drizzle");

  if (driver === "postgres") {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required when DATABASE_DRIVER=postgres");
    }
    const pool = new Pool({ connectionString: databaseUrl });
    try {
      const db = drizzlePg({ client: pool, relations: pgRelations });
      await migratePg(db, { migrationsFolder });
      console.log(`Applied PostgreSQL migrations from ${migrationsFolder}`);
    } finally {
      await pool.end();
    }
    return;
  }

  const sqlitePath = resolveSqliteMigrationPath();
  if (sqlitePath !== ":memory:") {
    const dir = dirname(sqlitePath);
    if (dir && dir !== ".") {
      mkdirSync(dir, { recursive: true });
    }
  }

  const client = new Database(sqlitePath);
  try {
    client.pragma("foreign_keys = ON");
    client.pragma("busy_timeout = 5000");
    if (sqlitePath !== ":memory:") {
      client.pragma("journal_mode = WAL");
    }
    const db = drizzleSqlite({ client, relations: sqliteRelations });
    migrateSqlite(db, { migrationsFolder });
    console.log(`Applied SQLite migrations from ${migrationsFolder} -> ${sqlitePath}`);
  } finally {
    client.close();
  }
}

runMigrations().catch((error: unknown) => {
  console.error("Database migration failed:", error);
  process.exit(1);
});
