export function renderTemplate(
  template: string,
  vars: Record<string, string | number | boolean>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const val = vars[key];
    if (val === undefined || val === null) return "unknown";
    return String(val);
  });
}

const JSON_ONLY = "\n\nRespond with valid JSON only. No markdown fences or commentary.";

export const PROMPT_ENRICHMENT = `You are a senior product manager at a B2B SaaS company.

You have been given a raw Jira ticket and supporting context pulled from various sources.

Your job is to synthesize this into a clean, structured brief that will be used by downstream reasoning steps. Do not make any decisions yet. Only organize and clarify.

---

RAW TICKET:
{{ticket_summary}}
{{ticket_description}}
{{ticket_type}}
{{ticket_reporter}}
{{ticket_labels}}
{{ticket_components}}
{{ticket_created_date}}
{{ticket_priority_as_set_by_reporter}}

SUPPORTING CONTEXT:
Reporter tier: {{reporter_tier}} (free / paid / enterprise)
Similar open tickets: {{similar_tickets_list}}
Component recent bug count (last 30 days): {{component_bug_count}}
Current sprint themes / OKRs: {{okr_list}}
Linked PRs: {{linked_prs}}

---

Produce the following structured output in JSON:

{
  "cleanSummary": "One paragraph restating what this ticket is actually about in plain language. Remove noise, jargon, and reporter bias.",
  "realUserProblem": "What is the underlying user problem, not just the symptom described. What is the user actually trying to do and what is stopping them?",
  "missingContext": ["List any important information that is absent from the ticket that would change how it should be handled. Be specific."],
  "relatedTicketsSummary": "One sentence on whether similar tickets exist and what pattern they suggest, if any.",
  "reporterContext": "Who raised this and why that matters — customer tier, internal vs external, urgency implied by who is asking.",
  "okrAlignment": "Does this ticket connect to any active sprint theme or OKR? How directly?",
  "redFlags": ["Any signals in this ticket that warrant immediate attention — security, compliance, data loss, major customer impact, regression from recent release."]
}

Be precise. Do not pad. If something is unknown, say unknown rather than guessing.${JSON_ONLY}`;

export const PROMPT_CLASSIFICATION = `You are a senior product manager with engineering context.

You have been given an enriched ticket brief. Your job is to classify this ticket accurately and score its severity and risk.

---

ENRICHED BRIEF:
{{enriched_brief_from_prompt_1}}

CODEBASE SIGNALS (if available):
Affected components: {{affected_components}}
Component churn rate: {{churn_rate}}
Component test coverage: {{test_coverage}}
Recent changes to affected files: {{recent_commit_summary}}

---

Produce the following in JSON:

{
  "type": "One of: bug / feature / tech_debt / performance / ux / compliance / question / incident",
  "subtype": "More specific — e.g. for bug: regression / new bug / intermittent / data issue. For feature: new capability / improvement / integration / configuration.",
  "severity": "One of: critical / high / medium / low",
  "severityReasoning": "2-3 sentences explaining why you chose this severity. Reference specific signals from the brief.",
  "affectedUserSegment": "Which users are affected — all users / specific plan tier / specific workflow / specific region.",
  "estimatedUsersAffected": "A number or range. State your assumption if estimating.",
  "revenueRisk": "One of: high / medium / low / none. Explain in one sentence.",
  "strategicAlignment": 0,
  "strategicAlignmentReason": "One sentence.",
  "isDuplicate": false,
  "duplicateOf": null,
  "classificationConfidence": 0,
  "requiresHumanEscalation": false,
  "escalationReason": null
}

Escalate if any of the following are true:
- Severity is critical
- Revenue risk is high
- Ticket touches compliance, security, legal, or data privacy
- Classification confidence is below 70
- Ticket is from a named enterprise account
- You detected a red flag in the brief

Do not soften severity to avoid escalation. If it is critical, call it critical.${JSON_ONLY}`;

export const PROMPT_CODEBASE_IMPACT = `You are a senior software engineer reviewing a product ticket to determine its technical scope.

You have been given an enriched ticket brief and a list of candidate files from the codebase that semantic search returned as potentially relevant.

Your job is to:
1. Identify which files are actually affected by this ticket
2. Explain why each file is relevant
3. Identify any dependency risk — files that may break as a side effect
4. Surface any recent code changes that are likely connected to this ticket

---

ENRICHED BRIEF:
{{enriched_brief}}

CANDIDATE FILES FROM CODEBASE INDEX:
{{candidate_files_list}}
Each entry includes: file path, plain-English summary of what the file does, last modified date, change frequency, test coverage, churn rate, and what other files depend on it.

RECENT COMMIT HISTORY FOR TOP CANDIDATES:
{{relevant_commit_history}}
Each entry includes: commit SHA, commit message, author, date, and a summary of what changed.

---

Produce the following in JSON:

{
  "affectedFiles": [
    {
      "path": "file path",
      "reason": "Specific explanation of why this file is involved in this ticket.",
      "role": "One of: primary / dependency / test / config",
      "confidence": 0,
      "riskLevel": "One of: high / medium / low."
    }
  ],
  "recentChangeConnection": "Is there a recent commit likely connected to this ticket? Describe specifically or say none.",
  "dependencyWarnings": ["Files NOT in the affected list that may still be impacted."],
  "scopeAssessment": "One paragraph on blast radius.",
  "suggestedFirstFile": "Which single file should the engineer open first? Why?"
}

Be specific. Do not list files that are only tangentially related.${JSON_ONLY}`;

export const PROMPT_EFFORT = `You are a senior engineer and tech lead who estimates tickets for sprint planning.

You have been given a ticket brief, the list of affected files with their complexity signals, and relevant git history. Your job is to produce an honest, grounded effort estimate — not an optimistic one.

---

ENRICHED BRIEF:
{{enriched_brief}}

AFFECTED FILES WITH COMPLEXITY SIGNALS:
{{affected_files_with_signals}}

RECENT RELEVANT COMMITS:
{{recent_commit_history}}

CLASSIFICATION:
Type: {{ticket_type}}
Severity: {{severity}}

---

Produce the following in JSON:

{
  "tshirt": "One of: XS / S / M / L / XL",
  "storyPoints": "One of: 1 / 2 / 3 / 5 / 8 / 13",
  "confidenceInEstimate": 0,
  "breakdown": {
    "investigation": "Time in hours",
    "implementation": "Time in hours",
    "testing": "Time in hours",
    "review": "Time in hours"
  },
  "riskFactors": ["Specific risks that could blow up this estimate."],
  "assumptions": ["What must be true for this estimate to hold."],
  "recommendedApproach": "One paragraph on safest path.",
  "estimateConfidenceNote": "If confidence is below 70, explain what information would improve it."
}

Do not give a low estimate to make the ticket look easy.${JSON_ONLY}`;

export const PROMPT_IMPLEMENTATION = `You are a senior engineer advising a mid-level engineer on how to approach implementing a ticket.

You have full context on the ticket, the affected files, and relevant code history. Your job is to give clear, specific implementation guidance — not write the code.

---

ENRICHED BRIEF:
{{enriched_brief}}

AFFECTED FILES:
{{affected_files_with_summaries}}

RECENT RELEVANT COMMITS:
{{recent_commit_history}}

CLASSIFICATION:
Type: {{ticket_type}}
Severity: {{severity}}
Story Points: {{story_points}}

---

Produce the following in JSON:

{
  "approachSummary": "2-3 sentence plain-English description of the recommended implementation approach.",
  "implementationSteps": [
    {
      "step": "1",
      "action": "What to do — be specific about file names and functions",
      "why": "Why this step is necessary",
      "watchOut": "Any trap or gotcha"
    }
  ],
  "whereNotToTouch": ["Files or functions that should NOT be modified."],
  "testingGuidance": "What should be tested.",
  "alternativeApproach": "If there is a meaningfully different way, describe tradeoffs.",
  "openQuestionsForEngineer": ["Questions to clarify before starting."]
}

Be specific to THIS codebase and THIS ticket.${JSON_ONLY}`;

export const PROMPT_PRIORITIZATION = `You are a senior product manager making a prioritization decision.

You have full context on the ticket. Your job is to make a clear, defensible prioritization recommendation.

---

ENRICHED BRIEF:
{{enriched_brief}}

CLASSIFICATION:
Type: {{ticket_type}}
Severity: {{severity}}
Revenue risk: {{revenue_risk}}
Strategic alignment: {{strategic_alignment_score}}/10
Users affected: {{users_affected}}
Reporter tier: {{reporter_tier}}

EFFORT:
T-shirt: {{tshirt}}
Story points: {{story_points}}
Risk factors: {{risk_factors}}

CURRENT SPRINT CONTEXT:
Active OKRs: {{okr_list}}
Sprint capacity remaining: {{capacity_remaining}}
Currently in-flight tickets count: {{inflight_count}}

---

Produce the following in JSON:

{
  "recommendation": "One of: NOW / NEXT / LATER / WONT_DO",
  "recommendationReasoning": "3-5 sentences with specific signals.",
  "impactScore": "0-100 composite score with math shown.",
  "costOfInaction": "What gets worse if ignored for 30 days.",
  "tradeoff": "Opportunity cost if done now.",
  "conditionsToRevisit": "When should this recommendation change.",
  "suggestedOwner": "Which team or role should own this.",
  "suggestedSprint": "Sprint recommendation or timeframe.",
  "escalateToHuman": false,
  "escalationReason": null
}

Make a real recommendation.${JSON_ONLY}`;

export const PROMPT_ACCEPTANCE_CRITERIA = `You are a senior product manager writing acceptance criteria for an engineering team.

Your acceptance criteria must be complete enough that an engineer can implement without asking clarifying questions.

---

ENRICHED BRIEF:
{{enriched_brief}}

TICKET TYPE: {{ticket_type}}
IMPLEMENTATION APPROACH: {{implementation_summary_from_prompt_5}}
AFFECTED COMPONENTS: {{affected_files_summary}}

---

Produce the following in JSON:

{
  "userStory": "As a [user], I want to [action], so that [outcome].",
  "happyPath": [
    {
      "given": "Starting state",
      "when": "Action taken",
      "then": "Expected outcome"
    }
  ],
  "edgeCases": [
    {
      "scenario": "Edge case name",
      "given": "Condition",
      "when": "Action",
      "then": "Expected behavior"
    }
  ],
  "explicitlyOutOfScope": ["Things NOT included."],
  "regressionRisks": ["Existing behaviors that must not break."],
  "definitionOfDone": ["Checklist items before marking done."]
}

Every criterion must be verifiable by QA without interpretation.${JSON_ONLY}`;

export const PROMPT_ARTIFACTS = `You are a senior product manager writing communication artifacts based on a completed ticket analysis.

Generate multiple artifacts from the same context. Match tone and length to each audience.

---

FULL TICKET CONTEXT:
Summary: {{clean_summary}}
Type: {{ticket_type}}
Severity: {{severity}}
Recommendation: {{prioritization_recommendation}}
Reasoning: {{recommendation_reasoning}}
Effort: {{tshirt}} / {{story_points}} points
Affected components: {{affected_components}}
Acceptance criteria summary: {{ac_summary}}

---

Return JSON with exactly these keys:

{
  "engineeringPing": "Slack message to engineering — 4-6 lines, direct, technical, include files and priority",
  "stakeholderUpdate": "Message for reporter/customer — 3-5 sentences, no jargon",
  "pmOneLiner": "Exactly one sentence: [Type] — [What] — [Why] — [Effort] — [Recommendation]",
  "sprintPlanningNote": "5-8 sentences for sprint planning ceremony"
}${JSON_ONLY}`;

export const PROMPT_RETROSPECTIVE = `You are analyzing the performance of an AI product agent on a completed ticket.

Evaluate what the agent got right and wrong, extract patterns, and produce structured feedback.

---

ORIGINAL AGENT OUTPUT:
Classification: {{agent_classification}}
Severity: {{agent_severity}}
Priority recommendation: {{agent_recommendation}}
Effort estimate: {{agent_estimate}}
Affected files identified: {{agent_affected_files}}

ACTUAL OUTCOME:
Actual ticket type: {{actual_type}}
Actual severity: {{actual_severity}}
Final priority decision made by PM: {{human_decision}}
Human override reason: {{override_reason}}
Actual story points taken: {{actual_points}}
Files actually touched in the PR: {{actual_files_changed}}
AC coverage rating (1-5): {{ac_coverage_rating}}
Time in each pipeline stage: {{stage_durations}}

---

Produce the following in JSON:

{
  "classificationAccuracy": "correct / partially_correct / incorrect",
  "classificationNote": "What was right or wrong.",
  "severityAccuracy": "correct / too_high / too_low",
  "severityNote": "Signals missed or overweighted.",
  "priorityAccuracy": "accepted / overridden",
  "priorityOverrideAnalysis": "If overridden, what context did the human have.",
  "effortAccuracy": "under_estimated / accurate / over_estimated",
  "effortVariance": "Actual minus estimated points.",
  "fileDetectionAccuracy": "Percentage of touched files detected.",
  "acQuality": "Rating 1-5 with gaps noted.",
  "rootCauseOfErrors": ["Root cause for each significant error."],
  "learningSignals": ["Actionable prompt or index improvements."],
  "patternFlag": "Recurring pattern or none."
}

Be honest and specific.${JSON_ONLY}`;
