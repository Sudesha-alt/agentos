export const pipelineSteps = [
  {
    id: "01",
    title: "Jira ticket created",
    kicker: "Raw intake",
    description:
      "A product manager files the ticket the way humans actually write: partial context, implied intent, missing constraints.",
    badge: "JIRA-1287",
    terminal: [
      "$ ingest jira JIRA-1287 --source product",
      "ticket.title  Add usage-based billing controls",
      "ticket.body   Enterprise admins need limits by workspace.",
      "signal        ambiguity detected: limit scope unspecified",
      "status        awaiting Product Agent",
    ],
  },
  {
    id: "02",
    title: "Discovery engine synthesises the PRD",
    kicker: "Four-stage discovery",
    description:
      "Ticket analysis, historical intelligence from RAG, gap analysis, and complexity scoring run before PRD synthesis — so engineering gets a spec built on structured intelligence.",
    badge: "DISCOVERY",
    terminal: [
      "$ discovery run --ticket JIRA-1287",
      "stage.1        ticket analysis — 12 atomic requirements",
      "stage.2        historical intelligence — 4 similar tickets",
      "stage.3        gap analysis — 6 gaps, 1 blocking",
      "stage.4        complexity score 6/10 — 9d realistic",
      "prd.generate   requirements.md — confidence 87%",
      "status         PRD attached to Jira",
    ],
  },
  {
    id: "03",
    title: "Validation gate checks the spec",
    kicker: "PRD Gate",
    description:
      "The gate refuses vague output. Every criterion is checked for actor, behavior, constraint, edge case, and testability.",
    badge: "PRD_GATE",
    checklist: [
      "Actors explicitly named",
      "Failure states defined",
      "Acceptance criteria testable",
      "No hidden implementation assumptions",
    ],
    terminal: [
      "$ validate prd requirements.md --strict",
      "✓ actor coverage          100%",
      "✓ edge conditions         6 captured",
      "! dependency risk         billing API quota unclear",
      "status                   gate passed with amber flag",
    ],
  },
  {
    id: "04",
    title: "Engineering Agent plans implementation",
    kicker: "Build planning",
    description:
      "Engineering receives a validated PRD, not a vibe. The plan maps requirements to files, APIs, migrations, and risks.",
    badge: "ENGINEERING_AGENT",
    terminal: [
      "$ agent engineering plan --prd requirements.md",
      "surface   billing-service, admin-ui, usage-metering",
      "plan      4 phases, 11 implementation tasks",
      "risk      quota reconciliation requires migration",
      "output    implementation_plan.md",
    ],
  },
  {
    id: "05",
    title: "QA Agent maps tests to acceptance criteria",
    kicker: "Test synthesis",
    description:
      "QA is not guessing what Product wanted. Each generated test links directly to a criterion and a failure mode.",
    badge: "QA_AGENT",
    terminal: [
      "$ agent qa generate --from acceptance_criteria",
      "tests.unit          8 generated",
      "tests.integration   5 generated",
      "tests.e2e           3 critical paths",
      "mapping             AC-001..AC-007 covered",
    ],
  },
  {
    id: "06",
    title: "Output written back to Jira",
    kicker: "Human review",
    description:
      "Nothing leaves the workflow. PRD, plan, test cases, validation state, and open flags are attached to the source ticket.",
    badge: "JIRA_SYNC",
    terminal: [
      "$ writeback jira JIRA-1287 --review-required",
      "attach   requirements.md",
      "attach   implementation_plan.md",
      "attach   qa_matrix.md",
      "status   ready for human review",
    ],
  },
];
