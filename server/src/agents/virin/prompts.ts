import { renderTemplate } from "../pm/prompts";

export { renderTemplate };

const JSON_ONLY = "\n\nRespond with valid JSON only. No markdown fences or commentary.";

export const PROMPT_INTAKE = `Stage 1 — Intake

Read the ENTIRE ticket below — summary, description, comments, and attachments — before classifying.
Do NOT claim that nothing is attached if attachments are listed below.
Do NOT ask many questions yet.

Classify the ticket as exactly one of: bug | task | small_feature | large_feature | unclear

Rules:
- If unclear, produce exactly ONE clarifying question to establish type. Not a list.
- With the clarifying question, provide 3–4 concise answer options grounded in company context, business context, ticket details, and codebase intelligence below (do NOT include "Other" — the UI adds that).
- Options must reflect realistic answers given who this company is, how they make money, what the ticket says, and what the codebase suggests — not generic placeholders.
- Use the OFFICIAL COMPANY NAME from company context exactly — do not substitute repo names, product codenames, or competitor names.
- Identify symptom vs likely root cause in one sentence each.
- Do not start discovery yet.

TICKET:
Summary: {{ticket_summary}}
Description: {{ticket_description}}
Type (Jira): {{ticket_type}}
Priority: {{ticket_priority}}
Status: {{ticket_status}}
Reporter: {{ticket_reporter}}
Assignee: {{ticket_assignee}}
Components: {{ticket_components}}
Labels: {{ticket_labels}}

TICKET COMMENTS:
{{ticket_comments}}

TICKET ATTACHMENTS (read these — they are part of the ticket):
{{ticket_attachments}}

COMPANY CONTEXT:
Official company name: {{company_name}}
Website: {{company_website}}
Product: {{company_product}}
ICP: {{company_icp}}
Revenue model: {{company_revenue_model}}

{{company_context}}

BUSINESS CONTEXT (revenue model, ICP, priorities):
{{business_context}}

STRATEGIC GOALS:
{{strategic_goals}}

CODEBASE INTELLIGENCE (modules, similar work, technical signals):
{{codebase_intelligence}}

{{prior_clarification_block}}

Output JSON:
{
  "ticketType": "bug|task|small_feature|large_feature|unclear",
  "reasoning": "2-3 sentences on why this classification",
  "symptomVsRootCause": "Symptom: ... Root cause hypothesis: ...",
  "clarifyingQuestion": "single question if unclear, else null",
  "clarifyingOptions": ["3-4 options grounded in company, business, and codebase context if clarifyingQuestion is set, else []"]
}${JSON_ONLY}`;

export const PROMPT_NEXT_QUESTION = `Stage 2 — Question mode (one turn)

You are Virin doing PM discovery for ONE specific ticket/feature.

MANDATORY: You have already been given the full ticket — summary, description, comments, attachments, company context, and codebase intelligence.
Read ALL of it before asking. Never say nothing is attached if attachments appear below.
Ask ONE question at a time only after you have absorbed the ticket materials.

FEATURE IN SCOPE (stay anchored here — do not drift to adjacent features or generic process):
Summary: {{ticket_summary}}
Description: {{ticket_description}}
Ticket type: {{ticket_type}}
Symptom vs root cause: {{symptom_vs_root}}

TICKET COMMENTS:
{{ticket_comments}}

TICKET ATTACHMENTS:
{{ticket_attachments}}

Turn {{turn_number}} of up to {{max_turns}} discovery questions.

{{last_answer_block}}

QUESTIONS ALREADY ASKED (do NOT re-ask these topics or paraphrase them — find a new gap):
{{prior_questions_list}}

FULL DISCOVERY TRANSCRIPT:
{{conversation_history}}

COMPANY CONTEXT:
Official company name: {{company_name}}
Website: {{company_website}}
Product: {{company_product}}
ICP: {{company_icp}}
Revenue model: {{company_revenue_model}}

{{company_context}}

BUSINESS CONTEXT (revenue model, ICP, what the company is building toward):
{{business_context}}

STRATEGIC GOALS:
{{strategic_goals}}

CODEBASE INTELLIGENCE (relevant modules, similar tickets, technical constraints):
{{codebase_intelligence}}

For {{ticket_type}}, the ONLY gaps worth asking about (pick ONE gap not yet answered):
- bug: reproduction steps, blast radius, severity, workaround, regression scope, environment — tied to THIS bug
- task: concrete deliverable, requester intent, done-when, dependencies — tied to THIS task
- small_feature / large_feature: target user, pain evidence, success metric, MVP slice, explicit out-of-scope — tied to THIS feature

Cross-questioning rules (mandatory when turn > 1):
- Open by referencing a specific fact from the last answer (quote or paraphrase it).
- Then ask the ONE new thing you still need — probe contradictions, missing numbers, vague terms, or unstated assumptions.
- If the last answer was vague, ask for a concrete example in the context of this feature.

Relevance & non-overlap rules (mandatory):
- The question MUST be impossible to answer without reading this ticket and transcript.
- Before writing the question, mentally check every prior Q: if your question would elicit substantially the same information as any prior Q/A, choose a different gap or action "ready".
- Do NOT ask about: timeline/ priority / stakeholders / "why now" if already covered; do NOT ask generic questions like "who are the users" if user segment was already stated.
- Do NOT ask multi-part questions. One interrogative, one unknown.
- Options MUST be grounded in company, business, and codebase context — mutually distinct realistic answers (no "Other").
- Use {{company_name}} as the company name in questions and options when referring to the customer company — never substitute repo or product codenames.

When to stop early:
- If you can write a clear problem statement, success definition, and MVP scope for THIS feature → action "ready" with discoverySummary (do not pad with extra questions).

If contradiction or scope problem → action "flag" with flag message; you may include one focused follow-up question if action is "ask".

Output JSON:
{
  "action": "ask|ready|flag",
  "question": "required if action is ask — must reference last answer when turn > 1",
  "options": ["3-4 distinct answer choices when action is ask"],
  "flag": "required if action is flag",
  "reason": "which gap this question fills OR why ready OR why flag — cite what is still unknown or what was already covered",
  "discoverySummary": "required if action is ready — a single plain-text string (NOT a nested JSON object) covering problem, user, evidence, success, MVP scope, and out of scope"
}${JSON_ONLY}`;

export const PROMPT_NEXT_QUESTION_RETRY = `Your previous discovery question overlapped with an earlier question or was too generic.

REJECTED QUESTION: {{rejected_question}}
OVERLAP REASON: {{overlap_reason}}

Ask a DIFFERENT question about a gap not yet covered. Same rules as before — feature-specific, cross-examine the last answer, zero overlap.

{{discovery_prompt_body}}`;

export const PROMPT_INFER_ANSWER = `You are helping Virin continue discovery when the stakeholder is not available.

Infer the most likely honest answer to this ONE question about THIS specific feature/ticket.
Do not repeat information already established in prior conversation — add new detail only.
Prefer answers aligned with business context and codebase intelligence when plausible.
If truly unknown, say "Unknown — needs stakeholder input" and note what to find out.

Question: {{question}}
Ticket: {{ticket_summary}}
{{ticket_description}}

Ticket comments:
{{ticket_comments}}

Ticket attachments:
{{ticket_attachments}}

Business context:
{{business_context}}

Codebase intelligence:
{{codebase_intelligence}}

Prior conversation:
{{conversation_history}}

Output JSON:
{
  "answer": "concise answer",
  "confidence": "high|medium|low",
  "needsHumanFollowUp": false
}${JSON_ONLY}`;

export const PROMPT_CODEBASE_ANALYSIS = `Stage 3 — Codebase analysis

Before writing any solution, analyze the codebase context for this ticket.

DISCOVERY SUMMARY:
{{discovery_summary}}

TICKET TYPE: {{ticket_type}}

CODEBASE SIGNALS:
Candidate files: {{candidate_files_list}}
Recent commits: {{recent_commit_summary}}
Component context: {{affected_components}}

Tasks:
1. Identify relevant modules/files and why
2. What can be reused or extended
3. Technical debt or architectural constraints affecting the solution
4. Does the code suggest the reported problem has a different root cause than stakeholders think?
5. Pressure-test the proposed direction with technical risks
6. Draft testable acceptance criteria (precise enough for engineers to write tests)
7. Separate what ALREADY EXISTS in the repo vs what GAPS must be built for this ticket
8. If the ticket is a document/content deliverable (curriculum, policy, playbook, documentation, markdown):
   - gapsToBuild MUST cite concrete doc file paths (e.g. docs/curriculum/q1.md)
   - suggestedFirstFile MUST be an existing or new doc path (.md preferred)
   - set suggestedImplementationMode to "content"

Output JSON:
{
  "suggestedImplementationMode": "code|content",
  "relevantModules": [{"path": "...", "reason": "...", "role": "primary|secondary|config|test"}],
  "reuseOpportunities": ["..."],
  "alreadyExists": ["concrete capability already in codebase — cite file paths"],
  "gapsToBuild": ["concrete net-new work required — cite what's missing"],
  "technicalDebt": ["..."],
  "architectureConstraints": ["..."],
  "rootCauseMismatch": "null or explanation if code suggests different root cause",
  "technicalRisks": ["..."],
  "testableAcceptanceCriteria": ["Given/When/Then or binary measurable criteria"],
  "scopeAssessment": "small|medium|large with reason",
  "suggestedFirstFile": "path — reason"
}${JSON_ONLY}`;

export const PROMPT_SOLUTIONING = `Stage 4 — Solutioning (direction only — NOT full PRD)

Synthesize discovery + codebase analysis into a direction summary for human confirmation.
Every idea MUST be validated against the company context below.

COMPANY CONTEXT:
{{company_context}}

DISCOVERY:
{{discovery_summary}}

COMPETITOR ANALYSIS:
{{competitor_analysis}}

CODEBASE ANALYSIS:
{{codebase_analysis_json}}

Flags raised during discovery:
{{flags}}

Write 2-3 paragraphs covering:
- What I understand the problem to be
- Recommended approach (simplest version that solves the real problem)
- Explicit non-goals (specific, not vague)
- Open risks

Then assess business fit vs company strategy and revenue model:
- strong: clearly advances strategic goals and revenue
- moderate: useful but not core to revenue or strategy
- weak: marginal value; question whether to prioritize
- misaligned: conflicts with ICP, non-goals, or revenue model — flag clearly

Output JSON:
{
  "problemStatement": "clear problem statement",
  "recommendedApproach": "2-3 paragraphs",
  "explicitNonGoals": ["specific non-goals"],
  "openRisks": ["..."],
  "summaryMarkdown": "formatted markdown of the above for stakeholder review",
  "businessFit": "strong|moderate|weak|misaligned",
  "revenueImpact": "how this affects how the company makes money",
  "alignmentNotes": "fit vs strategic goals and company non-goals",
  "companyValidationSummary": "1-2 sentences: should we build this given who we are?"
}${JSON_ONLY}`;

export const PROMPT_PRD = `Stage 5 — PRD generation

Virin writes the full PRD after direction was confirmed.
Success metrics must tie to company strategic goals and revenue model.

COMPANY CONTEXT:
{{company_context}}

Confirmed direction:
{{solution_summary}}

Discovery:
{{discovery_summary}}

Competitor landscape:
{{competitor_analysis}}

Codebase constraints:
{{codebase_analysis_json}}

Codebase intelligence (modules, similar work, candidate files):
{{codebase_intelligence}}

Jira: {{jira_key}}
Title: {{ticket_summary}}

Quality bar:
- Every requirement is testable (no "feel better" — rewrite to binary/measurable)
- Non-goals are specific
- Success metrics tie to stated goals
- Technical considerations include codebase findings with file paths
- existingCapabilities MUST list what the repo already provides for this ticket
- netNewWork MUST list only what must be built/changed (delta work)
- reuseFromCodebase MUST cite modules/patterns to extend
- implementationDeltaSummary MUST explain already-built vs net-new in 2-4 sentences
- Open questions are real and named with owner
- effortEstimate and complexitySummary use AgentOS agent pipeline wall-clock hours (Virin → Ananta → Neel), NOT human developer sprint days. Typical ranges: XS 30–90 min, S 1–3 h, M 3–8 h, L 8–16 h, XL 16–40 h.
- If the ticket is a document/content deliverable (curriculum, policy, playbook, documentation):
  - set implementationMode to "content"
  - deliverableFiles MUST list every repo file to create/update with path, format (markdown), and purpose
  - netNewWork MUST list those same file paths
  - technicalRequirements.endpoints MUST be []
- Otherwise set implementationMode to "code"

Use GeneratedPRD schema:
{
  "title": "...",
  "version": "1.0",
  "status": "Draft",
  "jiraKey": "{{jira_key}}",
  "createdAt": "{{today_iso}}",
  "priority": "...",
  "effortEstimate": "string — t-shirt and agent pipeline hours (e.g. M · ~5h)",
  "problemStatement": "...",
  "proposedSolution": "...",
  "successDefinition": "...",
  "userPersonas": [{"persona":"...","need":"...","currentPain":"..."}],
  "userStories": [{"id":"US-1","story":"...","acceptanceCriteria":["..."],"priority":"must-have|should-have|nice-to-have"}],
  "technicalRequirements": {
    "endpoints": [],
    "dataModel": [],
    "systemsAffected": [],
    "technicalAssumptions": []
  },
  "nonFunctionalRequirements": [{"type":"...","requirement":"...","measurable":"..."}],
  "assumptions": [],
  "outOfScope": ["specific non-goals from solutioning"],
  "openQuestions": [{"question":"...","impact":"...","defaultAssumption":"...","owner":"..."}],
  "risks": [{"risk":"...","probability":"...","impact":"...","mitigation":"..."}],
  "successMetrics": [{"metric":"...","baseline":"...","target":"...","measurementMethod":"..."}],
  "complexitySummary": {
    "score": 0,
    "effortOptimistic": "agent pipeline hours (e.g. 3h)",
    "effortRealistic": "agent pipeline hours (e.g. 5h)",
    "effortPessimistic": "agent pipeline hours (e.g. 8h)",
    "keyComplexityDrivers": []
  },
  "existingCapabilities": ["what the codebase already provides — cite paths"],
  "netNewWork": ["what must be built or changed — delta only"],
  "reuseFromCodebase": ["modules/patterns to extend"],
  "implementationDeltaSummary": "2-4 sentences: already built vs net-new for this ticket",
  "implementationMode": "code|content",
  "deliverableFiles": [{"path": "docs/example.md", "format": "markdown", "purpose": "when content mode only"}],
  "prdConfidence": 0.0,
  "confidenceNotes": "honest uncertainty notes"
}${JSON_ONLY}`;

export const PROMPT_SYSTEM_DESIGN = `Stage — System design (Architect capability)

Produce a structured system design package for engineering. Ground every decision in codebase analysis and discovery.

Discovery summary:
{{discovery_summary}}

Codebase analysis JSON:
{{codebase_analysis_json}}

System design scope:
{{system_design_scope}}

Output JSON:
{
  "fileList": ["paths that will be created or modified"],
  "interfaces": [{"name": "InterfaceName", "methods": ["method signatures"]}],
  "dataStructures": [{"name": "TypeName", "fields": ["field: type"]}],
  "sequenceDiagramMermaid": "optional mermaid sequenceDiagram string",
  "summaryMarkdown": "markdown overview of architecture decisions and tradeoffs"
}${JSON_ONLY}`;

export const PROMPT_TASK_PLANNING = `Stage — Task planning (Project Manager capability)

Break the system design into ordered engineering tasks. Each task must map to files and dependencies.
For content-mode tickets (documentation, curriculum, policy): every task files[] entry MUST be a doc path (.md).

System design JSON:
{{system_design_json}}

Codebase analysis JSON:
{{codebase_analysis_json}}

Discovery summary:
{{discovery_summary}}

Output JSON:
{
  "tasks": [
    {
      "id": "TASK-1",
      "title": "short actionable title",
      "files": ["paths to touch"],
      "dependsOn": ["TASK-0 or empty"],
      "description": "what to implement and why"
    }
  ],
  "summaryMarkdown": "markdown task plan with dependency notes"
}${JSON_ONLY}`;

export const PROMPT_HANDOFF = `Stage 6 — Handoff to engineering

Produce a handoff package — not just the PRD.

PRD title: {{prd_title}}
Problem: {{problem_statement}}

Full PRD JSON:
{{prd_json}}

Codebase analysis:
{{codebase_analysis_json}}

Output JSON:
{
  "engineeringTickets": [
    {
      "id": "ENG-1",
      "title": "...",
      "description": "one line + context",
      "acceptanceCriteria": ["testable criteria"],
      "technicalNotes": ["from codebase analysis"],
      "dependsOn": ["ENG-0 or empty"]
    }
  ],
  "dependencyMapMarkdown": "markdown diagram or list of which tickets block others",
  "definitionOfDone": ["what production state means complete and measurable"],
  "teamsInvolved": ["backend", "frontend", etc]
}${JSON_ONLY}`;

export const PROMPT_POST_SHIP = `Stage 7 — Post-ship retrospective (Virin)

Compare launch outcomes to PRD success metrics.

PRD success metrics:
{{success_metrics_json}}

Stakeholder-provided actuals:
{{metrics_input}}

Launch context:
{{launch_notes}}

Output JSON:
{
  "metricsReview": "narrative comparing targets vs actuals",
  "outcomesVsTargets": [{"metric":"...","target":"...","actual":"...","met": true}],
  "surprises": ["what was unexpected"],
  "nextIterationChanges": ["what to change next time"],
  "retrospectiveSummary": "short executive summary"
}${JSON_ONLY}`;

export const PROMPT_RETROSPECTIVE = `Virin process retrospective — improve future runs.

Original classification: {{ticket_type}}
Discovery turns: {{turn_count}}
Flags: {{flags}}
PRD confidence: {{prd_confidence}}

Human feedback (if any): {{human_feedback}}

Output JSON:
{
  "classificationAccuracy": "accurate|partially|wrong",
  "classificationNote": "...",
  "discoveryQuality": "...",
  "prdQuality": "...",
  "learningSignals": ["..."],
  "patternFlag": "none|scope_creep|under_specified|tech_risk_underestimated"
}${JSON_ONLY}`;
