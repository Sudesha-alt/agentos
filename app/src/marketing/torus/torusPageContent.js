/** AgentOX marketing copy structured for Torus-style layout. */

export const BRAND = {
  name: "AGENTOX",
  tagline: "FROM JIRA TICKET TO SHIPPED CODE",
  footerTagline: "Built for engineering teams that ship.",
  email: "sudesha@agentox.io",
};

export const NAV_LINKS = [
  { label: "INTELLIGENCE", href: "#platform" },
  { label: "PIPELINE", href: "#workflow" },
];

export const HERO = {
  headline: "Agents that think in Jira tickets, PRDs, and pull requests.",
  description:
    "AgentOX orchestrates Product, Engineering, and QA agents through your entire feature lifecycle — with validation gates that ensure what gets built is exactly what was specified.",
  primaryCta: "REQUEST EARLY ACCESS",
  primaryHref: "/login",
  secondaryCta: "WATCH DEMO",
  secondaryHref: "#platform",
  fallback: "or email",
};

export const SECTION_01 = {
  id: "platform",
  label: "01 PIPELINE INTELLIGENCE",
  intro:
    "Connect Jira and GitHub. AgentOX runs discovery, implementation, and QA in sequence — with validation gates between every handoff. Product sees PRDs and gap analysis. Engineering sees code and PRs. QA sees test coverage and failure reports. Same ticket, same pipeline.",
  mockup: {
    projectTitle: "AUTH-2847 OAuth Scope Expansion",
    productMeta: {
      flags: "2 gaps · 1 ambiguity",
      coverage: "PRD 94% complete",
    },
    engMeta: {
      flags: "3 criteria unmapped",
      coverage: "12/15 files planned",
    },
    productFlags: [
      {
        icon: "⚠",
        lines: [
          "Acceptance criterion missing for token refresh failure path",
          "  vs. similar ticket AUTH-2103 (had explicit Given/When/Then)",
          "acceptance_criteria_completeness",
        ],
      },
      {
        icon: "⚠",
        lines: [
          "Scope mentions \"admin users only\" but ticket label says \"all users\"",
          "  vs. product brief Q2-Auth-Scope.pdf",
          "scope_alignment",
        ],
      },
    ],
    engBlock: {
      title: "Implementation Plan, Draft #2",
      meta: ["GENERATED 4m AGO", "SOURCE: Jira AUTH-2847", "CONFIDENCE: 0.88"],
      body: [
        "RECOMMENDATION: PROCEED WITH CHANGES",
        "FILES: 12 modified · 3 new test files",
        "CRITERIA: 13/15 mapped · 2 need PRD clarification",
        "BLOCKERS: None",
      ],
    },
    productSidebar: {
      live: ["Jira ticket AUTH-2847", "Similar tickets (4)", "Product brief Q2"],
      missing: ["Error handling spec", "Rate limit policy"],
      stat: "847 CODEBASE SYMBOLS INDEXED",
    },
    engSidebar: {
      live: ["prd-validation", "implementation-plan"],
      learning: ["test-scaffolding", "canary-run"],
      ready: ["pr-draft", "qa-handoff", "jira-writeback"],
    },
    productNav: ["TICKET", "PRD", "GAPS", "GATE"],
    engNav: ["PLAN", "CODE", "PR", "GATE"],
  },
};

export const SECTION_02 = {
  id: "beyond",
  label: "02 BEYOND A CODING ASSISTANT",
  intro: [
    "Most AI tools for engineering are just coding assistants. You paste a ticket, get a pull request, hope it's right.",
    "One ticket. One PR. No validation.",
    "That's not how shipping works.",
  ],
  points: [
    {
      title: "Full pipeline context, not single prompts",
      body: "AgentOX holds your Jira ticket, PRD, codebase, and test results in context simultaneously. When your acceptance criteria say one thing and your implementation does another, AgentOX doesn't wait for you to notice. It already flagged it at the gate.",
    },
    {
      title: "Proactive, not reactive",
      body: "Coding assistants answer when asked. AgentOX finds gaps before engineering starts, blockers before QA runs, and coverage holes before merge. Three validation gates running against every feature in your sprint.",
    },
    {
      title: "Ships deliverables, not snippets",
      body: "AgentOX doesn't write generic code. It produces structured PRDs with Given/When/Then criteria, implementation plans mapped to your codebase, draft PRs with full descriptions, and QA reports tied to every acceptance criterion.",
    },
  ],
};

export const SECTION_03 = {
  id: "workflow",
  label: "03 WORKFLOW AUTOMATION",
  email: {
    from: "agentox@notifications.agentox.io",
    to: "sarah.chen@company.com",
    subject: "Pipeline complete: AUTH-2847 ready for review",
    body: [
      "Sarah,",
      "",
      "The AUTH-2847 pipeline finished. Virin generated a PRD with 15 acceptance criteria. Ananta opened draft PR #847 with 12 files changed. Neel ran 47 tests — 45 passed, 2 flagged for your review.",
    ],
    output: {
      header: "AGENTOX OUTPUT",
      lines: [
        { label: "STATUS:", value: "AWAITING REVIEW", highlight: true },
        { label: "PRD CONFIDENCE:", value: "94%" },
        { label: "CRITERIA COVERAGE:", value: "13/15 mapped" },
        { label: "QA RESULT:", value: "2 failures (non-blocking)" },
      ],
    },
    closing:
      'If this looks right, reply "approve" and I\'ll route the PR for merge and write results back to Jira.',
    sig: "AgentOX | pipeline: auth-2847 | confidence: 0.91",
  },
  sidebar: [
    {
      label: "GATES",
      title: "Validation at every handoff",
      body: "PRD gate before engineering. Implementation gate before QA. QA gate before merge. Pipeline pauses until you approve or override.",
    },
    {
      label: "WRITE-BACK",
      title: "Jira stays the source of truth",
      body: "PRD attached to ticket. PR linked. QA report uploaded. Status updated. Your team never leaves Jira to understand what happened.",
    },
    {
      label: "AUDIT TRAIL",
      title: "Every action, traceable",
      body: "Full provenance on every output. Which ticket triggered it, which gates passed, which human approved, and what changed between runs.",
    },
  ],
};

export const SECTION_04 = {
  id: "mission",
  label: "04 WHY THIS MATTERS",
  headline: "The most expensive bug is the one you ship twice.",
  body: [
    {
      strong: "30–40% of feature work gets reworked. 23% of sprint capacity lost to handoff degradation. 100× the cost when bugs reach production.",
    },
    "Every sprint, teams lose days to misread requirements, ambiguous acceptance criteria, and tests that stopped being true. When a PM meant one thing and engineering built another, it's not a communication problem — it's a missing governance layer.",
    {
      strong: "AgentOX gives every team the capacity of a full product-engineering-QA loop.",
    },
  ],
};

export const FINAL_CTA = {
  label: "YOUR NEXT STEP",
  headline: "See AgentOX on your next ticket.",
  description:
    "Connect Jira and GitHub. Run your first pipeline in under 30 minutes. We'll show you what three agents and three gates look like on real work.",
  primaryCta: "REQUEST EARLY ACCESS",
  primaryHref: "/login",
  fallback: "or email",
};
