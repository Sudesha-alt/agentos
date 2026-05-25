const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "analysis", label: "Ticket analysis" },
  { id: "history", label: "History" },
  { id: "gaps", label: "Gaps" },
  { id: "prd", label: "PRD" },
];

export default function DiscoverySectionNav({ active, onChange, available }) {
  const ids = available ?? SECTIONS.map((s) => s.id);

  return (
    <nav
      className="flex flex-wrap gap-2 border-b border-hairline px-5 pb-4 pt-1 sm:px-6"
      aria-label="Discovery sections"
    >
      {SECTIONS.filter((s) => ids.includes(s.id)).map((section) => (
        <button
          key={section.id}
          type="button"
          onClick={() => onChange(section.id)}
          className={`rounded-full border px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors ${
            active === section.id
              ? "border-indigo/50 bg-indigo/10 text-indigo"
              : "border-hairline text-ink-dim hover:border-hairline-strong hover:text-ink"
          }`}
        >
          {section.label}
        </button>
      ))}
    </nav>
  );
}
