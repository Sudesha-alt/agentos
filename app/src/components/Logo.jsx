import { Link } from "react-router-dom";

export default function Logo({ className = "", href = "#top", variant = "dark" }) {
  const isLight = variant === "light";
  const labelClass = isLight
    ? "text-app-ink group-hover:text-app-charcoal"
    : "text-ink/90 group-hover:text-ink";
  const centerFill = isLight ? "fill-app-ink" : "fill-ink";

  const content = (
    <>
      <svg
        width="22"
        height="22"
        viewBox="0 0 32 32"
        fill="none"
        className="shrink-0"
        aria-hidden="true"
      >
        <circle cx="9" cy="16" r="2.6" fill="#8B7CF6" />
        <circle cx="16" cy="16" r="2.6" className={centerFill} />
        <circle cx="23" cy="16" r="2.6" fill="#8B7CF6" />
        <path d="M11.6 16 H13.4 M18.6 16 H20.4" stroke="#8B7CF6" strokeWidth="1.2" />
      </svg>
      <span
        className={`text-[15px] font-semibold tracking-tight transition-colors ${labelClass} ${className}`}
      >
        AgentOS
      </span>
    </>
  );

  if (href.startsWith("/")) {
    return (
      <Link to={href} className="group inline-flex items-center gap-2.5" aria-label="Agentos home">
        {content}
      </Link>
    );
  }

  return (
    <a href={href} className="group inline-flex items-center gap-2.5" aria-label="Agentos home">
      {content}
    </a>
  );
}
