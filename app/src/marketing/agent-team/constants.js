export const NAV_LINKS = [
  { label: "Agents", href: "#agents" },
  { label: "One Team", href: "#shared-brain" },
  { label: "Clients", href: "#clients" },
  { label: "Contact", href: "/contact" },
];

/** Teammate intros — order matches radial triangle (Virin → Ananta → Neel) */
export const AGENTS = [
  {
    id: "virin",
    number: "01",
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
    appPath: "/app/codebase",
  },
  {
    id: "neel",
    number: "03",
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

/** Radial layout: clockwise handoff Virin → Ananta → Neel */
export const RADIAL_AGENTS = [
  {
    id: "virin",
    role: "Product",
    color: "#A8C53A",
    colorSoft: "rgba(168,197,58,0.35)",
    x: 50,
    y: 18,
  },
  {
    id: "ananta",
    role: "Tech",
    color: "#F2C94C",
    colorSoft: "rgba(242,201,76,0.35)",
    x: 84,
    y: 76,
  },
  {
    id: "neel",
    role: "QA",
    color: "#C49EDB",
    colorSoft: "rgba(201,158,219,0.35)",
    x: 16,
    y: 76,
  },
];

export const INSIGHT_CHIPS = [
  "Pattern reused",
  "Edge case caught",
  "Module mapped",
  "Gate passed",
];

export const SHARED_BRAIN = {
  headline: "One team. One shared brain. Smarter every loop.",
  subhead:
    "Every handoff feeds the intelligence core — company context, codebase memory, and pipeline history compound with each lap.",
  coreLabel: "Intelligence",
};

export const HERO_STATS = [
  { value: "7", label: "Pipeline stages" },
  { value: "3", label: "Validation gates" },
  { value: "1", label: "Virtual product team" },
];

export const INTEGRATIONS = [
  { id: "jira", name: "Jira", detail: "Tickets & writeback", logo: "/marketing/integrations/jira.png", height: 32, minWidth: 88 },
  { id: "github", name: "GitHub", detail: "Repos & PRs", logo: "/marketing/integrations/github.png", height: 40, minWidth: 40 },
  { id: "bitbucket", name: "Bitbucket", detail: "Git hosting", logo: "/marketing/integrations/bitbucket.png", height: 28, minWidth: 120 },
  { id: "confluence", name: "Confluence", detail: "Docs & wiki", logo: "/marketing/integrations/confluence.png", height: 26, minWidth: 130 },
  { id: "supabase", name: "Supabase", detail: "Vector index", logo: "/marketing/integrations/supabase.png", height: 30, minWidth: 140 },
  { id: "grafana", name: "Grafana", detail: "Observability", logo: "/marketing/integrations/grafana.png", height: 36, minWidth: 110 },
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
  { value: "1", label: "virtual product team" },
];

export const HERO = {
  badge: "Jira · GitHub · Bitbucket · Confluence · Supabase · Grafana",
  headline: "The AI product team for your entire pipeline",
  subhead:
    "Virin, Ananta, and Neel work as teammates — one shared brain makes every loop smarter.",
  cta: "Get Started",
  ctaHref: "/login",
  secondaryCta: "Meet the Agents",
  secondaryHref: "#agents",
};
