"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Bot, BrainCircuit, Check, ChevronRight, Cpu, Radio, Save, Settings2, ShieldCheck, WalletCards } from "lucide-react";
import { AppHeader } from "./AppHeader";
import { AI_MODELS, AI_PROVIDERS, BOT_ROLES, type AiProvider, type BotRole } from "@/engine/ai";
import { apiRequest } from "@/lib/client";
import type { BotDTO, WorldSnapshot } from "@/lib/types";
import { useWorldConnection } from "@/hooks/useWorldConnection";
import { useWorldStore } from "@/store/useWorldStore";

function officerFocus(bot: BotDTO, snapshot: WorldSnapshot): string {
  if (bot.role === "CTO") return snapshot.totals.power < 0 ? `Power deficit ${snapshot.totals.power}. Prioritise generation before new technical rooms.` : `Power reserve +${snapshot.totals.power}. ${snapshot.structures.length} structures available for infrastructure review.`;
  if (bot.role === "CFO") return `Net ${snapshot.totals.netIncome >= 0 ? "surplus" : "deficit"} ${snapshot.totals.netIncome} per tick; ${snapshot.pilot.credits.toLocaleString()} credits liquid.`;
  const rooms = snapshot.buildings.reduce((sum, building) => sum + building.rooms.length, 0);
  const compliant = snapshot.buildings.every((building) => building.rooms.some((room) => room.kind === "guard" && room.staff > 0) && building.rooms.some((room) => room.kind === "reception" && room.staff > 0));
  return `${snapshot.buildings.length} sites / ${rooms} rooms. Required staffing ${compliant ? "compliant" : "needs attention"}; food balance ${snapshot.totals.food}.`;
}

function OfficerCard({ bot, snapshot, onSave, busy }: { bot: BotDTO; snapshot: WorldSnapshot; onSave: (bot: BotDTO, draft: Draft) => Promise<void>; busy: boolean }) {
  const [draft, setDraft] = useState<Draft>({ provider: bot.provider as AiProvider, model: bot.model, directive: bot.directive, autonomy: bot.autonomy, active: bot.active });
  const [savedStamp, setSavedStamp] = useState(bot.updatedAt);
  if (savedStamp !== bot.updatedAt) {
    setSavedStamp(bot.updatedAt);
    setDraft({ provider: bot.provider as AiProvider, model: bot.model, directive: bot.directive, autonomy: bot.autonomy, active: bot.active });
  }
  const models = AI_MODELS.filter((model) => model.provider === draft.provider);
  const selectedModel = AI_MODELS.find((model) => model.id === draft.model && model.provider === draft.provider);
  const roleIcon = bot.role === "CTO" ? <Cpu size={20} /> : bot.role === "CFO" ? <WalletCards size={20} /> : <Settings2 size={20} />;
  return (
    <section className="glass-panel bot-card">
      <div className="bot-identity"><div className="bot-avatar">{bot.role}</div><div><h2>{bot.name}</h2><p>{bot.role} / {bot.active ? "Officer active" : "Officer paused"}</p></div><span className="ml-auto text-accent">{roleIcon}</span></div>
      <div className="selection-card mt-4"><div className="eyebrow">Live operational focus</div>{officerFocus(bot, snapshot)}</div>
      <label><span className="field-label">AI provider</span><select className="text-input" value={draft.provider} onChange={(event) => {
        const provider = event.target.value as AiProvider;
        setDraft({ ...draft, provider, model: AI_MODELS.find((model) => model.provider === provider)!.id });
      }}>{AI_PROVIDERS.map((provider) => <option key={provider}>{provider}</option>)}</select></label>
      <div className="field-label">Available models / {models.length}</div>
      <div className="model-list">{models.map((model) => <button type="button" key={model.id} className={`model-card w-full text-left ${draft.model === model.id ? "active" : ""}`} onClick={() => setDraft({ ...draft, model: model.id })}>
        <strong>{model.label}<span className="muted">{model.context} · {model.cost}</span></strong><p>{model.strength}</p>
      </button>)}</div>
      <label><span className="field-label">Persistent directive</span><textarea className="text-input" value={draft.directive} maxLength={600} onChange={(event) => setDraft({ ...draft, directive: event.target.value })} /></label>
      <label><span className="field-label">Decision autonomy / {draft.autonomy}%</span><input className="w-full accent-[var(--accent)]" type="range" min="0" max="100" value={draft.autonomy} onChange={(event) => setDraft({ ...draft, autonomy: Number(event.target.value) })} /></label>
      <div className="autonomy-track"><i style={{ width: `${draft.autonomy}%` }} /></div>
      <div className="split-controls mt-4"><label className="flex items-center gap-2 tiny cursor-pointer"><input type="checkbox" className="accent-[var(--accent)]" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} />Accept assignments</label><span className="tiny muted">{selectedModel?.provider} / {selectedModel?.context}</span></div>
      <button className="button primary w-full mt-4" disabled={busy || !draft.directive.trim()} onClick={() => void onSave(bot, draft)}><Save size={14} />{busy ? "Saving routing profile…" : "Save officer configuration"}</button>
    </section>
  );
}

type Draft = { provider: AiProvider; model: string; directive: string; autonomy: number; active: boolean };

export function AiManagementApp({ userId }: { userId: string }) {
  const storedPilotId = useWorldStore((state) => state.pilotId);
  const setPilotId = useWorldStore((state) => state.setPilotId);
  const setSnapshot = useWorldStore((state) => state.setSnapshot);
  const notify = useWorldStore((state) => state.notify);
  const { snapshot, loading, error } = useWorldConnection(userId);
  const [busyRole, setBusyRole] = useState<BotRole | null>(null);
  useEffect(() => { if (storedPilotId !== userId) setPilotId(userId); }, [storedPilotId, userId, setPilotId]);
  if (loading && !snapshot) return <><AppHeader active="ai" /><div className="loading-screen">Loading AI officers…</div></>;
  if (!snapshot) return <><AppHeader pilotId={userId} active="ai" /><div className="empty-state">{error ?? "Pilot not found"}<div className="mt-4"><Link className="button" href="/">Return to world</Link></div></div></>;

  const save = async (bot: BotDTO, draft: Draft): Promise<void> => {
    setBusyRole(bot.role);
    try {
      const next = await apiRequest<WorldSnapshot>(`/api/pilots/${userId}/bots/${bot.id}`, { method: "PATCH", body: JSON.stringify(draft) });
      setSnapshot(next); notify(`${bot.role} ${bot.name} now uses ${draft.provider} / ${draft.model}.`, "success");
    } catch (caught) { notify(caught instanceof Error ? caught.message : "Could not save officer", "error"); }
    finally { setBusyRole(null); }
  };
  const sortedBots = BOT_ROLES.map((role) => snapshot.bots.find((bot) => bot.role === role)).filter((bot): bot is BotDTO => Boolean(bot));
  const active = snapshot.bots.filter((bot) => bot.active).length;
  const providerCount = new Set(snapshot.bots.map((bot) => bot.provider)).size;
  const averageAutonomy = Math.round(snapshot.bots.reduce((sum, bot) => sum + bot.autonomy, 0) / Math.max(1, snapshot.bots.length));

  return (
    <main className="page-shell">
      <AppHeader pilotId={userId} areaId={snapshot.parcel?.id} buildingId={snapshot.buildings[0]?.id} active="ai" />
      <div className="page-main">
        <div className="breadcrumbs"><Link href="/"><ArrowLeft size={12} />World</Link><span>/</span><span>{snapshot.pilot.callSign}</span><span>/</span><span>AI management</span></div>
        <div className="page-title"><div><div className="eyebrow">AI Management / persistent routing</div><h1>Command officers</h1><p>Assign a provider and model to each bot. Profiles are validated and stored in the world database.</p></div><Link className="button" href={snapshot.parcel ? `/user/${userId}/area/${snapshot.parcel.id}` : "/"}>Return to command<ChevronRight size={14} /></Link></div>
        <div className="metric-grid mb-4"><div className="metric"><span>Officers active</span><strong>{active} / 3</strong></div><div className="metric"><span>Providers assigned</span><strong>{providerCount}</strong></div><div className="metric"><span>Mean autonomy</span><strong>{averageAutonomy}%</strong></div></div>
        <div className="bot-grid">{sortedBots.map((bot) => <OfficerCard key={bot.id} bot={bot} snapshot={snapshot} onSave={save} busy={busyRole === bot.role} />)}</div>
        {sortedBots.length < 3 && <div className="error-text mt-4">This pilot predates complete officer seeding; {3 - sortedBots.length} role(s) are unavailable.</div>}
        <div className="dashboard-grid mt-4">
          <section className="glass-panel panel-pad"><div className="panel-heading"><div><div className="eyebrow">Configuration journal</div><h2>Officer event stream</h2></div><Radio size={18} className="text-accent" /></div><div className="event-log">{snapshot.events.filter((event) => ["ai", "pilot"].includes(event.kind)).reverse().map((event) => <div className="event-row" key={event.id}><time>{new Date(event.createdAt).toLocaleDateString()}</time><span>{event.message}</span></div>)}{!snapshot.events.some((event) => ["ai", "pilot"].includes(event.kind)) && <div className="empty-state">Configuration changes will appear here.</div>}</div></section>
          <section className="glass-panel panel-pad"><div className="panel-heading"><div><div className="eyebrow">Operating boundary</div><h2>Routing, not simulated inference</h2></div><ShieldCheck size={18} className="text-accent" /></div><p className="tiny muted leading-6">This page persists real provider/model routing profiles and directives. It does not claim to contact a provider or generate an AI response; no inference request is sent. Operational focus cards are deterministic readouts of your actual world snapshot.</p><div className="hud-actions mt-4"><span className="room-chip"><BrainCircuit size={12} className="mr-1" />12 model profiles</span><span className="room-chip"><Bot size={12} className="mr-1" />3 distinct roles</span><span className="room-chip"><Check size={12} className="mr-1" />Server validation</span></div></section>
        </div>
      </div>
    </main>
  );
}
