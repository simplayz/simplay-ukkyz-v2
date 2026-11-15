"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Bot, Building2, CheckCircle2, Coins, Grid3X3, Map, MousePointer2, Save, ShieldCheck, Trash2, Users, X } from "lucide-react";
import { AppHeader } from "./AppHeader";
import { BuildingLayout } from "./BuildingLayout";
import { ParcelMiniMap } from "./ParcelMiniMap";
import { PlanCanvas } from "./PlanCanvas";
import { getStructureDefinition } from "@/engine/catalogue";
import { computeBuildingStats, ROOM_CATALOGUE, type RoomKind } from "@/engine/rooms";
import { apiRequest, formatNumber } from "@/lib/client";
import type { WorldSnapshot } from "@/lib/types";
import { useWorldConnection } from "@/hooks/useWorldConnection";
import { useWorldStore } from "@/store/useWorldStore";

export function BuildingApp({ userId, areaId, buildingId }: { userId: string; areaId: string; buildingId: string }) {
  const storedPilotId = useWorldStore((state) => state.pilotId);
  const setPilotId = useWorldStore((state) => state.setPilotId);
  const setSnapshot = useWorldStore((state) => state.setSnapshot);
  const notify = useWorldStore((state) => state.notify);
  const { snapshot, loading, error } = useWorldConnection(userId);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedKind, setSelectedKind] = useState<RoomKind | null>(null);
  const [name, setName] = useState("");
  const [staff, setStaff] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (storedPilotId !== userId) setPilotId(userId); }, [storedPilotId, userId, setPilotId]);
  const building = snapshot?.buildings.find((entry) => entry.id === buildingId) ?? null;
  const selectedRoom = building?.rooms.find((room) => room.id === selectedRoomId) ?? null;
  useEffect(() => {
    if (building && !selectedRoomId) setSelectedRoomId(building.rooms[0]?.id ?? null);
    if (selectedRoomId && building && !building.rooms.some((room) => room.id === selectedRoomId)) setSelectedRoomId(building.rooms[0]?.id ?? null);
  }, [building, selectedRoomId]);
  useEffect(() => { setName(selectedRoom?.name ?? ""); setStaff(selectedRoom?.staff ?? 0); }, [selectedRoom]);

  if (loading && !snapshot) return <><AppHeader active="building" /><div className="loading-screen">Loading building site…</div></>;
  if (!snapshot?.parcel || snapshot.parcel.id !== areaId || !building) return <><AppHeader pilotId={userId} areaId={areaId} active="building" /><div className="empty-state">{error ?? "Building site not found in this area."}<div className="mt-4"><Link className="button" href={`/user/${userId}/area/${areaId}`}>Return to area</Link></div></div></>;
  const stats = computeBuildingStats(building.rooms);
  const definition = getStructureDefinition(building.archetype);

  const placeRoom = async (cell: { x: number; y: number }): Promise<void> => {
    if (!selectedKind || busy) return;
    setBusy(true);
    try {
      const next = await apiRequest<WorldSnapshot>(`/api/buildings/${buildingId}/rooms?pilotId=${userId}`, { method: "POST", body: JSON.stringify({ kind: selectedKind, x: cell.x, y: cell.y }) });
      setSnapshot(next);
      const created = next.buildings.find((entry) => entry.id === buildingId)?.rooms.find((room) => room.kind === selectedKind && room.x === cell.x && room.y === cell.y);
      if (created) setSelectedRoomId(created.id);
      notify("Room commissioned on the persistent site plan.", "success");
    } catch (caught) { notify(caught instanceof Error ? caught.message : "Room placement failed", "error"); }
    finally { setBusy(false); }
  };

  const saveRoom = async (): Promise<void> => {
    if (!selectedRoom) return;
    setBusy(true);
    try {
      const next = await apiRequest<WorldSnapshot>(`/api/rooms/${selectedRoom.id}?pilotId=${userId}`, { method: "PATCH", body: JSON.stringify({ name, staff }) });
      setSnapshot(next); notify("Room staffing saved.", "success");
    } catch (caught) { notify(caught instanceof Error ? caught.message : "Save failed", "error"); }
    finally { setBusy(false); }
  };

  const removeRoom = async (): Promise<void> => {
    if (!selectedRoom) return;
    setBusy(true);
    try {
      const next = await apiRequest<WorldSnapshot>(`/api/rooms/${selectedRoom.id}?pilotId=${userId}`, { method: "DELETE" });
      setSnapshot(next); setSelectedRoomId(null); notify("Room removed and materials recovered.", "success");
    } catch (caught) { notify(caught instanceof Error ? caught.message : "Removal failed", "error"); }
    finally { setBusy(false); }
  };

  return (
    <main className="page-shell">
      <AppHeader pilotId={userId} areaId={areaId} buildingId={buildingId} active="building" />
      <div className="page-main">
        <div className="breadcrumbs"><Link href="/"><ArrowLeft size={12} />World</Link><span>/</span><Link href={`/user/${userId}/area/${areaId}`}>{snapshot.parcel.name}</Link><span>/</span><span>{building.name}</span></div>
        <div className="page-title">
          <div><div className="eyebrow">Building Site / {definition.short}</div><h1>{building.name}</h1><p>Grid {building.gx + 1}:{building.gy + 1} · {building.rooms.length} rooms · {stats.staff} assigned staff</p></div>
          <div className="hud-actions"><span className="button ghost"><Coins size={15} />{formatNumber(snapshot.pilot.credits)}</span><Link className="button" href={`/user/${userId}/ai/management`}><Bot size={14} />AI officers</Link></div>
        </div>

        <div className="dashboard-grid three">
          <div className="stack">
            <section className="glass-panel">
              <div className="panel-pad pb-3"><div className="panel-heading !mb-0"><div><div className="eyebrow">2D Building Site Mini Map</div><h2>Parcel context</h2></div><Map size={18} className="text-accent" /></div></div>
              <div className="map-frame"><ParcelMiniMap parcel={snapshot.parcel} buildings={snapshot.buildings} structures={snapshot.structures} focusBuilding={building} /><div className="map-legend glass-panel"><span>Crosshair marks this site within the frozen area survey.</span></div></div>
            </section>
            <section className="glass-panel panel-pad">
              <div className="panel-heading"><div><div className="eyebrow">Compliance</div><h3>Site readiness</h3></div><CheckCircle2 size={18} className="text-accent" /></div>
              <div className="score-list">
                <div className="flex justify-between tiny"><span className="flex items-center gap-2"><ShieldCheck size={14} />Guard coverage</span><b>{stats.guards} assigned</b></div>
                <div className="flex justify-between tiny"><span className="flex items-center gap-2"><Users size={14} />Reception coverage</span><b>{stats.receptionists} assigned</b></div>
                <div className="flex justify-between tiny"><span>Total operational coverage</span><b>{stats.coverage}%</b></div>
              </div>
              <p className="tiny muted mt-4">The server prevents removing the final guard post or receptionist and prevents zero staffing for either required role.</p>
            </section>
          </div>

          <div className="stack">
            <section className="glass-panel">
              <div className="panel-pad pb-3"><div className="panel-heading !mb-0"><div><div className="eyebrow">2D Building Site Layout Plan</div><h2>Interior zoning / 12×12</h2></div><Grid3X3 size={18} className="text-accent" /></div></div>
              <BuildingLayout building={building} selectedRoomId={selectedRoomId} onSelectRoom={(id) => { setSelectedRoomId(id); setSelectedKind(null); }} onPlace={(cell) => void placeRoom(cell)} />
              <div className="p-3 tiny muted border-t border-line">{selectedKind ? "Placement armed. Click an unoccupied origin cell; the server checks the full room footprint." : "Select a room to edit or choose an optional room type below."}</div>
            </section>
            <section className="glass-panel panel-pad">
              <div className="panel-heading"><div><div className="eyebrow">Interior programme</div><h3>Add functional room</h3></div><MousePointer2 size={17} className="text-accent" /></div>
              <div className="grid grid-cols-2 gap-2">{ROOM_CATALOGUE.filter((room) => !["reception", "guard"].includes(room.kind)).map((room) => <button key={room.kind} className={`catalogue-item !border ${selectedKind === room.kind ? "active" : ""}`} onClick={() => setSelectedKind(selectedKind === room.kind ? null : room.kind)}><span className="catalogue-swatch" style={{ background: room.color }}>{room.width}×{room.depth}</span><span><strong>{room.label}</strong><small>{room.staff} staff · {room.description}</small></span><span className="catalogue-cost">{room.cost}</span></button>)}</div>
              {selectedKind && <div className="selection-card mt-3 flex items-center gap-2"><MousePointer2 size={14} />Click the 2D plan to place.<button className="button icon ghost ml-auto" onClick={() => setSelectedKind(null)}><X size={13} /></button></div>}
            </section>
          </div>

          <div className="stack">
            <section className="glass-panel">
              <div className="panel-pad pb-3"><div className="panel-heading !mb-0"><div><div className="eyebrow">3D Interactive Preview</div><h2>Interior massing</h2></div><Building2 size={18} className="text-accent" /></div></div>
              <div className="map-frame preview"><PlanCanvas building={building} selectedId={selectedRoomId} onSelect={(id) => { setSelectedRoomId(id); setSelectedKind(null); }} /></div>
            </section>
            {selectedRoom ? <section className="glass-panel panel-pad">
              <div className="eyebrow">Selected room / {selectedRoom.kind}</div><div className="panel-heading"><h2>{selectedRoom.name}</h2><span className="tiny muted">{selectedRoom.width}×{selectedRoom.depth} ZONE</span></div>
              <label><span className="field-label">Room name</span><input className="text-input" value={name} maxLength={40} onChange={(event) => setName(event.target.value)} /></label>
              <label><span className="field-label">Assigned staff / {staff}</span><input className="w-full accent-[var(--accent)]" type="range" min={["guard", "reception"].includes(selectedRoom.kind) ? 1 : 0} max="20" value={staff} onChange={(event) => setStaff(Number(event.target.value))} /></label>
              <div className="hud-actions mt-4"><button className="button primary" disabled={busy || !name.trim()} onClick={() => void saveRoom()}><Save size={14} />Save staffing</button><button className="button danger" disabled={busy} onClick={() => void removeRoom()}><Trash2 size={14} />Remove</button></div>
            </section> : <section className="glass-panel empty-state">Select a room in either plan to edit its staff.</section>}
            <section className="glass-panel panel-pad"><div className="panel-heading"><div><div className="eyebrow">Area navigation</div><h3>Other building sites</h3></div></div><div className="building-list">{snapshot.buildings.filter((entry) => entry.id !== buildingId).slice(0, 4).map((entry) => <Link key={entry.id} href={`/user/${userId}/area/${areaId}/building/${entry.id}`} className="building-row"><span className="text-xs">{entry.name}</span><ArrowRight size={14} className="ml-auto text-accent" /></Link>)}{snapshot.buildings.length <= 1 && <Link className="button" href={`/user/${userId}/area/${areaId}`}>Commission another building<ArrowRight size={13} /></Link>}</div></section>
          </div>
        </div>
      </div>
    </main>
  );
}
