import { AGENTS } from "../../marketing/agent-team/constants";

export function getAgentImage(domain) {
  return AGENTS.find((a) => a.id === domain)?.image ?? null;
}

/** Avatar crop tuned for full-body agent illustrations (face at top). */
export function AgentChatAvatar({ domain, size = 40, className = "" }) {
  const src = getAgentImage(domain);
  if (!src) return null;

  return (
    <div
      className={`shrink-0 overflow-hidden rounded-full border border-app-border bg-[#FAF7F0] ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src={src}
        alt=""
        className="size-full object-contain object-top scale-110"
        draggable={false}
      />
    </div>
  );
}
