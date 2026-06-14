import { AGENTS } from "../constants";

const AGENT_IDS = AGENTS.filter((a) => a.image).map((a) => a.id);

export function AgentImage({ agentId, className = "", alt, style }) {
  const agent = AGENTS.find((a) => a.id === agentId);
  if (!agent?.image) return null;
  return (
    <img
      src={agent.image}
      alt={alt ?? `${agent.name} — ${agent.role} agent`}
      className={`object-contain drop-shadow-2xl ${className}`}
      style={style}
      loading="lazy"
      draggable={false}
    />
  );
}

export function AgentAvatarStack({ size = 56 }) {
  return (
    <div className="flex items-center -space-x-3" data-hero-avatars>
      {AGENT_IDS.map((id) => {
        const agent = AGENTS.find((a) => a.id === id);
        return (
          <div
            key={id}
            className="overflow-hidden rounded-full border-[3px] border-white bg-[#FAF7F0] shadow-md"
            style={{ width: size, height: size }}
            data-avatar={id}
          >
            <img
              src={agent.image}
              alt={agent.name}
              className="size-full object-contain object-bottom scale-105"
            />
          </div>
        );
      })}
      <div
        className="flex items-center justify-center rounded-full border-[3px] border-white bg-[#F0EEEB] text-sm font-semibold text-[#6B6B6B] shadow-md"
        style={{ width: size, height: size }}
        title="Add your team"
      >
        +
      </div>
    </div>
  );
}

export function AgentIllustration({ agent, className = "", size = 280 }) {
  const compact = size < 120;
  return (
    <AgentImage
      agentId={agent}
      className={`object-contain object-center ${className}`}
      style={
        compact
          ? { width: size, height: size }
          : { width: size, height: size * 1.2, maxHeight: "min(75vh, 520px)" }
      }
    />
  );
}
