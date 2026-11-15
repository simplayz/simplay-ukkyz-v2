import { relations } from "drizzle-orm";
import {
  bigserial,
  boolean,
  doublePrecision,
  index as pgIndex,
  integer as pgInteger,
  jsonb,
  pgTable,
  primaryKey as pgPrimaryKey,
  text as pgText,
  timestamp,
  uniqueIndex as pgUniqueIndex,
} from "drizzle-orm/pg-core";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type { BotRole } from "@/engine/ai";
import type { StructureType } from "@/engine/catalogue";
import type { AssaultReport } from "@/engine/simulation";
import type { SurveyCell, TerrainScores } from "@/engine/terrain";

export type DatabaseDriver = "sqlite" | "postgres";

export function resolveDatabaseDriver(raw = process.env.DATABASE_DRIVER): DatabaseDriver {
  const normalized = raw?.trim().toLowerCase();
  if (!normalized || normalized === "sqlite" || normalized === "better-sqlite3") {
    return "sqlite";
  }
  if (normalized === "postgres" || normalized === "postgresql" || normalized === "pg") {
    return "postgres";
  }
  throw new Error(`Unsupported DATABASE_DRIVER "${raw}". Expected "sqlite" or "postgres".`);
}

export const databaseDriver: DatabaseDriver = resolveDatabaseDriver();

const sqlitePilots = sqliteTable("pilots", {
  id: text("id").primaryKey(),
  callSign: text("call_sign").notNull().unique(),
  seed: integer("seed").notNull(),
  homeLat: real("home_lat").notNull(),
  homeLon: real("home_lon").notNull(),
  credits: integer("credits").notNull().default(15_000),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

const sqliteParcels = sqliteTable("parcels", {
  id: text("id").primaryKey(),
  pilotId: text("pilot_id").notNull().references(() => sqlitePilots.id, { onDelete: "cascade" }).unique(),
  name: text("name").notNull(),
  seed: integer("seed").notNull(),
  centerX: real("center_x").notNull(),
  centerY: real("center_y").notNull(),
  lat: real("lat").notNull(),
  lon: real("lon").notNull(),
  areaM2: integer("area_m2").notNull(),
  scores: text("scores", { mode: "json" }).$type<TerrainScores>().notNull(),
  cells: text("cells", { mode: "json" }).$type<SurveyCell[]>().notNull(),
  lockedUntil: integer("locked_until", { mode: "timestamp" }).notNull(),
  lastTickAt: integer("last_tick_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => [index("parcels_lock_idx").on(table.lockedUntil)]);

const sqliteStructures = sqliteTable("structures", {
  id: text("id").primaryKey(),
  parcelId: text("parcel_id").notNull().references(() => sqliteParcels.id, { onDelete: "cascade" }),
  type: text("type").$type<StructureType>().notNull(),
  gx: integer("gx").notNull(),
  gy: integer("gy").notNull(),
  rotation: integer("rotation").notNull().default(0),
  level: integer("level").notNull().default(1),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => [uniqueIndex("structures_cell_idx").on(table.parcelId, table.gx, table.gy)]);

const sqliteBuildings = sqliteTable("buildings", {
  id: text("id").primaryKey(),
  parcelId: text("parcel_id").notNull().references(() => sqliteParcels.id, { onDelete: "cascade" }),
  structureId: text("structure_id").references(() => sqliteStructures.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  archetype: text("archetype").notNull(),
  gx: integer("gx").notNull(),
  gy: integer("gy").notNull(),
  width: integer("width").notNull().default(3),
  depth: integer("depth").notNull().default(3),
  level: integer("level").notNull().default(1),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

const sqliteRooms = sqliteTable("rooms", {
  id: text("id").primaryKey(),
  buildingId: text("building_id").notNull().references(() => sqliteBuildings.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  name: text("name").notNull(),
  x: integer("x").notNull(),
  y: integer("y").notNull(),
  width: integer("width").notNull().default(2),
  depth: integer("depth").notNull().default(2),
  staff: integer("staff").notNull().default(1),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

const sqliteBots = sqliteTable("bots", {
  id: text("id").primaryKey(),
  pilotId: text("pilot_id").notNull().references(() => sqlitePilots.id, { onDelete: "cascade" }),
  role: text("role").$type<BotRole>().notNull(),
  name: text("name").notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  directive: text("directive").notNull(),
  autonomy: integer("autonomy").notNull().default(35),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => [uniqueIndex("bots_role_idx").on(table.pilotId, table.role)]);

const sqliteTileCache = sqliteTable("tile_cache", {
  z: integer("z").notNull(),
  x: integer("x").notNull(),
  y: integer("y").notNull(),
  pngBase64: text("png_base64").notNull(),
  fetchedAt: integer("fetched_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  source: text("source").notNull().default("osm"),
}, (table) => [primaryKey({ columns: [table.z, table.x, table.y] })]);

const sqliteEvents = sqliteTable("events", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  pilotId: text("pilot_id").notNull().references(() => sqlitePilots.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  message: text("message").notNull(),
  payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => [index("events_pilot_idx").on(table.pilotId, table.id)]);

const sqliteAssaults = sqliteTable("assaults", {
  id: text("id").primaryKey(),
  parcelId: text("parcel_id").notNull().references(() => sqliteParcels.id, { onDelete: "cascade" }),
  report: text("report", { mode: "json" }).$type<AssaultReport>().notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

const sqlitePilotsRelations = relations(sqlitePilots, ({ one, many }) => ({
  parcel: one(sqliteParcels),
  bots: many(sqliteBots),
  events: many(sqliteEvents),
}));

const sqliteParcelsRelations = relations(sqliteParcels, ({ one, many }) => ({
  pilot: one(sqlitePilots, { fields: [sqliteParcels.pilotId], references: [sqlitePilots.id] }),
  structures: many(sqliteStructures),
  buildings: many(sqliteBuildings),
  assaults: many(sqliteAssaults),
}));

const sqliteBuildingsRelations = relations(sqliteBuildings, ({ one, many }) => ({
  parcel: one(sqliteParcels, { fields: [sqliteBuildings.parcelId], references: [sqliteParcels.id] }),
  rooms: many(sqliteRooms),
}));

export const sqliteSchema = {
  pilots: sqlitePilots,
  parcels: sqliteParcels,
  structures: sqliteStructures,
  buildings: sqliteBuildings,
  rooms: sqliteRooms,
  bots: sqliteBots,
  tileCache: sqliteTileCache,
  events: sqliteEvents,
  assaults: sqliteAssaults,
  pilotsRelations: sqlitePilotsRelations,
  parcelsRelations: sqliteParcelsRelations,
  buildingsRelations: sqliteBuildingsRelations,
};

const pgPilots = pgTable("pilots", {
  id: pgText("id").primaryKey(),
  callSign: pgText("call_sign").notNull().unique(),
  seed: pgInteger("seed").notNull(),
  homeLat: doublePrecision("home_lat").notNull(),
  homeLon: doublePrecision("home_lon").notNull(),
  credits: pgInteger("credits").notNull().default(15_000),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

const pgParcels = pgTable("parcels", {
  id: pgText("id").primaryKey(),
  pilotId: pgText("pilot_id").notNull().references(() => pgPilots.id, { onDelete: "cascade" }).unique(),
  name: pgText("name").notNull(),
  seed: pgInteger("seed").notNull(),
  centerX: doublePrecision("center_x").notNull(),
  centerY: doublePrecision("center_y").notNull(),
  lat: doublePrecision("lat").notNull(),
  lon: doublePrecision("lon").notNull(),
  areaM2: pgInteger("area_m2").notNull(),
  scores: jsonb("scores").$type<TerrainScores>().notNull(),
  cells: jsonb("cells").$type<SurveyCell[]>().notNull(),
  lockedUntil: timestamp("locked_until", { withTimezone: true }).notNull(),
  lastTickAt: timestamp("last_tick_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [pgIndex("parcels_lock_idx").on(table.lockedUntil)]);

const pgStructures = pgTable("structures", {
  id: pgText("id").primaryKey(),
  parcelId: pgText("parcel_id").notNull().references(() => pgParcels.id, { onDelete: "cascade" }),
  type: pgText("type").$type<StructureType>().notNull(),
  gx: pgInteger("gx").notNull(),
  gy: pgInteger("gy").notNull(),
  rotation: pgInteger("rotation").notNull().default(0),
  level: pgInteger("level").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [pgUniqueIndex("structures_cell_idx").on(table.parcelId, table.gx, table.gy)]);

const pgBuildings = pgTable("buildings", {
  id: pgText("id").primaryKey(),
  parcelId: pgText("parcel_id").notNull().references(() => pgParcels.id, { onDelete: "cascade" }),
  structureId: pgText("structure_id").references(() => pgStructures.id, { onDelete: "cascade" }),
  name: pgText("name").notNull(),
  archetype: pgText("archetype").notNull(),
  gx: pgInteger("gx").notNull(),
  gy: pgInteger("gy").notNull(),
  width: pgInteger("width").notNull().default(3),
  depth: pgInteger("depth").notNull().default(3),
  level: pgInteger("level").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

const pgRooms = pgTable("rooms", {
  id: pgText("id").primaryKey(),
  buildingId: pgText("building_id").notNull().references(() => pgBuildings.id, { onDelete: "cascade" }),
  kind: pgText("kind").notNull(),
  name: pgText("name").notNull(),
  x: pgInteger("x").notNull(),
  y: pgInteger("y").notNull(),
  width: pgInteger("width").notNull().default(2),
  depth: pgInteger("depth").notNull().default(2),
  staff: pgInteger("staff").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

const pgBots = pgTable("bots", {
  id: pgText("id").primaryKey(),
  pilotId: pgText("pilot_id").notNull().references(() => pgPilots.id, { onDelete: "cascade" }),
  role: pgText("role").$type<BotRole>().notNull(),
  name: pgText("name").notNull(),
  provider: pgText("provider").notNull(),
  model: pgText("model").notNull(),
  directive: pgText("directive").notNull(),
  autonomy: pgInteger("autonomy").notNull().default(35),
  active: boolean("active").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [pgUniqueIndex("bots_role_idx").on(table.pilotId, table.role)]);

const pgTileCache = pgTable("tile_cache", {
  z: pgInteger("z").notNull(),
  x: pgInteger("x").notNull(),
  y: pgInteger("y").notNull(),
  pngBase64: pgText("png_base64").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  source: pgText("source").notNull().default("osm"),
}, (table) => [pgPrimaryKey({ columns: [table.z, table.x, table.y] })]);

const pgEvents = pgTable("events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  pilotId: pgText("pilot_id").notNull().references(() => pgPilots.id, { onDelete: "cascade" }),
  kind: pgText("kind").notNull(),
  message: pgText("message").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [pgIndex("events_pilot_idx").on(table.pilotId, table.id)]);

const pgAssaults = pgTable("assaults", {
  id: pgText("id").primaryKey(),
  parcelId: pgText("parcel_id").notNull().references(() => pgParcels.id, { onDelete: "cascade" }),
  report: jsonb("report").$type<AssaultReport>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

const pgPilotsRelations = relations(pgPilots, ({ one, many }) => ({
  parcel: one(pgParcels),
  bots: many(pgBots),
  events: many(pgEvents),
}));

const pgParcelsRelations = relations(pgParcels, ({ one, many }) => ({
  pilot: one(pgPilots, { fields: [pgParcels.pilotId], references: [pgPilots.id] }),
  structures: many(pgStructures),
  buildings: many(pgBuildings),
  assaults: many(pgAssaults),
}));

const pgBuildingsRelations = relations(pgBuildings, ({ one, many }) => ({
  parcel: one(pgParcels, { fields: [pgBuildings.parcelId], references: [pgParcels.id] }),
  rooms: many(pgRooms),
}));

export const pgSchema = {
  pilots: pgPilots,
  parcels: pgParcels,
  structures: pgStructures,
  buildings: pgBuildings,
  rooms: pgRooms,
  bots: pgBots,
  tileCache: pgTileCache,
  events: pgEvents,
  assaults: pgAssaults,
  pilotsRelations: pgPilotsRelations,
  parcelsRelations: pgParcelsRelations,
  buildingsRelations: pgBuildingsRelations,
};

const activeSchema = (databaseDriver === "postgres" ? pgSchema : sqliteSchema) as typeof sqliteSchema;

export const pilots = activeSchema.pilots;
export const parcels = activeSchema.parcels;
export const structures = activeSchema.structures;
export const buildings = activeSchema.buildings;
export const rooms = activeSchema.rooms;
export const bots = activeSchema.bots;
export const tileCache = activeSchema.tileCache;
export const events = activeSchema.events;
export const assaults = activeSchema.assaults;

export const pilotsRelations = activeSchema.pilotsRelations;
export const parcelsRelations = activeSchema.parcelsRelations;
export const buildingsRelations = activeSchema.buildingsRelations;
