import Anthropic from "@anthropic-ai/sdk";

export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: "search_historical_context",
    description: `
Search the vector database for historically similar tickets, PRDs,
implementation plans, and QA reports from past work.

Use this when you need to:
- Understand how similar features were scoped in the past
- Find acceptance criteria patterns for this type of work
- Discover technical approaches used before
- Identify risks or failures encountered in similar work
- Find reusable components or patterns

The search uses semantic similarity. Query with natural language that
describes the domain, problem, or precedent you need, not just keywords.

Call this multiple times with different queries to get different angles
on the historical context. Each call may surface different examples.
    `.trim(),
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Natural language description of the historical context you need. Be specific about the domain, user problem, or precedent you want.",
        },
        content_types: {
          type: "array",
          items: {
            type: "string",
            enum: ["ticket", "prd", "implementation", "qa_report"],
          },
          description:
            "Historical content types to search. Use 'prd' for scoping patterns, 'implementation' for technical approaches, and 'qa_report' for test and risk patterns.",
        },
        top_k: {
          type: "number",
          description:
            "Number of results to return. Default 4. Increase to 6 for broader coverage.",
        },
        similarity_threshold: {
          type: "number",
          description:
            "Minimum semantic similarity score between 0 and 1. Default 0.72. Lower for broader recall, higher for narrower matches.",
        },
      },
      required: ["query", "content_types"],
      additionalProperties: false,
    },
  },
  {
    name: "fetch_related_jira_tickets",
    description: `
Fetch related Jira tickets that are linked to the current ticket,
in the same epic, or similar by component or sprint context.

Use this when you need to:
- Understand the broader scope around the current ticket
- Check for dependencies or overlapping work
- Find the epic-level goal this ticket supports
- Identify adjacent tickets that may conflict or share patterns

Returns concise summaries, issue types, and statuses for related tickets.
    `.trim(),
    input_schema: {
      type: "object",
      properties: {
        jira_key: {
          type: "string",
          description: "The Jira ticket key to inspect for related tickets.",
        },
        relationship_types: {
          type: "array",
          items: {
            type: "string",
            enum: ["epic_children", "linked", "same_components", "same_sprint"],
          },
          description:
            "The relationship types to inspect. Use multiple values when you want broader Jira context.",
        },
      },
      required: ["jira_key", "relationship_types"],
      additionalProperties: false,
    },
  },
  {
    name: "analyse_requirement_completeness",
    description: `
Run a structured completeness check on a set of drafted user stories
and acceptance criteria.

Use this before finalising a PRD to verify:
- Acceptance criteria are testable
- Vague language is removed
- Edge cases are covered
- Non-functional requirements are represented
- Each story has sufficient detail

Returns a structured report with specific issues and passed checks.
    `.trim(),
    input_schema: {
      type: "object",
      properties: {
        user_stories: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              story: { type: "string" },
              acceptance_criteria: {
                type: "array",
                items: { type: "string" },
              },
            },
            required: ["id", "story", "acceptance_criteria"],
            additionalProperties: false,
          },
          description:
            "The drafted user stories and their acceptance criteria.",
        },
        check_types: {
          type: "array",
          items: {
            type: "string",
            enum: [
              "testability",
              "vague_language",
              "edge_cases",
              "nfr_coverage",
              "completeness",
            ],
          },
          description:
            "The completeness dimensions to check in this pass.",
        },
      },
      required: ["user_stories", "check_types"],
      additionalProperties: false,
    },
  },
  {
    name: "score_prd_readiness",
    description: `
Calculate the PRD gate score for the current draft.

Use this when you believe the PRD is close to complete and you want to
check whether it will pass the product validation gate.

Returns the score, whether it passes the 0.70 threshold, and specific
failure reasons. If it does not pass, use those reasons to improve the
PRD before finalising it.
    `.trim(),
    input_schema: {
      type: "object",
      properties: {
        prd_draft: {
          type: "object",
          description:
            "The complete PRD draft as a JSON object using the current output schema.",
        },
        gap_analysis: {
          type: "object",
          description:
            "The discovery gap analysis object for the current ticket.",
        },
      },
      required: ["prd_draft", "gap_analysis"],
      additionalProperties: false,
    },
  },
];
