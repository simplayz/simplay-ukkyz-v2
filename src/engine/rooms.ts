export const BUILDING_GRID_SIZE = 12;

export type RoomDefinition = {
  kind: string;
  label: string;
  description: string;
  color: string;
  width: number;
  depth: number;
  height: number;
  staff: number;
  cost: number;
};

export const ROOM_CATALOGUE = [
  { kind: "reception", label: "Reception", description: "Required public intake and visitor coordination.", color: "#e9bd73", width: 4, depth: 4, height: 3.2, staff: 1, cost: 0 },
  { kind: "guard", label: "Guard Post", description: "Required security coverage and siege muster point.", color: "#e66f62", width: 4, depth: 4, height: 3.4, staff: 1, cost: 0 },
  { kind: "office", label: "Operations Office", description: "Flexible desks for planning and administration.", color: "#a99be8", width: 3, depth: 3, height: 3, staff: 3, cost: 240 },
  { kind: "server", label: "Server Room", description: "Technical racks supporting the assigned AI officers.", color: "#63b8dc", width: 3, depth: 3, height: 3.1, staff: 1, cost: 420 },
  { kind: "workshop", label: "Workshop", description: "Fabrication and maintenance benches.", color: "#d88d66", width: 4, depth: 3, height: 3.8, staff: 2, cost: 360 },
  { kind: "quarters", label: "Crew Quarters", description: "Bunks and lockers for on-site crews.", color: "#8ba6cf", width: 4, depth: 3, height: 3, staff: 0, cost: 280 },
  { kind: "storage", label: "Storage", description: "Secure supplies and equipment inventory.", color: "#a69a7e", width: 3, depth: 3, height: 3.5, staff: 0, cost: 180 },
  { kind: "clinic", label: "Infirmary", description: "Treatment beds and emergency medical coverage.", color: "#df8f9d", width: 3, depth: 4, height: 3.1, staff: 2, cost: 390 },
  { kind: "generator", label: "Generator Room", description: "Local backup power and distribution.", color: "#68c6a5", width: 3, depth: 3, height: 3.3, staff: 1, cost: 440 },
] as const satisfies readonly RoomDefinition[];

export type RoomKind = (typeof ROOM_CATALOGUE)[number]["kind"];

export function isRoomKind(value: unknown): value is RoomKind {
  return typeof value === "string" && ROOM_CATALOGUE.some((room) => room.kind === value);
}

export function getRoomDefinition(kind: string): RoomDefinition {
  const definition = ROOM_CATALOGUE.find((room) => room.kind === kind);
  if (!definition) throw new Error(`Unknown room kind: ${kind}`);
  return definition;
}

export type RoomLike = { kind: string; staff: number; x: number; y: number; width: number; depth: number };

export function roomsOverlap(a: RoomLike, b: RoomLike): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.depth && a.y + a.depth > b.y;
}

export function computeBuildingStats(rooms: readonly RoomLike[]): { staff: number; guards: number; receptionists: number; coverage: number; valid: boolean } {
  const staff = rooms.reduce((sum, room) => sum + room.staff, 0);
  const guards = rooms.filter((room) => room.kind === "guard").reduce((sum, room) => sum + Math.max(1, room.staff), 0);
  const receptionists = rooms.filter((room) => room.kind === "reception").reduce((sum, room) => sum + Math.max(1, room.staff), 0);
  const specialistRooms = rooms.filter((room) => !["guard", "reception"].includes(room.kind)).length;
  const coverage = Math.min(100, guards * 24 + receptionists * 20 + specialistRooms * 7);
  return { staff, guards, receptionists, coverage, valid: guards >= 1 && receptionists >= 1 };
}
