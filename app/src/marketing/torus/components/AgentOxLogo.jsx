export function AgentOxLogo({ size = 44, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <rect x="1" y="1" width="42" height="42" stroke="currentColor" strokeWidth="1" />
      <path
        d="M12 32 L22 10 L32 32 M16 24 H28"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="square"
      />
      <circle cx="22" cy="22" r="3" fill="var(--accent, #e67e22)" />
    </svg>
  );
}
