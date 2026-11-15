"use client";

import type { MouseEvent } from "react";
import { BUILDING_GRID_SIZE, getRoomDefinition } from "@/engine/rooms";
import type { BuildingDTO } from "@/lib/types";

export function BuildingLayout({ building, selectedRoomId, onSelectRoom, onPlace }: {
  building: BuildingDTO;
  selectedRoomId: string | null;
  onSelectRoom: (id: string) => void;
  onPlace: (cell: { x: number; y: number }) => void;
}) {
  const click = (event: MouseEvent<SVGSVGElement>): void => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(BUILDING_GRID_SIZE - 1, Math.floor((event.clientX - bounds.left) / bounds.width * BUILDING_GRID_SIZE)));
    const y = Math.max(0, Math.min(BUILDING_GRID_SIZE - 1, Math.floor((event.clientY - bounds.top) / bounds.height * BUILDING_GRID_SIZE)));
    onPlace({ x, y });
  };
  return (
    <svg viewBox="-0.5 -0.5 13 13" className="layout-svg" onClick={click} role="img" aria-label="Interactive 12 by 12 building room layout">
      <defs><pattern id="room-grid" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M1 0H0V1" fill="none" stroke="currentColor" strokeWidth="0.025" opacity="0.24" /></pattern></defs>
      <rect width="12" height="12" fill="rgba(12,24,22,0.82)" />
      <rect width="12" height="12" fill="url(#room-grid)" className="text-accent" />
      {building.rooms.map((room) => {
        const definition = getRoomDefinition(room.kind);
        const selected = selectedRoomId === room.id;
        return <g key={room.id} onClick={(event) => { event.stopPropagation(); onSelectRoom(room.id); }} className="cursor-pointer" role="button" aria-label={`Select ${room.name}`}>
          <rect x={room.x + 0.08} y={room.y + 0.08} width={room.width - 0.16} height={room.depth - 0.16} fill={definition.color} fillOpacity={selected ? 0.88 : 0.55} stroke={selected ? "#fff1a8" : definition.color} strokeWidth={selected ? 0.13 : 0.07} />
          <path d={`M${room.x + 0.25} ${room.y + 0.28} H${room.x + room.width - 0.25}`} stroke="rgba(8,17,16,0.55)" strokeWidth="0.09" />
          <text x={room.x + room.width / 2} y={room.y + room.depth / 2} textAnchor="middle" dominantBaseline="middle" fontSize={room.width < 3.5 ? 0.31 : 0.38} fontWeight="700" fill="#13201d" pointerEvents="none">{room.name.toUpperCase()}</text>
          <text x={room.x + room.width / 2} y={room.y + room.depth / 2 + 0.45} textAnchor="middle" fontSize="0.25" fill="#24332f" pointerEvents="none">{room.staff} STAFF</text>
          <path d={`M${room.x + room.width / 2 - 0.25} ${room.y + room.depth} h0.5`} stroke="#f3e5af" strokeWidth="0.12" />
        </g>;
      })}
      <rect x="0" y="0" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="0.16" className="text-accent" pointerEvents="none" />
      <path d="M5.5 0h1" stroke="#f2d98c" strokeWidth="0.22" pointerEvents="none" />
    </svg>
  );
}
