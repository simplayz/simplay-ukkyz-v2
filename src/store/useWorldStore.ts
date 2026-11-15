"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RenderMode } from "@/renderer/WorldRenderer";
import type { StructureType } from "@/engine/catalogue";
import type { WorldSnapshot } from "@/lib/types";

export type ThemeName = "cartographer" | "violet" | "lilac" | "custom" | "chaos";
export type WorldLocation = { lat: number; lon: number; label: string };
export type Notice = { id: number; tone: "info" | "success" | "error"; message: string };

type WorldStore = {
  pilotId: string | null;
  snapshot: WorldSnapshot | null;
  location: WorldLocation;
  mode: RenderMode;
  theme: ThemeName;
  customHue: number;
  selectedBuild: StructureType | null;
  selectedStructureId: string | null;
  hoveredCell: { x: number; y: number } | null;
  streamStatus: "offline" | "connecting" | "live" | "polling";
  notices: Notice[];
  setPilotId: (id: string | null) => void;
  setSnapshot: (snapshot: WorldSnapshot | null) => void;
  setLocation: (location: WorldLocation) => void;
  setMode: (mode: RenderMode) => void;
  setTheme: (theme: ThemeName) => void;
  setCustomHue: (hue: number) => void;
  setSelectedBuild: (type: StructureType | null) => void;
  setSelectedStructureId: (id: string | null) => void;
  setHoveredCell: (cell: { x: number; y: number } | null) => void;
  setStreamStatus: (status: WorldStore["streamStatus"]) => void;
  notify: (message: string, tone?: Notice["tone"]) => void;
  dismissNotice: (id: number) => void;
};

export const useWorldStore = create<WorldStore>()(
  persist(
    (set) => ({
      pilotId: null,
      snapshot: null,
      location: { lat: 37.7749, lon: -122.4194, label: "San Francisco" },
      mode: "STACK",
      theme: "cartographer",
      customHue: 265,
      selectedBuild: null,
      selectedStructureId: null,
      hoveredCell: null,
      streamStatus: "offline",
      notices: [],
      setPilotId: (pilotId) => set({ pilotId, snapshot: null }),
      setSnapshot: (snapshot) => set({ snapshot }),
      setLocation: (location) => set({ location }),
      setMode: (mode) => set({ mode }),
      setTheme: (theme) => set({ theme }),
      setCustomHue: (customHue) => set({ customHue }),
      setSelectedBuild: (selectedBuild) => set({ selectedBuild }),
      setSelectedStructureId: (selectedStructureId) => set({ selectedStructureId }),
      setHoveredCell: (hoveredCell) => set({ hoveredCell }),
      setStreamStatus: (streamStatus) => set({ streamStatus }),
      notify: (message, tone = "info") => set((state) => ({ notices: [...state.notices.slice(-3), { id: Date.now() + Math.random(), tone, message }] })),
      dismissNotice: (id) => set((state) => ({ notices: state.notices.filter((notice) => notice.id !== id) })),
    }),
    {
      name: "simplayz-world",
      partialize: (state) => ({ pilotId: state.pilotId, location: state.location, mode: state.mode, theme: state.theme, customHue: state.customHue }),
      merge: (persisted, current) => ({ ...current, ...(persisted as Partial<WorldStore>), snapshot: null, notices: [], selectedBuild: null, hoveredCell: null }),
    },
  ),
);
