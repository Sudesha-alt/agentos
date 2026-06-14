import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";

const PHASES = [
  { id: "prd", label: "PRD", agent: "Virin", color: "#A8C53A" },
  { id: "code", label: "Build", agent: "Ananta", color: "#F2C94C" },
  { id: "qa", label: "QA", agent: "Neel", color: "#C49EDB" },
];

const QA_CASES = [
  "Login accepts valid credentials",
  "Widgets render under 200ms",
  "PRD criteria covered",
  "Canary staging passes",
];

function PrdPanel() {
  return (
    <div className="space-y-2.5 px-4 pb-4 pt-2">
      <div className="rounded-xl bg-[#F0EEEB] px-3 py-2 text-[12px] leading-snug text-[#2B2D33]">
        Discovery: phased rollout or big-bang?
      </div>
      <div className="flex flex-wrap gap-1.5">
        {["Phased alpha → GA", "Big-bang", "Other"].map((opt, i) => (
          <span
            key={opt}
            className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${
              i === 0 ? "bg-[#A8C53A]/25 text-[#2B2D33]" : "bg-[#F0EEEB] text-[#6B6B6B]"
            }`}
          >
            {opt}
          </span>
        ))}
      </div>
      <div className="rounded-xl border border-[#E8E4DE] bg-white p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6B6B6B]">
          Dashboard Redesign PRD
        </p>
        <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-[#2B2D33]">
          ## Goals — cut time-to-insight 40%
        </p>
        <p className="font-mono text-[11px] leading-relaxed text-[#6B6B6B]">
          ## Stories — PM builds view in &lt;4 min
        </p>
        <p className="font-mono text-[11px] leading-relaxed text-[#6B6B6B]">
          ## Handoff — 3 eng tickets ready
        </p>
      </div>
      <p className="text-[11px] text-[#8FB52E]">✓ Company profile validated</p>
    </div>
  );
}

function CodePanel() {
  return (
    <div className="space-y-2 px-4 pb-4 pt-2">
      <div className="flex items-center justify-between text-[11px] text-[#6B6B6B]">
        <span className="font-mono">DashboardGrid.tsx</span>
        <span className="at-pill px-2 py-0.5 text-[10px]">Ananta</span>
      </div>
      <div className="rounded-xl bg-[#2B2D33] p-3 font-mono text-[11px] leading-relaxed text-[#E8E4DE]">
        <p>
          <span className="text-[#F2C94C]">export function</span> DashboardGrid() {"{"}
        </p>
        <p className="pl-3 text-[#D9B8E8]">const {"{ widgets }"} = useDashboard();</p>
        <p className="pl-3">return &lt;Grid layout=&#123;widgets&#125; /&gt;;</p>
        <p>{"}"}</p>
        <p className="mt-2 text-[#A8C53A]">▌ writing implementation plan…</p>
      </div>
      <div className="flex gap-2 text-[10px] text-[#6B6B6B]">
        <span className="rounded bg-[#F2C94C]/25 px-2 py-0.5">3 files matched</span>
        <span className="rounded bg-[#F0EEEB] px-2 py-0.5">Impl. gate</span>
      </div>
    </div>
  );
}

function QaPanel({ activeCase }) {
  return (
    <div className="space-y-2.5 px-4 pb-4 pt-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#6B6B6B]">
          Test validation
        </span>
        <span className="at-pill px-2 py-0.5 text-[10px]">Neel</span>
      </div>
      <ul className="space-y-1.5">
        {QA_CASES.map((tc, i) => {
          const done = i < activeCase;
          const active = i === activeCase;
          return (
            <li
              key={tc}
              className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] leading-tight ${
                active
                  ? "bg-[#D9B8E8]/30 text-[#2B2D33]"
                  : done
                    ? "bg-[#A8C53A]/12 text-[#2B2D33]"
                    : "bg-[#F0EEEB] text-[#6B6B6B]"
              }`}
            >
              <span
                className={`flex size-4 shrink-0 items-center justify-center rounded-full text-[9px] ${
                  done ? "bg-[#A8C53A] text-white" : active ? "bg-[#C49EDB] text-white" : "bg-white"
                }`}
              >
                {done ? "✓" : active ? "…" : ""}
              </span>
              {tc}
            </li>
          );
        })}
      </ul>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#F0EEEB]">
        <div
          className="h-full rounded-full bg-[#C49EDB] transition-[width] duration-700 ease-out"
          style={{ width: `${((activeCase + 1) / QA_CASES.length) * 100}%` }}
        />
      </div>
      <p className="text-[11px] text-[#6B6B6B]">
        Coverage: <strong className="text-[#2B2D33]">{Math.round(((activeCase + 1) / QA_CASES.length) * 95)}%</strong>
      </p>
    </div>
  );
}

const PANELS = [PrdPanel, CodePanel, QaPanel];

export default function HeroVisualization({ variant = "default", onPhaseChange }) {
  const rootRef = useRef(null);
  const activeRef = useRef(0);
  const transitioningRef = useRef(false);
  const [phase, setPhase] = useState(0);
  const [qaCase, setQaCase] = useState(0);

  const showPanel = useCallback((index) => {
    const root = rootRef.current;
    if (!root || transitioningRef.current || activeRef.current === index) return;

    const panels = root.querySelectorAll("[data-hero-panel]");
    const tabs = root.querySelectorAll("[data-hero-tab]");
    const from = activeRef.current;
    const out = panels[from];
    const inn = panels[index];

    transitioningRef.current = true;
    activeRef.current = index;
    setPhase(index);
    onPhaseChange?.(index);
    if (index === 2) setQaCase(0);

    const tl = gsap.timeline({
      onComplete: () => {
        transitioningRef.current = false;
      },
    });

    tl.to(out, {
      opacity: 0,
      y: -8,
      duration: 0.28,
      ease: "power2.in",
      onComplete: () => gsap.set(out, { visibility: "hidden", pointerEvents: "none" }),
    })
      .set(inn, { visibility: "visible", pointerEvents: "auto", y: 10, opacity: 0 })
      .to(inn, { opacity: 1, y: 0, duration: 0.38, ease: "power2.out" })
      .to(
        tabs,
        { scale: 1, opacity: 0.45, duration: 0.15 },
        0
      )
      .to(
        tabs[index],
        { scale: 1, opacity: 1, duration: 0.2 },
        0.15
      );
  }, [onPhaseChange]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const panels = root.querySelectorAll("[data-hero-panel]");
    gsap.set(panels, { opacity: 0, visibility: "hidden", pointerEvents: "none", y: 10 });
    gsap.set(panels[0], { opacity: 1, visibility: "visible", pointerEvents: "auto", y: 0 });
    onPhaseChange?.(0);

    const phaseTimer = setInterval(() => {
      showPanel((activeRef.current + 1) % PHASES.length);
    }, 5500);

    return () => clearInterval(phaseTimer);
  }, [showPanel, onPhaseChange]);

  useEffect(() => {
    if (phase !== 2) return undefined;
    const t = setInterval(() => {
      setQaCase((c) => (c < QA_CASES.length - 1 ? c + 1 : c));
    }, 1100);
    return () => clearInterval(t);
  }, [phase]);

  const isLaptop = variant === "laptop";

  return (
    <div
      ref={rootRef}
      data-hero-mock
      className={`at-card w-full text-left shadow-2xl ${
        isLaptop ? "at-hero-laptop-viz max-w-none rounded-none" : "max-w-[460px] overflow-hidden"
      }`}
    >
      <div
        className={`flex items-center gap-1 border-b border-[#E8E4DE] bg-[#FAF7F0] ${
          isLaptop ? "px-2 py-1.5" : "px-3 py-2.5"
        }`}
      >
        {PHASES.map((p, i) => (
          <button
            key={p.id}
            type="button"
            data-hero-tab
            onClick={() => showPanel(i)}
            className={`flex flex-1 items-center justify-center gap-1 rounded-full font-semibold transition-colors ${
              isLaptop ? "px-1.5 py-1 text-[9px]" : "gap-1.5 px-2 py-1.5 text-[11px]"
            }`}
            style={{
              background: phase === i ? `${p.color}22` : "transparent",
              color: phase === i ? "#2B2D33" : "#6B6B6B",
              opacity: phase === i ? 1 : 0.45,
            }}
          >
            <span className="size-1.5 rounded-full" style={{ background: p.color }} />
            {p.label}
          </button>
        ))}
      </div>

      {/* Fixed-height stage — panels share one grid cell, only one visible at a time */}
      <div className={`grid grid-cols-1 grid-rows-1 ${isLaptop ? "at-hero-laptop-stage-grid" : "min-h-[300px]"}`}>
        {PHASES.map((p, i) => {
          const Panel = PANELS[i];
          return (
            <div
              key={p.id}
              data-hero-panel
              className="col-start-1 row-start-1 flex flex-col"
              style={{ visibility: i === 0 ? "visible" : "hidden", opacity: i === 0 ? 1 : 0 }}
            >
              <div
                className={`flex shrink-0 items-center gap-2 border-b border-[#E8E4DE]/60 text-[#6B6B6B] ${
                  isLaptop ? "px-2.5 py-1 text-[9px]" : "px-4 py-2 text-[11px]"
                }`}
              >
                <span className="size-2 rounded-full" style={{ background: p.color }} />
                {p.agent} · {i === 0 ? "Discovery → PRD" : i === 1 ? "Implementation" : "Test validation"}
              </div>
              <div className={`min-h-0 flex-1 ${isLaptop ? "overflow-hidden" : ""}`}>
                {i === 2 ? <QaPanel activeCase={qaCase} /> : <Panel />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
