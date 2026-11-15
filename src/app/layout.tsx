import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ToastHub } from "@/components/ToastHub";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Simplayz — Persistent World Simulator", template: "%s · Simplayz" },
  description: "Survey a procedural Web Mercator world, develop persistent areas, design staffed building sites and command AI officers.",
};

const themeScript = `
(() => {
  try {
    const saved = JSON.parse(localStorage.getItem('simplayz-world') || '{}');
    const state = saved.state || {};
    const allowed = ['cartographer','violet','lilac','custom','chaos'];
    document.documentElement.dataset.theme = allowed.includes(state.theme) ? state.theme : 'cartographer';
    document.documentElement.style.setProperty('--custom-hue', String(Number(state.customHue) || 265));
  } catch { document.documentElement.dataset.theme = 'cartographer'; }
})();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="cartographer" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body className="antialiased">{children}<ToastHub /></body>
    </html>
  );
}
