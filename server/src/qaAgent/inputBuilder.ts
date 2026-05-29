import type {
  ImplementationOutput,
  PrdOutput,
} from "../types/agents";
import type { RetrievedContext } from "../types/pipeline";
import { buildQaAgentContext } from "../pipeline/contextBuilder";

export interface QaAgenticInput {
  pipelineId: string;
  jiraKey: string;
  prd: PrdOutput;
  implementation: ImplementationOutput;
  retrievedContext: RetrievedContext[];
  branchName: string;
}

export function buildQaInitialUserMessage(input: QaAgenticInput): string {
  const context = buildQaAgentContext(
    input.prd,
    input.implementation,
    input.retrievedContext
  );

  return `
Jira: ${input.jiraKey}
Pipeline: ${input.pipelineId}
Implementation branch: ${input.branchName}

${context}

Acceptance criteria (test every one):
${input.prd.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Implementation criteria mapping:
${input.implementation.criteriaMapping
  .map((m) => `- ${m.criterion} → ${m.implementation}`)
  .join("\n")}

Begin PHASE 1: read implementation code on branch "${input.branchName}",
then proceed through all four phases. End with generate_qa_report and the
final JSON test plan.
  `.trim();
}

export function resolveQaBranchName(): string {
  return process.env.QA_DEFAULT_BRANCH || process.env.GITHUB_DEFAULT_BRANCH || "main";
}
