import { useEffect, useState } from "react";
import { PHASE_NOTIFS } from "./heroPhaseNotifications";

const TONE_COLOR = {
  done: { bg: "rgb(163, 230, 53)", shadow: "rgba(163, 230, 53, 0.4)" },
  running: { bg: "rgb(52, 211, 153)", shadow: "rgba(52, 211, 153, 0.5)" },
};

export default function HeroTaskNotification() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setPhase((p) => (p + 1) % PHASE_NOTIFS.length);
    }, 3200);
    return () => window.clearInterval(id);
  }, []);

  const task = PHASE_NOTIFS[phase];
  const color = TONE_COLOR[task.tone];

  return (
    <div className="at-hero-notif" data-hero-notif aria-live="polite">
      <div className="at-hero-notif-pill glass-pill text-shadow-xs">
        <div className="flex items-center gap-2 whitespace-nowrap px-3 py-2.5">
          <span className="flex items-center gap-1.5 text-[12px] font-medium tracking-wide text-white/80">
            <span
              className="inline-block size-1.5 shrink-0 rounded-full"
              style={{
                background: color.bg,
                boxShadow: `0 0 6px ${color.shadow}`,
              }}
            />
            {task.status}
          </span>
          <span className="text-[12px] font-medium italic text-white">{task.label}</span>
        </div>
      </div>
    </div>
  );
}
