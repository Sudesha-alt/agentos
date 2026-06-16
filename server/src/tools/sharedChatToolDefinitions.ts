import type Anthropic from "@anthropic-ai/sdk";

export const LOOKUP_JIRA_TICKET_TOOL: Anthropic.Tool = {
  name: "lookup_jira_ticket",
  description: `
Fetch details for a Jira ticket by key (e.g. PLT-123).
Use whenever the user names a ticket, asks about a specific issue, or you need ticket context to answer.
Returns summary, description, status, type, labels, and any Virin analysis on file.
  `.trim(),
  input_schema: {
    type: "object",
    properties: {
      jira_key: {
        type: "string",
        description: "Jira issue key, e.g. PLT-42",
      },
    },
    required: ["jira_key"],
    additionalProperties: false,
  },
};
