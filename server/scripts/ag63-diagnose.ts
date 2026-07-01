import "dotenv/config";
import { prisma } from "../src/db/client";

async function main() {
  const ticket = await prisma.ticket.findFirst({
    where: { jiraKey: { equals: "AG-63", mode: "insensitive" } },
    include: { pipeline: true },
  });
  if (!ticket?.pipeline) {
    console.log("AG-63 ticket/pipeline not found");
    return;
  }

  const pipelineId = ticket.pipeline.id;
  console.log("=== AG-63 OVERVIEW ===");
  console.log("Ticket status:", ticket.status);
  console.log("Pipeline status:", ticket.pipeline.status);
  console.log("Current stage:", ticket.pipeline.currentStage);
  console.log("Summary:", (ticket.normalizedData as { summary?: string })?.summary);

  const stages = await prisma.pipelineStageLog.findMany({
    where: { pipelineId },
    orderBy: { startedAt: "asc" },
  });
  console.log("\n=== STAGE TIMELINE ===");
  for (const s of stages) {
    const vr = s.validationResult as { passed?: boolean; score?: number } | null;
    console.log(
      `${s.stage}: ${s.status}` +
        (s.completedAt ? ` @ ${s.completedAt.toISOString()}` : "") +
        (vr ? ` validation passed=${vr.passed} score=${vr.score}` : "") +
        (s.error ? ` ERROR: ${s.error.slice(0, 200)}` : "")
    );
  }

  const failures = await prisma.auditLog.findMany({
    where: { pipelineId, event: "PIPELINE_FAILED" },
    orderBy: { timestamp: "desc" },
    take: 5,
  });
  console.log("\n=== PIPELINE_FAILED ===");
  for (const f of failures) {
    console.log(f.timestamp.toISOString(), JSON.stringify(f.metadata));
  }

  const engAudits = await prisma.auditLog.findMany({
    where: {
      pipelineId,
      event: {
        in: [
          "ENGINEERING_AGENT_STARTED",
          "ENGINEERING_CODING_STARTED",
          "ENGINEERING_CODING_COMPLETED",
          "ENGINEERING_PUSHED_TO_BRANCH",
          "CODING_TOOL_CALL_COMPLETED",
          "CODING_TOOL_CALL_FAILED",
        ],
      },
    },
    orderBy: { timestamp: "asc" },
    take: 100,
  });
  console.log("\n=== ENGINEERING AUDIT (key events) ===");
  for (const a of engAudits) {
    const meta = a.metadata as Record<string, unknown>;
    if (a.event === "CODING_TOOL_CALL_COMPLETED") {
      console.log(
        a.timestamp.toISOString(),
        a.event,
        meta.tool,
        meta.filePath ?? meta.error ?? ""
      );
    } else {
      console.log(a.timestamp.toISOString(), a.event, JSON.stringify(meta).slice(0, 300));
    }
  }

  const product = stages.find((s) => s.stage === "PRODUCT_AGENT");
  const eng = stages.find((s) => s.stage === "ENGINEERING_AGENT");
  const productOut = product?.output as Record<string, unknown> | null;
  const engOut = eng?.output as Record<string, unknown> | null;

  const norm = ticket.normalizedData as {
    pmContext?: {
      prdOutput?: { deliverableFiles?: unknown[]; acceptanceCriteria?: string[] };
      generatedPrd?: {
        deliverableFiles?: Array<{ path: string; purpose?: string }>;
        implementationMode?: string;
      };
    };
  };

  console.log("\n=== PRD / DELIVERABLES ===");
  const genPrd = norm.pmContext?.generatedPrd;
  console.log("implementationMode:", genPrd?.implementationMode);
  console.log("deliverableFiles:", JSON.stringify(genPrd?.deliverableFiles, null, 2));
  console.log(
    "acceptanceCriteria count:",
    norm.pmContext?.prdOutput?.acceptanceCriteria?.length ?? "n/a"
  );

  const implParsed = (engOut?.parsed ?? engOut) as {
    summary?: string;
    targetFiles?: string[];
    implementationMode?: string;
    codeChanges?: Array<{ filePath: string; action: string }>;
    codingSummary?: string;
  } | null;

  console.log("\n=== ENGINEERING OUTPUT ===");
  console.log("summary:", implParsed?.summary?.slice(0, 200));
  console.log("implementationMode:", implParsed?.implementationMode);
  console.log("targetFiles:", JSON.stringify(implParsed?.targetFiles));
  console.log("codeChanges:", JSON.stringify(implParsed?.codeChanges?.map((c) => c.filePath)));
  console.log("codingSummary:", implParsed?.codingSummary?.slice(0, 200));

  const writeTools = engAudits.filter(
    (a) =>
      a.event === "CODING_TOOL_CALL_COMPLETED" &&
      ["write_file", "write_source_file", "edit_file"].includes(
        String((a.metadata as Record<string, unknown>)?.tool)
      )
  );
  console.log("\n=== WRITE TOOL CALLS ===", writeTools.length);
  for (const w of writeTools) {
    const m = w.metadata as Record<string, unknown>;
    console.log(m.tool, m.filePath, m.isError ? "ERROR" : "ok", m.error ?? "");
  }

  const implVal = stages.find((s) => s.stage === "IMPLEMENTATION_VALIDATION");
  if (implVal?.validationResult) {
    console.log("\n=== IMPLEMENTATION VALIDATION ===");
    console.log(JSON.stringify(implVal.validationResult, null, 2).slice(0, 2000));
  }
}

main().finally(() => prisma.$disconnect());
