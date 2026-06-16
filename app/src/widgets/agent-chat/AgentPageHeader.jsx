import { PageIntro } from "../../shared/ui/Panel";
import { getAgentChatConfig } from "./agentChatConfig";

export function AgentPageHeader({ domain }) {
  const config = getAgentChatConfig(domain);
  const principles = config.principles ?? [];

  return (
    <header className="grid gap-4 pb-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
      <PageIntro kicker={config.role} title={config.displayName} />
      {principles.length > 0 ? (
        <ul className="flex flex-wrap gap-2 lg:justify-end">
          {principles.map((p) => (
            <li
              key={p}
              className="rounded-full border border-app-border bg-app-surface-muted/50 px-3 py-1 text-[11px] text-app-ink-dim"
            >
              {p}
            </li>
          ))}
        </ul>
      ) : null}
    </header>
  );
}
