import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import type { SQLWrapper } from "drizzle-orm";
import { drizzle as drizzleSqlite, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { databaseDriver, pgSchema, sqliteSchema, type DatabaseDriver } from "./schema";

export { databaseDriver, type DatabaseDriver };

type SqliteDrizzleDb = BetterSQLite3Database<typeof sqliteSchema> & {
  $client: Database.Database;
  execute: <T = unknown>(query: SQLWrapper) => Promise<T[]>;
};

type PgDrizzleDb = NodePgDatabase<typeof pgSchema> & {
  $client: Pool;
};

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
  __arenaNextJsSqliteClient?: Database.Database;
  __arenaNextJsSqlitePath?: string;
};

function resolveSqlitePath(): string {
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

function bootstrapSqliteSchema(client: Database.Database): void {
  client.exec(`
    CREATE TABLE IF NOT EXISTS \`pilots\` (
      \`id\` text PRIMARY KEY NOT NULL,
      \`call_sign\` text NOT NULL,
      \`seed\` integer NOT NULL,
      \`home_lat\` real NOT NULL,
      \`home_lon\` real NOT NULL,
      \`credits\` integer DEFAULT 15000 NOT NULL,
      \`created_at\` integer NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS \`pilots_call_sign_unique\` ON \`pilots\` (\`call_sign\`);

    CREATE TABLE IF NOT EXISTS \`parcels\` (
      \`id\` text PRIMARY KEY NOT NULL,
      \`pilot_id\` text NOT NULL,
      \`name\` text NOT NULL,
      \`seed\` integer NOT NULL,
      \`center_x\` real NOT NULL,
      \`center_y\` real NOT NULL,
      \`lat\` real NOT NULL,
      \`lon\` real NOT NULL,
      \`area_m2\` integer NOT NULL,
      \`scores\` text NOT NULL,
      \`cells\` text NOT NULL,
      \`locked_until\` integer NOT NULL,
      \`last_tick_at\` integer NOT NULL,
      \`created_at\` integer NOT NULL,
      FOREIGN KEY (\`pilot_id\`) REFERENCES \`pilots\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );
    CREATE UNIQUE INDEX IF NOT EXISTS \`parcels_pilot_id_unique\` ON \`parcels\` (\`pilot_id\`);
    CREATE INDEX IF NOT EXISTS \`parcels_lock_idx\` ON \`parcels\` (\`locked_until\`);

    CREATE TABLE IF NOT EXISTS \`structures\` (
      \`id\` text PRIMARY KEY NOT NULL,
      \`parcel_id\` text NOT NULL,
      \`type\` text NOT NULL,
      \`gx\` integer NOT NULL,
      \`gy\` integer NOT NULL,
      \`rotation\` integer DEFAULT 0 NOT NULL,
      \`level\` integer DEFAULT 1 NOT NULL,
      \`created_at\` integer NOT NULL,
      FOREIGN KEY (\`parcel_id\`) REFERENCES \`parcels\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );
    CREATE UNIQUE INDEX IF NOT EXISTS \`structures_cell_idx\` ON \`structures\` (\`parcel_id\`,\`gx\`,\`gy\`);

    CREATE TABLE IF NOT EXISTS \`buildings\` (
      \`id\` text PRIMARY KEY NOT NULL,
      \`parcel_id\` text NOT NULL,
      \`structure_id\` text,
      \`name\` text NOT NULL,
      \`archetype\` text NOT NULL,
      \`gx\` integer NOT NULL,
      \`gy\` integer NOT NULL,
      \`width\` integer DEFAULT 3 NOT NULL,
      \`depth\` integer DEFAULT 3 NOT NULL,
      \`level\` integer DEFAULT 1 NOT NULL,
      \`created_at\` integer NOT NULL,
      FOREIGN KEY (\`parcel_id\`) REFERENCES \`parcels\`(\`id\`) ON UPDATE no action ON DELETE cascade,
      FOREIGN KEY (\`structure_id\`) REFERENCES \`structures\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );

    CREATE TABLE IF NOT EXISTS \`rooms\` (
      \`id\` text PRIMARY KEY NOT NULL,
      \`building_id\` text NOT NULL,
      \`kind\` text NOT NULL,
      \`name\` text NOT NULL,
      \`x\` integer NOT NULL,
      \`y\` integer NOT NULL,
      \`width\` integer DEFAULT 2 NOT NULL,
      \`depth\` integer DEFAULT 2 NOT NULL,
      \`staff\` integer DEFAULT 1 NOT NULL,
      \`created_at\` integer NOT NULL,
      FOREIGN KEY (\`building_id\`) REFERENCES \`buildings\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );

    CREATE TABLE IF NOT EXISTS \`bots\` (
      \`id\` text PRIMARY KEY NOT NULL,
      \`pilot_id\` text NOT NULL,
      \`role\` text NOT NULL,
      \`name\` text NOT NULL,
      \`provider\` text NOT NULL,
      \`model\` text NOT NULL,
      \`directive\` text NOT NULL,
      \`autonomy\` integer DEFAULT 35 NOT NULL,
      \`active\` integer DEFAULT true NOT NULL,
      \`updated_at\` integer NOT NULL,
      FOREIGN KEY (\`pilot_id\`) REFERENCES \`pilots\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );
    CREATE UNIQUE INDEX IF NOT EXISTS \`bots_role_idx\` ON \`bots\` (\`pilot_id\`,\`role\`);

    CREATE TABLE IF NOT EXISTS \`tile_cache\` (
      \`z\` integer NOT NULL,
      \`x\` integer NOT NULL,
      \`y\` integer NOT NULL,
      \`png_base64\` text NOT NULL,
      \`fetched_at\` integer NOT NULL,
      \`source\` text DEFAULT 'osm' NOT NULL,
      PRIMARY KEY(\`z\`, \`x\`, \`y\`)
    );

    CREATE TABLE IF NOT EXISTS \`events\` (
      \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      \`pilot_id\` text NOT NULL,
      \`kind\` text NOT NULL,
      \`message\` text NOT NULL,
      \`payload\` text,
      \`created_at\` integer NOT NULL,
      FOREIGN KEY (\`pilot_id\`) REFERENCES \`pilots\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );
    CREATE INDEX IF NOT EXISTS \`events_pilot_idx\` ON \`events\` (\`pilot_id\`,\`id\`);

    CREATE TABLE IF NOT EXISTS \`assaults\` (
      \`id\` text PRIMARY KEY NOT NULL,
      \`parcel_id\` text NOT NULL,
      \`report\` text NOT NULL,
      \`created_at\` integer NOT NULL,
      FOREIGN KEY (\`parcel_id\`) REFERENCES \`parcels\`(\`id\`) ON UPDATE no action ON DELETE cascade
    );
  `);
}

function createSqliteDb(): { client: Database.Database; instance: SqliteDrizzleDb } {
  const sqlitePath = resolveSqlitePath();
  if (sqlitePath !== ":memory:") {
    const dir = dirname(sqlitePath);
    if (dir && dir !== ".") {
      mkdirSync(dir, { recursive: true });
    }
  }
  const reusable =
    globalForDb.__arenaNextJsSqliteClient &&
    globalForDb.__arenaNextJsSqliteClient.open &&
    globalForDb.__arenaNextJsSqlitePath === sqlitePath
      ? globalForDb.__arenaNextJsSqliteClient
      : undefined;

  const client = reusable ?? new Database(sqlitePath);
  client.pragma("foreign_keys = ON");
  client.pragma("busy_timeout = 5000");
  if (sqlitePath !== ":memory:") {
    client.pragma("journal_mode = WAL");
  }
  bootstrapSqliteSchema(client);

  if (process.env.NODE_ENV !== "production") {
    globalForDb.__arenaNextJsSqliteClient = client;
    globalForDb.__arenaNextJsSqlitePath = sqlitePath;
  }

  const base = drizzleSqlite(client, { schema: sqliteSchema });
  const instance = Object.assign(base, {
    execute: async <T = unknown>(query: SQLWrapper): Promise<T[]> => base.all<T>(query),
  });
  return { client, instance };
}

function createPostgresDb(): { pool: Pool; instance: PgDrizzleDb } {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required when DATABASE_DRIVER=postgres");
  }
  const pgPool =
    globalForDb.__arenaNextJsPostgresqlPool ??
    new Pool({
      connectionString: databaseUrl,
    });

  if (process.env.NODE_ENV !== "production") {
    globalForDb.__arenaNextJsPostgresqlPool = pgPool;
  }

  return { pool: pgPool, instance: drizzlePg(pgPool, { schema: pgSchema }) };
}

const initialized =
  databaseDriver === "postgres"
    ? { driver: "postgres" as const, ...createPostgresDb() }
    : { driver: "sqlite" as const, ...createSqliteDb() };

export const pool: Pool | null = initialized.driver === "postgres" ? initialized.pool : null;
export const sqlite: Database.Database | null = initialized.driver === "sqlite" ? initialized.client : null;
export const pgDb: PgDrizzleDb | null = initialized.driver === "postgres" ? initialized.instance : null;
export const db: SqliteDrizzleDb = initialized.instance as unknown as SqliteDrizzleDb;
