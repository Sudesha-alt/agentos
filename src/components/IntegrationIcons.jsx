export const integrations = [
  {
    id: "jira",
    name: "Jira",
    tooltip:
      "Reads tickets, attaches PRDs and test matrices, syncs validation state.",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" aria-hidden>
        <path
          d="M16 4 L28 16 L22 16 L16 22 L10 16 L4 16 Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path
          d="M16 10 L22 16 L16 22 L10 16 Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
          opacity="0.6"
        />
      </svg>
    ),
  },
  {
    id: "confluence",
    name: "Confluence",
    tooltip:
      "Pulls product docs and design specs into the agent context window.",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" aria-hidden>
        <path
          d="M5 22 C 10 14, 14 14, 16 18 C 18 22, 22 22, 27 14"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <path
          d="M5 10 C 10 18, 14 18, 16 14 C 18 10, 22 10, 27 18"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          opacity="0.6"
        />
      </svg>
    ),
  },
  {
    id: "github",
    name: "GitHub",
    tooltip:
      "Maps acceptance criteria to PRs and checks build output against the spec.",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" aria-hidden>
        <circle cx="16" cy="16" r="11" stroke="currentColor" strokeWidth="1.4" />
        <path
          d="M10 19 C 11 17, 13 17, 14 18 M22 19 C 21 17, 19 17, 18 18"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <path
          d="M14 23 L14 26 M18 23 L18 26"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: "linear",
    name: "Linear",
    tooltip:
      "Two-way sync with Linear issues and cycles. Preserves your existing workflow.",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" aria-hidden>
        <path d="M6 14 L18 26" stroke="currentColor" strokeWidth="1.4" />
        <path d="M6 18 L14 26" stroke="currentColor" strokeWidth="1.4" />
        <path d="M6 22 L10 26" stroke="currentColor" strokeWidth="1.4" />
        <path d="M6 10 L22 26" stroke="currentColor" strokeWidth="1.4" />
        <path d="M8 6 L26 24" stroke="currentColor" strokeWidth="1.4" />
        <path d="M12 4 L28 20" stroke="currentColor" strokeWidth="1.4" />
        <path d="M18 4 L28 14" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    ),
  },
  {
    id: "notion",
    name: "Notion",
    tooltip:
      "Imports product briefs and roadmap pages as long-term context memory.",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" aria-hidden>
        <rect
          x="6"
          y="6"
          width="20"
          height="20"
          rx="3"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <path
          d="M11 10 L11 22 M11 10 L20 22 M21 10 L21 22"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];
