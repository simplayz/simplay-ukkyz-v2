const enc = encodeURIComponent;

export const pages = {
  world: () => "/" as const,
  area: (userId: string, areaId: string) =>
    `/user/${enc(userId)}/area/${enc(areaId)}` as const,
  building: (userId: string, areaId: string, buildingId: string) =>
    `/user/${enc(userId)}/area/${enc(areaId)}/building/${enc(buildingId)}` as const,
  aiManagement: (userId: string) =>
    `/user/${enc(userId)}/ai/management` as const,
} as const;

export const api = {
  pilots: () => "/api/pilots" as const,
  pilot: (pilotId: string) => `/api/pilots/${enc(pilotId)}` as const,
  pilotClaim: (pilotId: string) => `/api/pilots/${enc(pilotId)}/claim` as const,
  pilotStructures: (pilotId: string) => `/api/pilots/${enc(pilotId)}/structures` as const,
  pilotBot: (pilotId: string, botId: string) =>
    `/api/pilots/${enc(pilotId)}/bots/${enc(botId)}` as const,
  structure: (structureId: string, pilotId: string) =>
    `/api/structures/${enc(structureId)}?pilotId=${enc(pilotId)}` as const,
  buildingRooms: (buildingId: string, pilotId: string) =>
    `/api/buildings/${enc(buildingId)}/rooms?pilotId=${enc(pilotId)}` as const,
  room: (roomId: string, pilotId: string) =>
    `/api/rooms/${enc(roomId)}?pilotId=${enc(pilotId)}` as const,
  parcelAssault: (parcelId: string, pilotId: string) =>
    `/api/parcels/${enc(parcelId)}/assault?pilotId=${enc(pilotId)}` as const,
  tile: (z: number, x: number, y: number) =>
    `/api/tiles/${z}/${x}/${y}.png` as const,
  stream: (pilotId: string, after = 0) =>
    `/api/stream?pilot=${enc(pilotId)}&after=${after}` as const,
  health: () => "/api/health" as const,
} as const;
