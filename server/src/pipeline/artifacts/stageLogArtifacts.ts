import { prisma } from "../../db/client";
import type { PipelineArtifact, PipelineArtifactType } from "./types";
import { listPipelineArtifacts } from "./store";

function artifactId(pipelineId: string, type: PipelineArtifactType): string {
  return `${pipelineId}:${type}:stage-log`;
}

function stageOutput(
  stages: Array<{ stage: string; output: unknown }>,
  stageName: string
): Record<string, unknown> | null {
  const log = stages.find((s) => s.stage === stageName);
  if (!log?.output || typeof log.output !== "object") return null;
  return log.output as Record<string, unknown>;
}

export async function listArtifactsFromStageLogs(
  pipelineId: string
): Promise<PipelineArtifact[]> {
  const memory = listPipelineArtifacts(pipelineId);
  if (memory.length > 0) return memory;

  const pipeline = await prisma.pipeline.findUnique({
    where: { id: pipelineId },
    include: {
      ticket: true,
      stages: {
        where: {
          status: "COMPLETED",
          stage: { in: ["PRODUCT_AGENT", "ENGINEERING_AGENT", "QA_AGENT"] },
        },
        orderBy: { completedAt: "desc" },
      },
    },
  });
  if (!pipeline) return [];

  const jiraKey = pipeline.ticket.jiraKey;
  const artifacts: PipelineArtifact[] = [];
  const productOut = stageOutput(pipeline.stages, "PRODUCT_AGENT");
  const engOut = stageOutput(pipeline.stages, "ENGINEERING_AGENT");
  const qaOut = stageOutput(pipeline.stages, "QA_AGENT");

  if (productOut) {
    const prd = (productOut.prd ?? productOut.generatedPrd) as
      | Record<string, unknown>
      | undefined;
    if (prd) {
      artifacts.push({
        id: artifactId(pipelineId, "IMPLEMENTATION_PLAN"),
        pipelineId,
        jiraKey,
        type: "IMPLEMENTATION_PLAN",
        producer: "virin",
        title:
          typeof prd === "object" && prd && "title" in prd
            ? String((prd as { title?: string }).title ?? "PRD")
            : "PRD",
        payload: { prd, discovery: productOut },
        createdAt: pipeline.stages.find((s) => s.stage === "PRODUCT_AGENT")
          ?.completedAt
          ?.toISOString() ?? new Date().toISOString(),
      });
    }
  }

  if (engOut) {
    artifacts.push({
      id: artifactId(pipelineId, "CODE_SUMMARY"),
      pipelineId,
      jiraKey,
      type: "CODE_SUMMARY",
      producer: "engineering",
      title: "Implementation plan",
      payload: engOut,
      createdAt:
        pipeline.stages.find((s) => s.stage === "ENGINEERING_AGENT")
          ?.completedAt?.toISOString() ?? new Date().toISOString(),
    });
  }

  if (qaOut) {
    artifacts.push({
      id: artifactId(pipelineId, "TEST_PLAN"),
      pipelineId,
      jiraKey,
      type: "TEST_PLAN",
      producer: "qa",
      title: "QA report",
      payload: {
        qa: qaOut.qa ?? qaOut,
        executionReport: qaOut.executionReport ?? null,
      },
      createdAt:
        pipeline.stages.find((s) => s.stage === "QA_AGENT")?.completedAt
          ?.toISOString() ?? new Date().toISOString(),
    });
  }

  return artifacts;
}
