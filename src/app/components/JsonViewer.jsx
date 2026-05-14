import { useState } from "react";

export default function JsonViewer({ value, maxHeight = 320 }) {
  const [copied, setCopied] = useState(false);
  const formatted = (() => {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  })();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(formatted);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1400);
        }}
        className="absolute right-2 top-2 z-10 rounded-md border border-hairline bg-canvas/70 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute hover:text-ink transition-colors"
      >
        {copied ? "Copied" : "Copy"}
      </button>
      <pre
        className="overflow-auto rounded-lg border border-hairline bg-[#0A0A13]/80 p-4 font-mono text-[12px] leading-6 text-ink-dim"
        style={{ maxHeight }}
      >
        {colorize(formatted)}
      </pre>
    </div>
  );
}

function colorize(json) {
  // Lightweight syntax tint that keeps the monospaced feel.
  const tokens = json.split(/(".*?":|".*?"|\btrue\b|\bfalse\b|\bnull\b|-?\d+\.?\d*)/g);
  return tokens.map((tok, i) => {
    if (/^".*":$/.test(tok)) return <span key={i} className="text-indigo">{tok}</span>;
    if (/^"/.test(tok)) return <span key={i} className="text-success/90">{tok}</span>;
    if (/^(true|false|null)$/.test(tok)) return <span key={i} className="text-warning">{tok}</span>;
    if (/^-?\d/.test(tok)) return <span key={i} className="text-ink">{tok}</span>;
    return <span key={i}>{tok}</span>;
  });
}
