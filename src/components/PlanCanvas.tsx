"use client";

import { useEffect, useRef } from "react";
import { PlanRenderer } from "@/renderer/PlanRenderer";
import type { BuildingDTO, ParcelDTO, StructureDTO } from "@/lib/types";

export function PlanCanvas({ parcel, buildings, structures, building, selectedId, onSelect }: {
  parcel?: ParcelDTO;
  buildings?: BuildingDTO[];
  structures?: StructureDTO[];
  building?: BuildingDTO;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const renderer = useRef<PlanRenderer | null>(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  useEffect(() => {
    if (!container.current) return;
    const instance = new PlanRenderer(container.current, (id) => selectRef.current(id));
    renderer.current = instance;
    return () => { instance.dispose(); renderer.current = null; };
  }, []);
  useEffect(() => {
    if (building) renderer.current?.setBuilding(building, selectedId);
    else if (parcel && buildings && structures) renderer.current?.setArea(parcel, buildings, structures, selectedId);
  }, [parcel, buildings, structures, building, selectedId]);
  return <div ref={container} className="absolute inset-0" />;
}
