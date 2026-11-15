"use client";

import { useEffect } from "react";
import { Check, Palette, Radio, WifiOff } from "lucide-react";
import { useWorldStore, type ThemeName } from "@/store/useWorldStore";

const themes: { id: ThemeName; label: string }[] = [
  { id: "cartographer", label: "Cartographer" },
  { id: "violet", label: "Violet" },
  { id: "lilac", label: "Lilac" },
  { id: "custom", label: "Custom" },
  { id: "chaos", label: "Chaos" },
];

export function ThemeControls() {
  const theme = useWorldStore((state) => state.theme);
  const customHue = useWorldStore((state) => state.customHue);
  const streamStatus = useWorldStore((state) => state.streamStatus);
  const setTheme = useWorldStore((state) => state.setTheme);
  const setCustomHue = useWorldStore((state) => state.setCustomHue);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.setProperty("--custom-hue", String(customHue));
  }, [theme, customHue]);

  return (
    <div className="theme-control">
      <div className="stream-indicator" title="Server-sent events plus a 25 second snapshot polling fallback">
        {streamStatus === "live" ? <Radio size={13} /> : <WifiOff size={13} />}
        <span>{streamStatus === "live" ? "LIVE" : streamStatus === "polling" ? "25S POLL" : streamStatus.toUpperCase()}</span>
      </div>
      <Palette size={15} aria-hidden="true" />
      <label className="sr-only" htmlFor="theme-select">Glass theme</label>
      <select id="theme-select" value={theme} onChange={(event) => setTheme(event.target.value as ThemeName)}>
        {themes.map((entry) => <option value={entry.id} key={entry.id}>{entry.label}</option>)}
      </select>
      {theme === "custom" && (
        <input aria-label="Custom theme hue" type="range" min="0" max="360" value={customHue} onChange={(event) => setCustomHue(Number(event.target.value))} />
      )}
      {theme !== "custom" && <Check size={13} className="text-accent" aria-hidden="true" />}
    </div>
  );
}
