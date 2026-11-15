"use client";

import Link from "next/link";
import { Bot, Building2, Globe2, Map, Hexagon } from "lucide-react";
import { pages } from "@/lib/routes";
import { ThemeControls } from "./ThemeControls";

export function AppHeader({ pilotId, areaId, buildingId, active = "world" }: { pilotId?: string | null; areaId?: string | null; buildingId?: string | null; active?: "world" | "area" | "building" | "ai" }) {
  return (
    <header className="app-header">
      <Link href={pages.world()} className="brand" aria-label="Simplayz world map">
        <span className="brand-mark"><Hexagon size={21} strokeWidth={1.6} /></span>
        <span>SIMPLAYZ</span>
        <small>PERSISTENT WORLD</small>
      </Link>
      <nav className="main-nav" aria-label="Simulator sections">
        <Link className={active === "world" ? "active" : ""} href={pages.world()}><Globe2 size={15} />World</Link>
        {pilotId && areaId ? <Link className={active === "area" ? "active" : ""} href={pages.area(pilotId, areaId)}><Map size={15} />Area</Link> : <span className="nav-disabled"><Map size={15} />Area</span>}
        {pilotId && areaId && buildingId ? <Link className={active === "building" ? "active" : ""} href={pages.building(pilotId, areaId, buildingId)}><Building2 size={15} />Site</Link> : <span className="nav-disabled"><Building2 size={15} />Site</span>}
        {pilotId ? <Link className={active === "ai" ? "active" : ""} href={pages.aiManagement(pilotId)}><Bot size={15} />AI officers</Link> : <span className="nav-disabled"><Bot size={15} />AI officers</span>}
      </nav>
      <ThemeControls />
    </header>
  );
}
