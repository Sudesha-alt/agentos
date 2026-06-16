import { AGENT_NAMES } from "../../shared/config/app";
import { getAgentImage } from "./AgentChatAvatar";

/** @typedef {"virin" | "ananta" | "neel"} AgentChatDomain */

export const AGENT_CHAT_CONFIG = {
  virin: {
    domain: "virin",
    displayName: AGENT_NAMES.VIRIN,
    role: "Product",
    get image() {
      return getAgentImage("virin");
    },
    welcome:
      "I help with discovery, tickets, and requirement quality. Mention any Jira key — I'll look it up. For code or QA, I'll point you to Ananta or Neel.",
    placeholder: "Ask me about a ticket, PRD readiness, or competitors…",
    suggestions: [
      "What do we know about PLT-100?",
      "Search similar tickets from past work",
      "Is this requirement complete enough for a PRD?",
      "How do competitors approach this problem?",
    ],
    principles: [
      "One question at a time",
      "Confirm before PRD",
      "Codebase-informed ACs",
      "Simplest version first",
    ],
  },
  ananta: {
    domain: "ananta",
    displayName: AGENT_NAMES.ANANTA,
    role: "Tech",
    get image() {
      return getAgentImage("ananta");
    },
    welcome:
      "I help implement tickets handed off from Virin — review plans, explain diffs, and answer questions about files being written for this ticket.",
    placeholder: "Ask about the implementation plan, a file change, or acceptance criteria…",
    suggestions: [
      "Summarize the implementation plan for this ticket",
      "Explain the changes in the latest file",
      "Which acceptance criteria are not covered yet?",
      "What should I review before approving the PR?",
    ],
    principles: [
      "Ticket-scoped",
      "Cite file paths",
      "Diff-aware",
      "Handoff-first",
    ],
  },
  neel: {
    domain: "neel",
    displayName: AGENT_NAMES.NEEL,
    role: "QA",
    get image() {
      return getAgentImage("neel");
    },
    welcome:
      "I focus on test coverage, failures, and canary findings. Reference a ticket or pipeline — I'll fetch context. Product and code questions go to Virin or Ananta.",
    placeholder: "Ask about test gaps, failures, or canary results…",
    suggestions: [
      "What are the biggest test coverage gaps?",
      "Summarize recent test failures",
      "Suggest test cases for this feature",
      "What did the latest canary run find?",
    ],
    principles: [
      "Coverage-led",
      "Canary-aware",
      "Read-only in chat",
      "Ticket-grounded",
    ],
  },
};

export function getAgentChatConfig(domain) {
  return AGENT_CHAT_CONFIG[domain] ?? AGENT_CHAT_CONFIG.ananta;
}
