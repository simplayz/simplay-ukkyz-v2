import type { BotRole } from "@/engine/ai";
import type { StructureType } from "@/engine/catalogue";
import type { AssaultReport, SimulationTotals } from "@/engine/simulation";
import type { SurveyCell, TerrainScores } from "@/engine/terrain";

export type PilotDTO = {
  id: string;
  callSign: string;
  seed: number;
  homeLat: number;
  homeLon: number;
  credits: number;
  createdAt: string;
};

export type ParcelDTO = {
  id: string;
  pilotId: string;
  name: string;
  seed: number;
  centerX: number;
  centerY: number;
  lat: number;
  lon: number;
  areaM2: number;
  scores: TerrainScores;
  cells: SurveyCell[];
  lockedUntil: string;
  lastTickAt: string;
  createdAt: string;
};

export type StructureDTO = {
  id: string;
  parcelId: string;
  type: StructureType;
  gx: number;
  gy: number;
  rotation: number;
  level: number;
};

export type RoomDTO = {
  id: string;
  buildingId: string;
  kind: string;
  name: string;
  x: number;
  y: number;
  width: number;
  depth: number;
  staff: number;
};

export type BuildingDTO = {
  id: string;
  parcelId: string;
  structureId: string | null;
  name: string;
  archetype: string;
  gx: number;
  gy: number;
  width: number;
  depth: number;
  level: number;
  rooms: RoomDTO[];
};

export type BotDTO = {
  id: string;
  pilotId: string;
  role: BotRole;
  name: string;
  provider: string;
  model: string;
  directive: string;
  autonomy: number;
  active: boolean;
  updatedAt: string;
};

export type EventDTO = {
  id: number;
  kind: string;
  message: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
};

export type AssaultDTO = { id: string; report: AssaultReport; createdAt: string };

export type WorldSnapshot = {
  pilot: PilotDTO;
  parcel: ParcelDTO | null;
  structures: StructureDTO[];
  buildings: BuildingDTO[];
  bots: BotDTO[];
  totals: SimulationTotals;
  events: EventDTO[];
  assaults: AssaultDTO[];
  serverTime: string;
  ticksApplied: number;
};

export type ApiFailure = { error: string };
