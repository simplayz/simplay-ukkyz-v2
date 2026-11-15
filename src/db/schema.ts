import { relations } from "drizzle-orm";
import { bigserial, boolean, doublePrecision, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import type { BotRole } from "@/engine/ai";
import type { StructureType } from "@/engine/catalogue";
import type { AssaultReport } from "@/engine/simulation";
import type { SurveyCell, TerrainScores } from "@/engine/terrain";

export const pilots = pgTable("pilots", {
  id: text("id").primaryKey(),
  callSign: text("call_sign").notNull().unique(),
  seed: integer("seed").notNull(),
  homeLat: doublePrecision("home_lat").notNull(),
  homeLon: doublePrecision("home_lon").notNull(),
  credits: integer("credits").notNull().default(15_000),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const parcels = pgTable("parcels", {
  id: text("id").primaryKey(),
  pilotId: text("pilot_id").notNull().references(() => pilots.id, { onDelete: "cascade" }).unique(),
  name: text("name").notNull(),
  seed: integer("seed").notNull(),
  centerX: doublePrecision("center_x").notNull(),
  centerY: doublePrecision("center_y").notNull(),
  lat: doublePrecision("lat").notNull(),
  lon: doublePrecision("lon").notNull(),
  areaM2: integer("area_m2").notNull(),
  scores: jsonb("scores").$type<TerrainScores>().notNull(),
  cells: jsonb("cells").$type<SurveyCell[]>().notNull(),
  lockedUntil: timestamp("locked_until", { withTimezone: true }).notNull(),
  lastTickAt: timestamp("last_tick_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("parcels_lock_idx").on(table.lockedUntil)]);

export const structures = pgTable("structures", {
  id: text("id").primaryKey(),
  parcelId: text("parcel_id").notNull().references(() => parcels.id, { onDelete: "cascade" }),
  type: text("type").$type<StructureType>().notNull(),
  gx: integer("gx").notNull(),
  gy: integer("gy").notNull(),
  rotation: integer("rotation").notNull().default(0),
  level: integer("level").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("structures_cell_idx").on(table.parcelId, table.gx, table.gy)]);

export const buildings = pgTable("buildings", {
  id: text("id").primaryKey(),
  parcelId: text("parcel_id").notNull().references(() => parcels.id, { onDelete: "cascade" }),
  structureId: text("structure_id").references(() => structures.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  archetype: text("archetype").notNull(),
  gx: integer("gx").notNull(),
  gy: integer("gy").notNull(),
  width: integer("width").notNull().default(3),
  depth: integer("depth").notNull().default(3),
  level: integer("level").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rooms = pgTable("rooms", {
  id: text("id").primaryKey(),
  buildingId: text("building_id").notNull().references(() => buildings.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  name: text("name").notNull(),
  x: integer("x").notNull(),
  y: integer("y").notNull(),
  width: integer("width").notNull().default(2),
  depth: integer("depth").notNull().default(2),
  staff: integer("staff").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const bots = pgTable("bots", {
  id: text("id").primaryKey(),
  pilotId: text("pilot_id").notNull().references(() => pilots.id, { onDelete: "cascade" }),
  role: text("role").$type<BotRole>().notNull(),
  name: text("name").notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  directive: text("directive").notNull(),
  autonomy: integer("autonomy").notNull().default(35),
  active: boolean("active").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("bots_role_idx").on(table.pilotId, table.role)]);

export const tileCache = pgTable("tile_cache", {
  z: integer("z").notNull(),
  x: integer("x").notNull(),
  y: integer("y").notNull(),
  pngBase64: text("png_base64").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  source: text("source").notNull().default("osm"),
}, (table) => [primaryKey({ columns: [table.z, table.x, table.y] })]);

export const events = pgTable("events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  pilotId: text("pilot_id").notNull().references(() => pilots.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  message: text("message").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("events_pilot_idx").on(table.pilotId, table.id)]);

export const assaults = pgTable("assaults", {
  id: text("id").primaryKey(),
  parcelId: text("parcel_id").notNull().references(() => parcels.id, { onDelete: "cascade" }),
  report: jsonb("report").$type<AssaultReport>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});



export const pilotsRelations = relations(pilots, ({ one, many }) => ({
  parcel: one(parcels),
  bots: many(bots),
  events: many(events),
}));
export const parcelsRelations = relations(parcels, ({ one, many }) => ({
  pilot: one(pilots, { fields: [parcels.pilotId], references: [pilots.id] }),
  structures: many(structures),
  buildings: many(buildings),
  assaults: many(assaults),
}));
export const buildingsRelations = relations(buildings, ({ one, many }) => ({
  parcel: one(parcels, { fields: [buildings.parcelId], references: [parcels.id] }),
  rooms: many(rooms),
}));
