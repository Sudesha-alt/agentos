import { motion } from "framer-motion";
import { EASE } from "../lib/motion";

const nodes = [
  { label: "Entry Layer", x: 42, y: 54, w: 142, h: 46 },
  { label: "Context Layer", x: 240, y: 54, w: 150, h: 46 },
  { label: "Agent Pipeline", x: 142, y: 150, w: 178, h: 52, active: true },
  { label: "Validation Gates", x: 372, y: 150, w: 170, h: 52, active: true },
  { label: "State Machine", x: 146, y: 260, w: 160, h: 46 },
  { label: "Human Override", x: 360, y: 260, w: 168, h: 46 },
];

const lines = [
  [184, 77, 240, 77, true],
  [315, 100, 240, 150, true],
  [320, 176, 372, 176, true],
  [231, 202, 226, 260, false],
  [457, 202, 444, 260, false],
  [306, 283, 360, 283, false],
];

export default function ArchitectureDiagram() {
  return (
    <div className="relative rounded-2xl border border-hairline bg-surface/40 p-4 shadow-glow-soft">
      <div className="grid-bg-fine absolute inset-0 rounded-2xl opacity-45 pointer-events-none" />
      <svg
        viewBox="0 0 590 360"
        className="relative h-auto w-full"
        role="img"
        aria-label="Architecture diagram showing Entry Layer, Context Layer, Agent Pipeline, Validation Gates, State Machine, and Human Override"
      >
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {lines.map(([x1, y1, x2, y2, active], i) => (
          <g key={`${x1}-${y1}-${x2}-${y2}`}>
            <path
              d={`M${x1} ${y1} L${x2} ${y2}`}
              stroke="#1E1E2E"
              strokeWidth="1"
            />
            {active && (
              <motion.path
                d={`M${x1} ${y1} L${x2} ${y2}`}
                stroke="#6366F1"
                strokeWidth="1.2"
                initial={{ pathLength: 0, opacity: 0 }}
                whileInView={{ pathLength: 1, opacity: 0.8 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 1, delay: i * 0.12, ease: EASE }}
                filter="url(#glow)"
              />
            )}
          </g>
        ))}

        {nodes.map((node, i) => (
          <motion.g
            key={node.label}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.55, delay: i * 0.08, ease: EASE }}
          >
            {node.active && (
              <rect
                x={node.x - 10}
                y={node.y - 10}
                width={node.w + 20}
                height={node.h + 20}
                rx="14"
                fill="#6366F1"
                opacity="0.08"
              />
            )}
            <rect
              x={node.x}
              y={node.y}
              width={node.w}
              height={node.h}
              rx="10"
              fill="#0E0E18"
              stroke={node.active ? "#6366F1" : "#2A2A3D"}
              strokeWidth="1"
            />
            <circle
              cx={node.x + 20}
              cy={node.y + node.h / 2}
              r="4"
              fill={node.active ? "#6366F1" : "#6B6B7B"}
            />
            <text
              x={node.x + 34}
              y={node.y + node.h / 2 + 4}
              className="fill-ink"
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: 11,
                letterSpacing: "0.08em",
              }}
            >
              {node.label}
            </text>
          </motion.g>
        ))}

        <text
          x="42"
          y="336"
          className="fill-ink-mute"
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 10,
            letterSpacing: "0.14em",
          }}
        >
          ACTIVE PATH: INTAKE → CONTEXT → AGENTS → GATES
        </text>
      </svg>
    </div>
  );
}
