"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Bot, Building2, Coins, Crosshair, LocateFixed, LockKeyhole, MapPin, MousePointer2, Navigation, Pickaxe, Shield, ShieldAlert, Trash2, UserRound, X } from "lucide-react";
import { AppHeader } from "./AppHeader";
import { WorldCanvas } from "./WorldCanvas";
import { BIOMES, type TerrainScores } from "@/engine/terrain";
import { lonLatToWorld, PARCEL_GRID_SIZE, seedForLocation } from "@/engine/geodesy";
import { STRUCTURE_CATALOGUE, getStructureDefinition, type StructureCategory, type StructureType } from "@/engine/catalogue";
import { TICK_MS } from "@/engine/simulation";
import { apiRequest, formatCountdown, formatNumber } from "@/lib/client";
import type { WorldSnapshot } from "@/lib/types";
import { useWorldConnection } from "@/hooks/useWorldConnection";
import { useWorldStore, type WorldLocation } from "@/store/useWorldStore";

const categories: ("all" | StructureCategory)[] = ["all", "civic", "production", "utility", "defence", "culture"];
const scoreLabels: (keyof TerrainScores)[] = ["elevation", "slope", "water", "forest", "farm", "build", "defence", "hydro"];

export function WorldApp() {
  const pilotId = useWorldStore((state) => state.pilotId);
  const setPilotId = useWorldStore((state) => state.setPilotId);
  const location = useWorldStore((state) => state.location);
  const setLocation = useWorldStore((state) => state.setLocation);
  const mode = useWorldStore((state) => state.mode);
  const setMode = useWorldStore((state) => state.setMode);
  const selectedBuild = useWorldStore((state) => state.selectedBuild);
  const setSelectedBuild = useWorldStore((state) => state.setSelectedBuild);
  const selectedStructureId = useWorldStore((state) => state.selectedStructureId);
  const setSelectedStructureId = useWorldStore((state) => state.setSelectedStructureId);
  const hoveredCell = useWorldStore((state) => state.hoveredCell);
  const setHoveredCell = useWorldStore((state) => state.setHoveredCell);
  const setSnapshot = useWorldStore((state) => state.setSnapshot);
  const notify = useWorldStore((state) => state.notify);
  const { snapshot, loading } = useWorldConnection(pilotId);
  const [mounted, setMounted] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [callSign, setCallSign] = useState("");
  const [latInput, setLatInput] = useState(String(location.lat));
  const [lonInput, setLonInput] = useState(String(location.lon));
  const [locationName, setLocationName] = useState(location.label);
  const [busy, setBusy] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [category, setCategory] = useState<(typeof categories)[number]>("all");
  const [inspectedCell, setInspectedCell] = useState<{ x: number; y: number } | null>(null);
  const [tiles, setTiles] = useState({ loaded: 0, total: 9 });
  const [now, setNow] = useState(Date.now());

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { setLatInput(String(location.lat)); setLonInput(String(location.lon)); setLocationName(location.label); }, [location]);
  useEffect(() => {
    if (snapshot?.parcel) {
      const parcel = snapshot.parcel;
      const current = useWorldStore.getState().location;
      if (current.lat !== parcel.lat || current.lon !== parcel.lon) setLocation({ lat: parcel.lat, lon: parcel.lon, label: parcel.name });
    }
  }, [snapshot?.parcel, setLocation]);

  const center = useMemo(() => lonLatToWorld(location.lon, location.lat), [location]);
  const seed = snapshot ? seedForLocation(snapshot.pilot.seed, location.lat, location.lon) : 42;
  const selectedStructure = snapshot?.structures.find((structure) => structure.id === selectedStructureId) ?? null;
  const selectedBuilding = selectedStructure ? snapshot?.buildings.find((building) => building.structureId === selectedStructure.id) : null;
  const lockExpired = snapshot?.parcel ? new Date(snapshot.parcel.lockedUntil).getTime() <= now : false;
  const activeCell = hoveredCell ?? inspectedCell;
  const cellData = snapshot?.parcel && activeCell ? snapshot.parcel.cells[activeCell.y * PARCEL_GRID_SIZE + activeCell.x] : null;

  const locate = useCallback(() => {
    setFormError(null);
    if (!navigator.geolocation) { setFormError("Geolocation is unavailable; enter a custom location instead."); return; }
    setBusy("locate");
    navigator.geolocation.getCurrentPosition(
      (position) => setLocation({ lat: Number(position.coords.latitude.toFixed(6)), lon: Number(position.coords.longitude.toFixed(6)), label: "Device location" }),
      () => { setFormError("Location permission was not granted. Custom coordinates remain fully supported."); setBusy(null); },
      { enableHighAccuracy: false, timeout: 9000 },
    );
  }, [setLocation]);
  useEffect(() => { if (busy === "locate") setBusy(null); }, [location, busy]);

  const applyCustomLocation = (): void => {
    const lat = Number(latInput);
    const lon = Number(lonInput);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 85 || Math.abs(lon) > 180) { setFormError("Enter latitude −85…85 and longitude −180…180."); return; }
    setFormError(null);
    setLocation({ lat, lon, label: locationName.trim() || "Custom coordinate" });
  };

  const register = async (): Promise<void> => {
    setBusy("register"); setFormError(null);
    try {
      const next = await apiRequest<WorldSnapshot>("/api/pilots", { method: "POST", body: JSON.stringify({ callSign, lat: location.lat, lon: location.lon }) });
      setPilotId(next.pilot.id);
      setSnapshot(next);
      setRegistrationOpen(false);
      notify(`Pilot ${next.pilot.callSign} registered with three AI officers.`, "success");
    } catch (error) { setFormError(error instanceof Error ? error.message : "Registration failed"); }
    finally { setBusy(null); }
  };

  const claim = async (): Promise<void> => {
    if (!pilotId) { setRegistrationOpen(true); return; }
    setBusy("claim"); setFormError(null);
    try {
      const next = await apiRequest<WorldSnapshot>(`/api/pilots/${pilotId}/claim`, { method: "POST", body: JSON.stringify({ lat: location.lat, lon: location.lon }) });
      setSnapshot(next);
      notify("Parcel surveyed and locked for 72 hours.", "success");
    } catch (error) { notify(error instanceof Error ? error.message : "Claim failed", "error"); }
    finally { setBusy(null); }
  };

  const pickCell = async (cell: { x: number; y: number }): Promise<void> => {
    setInspectedCell(cell);
    if (!selectedBuild || !pilotId || !snapshot?.parcel || busy) return;
    setBusy("build");
    try {
      const next = await apiRequest<WorldSnapshot>(`/api/pilots/${pilotId}/structures`, { method: "POST", body: JSON.stringify({ type: selectedBuild, gx: cell.x, gy: cell.y, rotation: 0 }) });
      setSnapshot(next);
      notify(`${getStructureDefinition(selectedBuild).label} commissioned.`, "success");
    } catch (error) { notify(error instanceof Error ? error.message : "Build failed", "error"); }
    finally { setBusy(null); }
  };

  const salvage = async (): Promise<void> => {
    if (!selectedStructure || !pilotId) return;
    setBusy("salvage");
    try {
      const next = await apiRequest<WorldSnapshot>(`/api/structures/${selectedStructure.id}?pilotId=${pilotId}`, { method: "DELETE" });
      setSnapshot(next); setSelectedStructureId(null); notify("Structure salvaged; 40% of base cost recovered.", "success");
    } catch (error) { notify(error instanceof Error ? error.message : "Salvage failed", "error"); }
    finally { setBusy(null); }
  };

  const assault = async (): Promise<void> => {
    if (!pilotId || !snapshot?.parcel) return;
    setBusy("assault");
    try {
      const next = await apiRequest<WorldSnapshot>(`/api/parcels/${snapshot.parcel.id}/assault?pilotId=${pilotId}`, { method: "POST" });
      setSnapshot(next); notify("Four-phase assault resolved and archived.", "success");
    } catch (error) { notify(error instanceof Error ? error.message : "Assault failed", "error"); }
    finally { setBusy(null); }
  };

  const filteredCatalogue = STRUCTURE_CATALOGUE.filter((entry) => category === "all" || entry.category === category);
  const latestAssault = snapshot?.assaults[0];

  return (
    <main className="world-shell">
      <AppHeader pilotId={pilotId} areaId={snapshot?.parcel?.id} buildingId={snapshot?.buildings[0]?.id} active="world" />
      <div className="world-stage">
        <WorldCanvas seed={seed} center={center} parcel={snapshot?.parcel ?? null} structures={snapshot?.structures ?? []} mode={mode} hoveredCell={hoveredCell} onHoverCell={setHoveredCell} onPickCell={(cell) => void pickCell(cell)} onPickStructure={setSelectedStructureId} onTileStatus={(loaded, total) => setTiles({ loaded, total })} />
        <div className="hud-layer">
          <section className="hud-column">
            <div className="glass-panel panel-pad">
              <div className="eyebrow">Web Mercator / Z15</div>
              <div className="panel-heading">
                <div><h2>{location.label}</h2><div className="coord-readout"><span>LAT<strong className="mono">{location.lat.toFixed(5)}</strong></span><span>LON<strong className="mono">{location.lon.toFixed(5)}</strong></span></div></div>
                <Navigation size={20} className="text-accent" />
              </div>
              <div className="mode-switch" aria-label="Terrain render mode">
                {(["FLAT", "STACK", "RASTER"] as const).map((entry) => <button key={entry} className={mode === entry ? "active" : ""} onClick={() => setMode(entry)}>{entry}</button>)}
              </div>
              <div className="location-row mt-3">
                <label><span className="field-label">Latitude</span><input className="text-input" value={latInput} onChange={(event) => setLatInput(event.target.value)} inputMode="decimal" /></label>
                <label><span className="field-label">Longitude</span><input className="text-input" value={lonInput} onChange={(event) => setLonInput(event.target.value)} inputMode="decimal" /></label>
              </div>
              <label><span className="field-label">Location label</span><input className="text-input" value={locationName} onChange={(event) => setLocationName(event.target.value)} placeholder="Custom coordinate" /></label>
              <div className="hud-actions mt-3">
                <button className="button primary" onClick={applyCustomLocation}><Crosshair size={14} />Recenter</button>
                <button className="button" onClick={locate} disabled={busy === "locate"}><LocateFixed size={14} />{busy === "locate" ? "Locating" : "Device"}</button>
              </div>
              {formError && !registrationOpen && <p className="error-text">{formError}</p>}
            </div>

            {snapshot?.parcel ? (
              <div className="glass-panel panel-pad">
                <div className="panel-heading"><div><div className="eyebrow">Frozen 64×64 survey</div><h3>{snapshot.parcel.name}</h3></div><MapPin size={18} className="text-accent" /></div>
                <div className="score-list">
                  {scoreLabels.map((score) => <div className="score-row" key={score}><span>{score}</span><div className="score-track"><i style={{ width: `${snapshot.parcel!.scores[score] * 100}%` }} /></div><b className="mono">{Math.round(snapshot.parcel!.scores[score] * 100)}</b></div>)}
                </div>
                <Link className="button primary w-full mt-4" href={`/user/${snapshot.pilot.id}/area/${snapshot.parcel.id}`}>Open area plan<ArrowRight size={14} /></Link>
              </div>
            ) : (
              <div className="glass-panel panel-pad">
                <div className="eyebrow">Claim protocol</div>
                <h2 className="text-lg font-normal mb-2">40,960,000 m² available</h2>
                <p className="muted tiny">A 64×64 survey freezes relief, drainage and development scores. Your first claim is protected from assault for 72 hours.</p>
                <button className="button primary w-full mt-4" disabled={!pilotId || busy === "claim" || loading} onClick={() => void claim()}><LockKeyhole size={14} />{busy === "claim" ? "Surveying 4,096 cells…" : pilotId ? "Survey & lock this parcel" : "Register to claim"}</button>
              </div>
            )}

            {activeCell && cellData && (
              <div className="glass-panel panel-pad">
                <div className="panel-heading"><h3>Cell {activeCell.x + 1}:{activeCell.y + 1}</h3><span className="eyebrow !mb-0">{BIOMES[cellData.b].replaceAll("_", " ")}</span></div>
                <div className="metric-grid">
                  <div className="metric"><span>Elevation</span><strong>{cellData.h.toFixed(0)}m</strong></div>
                  <div className="metric"><span>Slope</span><strong>{cellData.s.toFixed(2)}</strong></div>
                  <div className="metric"><span>Drainage</span><strong>{Math.round(cellData.d * 100)}</strong></div>
                </div>
              </div>
            )}
          </section>

          <section className="hud-column right">
            {snapshot && (
              <div className="glass-panel">
                <div className="panel-pad pb-3">
                  <div className="panel-heading !mb-2"><div><div className="eyebrow">Pilot command</div><h2>{snapshot.pilot.callSign}</h2></div><UserRound size={19} className="text-accent" /></div>
                  <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-accent text-xl"><Coins size={18} />{formatNumber(snapshot.pilot.credits)}</span><span className="tiny muted mono">NET {snapshot.totals.netIncome >= 0 ? "+" : ""}{snapshot.totals.netIncome} / {TICK_MS / 1000}S</span></div>
                  {snapshot.parcel && <div className="mt-3 tiny muted flex justify-between"><span className="flex items-center gap-1"><Shield size={12} />{lockExpired ? "LOCK EXPIRED" : "PROTECTED"}</span><span className="mono">{lockExpired ? "ASSAULT READY" : formatCountdown(snapshot.parcel.lockedUntil, now)}</span></div>}
                </div>
                <div className="metric-grid">
                  <div className="metric"><span>Income</span><strong className="positive">+{snapshot.totals.income}</strong></div>
                  <div className="metric"><span>Upkeep</span><strong className="negative">−{snapshot.totals.upkeep}</strong></div>
                  <div className="metric"><span>Net tick</span><strong className={snapshot.totals.netIncome >= 0 ? "positive" : "negative"}>{snapshot.totals.netIncome}</strong></div>
                  <div className="metric"><span>Food</span><strong className={snapshot.totals.food >= 0 ? "positive" : "negative"}>{snapshot.totals.food}</strong></div>
                  <div className="metric"><span>Power</span><strong className={snapshot.totals.power >= 0 ? "positive" : "negative"}>{snapshot.totals.power}</strong></div>
                  <div className="metric"><span>Defence</span><strong>{snapshot.totals.defence}</strong></div>
                </div>
                <div className="p-3 flex gap-2">
                  <Link href={`/user/${snapshot.pilot.id}/ai/management`} className="button flex-1"><Bot size={13} />3 AI officers</Link>
                  {snapshot.parcel && <button className="button danger flex-1" disabled={!lockExpired || busy === "assault"} title={lockExpired ? "Resolve deterministic assault" : "Available after the 72-hour lock expires"} onClick={() => void assault()}><ShieldAlert size={13} />{busy === "assault" ? "Resolving" : "Assault"}</button>}
                </div>
              </div>
            )}

            {snapshot?.parcel && (
              <div className="glass-panel">
                <div className="panel-pad pb-2">
                  <div className="panel-heading !mb-2"><div><div className="eyebrow">Shared server catalogue</div><h3>Commission structure</h3></div><Building2 size={18} className="text-accent" /></div>
                  <div className="hud-actions">{categories.map((entry) => <button key={entry} className={`button !min-h-6 !px-2 !py-1 !text-[8px] ${category === entry ? "primary" : "ghost"}`} onClick={() => setCategory(entry)}>{entry}</button>)}</div>
                </div>
                <div className="catalogue border-t border-line">
                  {filteredCatalogue.map((entry) => <button key={entry.type} className={`catalogue-item ${selectedBuild === entry.type ? "active" : ""}`} onClick={() => { setSelectedBuild(selectedBuild === entry.type ? null : entry.type as StructureType); setSelectedStructureId(null); }} title={entry.description}>
                    <span className="catalogue-swatch" style={{ background: entry.color }}>{entry.short}</span>
                    <span><strong>{entry.label}</strong><small>{entry.income ? `+${entry.income} income · ` : ""}{entry.power ? `${entry.power > 0 ? "+" : ""}${entry.power} power · ` : ""}{entry.defence ? `${entry.defence} defence` : entry.affinity}</small></span>
                    <span className="catalogue-cost">{formatNumber(entry.cost)}</span>
                  </button>)}
                </div>
                {selectedBuild && <div className="selection-card m-3 flex items-center gap-2"><MousePointer2 size={15} /><span>Click a valid parcel cell to place <b>{getStructureDefinition(selectedBuild).label}</b>.</span><button className="button icon ghost ml-auto" onClick={() => setSelectedBuild(null)} aria-label="Cancel placement"><X size={14} /></button></div>}
              </div>
            )}

            {selectedStructure && (
              <div className="glass-panel panel-pad">
                <div className="eyebrow">Selected structure</div>
                <div className="panel-heading"><h3>{getStructureDefinition(selectedStructure.type).label}</h3><Pickaxe size={17} className="text-accent" /></div>
                <p className="muted tiny">{getStructureDefinition(selectedStructure.type).description}</p>
                <div className="hud-actions mt-3">
                  {selectedBuilding && <Link className="button primary" href={`/user/${snapshot!.pilot.id}/area/${snapshot!.parcel!.id}/building/${selectedBuilding.id}`}>Interior plan<ArrowRight size={13} /></Link>}
                  <button className="button danger" disabled={busy === "salvage"} onClick={() => void salvage()}><Trash2 size={13} />Salvage</button>
                </div>
              </div>
            )}

            {latestAssault && (
              <details className="glass-panel panel-pad">
                <summary className="cursor-pointer text-xs uppercase tracking-widest">Last assault · {latestAssault.report.victory ? "Held" : "Overrun"}</summary>
                <div className="phase-list">{latestAssault.report.phases.map((phase) => <div className="phase" key={phase.phase}><strong>{phase.phase}<span>{phase.defender} / {phase.attacker}</span></strong><p>{phase.narrative}</p></div>)}</div>
              </details>
            )}
          </section>
        </div>
        <div className="world-status glass-panel"><span>SEED <b className="mono">{seed}</b></span><span>RASTER <b>{tiles.loaded}/{tiles.total}</b></span><span>MODE <b>{mode}</b></span><span>WASD <b>MOVE PILOT</b></span><span>DRAG <b>ORBIT</b></span></div>
        <a className="attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors · tiles via Simplayz cache</a>
      </div>

      {mounted && !pilotId && registrationOpen && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="eyebrow">Persistent world registration</div>
            <h1>Your parcel is unwritten.</h1>
            <p className="modal-intro">Register a pilot at {location.label}. You begin with 15,000 credits and three persistent AI officers: Ada (CTO), Rook (CFO) and Mara (COO).</p>
            <label><span className="field-label">Pilot call sign</span><input autoFocus className="text-input" value={callSign} onChange={(event) => setCallSign(event.target.value)} placeholder="e.g. Northstar" maxLength={24} onKeyDown={(event) => { if (event.key === "Enter") void register(); }} /></label>
            <div className="location-row">
              <label><span className="field-label">Latitude</span><input className="text-input" value={location.lat} readOnly /></label>
              <label><span className="field-label">Longitude</span><input className="text-input" value={location.lon} readOnly /></label>
            </div>
            <div className="hud-actions mt-3"><button className="button" onClick={locate}><LocateFixed size={14} />Use device location</button><button className="button ghost" onClick={() => setRegistrationOpen(false)}>Explore first</button></div>
            {formError && <p className="error-text">{formError}</p>}
            <div className="form-actions"><button className="button primary" disabled={callSign.trim().length < 2 || busy === "register"} onClick={() => void register()}>{busy === "register" ? "Creating persistent pilot…" : "Register pilot"}<ArrowRight size={15} /></button></div>
          </div>
        </div>
      )}
    </main>
  );
}
