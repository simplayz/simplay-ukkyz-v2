"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Bot, Building2, Coins, Grid3X3, Map, MousePointer2, ShieldCheck, Users, X } from "lucide-react";
import { AppHeader } from "./AppHeader";
import { AreaLayout } from "./AreaLayout";
import { ParcelMiniMap } from "./ParcelMiniMap";
import { PlanCanvas } from "./PlanCanvas";
import { STRUCTURE_CATALOGUE, getStructureDefinition, type StructureType } from "@/engine/catalogue";
import { computeBuildingStats } from "@/engine/rooms";
import { apiRequest, formatNumber } from "@/lib/client";
import { api, pages } from "@/lib/routes";
import type { WorldSnapshot } from "@/lib/types";
import { useWorldConnection } from "@/hooks/useWorldConnection";
import { useWorldStore } from "@/store/useWorldStore";

export function AreaApp({ userId, areaId }: { userId: string; areaId: string }) {
  const storedPilotId = useWorldStore((state) => state.pilotId);
  const setPilotId = useWorldStore((state) => state.setPilotId);
  const setSnapshot = useWorldStore((state) => state.setSnapshot);
  const notify = useWorldStore((state) => state.notify);
  const { snapshot, loading, error } = useWorldConnection(userId);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [selectedBuild, setSelectedBuild] = useState<StructureType | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (storedPilotId !== userId) setPilotId(userId); }, [storedPilotId, userId, setPilotId]);
  useEffect(() => {
    if (!selectedBuildingId && snapshot?.buildings[0]) setSelectedBuildingId(snapshot.buildings[0].id);
    if (selectedBuildingId && snapshot && !snapshot.buildings.some((building) => building.id === selectedBuildingId)) setSelectedBuildingId(snapshot.buildings[0]?.id ?? null);
  }, [snapshot, selectedBuildingId]);

  if (loading && !snapshot) return <><AppHeader active="area" /><div className="loading-screen">Loading frozen area survey…</div></>;
  if (!snapshot?.parcel || snapshot.parcel.id !== areaId) return <><AppHeader pilotId={userId} active="area" /><div className="empty-state">{error ?? "This area does not belong to the requested pilot."}<div className="mt-4"><Link className="button" href={pages.world()}>Return to world</Link></div></div></>;
  const parcel = snapshot.parcel;
  const selectedBuilding = snapshot.buildings.find((building) => building.id === selectedBuildingId) ?? null;
  const selectedStats = selectedBuilding ? computeBuildingStats(selectedBuilding.rooms) : null;
  const siteCatalogue = STRUCTURE_CATALOGUE.filter((entry) => entry.site);

  const place = async (cell: { x: number; y: number }): Promise<void> => {
    if (!selectedBuild || busy) return;
    setBusy(true);
    try {
      const next = await apiRequest<WorldSnapshot>(api.pilotStructures(userId), { method: "POST", body: JSON.stringify({ type: selectedBuild, gx: cell.x, gy: cell.y, rotation: 0 }) });
      setSnapshot(next);
      const created = next.structures.find((structure) => structure.gx === cell.x && structure.gy === cell.y && structure.type === selectedBuild);
      const building = next.buildings.find((entry) => entry.structureId === created?.id);
      if (building) setSelectedBuildingId(building.id);
      notify(`${getStructureDefinition(selectedBuild).label} and its required staff rooms commissioned.`, "success");
    } catch (caught) { notify(caught instanceof Error ? caught.message : "Commission failed", "error"); }
    finally { setBusy(false); }
  };

  return (
    <main className="page-shell">
      <AppHeader pilotId={userId} areaId={areaId} buildingId={selectedBuildingId ?? snapshot.buildings[0]?.id} active="area" />
      <div className="page-main">
        <div className="breadcrumbs"><Link href={pages.world()}><ArrowLeft size={12} />World</Link><span>/</span><span>{snapshot.pilot.callSign}</span><span>/</span><span>{parcel.name}</span></div>
        <div className="page-title">
          <div><div className="eyebrow">Player area / 40,960,000 m²</div><h1>{parcel.name}</h1><p>{snapshot.buildings.length} building sites · {snapshot.structures.length} total structures · seed <span className="mono">{parcel.seed}</span></p></div>
          <div className="hud-actions"><span className="button ghost"><Coins size={15} />{formatNumber(snapshot.pilot.credits)}</span><Link className="button" href={pages.aiManagement(userId)}><Bot size={14} />Manage officers</Link></div>
        </div>

        <div className="dashboard-grid three">
          <div className="stack">
            <section className="glass-panel">
              <div className="panel-pad pb-3"><div className="panel-heading !mb-0"><div><div className="eyebrow">2D Area Mini Map</div><h2>Survey index</h2></div><Map size={18} className="text-accent" /></div></div>
              <div className="map-frame"><ParcelMiniMap parcel={parcel} buildings={snapshot.buildings} structures={snapshot.structures} selectedBuildingId={selectedBuildingId} onSelectCell={selectedBuild ? (cell) => void place(cell) : undefined} /><div className="map-legend glass-panel"><span><i className="legend-dot" style={{ background: "#4b91a4" }} />Water</span><span><i className="legend-dot" style={{ background: "#68875c" }} />Land</span><span><i className="legend-dot" style={{ background: "#e6c879" }} />Sites</span></div></div>
            </section>
            <section className="glass-panel panel-pad">
              <div className="panel-heading"><div><div className="eyebrow">Persistent entities</div><h3>Building register</h3></div><Building2 size={17} className="text-accent" /></div>
              {snapshot.buildings.length ? <div className="building-list">{snapshot.buildings.map((building) => {
                const stats = computeBuildingStats(building.rooms);
                return <div className={`building-row ${selectedBuildingId === building.id ? "border-accent" : ""}`} key={building.id}>
                  <button className="text-left flex-1 cursor-pointer border-0 bg-transparent" onClick={() => setSelectedBuildingId(building.id)}><strong className="block text-xs">{building.name}</strong><span className="tiny muted">{building.rooms.length} rooms · {stats.staff} staff · grid {building.gx + 1}:{building.gy + 1}</span></button>
                  <Link className="button icon" href={pages.building(userId, areaId, building.id)} aria-label={`Open ${building.name}`}><ArrowRight size={14} /></Link>
                </div>;
              })}</div> : <div className="empty-state">No building sites yet. Select a civic or production site and click the layout.</div>}
            </section>
          </div>

          <div className="stack">
            <section className="glass-panel">
              <div className="panel-pad pb-3"><div className="panel-heading !mb-0"><div><div className="eyebrow">2D Area Layout Plan</div><h2>Development grid</h2></div><Grid3X3 size={18} className="text-accent" /></div></div>
              <AreaLayout buildings={snapshot.buildings} structures={snapshot.structures} selectedBuildingId={selectedBuildingId} onSelectBuilding={(id) => { setSelectedBuildingId(id); setSelectedBuild(null); }} onPlace={(cell) => void place(cell)} />
              <div className="p-3 tiny muted border-t border-line">{selectedBuild ? `Placement armed: click a free cell for ${getStructureDefinition(selectedBuild).label}.` : "Select a building to inspect it, or arm a site below to commission."}</div>
            </section>
            <section className="glass-panel panel-pad">
              <div className="panel-heading"><div><div className="eyebrow">Shared catalogue / site-capable</div><h3>Commission a building</h3></div><MousePointer2 size={17} className="text-accent" /></div>
              <div className="grid grid-cols-2 gap-2">{siteCatalogue.map((entry) => <button key={entry.type} className={`catalogue-item !border ${selectedBuild === entry.type ? "active" : ""}`} onClick={() => setSelectedBuild(selectedBuild === entry.type ? null : entry.type)}><span className="catalogue-swatch" style={{ background: entry.color }}>{entry.short}</span><span><strong>{entry.label}</strong><small>Reception + guard included</small></span><span className="catalogue-cost">{formatNumber(entry.cost)}</span></button>)}</div>
              {selectedBuild && <div className="selection-card mt-3 flex items-center gap-2"><MousePointer2 size={14} />Click either 2D plan to place.<button className="button icon ghost ml-auto" onClick={() => setSelectedBuild(null)}><X size={13} /></button></div>}
            </section>
          </div>

          <div className="stack">
            <section className="glass-panel">
              <div className="panel-pad pb-3"><div className="panel-heading !mb-0"><div><div className="eyebrow">3D Interactive Preview</div><h2>Survey massing</h2></div><span className="tiny muted">ORBIT / ZOOM / SELECT</span></div></div>
              <div className="map-frame preview"><PlanCanvas parcel={parcel} buildings={snapshot.buildings} structures={snapshot.structures} selectedId={selectedBuildingId} onSelect={(id) => { setSelectedBuildingId(id); setSelectedBuild(null); }} /></div>
            </section>
            {selectedBuilding && selectedStats ? (
              <section className="glass-panel panel-pad">
                <div className="eyebrow">Selected building site</div><div className="panel-heading"><h2>{selectedBuilding.name}</h2><Building2 size={18} className="text-accent" /></div>
                <p className="tiny muted">{getStructureDefinition(selectedBuilding.archetype).description}</p>
                <div className="metric-grid mt-3"><div className="metric"><span>Rooms</span><strong>{selectedBuilding.rooms.length}</strong></div><div className="metric"><span>Staff</span><strong>{selectedStats.staff}</strong></div><div className="metric"><span>Coverage</span><strong>{selectedStats.coverage}%</strong></div></div>
                <div className="flex gap-4 mt-3 tiny muted"><span className="flex items-center gap-1"><ShieldCheck size={13} />{selectedStats.guards} guard</span><span className="flex items-center gap-1"><Users size={13} />{selectedStats.receptionists} receptionist</span></div>
                <Link className="button primary w-full mt-4" href={pages.building(userId, areaId, selectedBuilding.id)}>Open building site<ArrowRight size={14} /></Link>
              </section>
            ) : <section className="glass-panel empty-state">Select a 3D mass or register entry to inspect its staffed interior.</section>}
            <section className="glass-panel panel-pad"><div className="eyebrow">Live operations</div><div className="event-log">{snapshot.events.slice(-5).reverse().map((event) => <div className="event-row" key={event.id}><time>{new Date(event.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time><span>{event.message}</span></div>)}</div></section>
          </div>
        </div>
      </div>
    </main>
  );
}
