/** Marketing page copy — AgentOX landing (design unchanged, content only). */

export const HERO = {
  headline: "From Jira Ticket to Shipped Code.\nWithout Losing What You Actually Meant.",
  subhead:
    "AgentOX orchestrates Product, Engineering, and QA agents through your entire feature lifecycle — with validation gates that ensure what gets built is exactly what was specified.",
  cta: "Request Early Access",
  ctaHref: "/login",
  secondaryCta: "Watch 4-min Demo →",
  secondaryHref: "#solution",
  trustLine:
    "Built for engineering teams who are tired of sprint rework. No credit card required. Setup in under 30 minutes.",
  socialProof: "Trusted by engineering teams at [Company] [Company] [Company]",
};

export const PROBLEM = {
  kicker: "The problem",
  headline:
    "The most expensive problem in software development has nothing to do with writing code.",
  cards: [
    {
      title: "The PRD That Meant Three Different Things",
      body: [
        "A product manager writes requirements. An engineering lead reads them differently. A developer interprets them a third way. QA tests a fourth interpretation. By the time anyone notices, you've lost a sprint.",
        "This happens on 30–40% of all feature work. Nobody talks about it in retrospectives.",
      ],
    },
    {
      title: "The Handoff Tax",
      body: [
        "Every time work moves from Product to Engineering to QA, context gets lost. The original intent degrades. Edge cases disappear. The acceptance criteria that seemed clear in a Jira ticket become ambiguous in a pull request.",
        "The average team loses 23% of sprint capacity to rework caused by this degradation.",
      ],
    },
    {
      title: "The Test Suite That Stopped Being True",
      body: [
        "Tests written at feature delivery time test the world as it was. As the product evolves, the tests don't. Bugs find production before your test suite finds them.",
        "By then, the cost is 100× what it would have been to catch it before the code was written.",
      ],
    },
  ],
};

export const SOLUTION = {
  kicker: "The solution",
  headline: "Three agents. One pipeline. Zero lost context.",
  subhead:
    "AgentOX orchestrates Virin (Product Agent), Ananta (Engineering Agent), and Neel (QA Agent) through a structured pipeline — with validation gates between every handoff that ensure nothing gets lost in translation.",
  pipelineSteps: [
    { label: "JIRA TICKET", detail: "" },
    { label: "VIRIN — PRODUCT AGENT", detail: "Discovers requirements · Fills gaps · Generates PRD" },
    { label: "PRD VALIDATION GATE", detail: "Confidence score · Testability check · Completeness check" },
    { label: "ANANTA — ENGINEERING AGENT", detail: "Reads codebase · Plans implementation · Writes code · Creates PR" },
    { label: "IMPLEMENTATION GATE", detail: "Criteria coverage · Blocker check · Effort validation" },
    { label: "NEEL — QA AGENT", detail: "Generates tests · Executes in sandbox · Analyses failures" },
    { label: "QA VALIDATION GATE", detail: "Coverage check · Failure classification · Risk assessment" },
    { label: "STRUCTURED OUTPUT", detail: "PRD attached to Jira · PR created · QA report attached · Human reviews and approves" },
  ],
};

export const AGENT_DETAILS = {
  virin: {
    roleLabel: "PRODUCT AGENT",
    tagline: "The agent that understands what you actually meant.",
    intro:
      "Virin takes a raw Jira ticket and runs it through a four-stage discovery process — analysing requirements, retrieving historical context from similar past work, identifying every gap and ambiguity, and scoring complexity before generating a PRD that engineering can actually build from.",
    produces: [
      "Structured PRD with Given/When/Then acceptance criteria",
      "Gap analysis with default assumptions documented",
      "Complexity estimate with optimistic/realistic/pessimistic range",
      "Open questions flagged before engineering starts",
      "Confidence score — if below 70%, human review triggered",
    ],
  },
  ananta: {
    roleLabel: "ENGINEERING AGENT",
    tagline: "The agent that builds what was specified. Precisely.",
    intro:
      "Ananta reads your actual codebase — not a description of it — plans the implementation, maps every acceptance criterion to specific code, writes production-quality files that follow your existing patterns, and opens a draft PR with a complete implementation plan attached.",
    produces: [
      "Implementation plan with every file mapped",
      "Code that follows your existing conventions",
      "Every acceptance criterion mapped to specific functions",
      "Draft PR with full description",
      "Test file scaffolding for the QA Agent",
    ],
  },
  neel: {
    roleLabel: "QA AGENT",
    tagline: "The agent that finds what you forgot to test for.",
    intro:
      "Neel reads the PRD, reads the implementation, and generates test scenarios covering every code path — not just the happy paths. It runs tests in an isolated sandbox, classifies every failure by severity, maps each failure to the specific acceptance criterion it violates, and produces a report that tells engineering exactly what to fix and why.",
    produces: [
      "Test cases for every code path — happy, edge, error, security",
      "Test execution results with pass/fail per case",
      "Failure analysis with root cause and remediation steps",
      "Coverage report mapped to acceptance criteria",
      "QA recommendation — approve / request changes / block",
    ],
  },
};

export const DIFFERENTIATION = {
  kicker: "Differentiation",
  headline: "Not another coding assistant.\nThe governance layer your coding assistants are missing.",
  columns: ["", "Claude Code / Copilot", "Cursor / Windsurf", "AgentOX"],
  rows: [
    { feature: "Writes code", values: [true, true, true] },
    { feature: "Validates requirements", values: [false, false, true] },
    { feature: "Multi-agent pipeline", values: [false, false, true] },
    { feature: "Persistent codebase intelligence", values: [false, false, true] },
    { feature: "Organisational memory", values: [false, false, true] },
    { feature: "Human validation gates", values: [false, false, true] },
    { feature: "QA test execution", values: [false, false, true] },
    { feature: "Compliance audit trail", values: [false, false, true] },
    { feature: "Jira-native workflow", values: [false, false, true] },
    { feature: "Learns from corrections", values: [false, false, true] },
  ],
  footerRows: [
    { label: "Scope", values: ["Individual developer", "Individual developer", "Organisation wide"] },
    { label: "Buyer", values: ["Developer", "Developer", "VP Eng / CTO"] },
    { label: "Memory", values: ["Session only", "Session only", "Permanent"] },
  ],
  supporting: [
    "Claude Code and Cursor make individual developers faster at writing code. AgentOX makes your entire organisation faster at shipping the right features, tested, with a complete audit trail.",
    "They are not competing products. AgentOX customers use both — and AgentOX handles everything those tools cannot touch.",
  ],
};

export const INTELLIGENCE = {
  kicker: "Codebase intelligence",
  headline: "Your codebase, understood.\nNot just indexed — intelligent.",
  body:
    "AgentOX builds a living intelligence layer on top of your repository. Every file is read, summarised in plain English, and mapped for relationships. Every agent run adds to this knowledge. Every human correction teaches it something new.\n\nAfter six months of AgentOX running on your codebase, it knows your patterns, your conventions, your failure modes, and your team's preferences at a depth that no new hire — human or AI — could match in that timeframe.",
  callouts: [
    {
      title: "Semantic codebase search",
      body: '"Where is authentication handled?" finds the answer by meaning, not by filename. Engineers stop grepping and start asking.',
    },
    {
      title: "The AI tour guide",
      body: "New engineer joins your team. In 8 minutes the codebase tour — generated specifically for your repository — gives them the mental model that used to take 3 weeks of questions to a senior engineer.",
    },
    {
      title: "Impact analysis",
      body: '"What breaks if I change the User model?" See every dependent file, every risk level, every test that covers the affected code — before touching a single line.',
    },
    {
      title: "Branch intelligence",
      body: "Know when a human has modified agent-written code. See the diff. Capture the correction as a training signal that makes the next agent run better.",
    },
  ],
};

export const HOW_IT_WORKS = {
  kicker: "How it works",
  headline: "Connect once. Ship better, forever.",
  steps: [
    {
      title: "Connect",
      body: "Connect your Jira project and GitHub repository. AgentOX indexes your codebase once — 15–30 minutes for most repositories. Every subsequent change is indexed automatically via webhook. No manual maintenance. No scheduled jobs.",
    },
    {
      title: "Configure",
      body: "Set your validation thresholds — the PRD gate defaults to 70% confidence, the QA gate defaults to 100% criteria coverage. Adjust these to match your team's standards. Connect Slack for actionable notifications. The whole setup takes under 30 minutes.",
    },
    {
      title: "Assign",
      body: "Create a Jira ticket the way you always have. Tag it for the AgentOX pipeline — or configure automatic triggering for specific project types. The pipeline starts within seconds of ticket creation.",
    },
    {
      title: "Review and ship",
      body: "AgentOX runs Product, Engineering, and QA agents in sequence. You receive a Slack notification when something needs your attention — a gate failure, a confidence score below threshold, or a completed pipeline ready for your approval. Review, approve, merge. Average human time per feature: under 10 minutes.",
    },
  ],
};

export const SOCIAL_PROOF = {
  headline: "What engineering leaders say",
  placeholder:
    '"[Specific outcome they experienced with specific numbers]" — [Name], [Title] at [Company]',
  metrics: [
    "X% reduction in sprint rework",
    "X hours saved per feature on average",
    "X% of pipelines completed without human intervention",
    "$X saved in engineering costs per month",
  ],
};

export const PRICING = {
  kicker: "Pricing",
  headline: "Pricing that pays for itself in the first sprint.",
  footnote:
    "Annual billing saves 15% · No setup fees · Cancel anytime. All plans include: GitHub App integration, webhook-based triggering, human override controls, and full audit trail.",
  tiers: [
    {
      name: "Starter",
      price: "$1,999/month",
      features: [
        "40 pipeline runs/month",
        "1 repository",
        "Product + Eng + QA agents",
        "Jira integration",
        "Email notifications",
        "PRD generation",
        "QA test execution",
        "30-day audit trail",
        "$40 per extra run",
      ],
      cta: "Get Started",
    },
    {
      name: "Growth",
      price: "$4,999/month",
      badge: "Most Popular",
      features: [
        "150 pipeline runs/month",
        "5 repositories",
        "Everything in Starter",
        "Codebase Intelligence",
        "Branch tracking",
        "Slack integration",
        "Cost Intelligence",
        "Custom validation gates",
        "90-day audit trail",
        "$35 per extra run",
      ],
      cta: "Get Started",
    },
    {
      name: "Enterprise",
      price: "From $40,000/year",
      features: [
        "Unlimited runs",
        "Unlimited repos",
        "Everything in Growth",
        "Multi-repo intelligence",
        "Compliance reports",
        "SSO / SAML",
        "Dedicated success manager",
        "VPC deployment option",
        "Unlimited audit trail",
        "Custom",
      ],
      cta: "Talk to Sales",
    },
  ],
};

export const FAQ = {
  kicker: "FAQ",
  headline: "Common questions",
  items: [
    {
      q: "How is this different from what Atlassian just shipped with the Claude Agent for Jira?",
      a: "The Atlassian Claude Agent takes a Jira ticket and produces a pull request. That is one step — ticket to code. AgentOX is the system that ensures the ticket was worth building, the code solves the right problem, and the tests actually verify it did. Atlassian built the execution layer. We built the intelligence, validation, and governance layer that makes execution trustworthy.",
    },
    {
      q: "Do we need to replace our existing tools?",
      a: "No. AgentOX sits on top of your existing Jira and GitHub workflows. Your engineers keep using whatever IDE and coding tools they prefer. AgentOX adds the organisational layer that those tools do not cover. Most customers continue using Claude Code or Cursor individually while AgentOX handles the pipeline.",
    },
    {
      q: "What happens when the agent gets something wrong?",
      a: "Every agent output passes through a validation gate before proceeding. If the gate fails the pipeline pauses and you receive a Slack notification with the specific issues found. You can review the output, make corrections, and resume — or override the gate entirely. Every human correction is logged and becomes a learning signal that improves future runs.",
    },
    {
      q: "How long does a full pipeline run take?",
      a: "For a typical feature ticket — a Story with a clear description — the pipeline runs in 20–45 minutes end to end. Discovery and PRD generation: 5–10 minutes. Engineering implementation: 10–20 minutes. QA test generation and execution: 8–15 minutes. Human review and approval: under 10 minutes. Total elapsed time from ticket to PR-ready: under 2 hours versus the typical 8–10 business day manual process.",
    },
    {
      q: "What happens to our code? Is it secure?",
      a: "AgentOX operates through your existing GitHub App integration with the minimum permissions required — read and write to the repositories you specify, create pull requests, read metadata. Your code is never stored on AgentOX servers. The codebase intelligence index stores file summaries and embeddings — not raw code. Enterprise plans support VPC deployment for complete data isolation.",
    },
    {
      q: "Can we control which tickets go through the pipeline?",
      a: "Yes. You configure triggers in the AgentOX dashboard — by ticket type, by label, by project, or by custom field value. You can also manually trigger any ticket and skip the pipeline for others. The [no-agent] label in any ticket title bypasses the pipeline entirely.",
    },
    {
      q: "How does pricing work for overage runs?",
      a: "When you exceed your plan's monthly run limit additional pipeline runs are billed at $40 (Starter) or $35 (Growth) per run. Overages are billed at the end of each monthly cycle. You receive a Slack notification when you reach 80% of your monthly limit.",
    },
    {
      q: "What does setup actually involve?",
      a: "Three connections — Jira, GitHub, and optionally Slack. Each takes 5–10 minutes through guided OAuth flows. The initial codebase index runs automatically after GitHub connection and completes in 15–30 minutes for most repositories. Most teams are running their first pipeline within 45 minutes of signing up.",
    },
  ],
};

export const FINAL_CTA = {
  headline: "Your next sprint rework is preventable.",
  subhead:
    "Join engineering teams who have stopped rebuilding features and started shipping them right the first time.",
  cta: "Request Early Access",
  footnote: "Setup takes 30 minutes. Your first pipeline run shows you exactly what we mean.",
  contact: "Questions? Talk to a founder directly.",
  email: "sudesha@agentox.io",
  emailNote: "We respond within 4 hours on business days.",
};

export const ROI_ASSUMPTIONS = {
  reworkReductionRate: 0.6,
  workingDaysPerMonth: 22,
  engineersPerRework: 2,
  agentoxGrowthCost: 4999,
};
