import { motion } from "framer-motion";
import { EASE } from "../lib/motion";

/**
 * Hero pipeline: three connected agent nodes with traveling light dots on
 * animated edges. Pure SVG + Framer Motion, no canvas. Designed to feel like
 * a system that is calmly thinking, not a marketing celebration.
 */
const NODES = [
  { id: "product", label: "Product Agent", x: 120, y: 130 },
  { id: "engineering", label: "Engineering Agent", x: 420, y: 130 },
  { id: "qa", label: "QA Agent", x: 720, y: 130 },
];

const EDGES = [
  { from: NODES[0], to: NODES[1], delay: 0 },
  { from: NODES[1], to: NODES[2], delay: 1.4 },
];

function Node({ x, y, label, delay = 0, isCenter = false }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {/* Soft glow halo */}
      <circle r="40" fill="url(#nodeGlow)" opacity="0.55" />

      {/* Outer pulse ring */}
      <motion.circle
        r="28"
        fill="none"
        stroke="#6366F1"
        strokeWidth="0.8"
        initial={{ scale: 1, opacity: 0.55 }}
        animate={{ scale: [1, 2.2], opacity: [0.55, 0] }}
        transition={{
          duration: 2.6,
          ease: EASE,
          repeat: Infinity,
          delay,
        }}
        style={{ transformOrigin: "center" }}
      />
      <motion.circle
        r="28"
        fill="none"
        stroke="#6366F1"
        strokeWidth="0.8"
        initial={{ scale: 1, opacity: 0.45 }}
        animate={{ scale: [1, 2.2], opacity: [0.45, 0] }}
        transition={{
          duration: 2.6,
          ease: EASE,
          repeat: Infinity,
          delay: delay + 1.1,
        }}
        style={{ transformOrigin: "center" }}
      />

      {/* Static hairline ring */}
      <circle r="28" fill="none" stroke="#2A2A3D" strokeWidth="1" />

      {/* Core */}
      <circle
        r="20"
        fill="#0E0E18"
        stroke={isCenter ? "#6366F1" : "#2A2A3D"}
        strokeWidth="1"
      />
      <circle r="6" fill="#6366F1" />
      <circle r="6" fill="#6366F1" opacity="0.3">
        <animate
          attributeName="r"
          values="6;9;6"
          dur="2.4s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="0.3;0;0.3"
          dur="2.4s"
          repeatCount="indefinite"
        />
      </circle>

      {/* Label */}
      <g transform="translate(0 60)">
        <text
          textAnchor="middle"
          className="fill-ink"
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 11,
            letterSpacing: "0.12em",
          }}
        >
          {label.toUpperCase()}
        </text>
        <text
          y="14"
          textAnchor="middle"
          className="fill-ink-mute"
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 9,
            letterSpacing: "0.12em",
          }}
        >
          ACTIVE
        </text>
      </g>
    </g>
  );
}

function Edge({ from, to, delay = 0 }) {
  const pathD = `M ${from.x + 28} ${from.y} L ${to.x - 28} ${to.y}`;

  return (
    <g>
      {/* Base hairline */}
      <path d={pathD} stroke="#1E1E2E" strokeWidth="1" fill="none" />

      {/* Animated draw-in indigo path */}
      <motion.path
        d={pathD}
        stroke="#6366F1"
        strokeWidth="1.25"
        fill="none"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 0.65 }}
        transition={{ duration: 1.2, ease: EASE, delay }}
      />

      {/* Traveling dot — three offset packets */}
      {[0, 1, 2].map((i) => (
        <motion.circle
          key={i}
          r="3.2"
          fill="#F0EEE8"
          initial={{ opacity: 0 }}
          animate={{
            opacity: [0, 1, 1, 0],
            offsetDistance: ["0%", "100%"],
          }}
          transition={{
            duration: 2.6,
            ease: "linear",
            repeat: Infinity,
            delay: delay + 1.2 + i * 0.85,
            times: [0, 0.05, 0.95, 1],
          }}
          style={{
            offsetPath: `path('${pathD}')`,
            offsetRotate: "0deg",
            filter: "drop-shadow(0 0 6px rgba(99,102,241,0.9))",
          }}
        />
      ))}
    </g>
  );
}

export default function HeroPipeline() {
  return (
    <div className="relative mx-auto w-full max-w-3xl">
      {/* Section label rail above */}
      <div className="absolute -top-7 left-0 right-0 flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.2em] text-ink-mute">
        <span>Jira ticket in</span>
        <span className="hidden sm:inline">Validated spec out</span>
      </div>

      <div className="relative rounded-xl border border-hairline bg-surface/40 backdrop-blur-[2px] shadow-glow-soft">
        {/* Grid inside the panel */}
        <div className="grid-bg-fine absolute inset-0 rounded-xl opacity-60 pointer-events-none" />

        <svg
          viewBox="0 0 840 260"
          role="img"
          aria-label="Animated pipeline showing Product Agent, Engineering Agent, and QA Agent connected by data flow"
          className="relative w-full h-auto"
        >
          <defs>
            <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#6366F1" stopOpacity="0.5" />
              <stop offset="60%" stopColor="#6366F1" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#6366F1" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="edgePulse" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#6366F1" stopOpacity="0" />
              <stop offset="50%" stopColor="#6366F1" stopOpacity="1" />
              <stop offset="100%" stopColor="#6366F1" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Input tag (left) */}
          <g transform="translate(40 130)">
            <rect
              x="-30"
              y="-12"
              width="60"
              height="24"
              rx="4"
              fill="#0E0E18"
              stroke="#2A2A3D"
            />
            <text
              textAnchor="middle"
              y="4"
              className="fill-ink-dim"
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: 10,
                letterSpacing: "0.1em",
              }}
            >
              JIRA-1287
            </text>
          </g>
          <path
            d="M 70 130 L 92 130"
            stroke="#2A2A3D"
            strokeWidth="1"
            fill="none"
          />

          {EDGES.map((e, i) => (
            <Edge key={i} from={e.from} to={e.to} delay={e.delay} />
          ))}

          {/* Output tag (right) */}
          <path
            d="M 748 130 L 770 130"
            stroke="#2A2A3D"
            strokeWidth="1"
            fill="none"
          />
          <g transform="translate(800 130)">
            <rect
              x="-30"
              y="-12"
              width="60"
              height="24"
              rx="4"
              fill="#0E0E18"
              stroke="#2A2A3D"
            />
            <text
              textAnchor="middle"
              y="4"
              className="fill-indigo"
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: 10,
                letterSpacing: "0.1em",
              }}
            >
              SHIPPED
            </text>
          </g>

          {NODES.map((n, i) => (
            <Node
              key={n.id}
              {...n}
              delay={i * 0.4}
              isCenter={i === 1}
            />
          ))}
        </svg>

        {/* Bottom rail — system telemetry */}
        <div className="grid grid-cols-3 divide-x divide-hairline border-t border-hairline">
          {[
            { k: "Context loaded", v: "12 docs" },
            { k: "Gates passed", v: "3 / 3" },
            { k: "Latency", v: "1.2s" },
          ].map((m) => (
            <div
              key={m.k}
              className="flex items-center justify-between px-4 py-2.5"
            >
              <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-mute">
                {m.k}
              </span>
              <span className="font-mono text-[11.5px] text-ink">{m.v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
