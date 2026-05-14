export default function Logo({ className = "", href = "#top" }) {
  return (
    <a
      href={href}
      className={`group inline-flex items-center gap-2.5 ${className}`}
      aria-label="Agentos home"
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 32 32"
        fill="none"
        className="shrink-0"
        aria-hidden="true"
      >
        <circle cx="9" cy="16" r="2.6" fill="#6366F1" />
        <circle cx="16" cy="16" r="2.6" className="fill-ink" />
        <circle cx="23" cy="16" r="2.6" fill="#6366F1" />
        <path
          d="M11.6 16 H13.4 M18.6 16 H20.4"
          stroke="#6366F1"
          strokeWidth="1.2"
        />
      </svg>
      <span className="font-mono text-[13px] tracking-[0.16em] text-ink/90 group-hover:text-ink transition-colors">
        AGENTOS
      </span>
    </a>
  );
}
