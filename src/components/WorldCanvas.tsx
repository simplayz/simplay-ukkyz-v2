"use client";

import { useEffect, useRef } from "react";
import type { WorldPoint } from "@/engine/geodesy";
import { WorldRenderer, type RenderMode } from "@/renderer/WorldRenderer";
import type { ParcelDTO, StructureDTO } from "@/lib/types";

export function WorldCanvas({ seed, center, parcel, structures, mode, hoveredCell, onHoverCell, onPickCell, onPickStructure, onTileStatus }: {
  seed: number;
  center: WorldPoint;
  parcel: ParcelDTO | null;
  structures: StructureDTO[];
  mode: RenderMode;
  hoveredCell: { x: number; y: number } | null;
  onHoverCell: (cell: { x: number; y: number } | null) => void;
  onPickCell: (cell: { x: number; y: number }) => void;
  onPickStructure: (id: string) => void;
  onTileStatus: (loaded: number, total: number) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const renderer = useRef<WorldRenderer | null>(null);
  const callbacks = useRef({ onHoverCell, onPickCell, onPickStructure, onTileStatus });
  callbacks.current = { onHoverCell, onPickCell, onPickStructure, onTileStatus };
  const initial = useRef({ seed, center, parcel, structures, mode });

  useEffect(() => {
    if (!container.current) return;
    const instance = new WorldRenderer(container.current, initial.current, {
      onHoverCell: (cell) => callbacks.current.onHoverCell(cell),
      onPickCell: (cell) => callbacks.current.onPickCell(cell),
      onPickStructure: (id) => callbacks.current.onPickStructure(id),
      onTileStatus: (loaded, total) => callbacks.current.onTileStatus(loaded, total),
    });
    renderer.current = instance;
    return () => { instance.dispose(); renderer.current = null; };
  }, []);

  useEffect(() => {
    renderer.current?.update({ seed, center, parcel, structures, mode });
  }, [seed, center, parcel, structures, mode]);

  useEffect(() => { renderer.current?.setHoveredCell(hoveredCell); }, [hoveredCell]);
  return <div ref={container} className="absolute inset-0" />;
}
