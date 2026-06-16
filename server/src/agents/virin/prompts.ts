import { renderTemplate } from "../pm/prompts";

export { renderTemplate };

const JSON_ONLY = "\n\nRespond with valid JSON only. No markdown fences or commentary.";

export const PROMPT_INTAKE = `Stage 1 — Intake

Read the ticket carefully. Do NOT ask many questions yet.

Classify the ticket as exactly one of: bug | task | small_feature | large_feature | unclear

Rules:
- If unclear, produce exactly ONE clarifying question to establish type. Not a list.
- With the clarifying question, provide 3–4 concise answer options grounded in company context, business context, and codebase intelligence below (do NOT include "Other" — the UI adds that).
- Options must reflect realistic answers given who this company is, how they make money, and what the codebase suggests — not generic placeholders.
- Identify symptom vs likely root cause in one sentence each.
- Do not start discovery yet.

TICKET:
Summary: {{ticket_summary}}
Description: {{ticket_description}}
Type (Jira): {{ticket_type}}
Priority: {{ticket_priority}}
Components: {{ticket_components}}
Labels: {{ticket_labels}}

COMPANY CONTEXT:
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

You are Virin doing PM discovery. Ask ONE question at a time. Read the last answer before asking the next.

Ticket type: {{ticket_type}}
Symptom vs root cause: {{symptom_vs_root}}

DISCOVERY SO FAR:
{{conversation_history}}

TICKET CONTEXT:
{{ticket_summary}}
{{ticket_description}}

COMPANY CONTEXT:
{{company_context}}

BUSINESS CONTEXT (revenue model, ICP, what the company is building toward):
{{business_context}}

STRATEGIC GOALS:
{{strategic_goals}}

CODEBASE INTELLIGENCE (relevant modules, similar tickets, technical constraints):
{{codebase_intelligence}}

For {{ticket_type}}, focus areas:
- bug: what broke, when, how many users, severity, workaround
- task: what needs doing, why now, who requested, done-when
- small_feature / large_feature: user problem, evidence, who is the user, business reason, success definition, simplest version, explicit out of scope

Rules:
- If the last answer reveals contradiction, missing dependency, or scope problem → action "flag" with the flag message, then ask a follow-up OR ask one clarifying question.
- If you have enough for a clear problem statement and solution direction → action "ready" with discoverySummary.
- Otherwise → action "ask" with exactly ONE question and 3–4 concise answer options.
- Never ask multiple questions in one turn.
- Options MUST be grounded in company context, business context, and codebase intelligence above.
  * At least one option should reflect business/revenue/strategic fit.
  * At least one option should reflect a technical/codebase-informed path or constraint.
  * Options must be mutually distinct, realistic stakeholder answers (do NOT include "Other").

Output JSON:
{
  "action": "ask|ready|flag",
  "question": "required if action is ask",
  "options": ["3-4 answer choices grounded in company, business, and codebase context when action is ask"],
  "flag": "required if action is flag — immediate concern",
  "reason": "why this question or flag",
  "discoverySummary": "required if action is ready — structured summary of what you learned"
}${JSON_ONLY}`;

export const PROMPT_INFER_ANSWER = `You are helping Neel (PM agent) continue discovery when the stakeholder is not available.

Given the ticket and context, infer the most likely honest answer to this question.
Prefer answers aligned with business context and codebase intelligence when plausible.
If truly unknown, say "Unknown — needs stakeholder input" and note what to find out.

Question: {{question}}
Ticket: {{ticket_summary}}
{{ticket_description}}

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

Output JSON:
{
  "relevantModules": [{"path": "...", "reason": "...", "role": "primary|secondary|config|test"}],
  "reuseOpportunities": ["..."],
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

Jira: {{jira_key}}
Title: {{ticket_summary}}

Quality bar:
- Every requirement is testable (no "feel better" — rewrite to binary/measurable)
- Non-goals are specific
- Success metrics tie to stated goals
- Technical considerations include codebase findings
- Open questions are real and named with owner
- effortEstimate and complexitySummary use AgentOS agent pipeline wall-clock hours (Virin → Ananta → Neel), NOT human developer sprint days. Typical ranges: XS 30–90 min, S 1–3 h, M 3–8 h, L 8–16 h, XL 16–40 h.

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
