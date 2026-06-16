export const NAV_LINKS = [
  { label: "Agents", href: "#agents" },
  { label: "Pricing", href: "#pricing" },
  { label: "Clients", href: "#clients" },
  { label: "Contact", href: "/contact" },
];

/** Teammate intros — Virin → Ananta → Neel */
export const AGENTS = [
  {
    id: "virin",
    number: "01",
    chapter: 1,
    chapterRoman: "I",
    chapterTitle: "Product Discovery",
    chapterSubtitle: "Virin shapes the spec your team can ship",
    name: "Virin",
    role: "Product",
    roleDetail: "PM & discovery",
    gradient: "olive",
    image: "/marketing/agents/virin.png",
    headline: "Shapes the spec your team can ship",
    teammateIntro:
      "Hi, I'm Virin — your Product teammate. I take rough ideas and Jira tickets, run discovery against company context, and hand off a PRD the whole team trusts.",
    body: "Discovery Q&A, company validation, and PRD gates — all before engineering touches the ticket.",
    bullets: [
      "Grounded discovery from company + codebase",
      "PRD with acceptance criteria",
      "Clean handoff to Tech and QA",
    ],
    sectionId: "agent-virin",
    appPath: "/app/pm-agents",
  },
  {
    id: "ananta",
    number: "02",
    chapter: 2,
    chapterRoman: "II",
    chapterTitle: "Engineering & Build",
    chapterSubtitle: "Ananta plans against your real codebase",
    name: "Ananta",
    role: "Tech",
    roleDetail: "Build & integrate",
    gradient: "amber",
    image: "/marketing/agents/ananta.png",
    headline: "Builds against your real repository",
    teammateIntro:
      "I'm Ananta — your Tech teammate. I read the PRD, search your indexed repo, and draft implementation steps your engineers can execute without guesswork.",
    body: "Codebase intelligence, implementation plans, and engineering gates — aligned to what Virin specified.",
    bullets: [
      "Module search across your GitHub index",
      "Step-by-step implementation plan",
      "Engineering gate before QA",
    ],
    sectionId: "agent-ananta",
    appPath: "/app/ananta",
  },
  {
    id: "neel",
    number: "03",
    chapter: 3,
    chapterRoman: "III",
    chapterTitle: "QA & Release",
    chapterSubtitle: "Neel signs off before anything ships",
    name: "Neel",
    role: "QA",
    roleDetail: "Test & release",
    gradient: "lavender",
    image: "/marketing/agents/neel.png",
    headline: "Signs off before anything ships",
    teammateIntro:
      "I'm Neel — your QA teammate. I generate test cases from the PRD, track coverage, run canary checks, and hold the gate until we're confident — then write back to Jira.",
    body: "Test validation, QA Center tracking, and completion writeback — closing the loop for the team.",
    bullets: [
      "Test cases from acceptance criteria",
      "QA coverage threshold + canary pass",
      "Jira completion writeback",
    ],
    sectionId: "agent-neel",
    appPath: "/app/qa",
  },
];

/** Marketing chapter cards — three agents + pipeline capstone (Cofounder-style books). */
export const AGENT_CHAPTERS = [
  ...AGENTS,
  {
    id: "pipeline",
    number: "04",
    chapter: 4,
    chapterRoman: "IV",
    chapterTitle: "One Pipeline",
    chapterSubtitle: "Three agents, one full pipeline",
    name: "AgentOS Pipeline",
    role: "Full loop",
    roleDetail: "Jira → PRD → build → QA",
    gradient: "cream",
    image: null,
    coverAgents: ["virin", "ananta", "neel"],
    headline: "Every handoff compounds team intelligence",
    teammateIntro:
      "Virin, Ananta, and Neel hand off in sequence — company context, codebase memory, and pipeline history carry forward on every ticket.",
    body: "From the first Jira ticket to completion writeback, the full pipeline runs with human gates at every critical step.",
    bullets: [
      "End-to-end flow from Jira ticket to completion",
      "Human approval at PRD, engineering, and QA gates",
      "Audit trail and writeback to Jira when done",
    ],
    sectionId: "agent-pipeline",
    appPath: "/login",
  },
];

export const HERO_STATS = [
  { value: "7", label: "Pipeline stages" },
  { value: "3", label: "Validation gates" },
  { value: "∞", label: "Tickets per pipeline" },
];

export const INTEGRATIONS = [
  { id: "jira", name: "Jira", detail: "Tickets & writeback", logo: "/marketing/integrations/jira-wordmark.svg", height: 30, minWidth: 88 },
  { id: "github", name: "GitHub", detail: "Repos & PRs", logo: "/marketing/integrations/github-wordmark.svg", height: 32, minWidth: 110 },
  { id: "bitbucket", name: "Bitbucket", detail: "Git hosting", logo: "/marketing/integrations/bitbucket-wordmark.svg", height: 26, minWidth: 120 },
  { id: "confluence", name: "Confluence", detail: "Docs & wiki", logo: "/marketing/integrations/confluence-wordmark.svg", height: 24, minWidth: 130 },
  { id: "supabase", name: "Supabase", detail: "Vector index", logo: "/marketing/integrations/supabase-wordmark.svg", height: 28, minWidth: 130 },
  { id: "grafana", name: "Grafana", detail: "Observability", logo: "/marketing/integrations/grafana-wordmark.svg", height: 30, minWidth: 100 },
];

export const CLIENT_LOGOS = [
  "Northwind Labs",
  "Brightstack",
  "Orbit Commerce",
  "Fieldnote",
  "Relay Systems",
  "Harbor AI",
];

export const CLIENT_METRICS = [
  { value: "Jira", label: "ticket → PRD pipeline" },
  { value: "3", label: "validation gates before ship" },
  { value: "100%", label: "audit trail coverage" },
];

export const HERO = {
  headline: "AgentOS lets you run an entire pipeline with agents",
  subhead: "Discovery, engineering, and QA — from Jira to ship.",
  cta: "Get started",
  ctaHref: "/login",
  secondaryCta: "Meet the agents",
  secondaryHref: "#agents",
};
