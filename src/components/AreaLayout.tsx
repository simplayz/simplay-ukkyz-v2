"use client";

import type { MouseEvent } from "react";
import { getStructureDefinition } from "@/engine/catalogue";
import { PARCEL_GRID_SIZE } from "@/engine/geodesy";
import type { BuildingDTO, StructureDTO } from "@/lib/types";

export function AreaLayout({ buildings, structures, selectedBuildingId, onSelectBuilding, onPlace }: {
  buildings: BuildingDTO[];
  structures: StructureDTO[];
  selectedBuildingId: string | null;
  onSelectBuilding: (id: string) => void;
  onPlace: (cell: { x: number; y: number }) => void;
}) {
  const click = (event: MouseEvent<SVGSVGElement>): void => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(63, Math.floor((event.clientX - bounds.left) / bounds.width * PARCEL_GRID_SIZE)));
    const y = Math.max(0, Math.min(63, Math.floor((event.clientY - bounds.top) / bounds.height * PARCEL_GRID_SIZE)));
    onPlace({ x, y });
  };
  return (
    <svg className="layout-svg" viewBox="0 0 64 64" onClick={click} role="img" aria-label="Interactive 64 by 64 area development layout">
      <defs>
        <pattern id="minor-grid" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M 1 0 L 0 0 0 1" fill="none" stroke="currentColor" strokeWidth="0.025" opacity="0.2" /></pattern>
        <pattern id="major-grid" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="url(#minor-grid)" /><path d="M 8 0 L 0 0 0 8" fill="none" stroke="currentColor" strokeWidth="0.07" opacity="0.32" /></pattern>
      </defs>
      <rect width="64" height="64" fill="rgba(10,22,20,0.76)" />
      <rect width="64" height="64" fill="url(#major-grid)" className="text-accent" />
      <path d="M0 32 H64 M32 0 V64" stroke="currentColor" strokeWidth="0.12" opacity="0.28" className="text-accent" strokeDasharray="0.5 0.4" />
      {structures.filter((structure) => !buildings.some((building) => building.structureId === structure.id)).map((structure) => {
        const definition = getStructureDefinition(structure.type);
        return <g key={structure.id} pointerEvents="none"><rect x={structure.gx + 0.2} y={structure.gy + 0.2} width="0.6" height="0.6" fill={definition.color} /><circle cx={structure.gx + 0.5} cy={structure.gy + 0.5} r="0.48" fill="none" stroke={definition.color} strokeWidth="0.06" /></g>;
      })}
      {buildings.map((building) => {
        const definition = getStructureDefinition(building.archetype);
        const selected = selectedBuildingId === building.id;
        return (
          <g key={building.id} onClick={(event) => { event.stopPropagation(); onSelectBuilding(building.id); }} className="cursor-pointer" role="button" aria-label={`Select ${building.name}`}>
            <rect x={building.gx + 0.08} y={building.gy + 0.08} width={building.width - 0.16} height={building.depth - 0.16} fill={definition.color} fillOpacity={selected ? 0.92 : 0.67} stroke={selected ? "#fff0a8" : definition.color} strokeWidth={selected ? 0.16 : 0.08} />
            <path d={`M${building.gx + 0.25} ${building.gy + 0.45} H${building.gx + building.width - 0.25} M${building.gx + 0.25} ${building.gy + 0.75} H${building.gx + building.width - 0.75}`} stroke="rgba(10,20,18,0.55)" strokeWidth="0.09" />
            <text x={building.gx + building.width / 2} y={building.gy + building.depth / 2 + 0.25} textAnchor="middle" fontSize="0.65" fontWeight="800" fill="#13201d" pointerEvents="none">{definition.short}</text>
          </g>
        );
      })}
      <rect x="0.1" y="0.1" width="63.8" height="63.8" fill="none" stroke="currentColor" strokeWidth="0.2" className="text-accent" pointerEvents="none" />
    </svg>
  );
}
