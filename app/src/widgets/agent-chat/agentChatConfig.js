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
    welcome: "Ask me about discovery, similar tickets, or requirement quality.",
    placeholder: "Ask about this feature, PRD readiness, or competitors…",
    suggestions: [
      "Search similar tickets from past work",
      "Check requirement completeness for this idea",
      "Summarize what we know so far",
      "How do competitors approach this?",
    ],
  },
  ananta: {
    domain: "ananta",
    displayName: AGENT_NAMES.ANANTA,
    role: "Tech",
    get image() {
      return getAgentImage("ananta");
    },
    welcome: "Ask me anything about the codebase — architecture, flows, health.",
    placeholder: "Ask about architecture, auth flow, or impact of a change…",
    suggestions: [
      "Explain the overall architecture",
      "Trace how authentication works",
      "Summarize codebase health",
      "What is the impact of changing this file?",
    ],
  },
  neel: {
    domain: "neel",
    displayName: AGENT_NAMES.NEEL,
    role: "QA",
    get image() {
      return getAgentImage("neel");
    },
    welcome: "Ask about test coverage, failures, canary findings, or test ideas.",
    placeholder: "Ask about test gaps, failures, or canary results…",
    suggestions: [
      "Review test coverage gaps",
      "Analyze recent test failures",
      "Suggest test cases for a feature",
      "Summarize latest canary findings",
    ],
  },
};

export function getAgentChatConfig(domain) {
  return AGENT_CHAT_CONFIG[domain] ?? AGENT_CHAT_CONFIG.ananta;
}
