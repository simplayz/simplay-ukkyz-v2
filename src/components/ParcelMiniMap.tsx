"use client";

import { useEffect, useRef } from "react";
import { getStructureDefinition } from "@/engine/catalogue";
import { PARCEL_GRID_SIZE } from "@/engine/geodesy";
import { BIOMES } from "@/engine/terrain";
import type { BuildingDTO, ParcelDTO, StructureDTO } from "@/lib/types";

const colors = ["#194e67", "#32768b", "#4b91a4", "#96998d", "#527c69", "#85857e", "#a39b7f", "#9ca09c", "#7e8b82", "#355c49", "#285c42", "#48734f", "#7f9458", "#68875c"];

export function ParcelMiniMap({ parcel, buildings, structures, selectedBuildingId, focusBuilding, onSelectCell }: {
  parcel: ParcelDTO;
  buildings: BuildingDTO[];
  structures: StructureDTO[];
  selectedBuildingId?: string | null;
  focusBuilding?: BuildingDTO | null;
  onSelectCell?: (cell: { x: number; y: number }) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const size = canvas.width;
    const cellSize = size / PARCEL_GRID_SIZE;
    context.clearRect(0, 0, size, size);
    parcel.cells.forEach((cell, index) => {
      const x = index % PARCEL_GRID_SIZE;
      const y = Math.floor(index / PARCEL_GRID_SIZE);
      context.fillStyle = colors[cell.b] ?? "#68875c";
      context.fillRect(x * cellSize, y * cellSize, Math.ceil(cellSize), Math.ceil(cellSize));
      if (cell.h > 500) {
        context.fillStyle = `rgba(230,235,219,${Math.min(0.35, cell.h / 3500)})`;
        context.fillRect(x * cellSize, y * cellSize, Math.ceil(cellSize), Math.ceil(cellSize));
      }
    });
    context.strokeStyle = "rgba(235,238,214,0.09)";
    context.lineWidth = 1;
    for (let line = 0; line <= PARCEL_GRID_SIZE; line += 8) {
      context.beginPath(); context.moveTo(line * cellSize, 0); context.lineTo(line * cellSize, size); context.stroke();
      context.beginPath(); context.moveTo(0, line * cellSize); context.lineTo(size, line * cellSize); context.stroke();
    }
    for (const structure of structures) {
      if (buildings.some((building) => building.structureId === structure.id)) continue;
      context.fillStyle = getStructureDefinition(structure.type).color;
      context.fillRect((structure.gx + 0.2) * cellSize, (structure.gy + 0.2) * cellSize, Math.max(2, cellSize * 0.6), Math.max(2, cellSize * 0.6));
    }
    for (const building of buildings) {
      context.fillStyle = getStructureDefinition(building.archetype).color;
      context.fillRect(building.gx * cellSize, building.gy * cellSize, building.width * cellSize, building.depth * cellSize);
      context.strokeStyle = selectedBuildingId === building.id || focusBuilding?.id === building.id ? "#fff1a8" : "rgba(8,16,15,0.7)";
      context.lineWidth = selectedBuildingId === building.id || focusBuilding?.id === building.id ? 3 : 1;
      context.strokeRect(building.gx * cellSize, building.gy * cellSize, building.width * cellSize, building.depth * cellSize);
    }
    if (focusBuilding) {
      const cx = (focusBuilding.gx + focusBuilding.width / 2) * cellSize;
      const cy = (focusBuilding.gy + focusBuilding.depth / 2) * cellSize;
      context.strokeStyle = "#fff1a8";
      context.lineWidth = 1;
      context.beginPath(); context.arc(cx, cy, 18, 0, Math.PI * 2); context.stroke();
      context.beginPath(); context.moveTo(cx - 25, cy); context.lineTo(cx + 25, cy); context.moveTo(cx, cy - 25); context.lineTo(cx, cy + 25); context.stroke();
    }
    context.fillStyle = "rgba(238,238,214,0.8)";
    context.font = "10px monospace";
    context.fillText(`N  ${BIOMES.length} BIOME SURVEY`, 10, 17);
  }, [parcel, buildings, structures, selectedBuildingId, focusBuilding]);

  return <canvas ref={canvasRef} width={512} height={512} className="layout-svg" onClick={(event) => {
    if (!onSelectCell) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.floor((event.clientX - bounds.left) / bounds.width * PARCEL_GRID_SIZE);
    const y = Math.floor((event.clientY - bounds.top) / bounds.height * PARCEL_GRID_SIZE);
    if (x >= 0 && y >= 0 && x < PARCEL_GRID_SIZE && y < PARCEL_GRID_SIZE) onSelectCell({ x, y });
  }} />;
}
