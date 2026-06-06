/**
 * Generates scripts/horizon-commerce-jira-import.csv — 100 sample tickets
 * for Jira Cloud CSV import (SCRUM / software project).
 */
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "horizon-commerce-jira-import.csv");

const EPICS = [
  {
    id: "HC-EPIC-01",
    summary: "Merchant onboarding & KYC verification",
    description:
      "Enable new B2B merchants to register, submit business documents, and pass automated KYC before accepting payments. Target: reduce time-to-first-transaction from 5 days to under 24 hours.",
  },
  {
    id: "HC-EPIC-02",
    summary: "Checkout, payments & settlement",
    description:
      "Unified checkout experience supporting cards, ACH, and invoice billing with automated settlement reporting and reconciliation hooks for finance teams.",
  },
  {
    id: "HC-EPIC-03",
    summary: "Order management & fulfillment",
    description:
      "End-to-end order lifecycle: cart, payment capture, fulfillment status, refunds, and partial shipments for multi-warehouse merchants.",
  },
  {
    id: "HC-EPIC-04",
    summary: "Catalog, inventory & pricing",
    description:
      "Product catalog with variants, tiered B2B pricing, stock reservations, and low-stock alerts integrated with ERP exports.",
  },
  {
    id: "HC-EPIC-05",
    summary: "Merchant analytics dashboard",
    description:
      "Self-serve analytics for GMV, conversion, payment failures, and cohort retention with exportable CSV and scheduled email reports.",
  },
  {
    id: "HC-EPIC-06",
    summary: "Public API & developer platform",
    description:
      "REST and webhook APIs for orders, payments, and catalog with OAuth apps, sandbox environments, and rate limiting.",
  },
  {
    id: "HC-EPIC-07",
    summary: "Security, fraud & compliance",
    description:
      "PCI scope reduction, fraud scoring, audit logging, SOC2 controls, and GDPR data subject request tooling.",
  },
  {
    id: "HC-EPIC-08",
    summary: "Mobile seller companion app",
    description:
      "iOS/Android app for field sales reps to create quotes, capture signatures, and check inventory in offline-first mode.",
  },
];

const COMPONENTS = [
  "Frontend",
  "Backend",
  "Payments",
  "API",
  "Mobile",
  "Data",
  "DevOps",
  "Security",
];

const REPORTERS = [
  "Sarah Chen",
  "Marcus Webb",
  "Priya Nair",
  "James Okafor",
  "Elena Vasquez",
  "Tom Bradley",
];

function esc(val) {
  if (val == null) return '""';
  return `"${String(val).replace(/"/g, '""')}"`;
}

function storyDescription(opts) {
  const {
    persona,
    want,
    benefit,
    context,
    acceptance,
    technical,
    outOfScope,
  } = opts;
  const lines = [
    `*User story*`,
    `As a ${persona}, I want ${want} so that ${benefit}.`,
    ``,
    `*Background*`,
    context,
    ``,
    `*Acceptance criteria*`,
    ...acceptance.map((a, i) => `${i + 1}. ${a}`),
  ];
  if (technical?.length) {
    lines.push(``, `*Technical notes*`, ...technical.map((t) => `- ${t}`));
  }
  if (outOfScope?.length) {
    lines.push(``, `*Out of scope*`, ...outOfScope.map((o) => `- ${o}`));
  }
  return lines.join("\n");
}

function bugDescription(opts) {
  const { steps, expected, actual, env, impact } = opts;
  return [
    `*Steps to reproduce*`,
    ...steps.map((s, i) => `${i + 1}. ${s}`),
    ``,
    `*Expected*`,
    expected,
    ``,
    `*Actual*`,
    actual,
    ``,
    `*Environment*`,
    env,
    ``,
    `*Business impact*`,
    impact,
  ].join("\n");
}

function taskDescription(opts) {
  const { goal, deliverables, notes } = opts;
  return [
    `*Goal*`,
    goal,
    ``,
    `*Deliverables*`,
    ...deliverables.map((d) => `- ${d}`),
    ``,
    `*Notes*`,
    notes,
  ].join("\n");
}

function pickLabels(type, epicIdx) {
  const base = ["horizon-commerce", "agentos-demo"];
  const epicTag = `epic-${String(epicIdx + 1).padStart(2, "0")}`;
  if (type === "Bug") return [...base, epicTag, "bug", "needs-triage"];
  if (type === "Task") return [...base, epicTag, "tech-debt"];
  return [...base, epicTag, "feature"];
}

function pickComponents(type, epicIdx) {
  const pools = {
    0: ["Frontend", "Backend", "Security"],
    1: ["Payments", "Backend", "Frontend"],
    2: ["Backend", "API", "Frontend"],
    3: ["Backend", "Data", "API"],
    4: ["Frontend", "Data", "Backend"],
    5: ["API", "Backend", "DevOps"],
    6: ["Security", "Backend", "DevOps"],
    7: ["Mobile", "API", "Backend"],
  };
  const pool = pools[epicIdx] ?? ["Backend", "Frontend"];
  if (type === "Bug") return [pool[0], "Security"].slice(0, 2);
  if (type === "Task") return [pool[1], "DevOps"].slice(0, 2);
  return pool.slice(0, 2);
}

function dateFor(dayOffset) {
  const d = new Date("2025-01-15T10:00:00Z");
  d.setDate(d.getDate() + dayOffset);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy} 10:00`;
}

const STORY_TEMPLATES = [
  (e) => ({
    summary: `Self-serve ${e.toLowerCase()} wizard for new merchants`,
    persona: "merchant admin",
    want: "a guided onboarding wizard with save-and-resume",
    benefit: "I can complete KYC without support calls",
    context:
      "Current onboarding drops off at document upload. Merchants abandon when session expires.",
    acceptance: [
      "Given I am a new merchant, when I start onboarding, then I see a 4-step progress indicator.",
      "Given I upload a PDF over 10MB, when validation runs, then I see a clear size error before submit.",
      "Given I leave mid-flow, when I return within 7 days, then my draft is restored.",
    ],
    technical: [
      "Store draft state in merchant_onboarding_sessions table",
      "Use presigned S3 URLs for document upload",
    ],
  }),
  (e) => ({
    summary: `Webhook notifications for ${e.toLowerCase()} status changes`,
    persona: "integration engineer",
    want: "webhooks when key state transitions occur",
    benefit: "downstream ERP systems stay in sync without polling",
    context:
      "Enterprise merchants require near-real-time updates for order and payment events.",
    acceptance: [
      "Given a registered webhook URL, when payment succeeds, then a signed POST is delivered within 30s.",
      "Given delivery fails 3 times, when retries exhaust, then the event appears in a dead-letter queue UI.",
      "Given I rotate the signing secret, when I save, then old secret works for 24h grace period.",
    ],
    technical: ["HMAC-SHA256 signature header X-Horizon-Signature", "Exponential backoff max 15 min"],
  }),
  (e) => ({
    summary: `Role-based access for ${e.toLowerCase()} admin actions`,
    persona: "org owner",
    want: "to assign viewer, editor, and billing roles",
    benefit: "least-privilege access across my team",
    context: "SOC2 audit flagged shared admin credentials at 12 merchant accounts.",
    acceptance: [
      "Given I am org owner, when I invite a user as Viewer, then they cannot refund payments.",
      "Given a user is Editor, when they attempt API key creation, then action is denied.",
      "Given role change, when saved, then audit log records actor, target, and timestamp.",
    ],
  }),
  (e) => ({
    summary: `Export ${e.toLowerCase()} data to CSV with date filters`,
    persona: "finance analyst",
    want: "scheduled CSV exports of transactions",
    benefit: "month-end close does not require manual dashboard clicks",
    context: "Finance teams reconcile in NetSuite; manual exports take 2+ hours weekly.",
    acceptance: [
      "Given a date range, when I export, then CSV includes id, amount, fee, status, and settlement date.",
      "Given I schedule weekly export, when Monday 6am UTC hits, then email contains secure download link expiring in 72h.",
      "Given no rows match filter, when export runs, then I receive empty CSV with headers only.",
    ],
  }),
  (e) => ({
    summary: `Search and filter ${e.toLowerCase()} records in admin UI`,
    persona: "support agent",
    want: "full-text search with filters on status and date",
    benefit: "I resolve merchant tickets faster",
    context: "Support avg handle time is 18 min; search latency is a top complaint.",
    acceptance: [
      "Given 100k records, when I search by email fragment, then results return under 2 seconds.",
      "Given active filters, when I share URL, then colleague sees same filtered view.",
      "Given PII fields, when results render, then only last4 of card is visible to support role.",
    ],
  }),
];

const BUG_TEMPLATES = [
  {
    summary: "Duplicate charge when user double-clicks Pay button",
    steps: [
      "Open checkout with $250 cart",
      "Click Pay twice within 500ms on slow 3G",
      "Observe bank statement",
    ],
    expected: "Single authorization hold",
    actual: "Two identical charges posted",
    env: "Production, Chrome 122, checkout v3.2.1",
    impact: "High — direct revenue and trust impact; 14 merchant escalations this week",
  },
  {
    summary: "Webhook signature validation fails for payloads over 64KB",
    steps: [
      "Send order.updated webhook with 200 line items",
      "Verify signature with official SDK",
    ],
    expected: "Signature validates",
    actual: "401 Invalid signature despite correct secret",
    env: "Sandbox API, Node SDK 2.4.0",
    impact: "Medium — large B2B orders fail ERP sync",
  },
  {
    summary: "Timezone mislabels settlement date in analytics chart",
    steps: [
      "Set merchant timezone to America/Chicago",
      "View GMV chart for Jan 31 cross-midnight UTC",
    ],
    expected: "Bars align to merchant local day boundaries",
    actual: "Jan 31 GMV split incorrectly across Feb 1",
    env: "Dashboard v1.8, Postgres rollup job",
    impact: "Medium — finance reports disagree with processor statements",
  },
  {
    summary: "Mobile app crashes on offline catalog sync resume",
    steps: [
      "Login as field rep on iOS 17",
      "Start catalog sync, enable airplane mode mid-sync",
      "Disable airplane mode after 2 minutes",
    ],
    expected: "Sync resumes from last checkpoint",
    actual: "App crashes to home screen; logs show SQLite locked",
    env: "iOS app 4.1.0 build 412",
    impact: "High — field sales blocked in low-connectivity regions",
  },
  {
    summary: "API rate limit headers missing on 429 responses",
    steps: ["Exceed 100 req/min on /v1/orders", "Inspect response headers"],
    expected: "Retry-After and X-RateLimit-Reset present",
    actual: "429 body only; integrators cannot backoff correctly",
    env: "Production API gateway",
    impact: "Low — developer experience; causes retry storms",
  },
];

const TASK_TEMPLATES = [
  {
    summary: "Upgrade payment processor SDK to latest PCI-compliant version",
    goal: "Remove deprecated TLS 1.0 paths before processor cutoff date.",
    deliverables: [
      "Bump stripe-node / equivalent to supported version",
      "Run integration test suite in staging",
      "Update runbook for rollback",
    ],
    notes: "Processor deadline: end of Q1. Coordinate with finance for test transactions.",
  },
  {
    summary: "Add database indexes for order search queries",
    goal: "Reduce p95 admin search latency from 4.2s to under 1s.",
    deliverables: [
      "EXPLAIN ANALYZE on top 5 slow queries",
      "Migration for composite index on (merchant_id, created_at, status)",
      "Validate on staging copy with 2M rows",
    ],
    notes: "Use CONCURRENTLY in production migration window.",
  },
  {
    summary: "Document public API error code catalog",
    goal: "Publish stable error codes for integrators with remediation hints.",
    deliverables: [
      "Markdown reference in developer portal",
      "OpenAPI examples for 4xx/5xx",
      "Changelog entry for support team",
    ],
    notes: "Align codes with existing internal enum payment_errors.",
  },
];

const rows = [];
let day = 0;
let workId = 1;

function addRow(r) {
  rows.push(r);
  workId += 1;
  day += 1;
}

// Epics
for (const epic of EPICS) {
  addRow({
    workItemId: epic.id,
    summary: epic.summary,
    description: epic.description,
    issueType: "Epic",
    priority: "High",
    status: "Done",
    resolution: "Done",
    labels: pickLabels("Story", EPICS.indexOf(epic)),
    components: pickComponents("Story", EPICS.indexOf(epic)),
    parent: "",
    reporter: REPORTERS[EPICS.indexOf(epic) % REPORTERS.length],
    created: dateFor(day),
  });
}

// Fill to 100: stories, bugs, tasks per epic
let ticketNum = 0;
const target = 100;
const epicCount = EPICS.length;
const remaining = target - rows.length; // 92 child issues

// ~55 stories, ~25 bugs, ~12 tasks across epics
const storiesPerEpic = [6, 6, 6, 6, 6, 6, 6, 7]; // 49
const bugsPerEpic = [3, 3, 3, 3, 3, 3, 3, 4]; // 25
const tasksPerEpic = [2, 1, 2, 1, 2, 1, 2, 1]; // 12
// total children = 86, + 8 epics = 94... need 6 more stories
storiesPerEpic[0] += 6; // add 6 -> 55 stories, 25 bugs, 12 tasks = 92 + 8 = 100

for (let ei = 0; ei < epicCount; ei++) {
  const epic = EPICS[ei];
  const statusPool = [
    ...Array(7).fill("Done"),
    ...Array(2).fill("Resolved"),
    ...Array(2).fill("In Progress"),
    ...Array(2).fill("To Do"),
  ];
  let si = 0;

  for (let i = 0; i < storiesPerEpic[ei]; i++) {
    ticketNum += 1;
    const tpl = STORY_TEMPLATES[si % STORY_TEMPLATES.length](epic.summary);
    si += 1;
    const status = statusPool[i % statusPool.length];
    addRow({
      workItemId: `HC-${String(ticketNum).padStart(3, "0")}`,
      summary: tpl.summary,
      description: storyDescription(tpl),
      issueType: "Story",
      priority: i % 5 === 0 ? "Highest" : i % 3 === 0 ? "High" : "Medium",
      status,
      resolution: status === "Done" || status === "Resolved" ? "Done" : "",
      labels: pickLabels("Story", ei),
      components: pickComponents("Story", ei),
      parent: epic.id,
      reporter: REPORTERS[(ei + i) % REPORTERS.length],
      created: dateFor(day),
    });
  }

  for (let i = 0; i < bugsPerEpic[ei]; i++) {
    ticketNum += 1;
    const tpl = BUG_TEMPLATES[(ei + i) % BUG_TEMPLATES.length];
    const status =
      i % 4 === 0 ? "To Do" : i % 3 === 0 ? "In Progress" : "Done";
    addRow({
      workItemId: `HC-${String(ticketNum).padStart(3, "0")}`,
      summary: tpl.summary,
      description: bugDescription(tpl),
      issueType: "Bug",
      priority: i % 2 === 0 ? "High" : "Medium",
      status: status === "Done" ? "Resolved" : status,
      resolution: status === "Done" || status === "Resolved" ? "Fixed" : "",
      labels: pickLabels("Bug", ei),
      components: pickComponents("Bug", ei),
      parent: epic.id,
      reporter: REPORTERS[(ei + i + 2) % REPORTERS.length],
      created: dateFor(day),
    });
  }

  for (let i = 0; i < tasksPerEpic[ei]; i++) {
    ticketNum += 1;
    const tpl = TASK_TEMPLATES[(ei + i) % TASK_TEMPLATES.length];
    const status = i % 2 === 0 ? "Done" : "In Progress";
    addRow({
      workItemId: `HC-${String(ticketNum).padStart(3, "0")}`,
      summary: `${tpl.summary} (${epic.summary.split(" ")[0]})`,
      description: taskDescription(tpl),
      issueType: "Task",
      priority: "Medium",
      status,
      resolution: status === "Done" ? "Done" : "",
      labels: pickLabels("Task", ei),
      components: pickComponents("Task", ei),
      parent: epic.id,
      reporter: REPORTERS[(ei + i + 4) % REPORTERS.length],
      created: dateFor(day),
    });
  }
}

// Pad to exactly 100 if off by a few
while (rows.length < 100) {
  ticketNum += 1;
  const ei = rows.length % epicCount;
  const epic = EPICS[ei];
  addRow({
    workItemId: `HC-${String(ticketNum).padStart(3, "0")}`,
    summary: "Add audit trail export for compliance reviews",
    description: storyDescription({
      persona: "compliance officer",
      want: "to export immutable audit logs for a date range",
      benefit: "SOC2 evidence collection is automated",
      context: "Auditors request quarterly samples of admin actions.",
      acceptance: [
        "Given a date range, when I export audit log, then CSV is SHA256 checksum verified.",
        "Given tampered row, when verify runs, then export fails validation loudly.",
      ],
    }),
    issueType: "Story",
    priority: "High",
    status: "To Do",
    resolution: "",
    labels: pickLabels("Story", ei),
    components: ["Security", "Backend"],
    parent: epic.id,
    reporter: REPORTERS[0],
    created: dateFor(day),
  });
}

rows.length = 100;

const header = [
  "Work item id",
  "Summary",
  "Description",
  "Issue Type",
  "Priority",
  "Status",
  "Resolution",
  "Labels",
  "Labels",
  "Labels",
  "Component",
  "Component",
  "Parent",
  "Reporter",
  "Created",
];

const lines = [header.join(",")];

for (const r of rows) {
  const labels = r.labels;
  const comps = r.components;
  lines.push(
    [
      esc(r.workItemId),
      esc(r.summary),
      esc(r.description),
      esc(r.issueType),
      esc(r.priority),
      esc(r.status),
      esc(r.resolution),
      esc(labels[0] ?? ""),
      esc(labels[1] ?? ""),
      esc(labels[2] ?? ""),
      esc(comps[0] ?? ""),
      esc(comps[1] ?? ""),
      esc(r.parent),
      esc(r.reporter),
      esc(r.created),
    ].join(",")
  );
}

writeFileSync(OUT, lines.join("\n"), "utf8");
console.log(`Wrote ${rows.length} rows to ${OUT}`);
