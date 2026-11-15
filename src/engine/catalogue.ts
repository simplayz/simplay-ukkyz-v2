import type { TerrainScores } from "./terrain";

export type StructureCategory = "civic" | "production" | "utility" | "defence" | "culture";

export type StructureDefinition = {
  type: string;
  label: string;
  short: string;
  category: StructureCategory;
  description: string;
  cost: number;
  income: number;
  upkeep: number;
  food: number;
  power: number;
  defence: number;
  prestige: number;
  affinity: keyof TerrainScores;
  color: string;
  height: number;
  site: boolean;
};

export const STRUCTURE_CATALOGUE = [
  { type: "command", label: "Command Pavilion", short: "CMD", category: "civic", description: "Coordinates the claim and anchors a multi-room command site.", cost: 2400, income: 45, upkeep: 12, food: -2, power: -6, defence: 8, prestige: 12, affinity: "build", color: "#f0b35a", height: 24, site: true },
  { type: "habitat", label: "Habitat Stack", short: "HAB", category: "civic", description: "Dense crew quarters. Consumes food but grows the settlement.", cost: 900, income: 12, upkeep: 5, food: -6, power: -3, defence: 1, prestige: 2, affinity: "build", color: "#c9a6ff", height: 30, site: true },
  { type: "hydroponics", label: "Hydroponic Gallery", short: "HYD", category: "production", description: "Closed-loop crops whose yield follows the hydro score.", cost: 1100, income: 20, upkeep: 8, food: 14, power: -5, defence: 0, prestige: 1, affinity: "hydro", color: "#5ee7b0", height: 14, site: true },
  { type: "solar_array", label: "Solar Array", short: "SOL", category: "utility", description: "Low-profile generation suited to gentle, buildable land.", cost: 700, income: 0, upkeep: 3, food: 0, power: 14, defence: 0, prestige: 1, affinity: "build", color: "#62b9e9", height: 5, site: false },
  { type: "wind_turbine", label: "Wind Turbine", short: "WND", category: "utility", description: "High relief improves exposure and electrical output.", cost: 950, income: 0, upkeep: 4, food: 0, power: 18, defence: 0, prestige: 2, affinity: "elevation", color: "#d9edf0", height: 44, site: false },
  { type: "tidal_generator", label: "Tidal Generator", short: "TID", category: "utility", description: "Drainage and shoreline access drive reliable generation.", cost: 1400, income: 8, upkeep: 7, food: 0, power: 24, defence: 0, prestige: 2, affinity: "hydro", color: "#4bc5d4", height: 11, site: false },
  { type: "farm", label: "Terrace Farm", short: "FRM", category: "production", description: "Soil, water and gentle grades combine into food output.", cost: 650, income: 12, upkeep: 4, food: 18, power: -2, defence: 0, prestige: 0, affinity: "farm", color: "#9fcf69", height: 7, site: true },
  { type: "mine", label: "Deep Mine", short: "MIN", category: "production", description: "Extracts ore; rugged elevated parcels yield more income.", cost: 1250, income: 42, upkeep: 11, food: -1, power: -6, defence: 1, prestige: 0, affinity: "elevation", color: "#a89b8d", height: 16, site: false },
  { type: "lumber_camp", label: "Lumber Camp", short: "LMB", category: "production", description: "Managed canopy harvesting with forestry-driven yield.", cost: 700, income: 24, upkeep: 6, food: 2, power: -2, defence: 0, prestige: 0, affinity: "forest", color: "#73945b", height: 10, site: false },
  { type: "factory", label: "Fabrication Works", short: "FAB", category: "production", description: "A power-hungry fabrication line and configurable industrial site.", cost: 1800, income: 68, upkeep: 18, food: -3, power: -12, defence: 0, prestige: 2, affinity: "build", color: "#e68b64", height: 25, site: true },
  { type: "market", label: "Exchange Market", short: "MKT", category: "civic", description: "Converts accessible land and settlement activity into trade.", cost: 1300, income: 52, upkeep: 10, food: -4, power: -5, defence: 0, prestige: 4, affinity: "build", color: "#f2ce6e", height: 17, site: true },
  { type: "laboratory", label: "Research Laboratory", short: "LAB", category: "civic", description: "A research site that turns infrastructure into prestige.", cost: 2000, income: 36, upkeep: 16, food: -2, power: -10, defence: 0, prestige: 9, affinity: "build", color: "#8f9cff", height: 21, site: true },
  { type: "clinic", label: "Field Clinic", short: "MED", category: "civic", description: "Supports crews and provides a staffed public interior.", cost: 1500, income: 8, upkeep: 12, food: -5, power: -7, defence: 0, prestige: 5, affinity: "build", color: "#ef8f9b", height: 18, site: true },
  { type: "barracks", label: "Guard Barracks", short: "BRK", category: "defence", description: " Houses trained guards; natural defence improves its muster.", cost: 1600, income: 0, upkeep: 14, food: -6, power: -5, defence: 20, prestige: 4, affinity: "defence", color: "#d66d64", height: 16, site: true },
  { type: "rampart", label: "Terrain Rampart", short: "WAL", category: "defence", description: "Low-cost fortification amplified by slopes and elevation.", cost: 450, income: 0, upkeep: 2, food: 0, power: 0, defence: 12, prestige: 0, affinity: "defence", color: "#8e8175", height: 8, site: false },
  { type: "turret", label: "Sentry Turret", short: "TRT", category: "defence", description: "Powered autonomous defence with a strong terrain bonus.", cost: 1000, income: 0, upkeep: 7, food: 0, power: -4, defence: 28, prestige: 1, affinity: "defence", color: "#ef745f", height: 15, site: false },
  { type: "radar", label: "Radar Mast", short: "RDR", category: "defence", description: "Extends warning time and contributes to siege defence.", cost: 1200, income: 5, upkeep: 8, food: 0, power: -6, defence: 8, prestige: 6, affinity: "defence", color: "#c6b8e8", height: 38, site: false },
  { type: "monument", label: "Survey Monument", short: "MON", category: "culture", description: "A civic landmark that makes the claim worth attacking.", cost: 1750, income: 10, upkeep: 4, food: 0, power: -2, defence: 0, prestige: 20, affinity: "build", color: "#f0dfb2", height: 35, site: false },
] as const satisfies readonly StructureDefinition[];

export type StructureType = (typeof STRUCTURE_CATALOGUE)[number]["type"];
export type PlacedStructure = { type: StructureType; level?: number };

export function isStructureType(value: unknown): value is StructureType {
  return typeof value === "string" && STRUCTURE_CATALOGUE.some((entry) => entry.type === value);
}

export function getStructureDefinition(type: string): StructureDefinition {
  const definition = STRUCTURE_CATALOGUE.find((entry) => entry.type === type);
  if (!definition) throw new Error(`Unknown structure type: ${type}`);
  return definition;
}
