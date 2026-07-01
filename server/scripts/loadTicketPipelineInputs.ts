/**
 * Load real pipeline inputs for Neel layer tests.
 */
import { prisma } from "../src/db/client";
import type { ImplementationOutput, PrdOutput } from "../src/types/agents";

export interface TicketPipelineInputs {
  pipelineId: string;
  jiraKey: string;
  prd: PrdOutput;
  implementation: ImplementationOutput;
  implementationBranch: string;
  deliverablePaths: string[];
  qaOutput?: import("../types/agents").QaOutput;
  qaValidation?: Record<string, unknown>;
}

export async function loadTicketPipelineInputs(
  jiraKey: string
): Promise<TicketPipelineInputs | null> {
  const ticket = await prisma.ticket.findFirst({
    where: { jiraKey: { equals: jiraKey, mode: "insensitive" } },
    include: { pipeline: { include: { stages: true } } },
  });
  if (!ticket?.pipeline) return null;

  const stages = ticket.pipeline.stages;
  const product = stages.find((s) => s.stage === "PRODUCT_AGENT");
  const eng = stages.find((s) => s.stage === "ENGINEERING_AGENT");
  const qa = stages.find((s) => s.stage === "QA_AGENT");
  const qaVal = stages.find((s) => s.stage === "QA_VALIDATION");

  const productOut = product?.output as {
    prd?: PrdOutput;
    generatedPrd?: { deliverableFiles?: Array<{ path: string }>; implementationMode?: string };
  } | null;

  const norm = ticket.normalizedData as {
    pmContext?: { prdOutput?: PrdOutput; generatedPrd?: { deliverableFiles?: Array<{ path: string }> } };
  };

  const prd =
    productOut?.prd ??
    norm.pmContext?.prdOutput ??
    null;

  const implementation =
    (eng?.output as { parsed?: ImplementationOutput })?.parsed ??
    (eng?.output as ImplementationOutput | null);
  if (!prd || !implementation?.summary) return null;

  const deliverablePaths = [
    ...new Set([
      ...(productOut?.generatedPrd?.deliverableFiles?.map((f) => f.path) ?? []),
      ...(norm.pmContext?.generatedPrd?.deliverableFiles?.map((f) => f.path) ?? []),
      ...(implementation.targetFiles ?? []),
    ]),
  ].filter(Boolean);

  const audits = await prisma.auditLog.findMany({
    where: {
      pipelineId: ticket.pipeline.id,
      event: "ENGINEERING_PUSHED_TO_BRANCH",
    },
    orderBy: { timestamp: "desc" },
    take: 1,
  });
  const pushMeta = audits[0]?.metadata as { targetBranch?: string } | null;
  const implementationBranch =
    pushMeta?.targetBranch?.trim() ?? `agentos/${jiraKey.toLowerCase()}`;

  const qaOut = qa?.output as { qa?: import("../types/agents").QaOutput } | null;

  return {
    pipelineId: ticket.pipeline.id,
    jiraKey: ticket.jiraKey,
    prd,
    implementation,
    implementationBranch,
    deliverablePaths,
    qaOutput: qaOut?.qa,
    qaValidation: qaVal?.validationResult as Record<string, unknown> | undefined,
  };
}
