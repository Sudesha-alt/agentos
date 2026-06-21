const TABS = [
  { id: "active", label: "Active ticket" },
  { id: "awaiting_ananta", label: "Awaiting Ananta" },
  { id: "prd_library", label: "PRD library" },
];

export default function VirinWorkspaceTabs({ activeTab, onTabChange, counts = {} }) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-app-border pb-3">
      {TABS.map((tab) => {
        const count =
          tab.id === "awaiting_ananta"
            ? counts.awaitingAnanta
            : tab.id === "prd_library"
              ? counts.prdLibrary
              : null;
        const selected = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`rounded-full px-4 py-2 text-[12px] font-medium transition ${
              selected
                ? "bg-indigo text-white shadow-sm"
                : "border border-app-border bg-app-surface text-app-ink-dim hover:border-indigo/30 hover:text-indigo"
            }`}
          >
            {tab.label}
            {count != null && count > 0 ? (
              <span
                className={`ml-2 inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 font-mono text-[10px] ${
                  selected ? "bg-white/20 text-white" : "bg-indigo/10 text-indigo"
                }`}
              >
                {count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export { TABS as VIRIN_WORKSPACE_TABS };
