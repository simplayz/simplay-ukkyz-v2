"use client";

import { useEffect } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { useWorldStore } from "@/store/useWorldStore";

export function ToastHub() {
  const notices = useWorldStore((state) => state.notices);
  const dismiss = useWorldStore((state) => state.dismissNotice);
  useEffect(() => {
    if (!notices.length) return;
    const timers = notices.map((notice) => window.setTimeout(() => dismiss(notice.id), 6500));
    return () => timers.forEach(window.clearTimeout);
  }, [notices, dismiss]);
  return (
    <div className="toast-hub" aria-live="polite">
      {notices.map((notice) => (
        <div className={`toast toast-${notice.tone}`} key={notice.id}>
          {notice.tone === "success" ? <CheckCircle2 size={17} /> : notice.tone === "error" ? <AlertTriangle size={17} /> : <Info size={17} />}
          <span>{notice.message}</span>
          <button aria-label="Dismiss notification" onClick={() => dismiss(notice.id)}><X size={15} /></button>
        </div>
      ))}
    </div>
  );
}
