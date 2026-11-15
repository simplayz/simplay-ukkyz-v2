"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchSnapshot } from "@/lib/client";
import type { EventDTO } from "@/lib/types";
import { useWorldStore } from "@/store/useWorldStore";

export function useWorldConnection(pilotId: string | null) {
  const snapshot = useWorldStore((state) => state.snapshot);
  const setSnapshot = useWorldStore((state) => state.setSnapshot);
  const setStreamStatus = useWorldStore((state) => state.setStreamStatus);
  const notify = useWorldStore((state) => state.notify);
  const [loading, setLoading] = useState(Boolean(pilotId));
  const [error, setError] = useState<string | null>(null);
  const lastEvent = useRef(0);

  const refresh = useCallback(async (quiet = false) => {
    if (!pilotId) return null;
    if (!quiet) setLoading(true);
    try {
      const next = await fetchSnapshot(pilotId);
      setSnapshot(next);
      lastEvent.current = Math.max(lastEvent.current, ...next.events.map((event) => event.id), 0);
      setError(null);
      return next;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not load world";
      setError(message);
      if (!quiet) notify(message, "error");
      return null;
    } finally {
      setLoading(false);
    }
  }, [pilotId, setSnapshot, notify]);

  useEffect(() => {
    if (!pilotId) { setSnapshot(null); setLoading(false); return; }
    let active = true;
    let source: EventSource | null = null;
    setStreamStatus("connecting");
    void refresh();
    const poll = window.setInterval(() => { if (active) void refresh(true); }, 25_000);
    const connect = (): void => {
      if (!active) return;
      source?.close();
      source = new EventSource(`/api/stream?pilot=${encodeURIComponent(pilotId)}&after=${lastEvent.current}`);
      source.addEventListener("ready", () => { if (active) setStreamStatus("live"); });
      source.addEventListener("world", (message) => {
        if (!active) return;
        const event = JSON.parse((message as MessageEvent<string>).data) as EventDTO;
        if (event.id > lastEvent.current) {
          lastEvent.current = event.id;
          notify(event.message, event.kind === "assault" ? "success" : "info");
          void refresh(true);
        }
      });
      source.onerror = () => { if (active) setStreamStatus("polling"); };
    };
    connect();
    return () => {
      active = false;
      window.clearInterval(poll);
      source?.close();
      setStreamStatus("offline");
    };
  }, [pilotId, refresh, setSnapshot, setStreamStatus, notify]);

  return { snapshot, loading, error, refresh };
}
