import type { Prisma, PipelineStage } from "../db/prisma";
import { EngineeringAgent } from "../agents/engineeringAgent";
import { runQaAgentic } from "../qaAgent";
import { attachQaReportToJira } from "../qa/report/reportAttacher";
import { codebaseQueryService } from "../codebaseIntelligence/queryService";
import { resolveRepoScope } from "../codebaseIntelligence/repoScope";
import {
  DiscoveryPausedError,
  runDiscovery,
} from "../discovery/discoveryOrchestrator";
import { auditRepo } from "../db/repositories/auditRepo";
import { pipelineRepo } from "../db/repositories/pipelineRepo";
import { ticketRepo } from "../db/repositories/ticketRepo";
import { getPipelineJiraClient } from "../pipeline/jira/client";
import { indexer } from "../rag/indexer";
import { retriever } from "../rag/retriever";
import type {
  AgentOutput,
  ImplementationOutput,
  PrdOutput,
  QaOutput,
} from "../types/agents";
import type { NormalizedTicket } from "../types/ticket";
import type { ValidationResult } from "../types/pipeline";
import { logger } from "../utils/logger";
import { validateImplementation } from "../validators/implementationValidator";
import { validatePrd } from "../validators/prdValidator";
import { validateQa } from "../validators/qaValidator";
import { buildEngineeringAgentContext } from "./contextBuilder";
import { stateManager } from "./stateManager";

export class PipelineOrchestrator {
  private readonly engineeringAgent = new EngineeringAgent();

  async run(ticketId: string): Promise<void> {
    const ticket = await ticketRepo.findById(ticketId);
    if (!ticket) throw new Error(`Ticket ${ticketId} not found`);

    const normalizedTicket = ticket.normalizedData as unknown as NormalizedTicket;
    const pipeline = await pipelineRepo.create({
      ticketId: ticket.id,
      currentStage: "INGESTION",
      status: "RUNNING",
    });

    logger.info({ pipelineId: pipeline.id, ticketId }, "pipeline started");
    await ticketRepo.setStatus(ticket.id, "PROCESSING");
    await auditRepo.log(pipeline.id, "PIPELINE_STARTED", {
      ticketId: ticket.id,
      jiraKey: ticket.jiraKey,
    });

    try {
      await this.ingest(pipeline.id, normalizedTicket);

      const productStage = await this.runProductAgent(
        pipeline.id,
        normalizedTicket.jiraKey,
        normalizedTicket,
      );
      const prdValidation = await this.validatePrdStage(pipeline.id, productStage.agentOutput);
      if (!(await this.continueOrPause(pipeline.id, "PRD_VALIDATION", prdValidation))) {
        await ticketRepo.setStatus(ticket.id, "AWAITING_HUMAN");
        return;
      }
      await indexer.indexPrd(
        normalizedTicket.jiraTicketId,
        normalizedTicket.jiraKey,
        productStage.agentOutput.parsed
      );

      const implementationOutput = await this.runEngineeringAgent(
        pipeline.id,
        normalizedTicket.jiraKey,
        productStage.agentOutput.parsed,
        productStage.enrichedPrdDocument
      );
      const implementationValidation = await this.validateImplementationStage(
        pipeline.id,
        implementationOutput,
        productStage.agentOutput.parsed
      );
      if (
        !(await this.continueOrPause(
          pipeline.id,
          "IMPLEMENTATION_VALIDATION",
          implementationValidation
        ))
      ) {
        await ticketRepo.setStatus(ticket.id, "AWAITING_HUMAN");
        return;
      }
      await indexer.indexImplementation(
        normalizedTicket.jiraTicketId,
        normalizedTicket.jiraKey,
        implementationOutput.parsed
      );

      const qaStage = await this.runQaAgent(
        pipeline.id,
        normalizedTicket.jiraKey,
        productStage.agentOutput.parsed,
        implementationOutput.parsed
      );
      const qaOutput = qaStage.agentOutput;
      const qaValidation = await this.validateQaStage(
        pipeline.id,
        qaOutput,
        productStage.agentOutput.parsed
      );
      if (!(await this.continueOrPause(pipeline.id, "QA_VALIDATION", qaValidation))) {
        await ticketRepo.setStatus(ticket.id, "AWAITING_HUMAN");
        return;
      }
      if (qaStage.executionReport) {
        await attachQaReportToJira(
          normalizedTicket.jiraKey,
          qaOutput.parsed,
          qaStage.executionReport
        );
      }
      await indexer.indexQaReport(
        normalizedTicket.jiraTicketId,
        normalizedTicket.jiraKey,
        qaOutput.parsed
      );

      await this.writeBackToJira(pipeline.id, normalizedTicket.jiraKey, {
        prd: productStage.agentOutput.parsed,
        prdDocument: productStage.enrichedPrdDocument,
        implementation: implementationOutput.parsed,
        qa: qaOutput.parsed,
        validations: {
          prd: prdValidation,
          implementation: implementationValidation,
          qa: qaValidation,
        },
      });

      await stateManager.complete(pipeline.id);
      await ticketRepo.setStatus(ticket.id, "COMPLETED");
      logger.info({ pipelineId: pipeline.id }, "pipeline completed");
    } catch (err) {
      if (err instanceof DiscoveryPausedError) {
        await ticketRepo.setStatus(ticket.id, "AWAITING_HUMAN");
        logger.warn(
          { pipelineId: pipeline.id, blockingGaps: err.blockingGaps },
          "discovery paused for human clarification"
        );
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      await stateManager.fail(pipeline.id, "OUTPUT", message);
      await ticketRepo.setStatus(ticket.id, "FAILED");
      logger.error({ err, pipelineId: pipeline.id }, "pipeline failed");
      throw err;
    }
  }

  private async ingest(
    pipelineId: string,
    ticket: NormalizedTicket
  ): Promise<void> {
    const log = await pipelineRepo.startStage({
      pipelineId,
      stage: "INGESTION",
      inputJson: ticket as unknown as Prisma.InputJsonValue,
    });
    await indexer.indexTicket(ticket);
    await pipelineRepo.completeStage({
      stageLogId: log.id,
      output: { indexed: true, jiraKey: ticket.jiraKey },
    });
    await stateManager.advance(pipelineId, "PRODUCT_AGENT");
  }

  private async runProductAgent(
    pipelineId: string,
    _jiraKey: string,
    ticket: NormalizedTicket
  ): Promise<{
    agentOutput: AgentOutput<PrdOutput>;
    enrichedPrdDocument: Record<string, unknown>;
  }> {
    const stageLog = await pipelineRepo.startStage({
      pipelineId,
      stage: "PRODUCT_AGENT",
      inputJson: {
        mode: "discovery",
        jiraKey: ticket.jiraKey,
      } as unknown as Prisma.InputJsonValue,
    });

    const discovery = await runDiscovery(ticket, pipelineId);

    const output: AgentOutput<PrdOutput> = {
      raw: JSON.stringify(discovery.prd),
      parsed: discovery.prdOutput,
      metadata: {
        inputTokens: discovery.totalTokensUsed,
        outputTokens: 0,
        costUsd: discovery.totalCostUsd,
        durationMs: discovery.durationMs,
      },
    };

    const enrichedPrdDocument: Record<string, unknown> = {
      prdOutput: discovery.prdOutput,
      generatedPrd: discovery.prd,
      historicalIntelligence: discovery.historicalIntelligence,
      ticketAnalysis: discovery.ticketAnalysis,
      gapAnalysis: discovery.gapAnalysis,
      complexityAssessment: discovery.complexityAssessment,
      scores: discovery.scores,
      toolCallLog: discovery.toolCallLog,
      synthesisSummary: {
        historicalCoverage: discovery.historicalIntelligence.historicalCoverage,
        reusedPatterns: discovery.historicalIntelligence.successPatterns,
        knownFailures: discovery.historicalIntelligence.knownFailures,
        impliedRequirements: discovery.historicalIntelligence.impliedRequirements,
        reuseOpportunities: discovery.historicalIntelligence.reuseOpportunities,
        blockingGaps: discovery.gapAnalysis.blockingGaps,
      },
    };

    await pipelineRepo.completeStage({
      stageLogId: stageLog.id,
      output: {
        prd: discovery.prdOutput,
        scores: discovery.scores,
        toolCallLog: discovery.toolCallLog,
        discovery: {
          ticketAnalysis: discovery.ticketAnalysis,
          historicalIntelligence: discovery.historicalIntelligence,
          gapAnalysis: discovery.gapAnalysis,
          complexityAssessment: discovery.complexityAssessment,
          generatedPrd: discovery.prd,
        },
      } as unknown as Prisma.InputJsonValue,
      confidenceScore: discovery.scores.prdQualityScore,
      tokenCount: discovery.totalTokensUsed,
      costUsd: discovery.totalCostUsd,
    });
    await stateManager.advance(pipelineId, "PRD_VALIDATION");
    return { agentOutput: output, enrichedPrdDocument };
  }

  private async validatePrdStage(
    pipelineId: string,
    output: AgentOutput<PrdOutput>
  ): Promise<ValidationResult> {
    const stageLog = await pipelineRepo.startStage({
      pipelineId,
      stage: "PRD_VALIDATION",
      inputJson: output.parsed as unknown as Prisma.InputJsonValue,
    });
    const result = validatePrd(output.parsed);
    await pipelineRepo.completeStage({
      stageLogId: stageLog.id,
      output: result as unknown as Prisma.InputJsonValue,
      validationResult: result as unknown as Prisma.InputJsonValue,
      status: result.passed ? "COMPLETED" : "AWAITING_HUMAN",
    });
    if (result.passed) await stateManager.advance(pipelineId, "ENGINEERING_AGENT");
    return result;
  }

  private async runEngineeringAgent(
    pipelineId: string,
    jiraKey: string,
    prd: PrdOutput,
    enrichedPrdDocument: Record<string, unknown>
  ): Promise<AgentOutput<ImplementationOutput>> {
    const retrieved = await retriever.retrieveForEngineeringAgent(prd, jiraKey);
    const codebaseIntelligence = await this.getCodebaseIntelligenceSnapshot(prd);
    const enrichedPrdSummary = this.buildEnrichedPrdSummary(enrichedPrdDocument);
    const context = buildEngineeringAgentContext(
      prd,
      retrieved,
      `${enrichedPrdSummary}\n\n${codebaseIntelligence.snapshotText}`
    );
    const input = {
      context,
      enrichedPrdDocument,
      codebaseIntelligence,
      prd,
      instruction: "Produce an implementation plan mapped to every acceptance criterion.",
    };
    const stageLog = await pipelineRepo.startStage({
      pipelineId,
      stage: "ENGINEERING_AGENT",
      inputJson: input as unknown as Prisma.InputJsonValue,
    });
    const output = await this.engineeringAgent.run(
      pipelineId,
      JSON.stringify(input, null, 2)
    );
    await pipelineRepo.completeStage({
      stageLogId: stageLog.id,
      output: output.parsed as unknown as Prisma.InputJsonValue,
      confidenceScore: output.parsed.confidenceScore,
      tokenCount: output.metadata.inputTokens + output.metadata.outputTokens,
      costUsd: output.metadata.costUsd,
    });
    await stateManager.advance(pipelineId, "IMPLEMENTATION_VALIDATION");
    return output;
  }

  private buildEnrichedPrdSummary(enrichedPrdDocument: Record<string, unknown>): string {
    const synthesis = (enrichedPrdDocument.synthesisSummary ?? {}) as Record<string, unknown>;
    const historicalCoverage = Number(synthesis.historicalCoverage ?? 0);
    const reusedPatterns = Array.isArray(synthesis.reusedPatterns)
      ? synthesis.reusedPatterns
      : [];
    const knownFailures = Array.isArray(synthesis.knownFailures)
      ? synthesis.knownFailures
      : [];
    const impliedRequirements = Array.isArray(synthesis.impliedRequirements)
      ? synthesis.impliedRequirements
      : [];
    const blockingGaps = Number(synthesis.blockingGaps ?? 0);

    const lines = [
      "Enriched PRD Intelligence:",
      `- Historical coverage: ${historicalCoverage}`,
      `- Reuse patterns: ${reusedPatterns.length}`,
      `- Known failures to avoid: ${knownFailures.length}`,
      `- Implied requirements: ${impliedRequirements.length}`,
      `- Blocking gaps: ${blockingGaps}`,
    ];

    return lines.join("\n");
  }

  private async getCodebaseIntelligenceSnapshot(prd: PrdOutput): Promise<{
    branch: string;
    semanticMatches: unknown[];
    featureFiles: unknown[];
    recentChanges: unknown[];
    snapshotText: string;
  }> {
    const scope = resolveRepoScope();
    const branch = scope?.defaultBranch ?? "main";

    try {
      const [semanticMatches, featureFiles, recentChanges] = await Promise.all([
        codebaseQueryService.searchCodebaseSemantically({
          query: `${prd.title}\n${prd.problemStatement}\n${prd.acceptanceCriteria.join("\n")}`,
          branchName: branch,
          topK: 8,
          similarityThreshold: 0.68,
        }),
        codebaseQueryService.getFilesTouchingFeature(prd.title, branch),
        codebaseQueryService.getRecentChanges(branch, 10),
      ]);

      const semanticLines = semanticMatches
        .slice(0, 8)
        .map((match: any) => {
          const similarity = Number(match.similarity ?? 0).toFixed(3);
          return `- ${match.file_path ?? "unknown"} (similarity ${similarity})`;
        });

      const featureLines = featureFiles
        .slice(0, 10)
        .map((file: any) => `- ${file.filePath} :: ${file.summary ?? "no summary"}`);

      const changeLines = recentChanges
        .slice(0, 8)
        .map(
          (change: any) =>
            `- ${change.sha?.slice(0, 8) ?? "unknown"} ${change.message ?? ""} (${change.author ?? "unknown"})`
        );

      const snapshotText = [
        `Branch: ${branch}`,
        "Top semantic matches:",
        ...(semanticLines.length ? semanticLines : ["- none"]),
        "Likely feature files:",
        ...(featureLines.length ? featureLines : ["- none"]),
        "Recent branch changes:",
        ...(changeLines.length ? changeLines : ["- none"]),
      ].join("\n");

      return {
        branch,
        semanticMatches,
        featureFiles,
        recentChanges,
        snapshotText,
      };
    } catch (err) {
      logger.warn({ err, branch }, "codebase intelligence lookup failed for engineering stage");
      return {
        branch,
        semanticMatches: [],
        featureFiles: [],
        recentChanges: [],
        snapshotText: "Unavailable (lookup failed or index not ready).",
      };
    }
  }

  private async validateImplementationStage(
    pipelineId: string,
    output: AgentOutput<ImplementationOutput>,
    prd: PrdOutput
  ): Promise<ValidationResult> {
    const stageLog = await pipelineRepo.startStage({
      pipelineId,
      stage: "IMPLEMENTATION_VALIDATION",
      inputJson: output.parsed as unknown as Prisma.InputJsonValue,
    });
    const result = validateImplementation(output.parsed, prd);
    await pipelineRepo.completeStage({
      stageLogId: stageLog.id,
      output: result as unknown as Prisma.InputJsonValue,
      validationResult: result as unknown as Prisma.InputJsonValue,
      status: result.passed ? "COMPLETED" : "AWAITING_HUMAN",
    });
    if (result.passed) await stateManager.advance(pipelineId, "QA_AGENT");
    return result;
  }

  private async runQaAgent(
    pipelineId: string,
    jiraKey: string,
    prd: PrdOutput,
    implementation: ImplementationOutput
  ) {
    const retrieved = await retriever.retrieveForQAAgent(prd, jiraKey);
    const input = {
      prd,
      implementation,
      retrievedContext: retrieved,
      instruction:
        "Four-phase QA: understand code, write tests, run tests, report findings.",
    };
    const stageLog = await pipelineRepo.startStage({
      pipelineId,
      stage: "QA_AGENT",
      inputJson: input as unknown as Prisma.InputJsonValue,
    });
    const result = await runQaAgentic({
      pipelineId,
      jiraKey,
      prd,
      implementation,
      retrievedContext: retrieved,
    });
    const output = result.agentOutput;
    await pipelineRepo.completeStage({
      stageLogId: stageLog.id,
      output: {
        qa: output.parsed,
        executionReport: result.executionReport,
        toolCallLog: result.toolCallLog,
      } as unknown as Prisma.InputJsonValue,
      confidenceScore: output.parsed.confidenceScore,
      tokenCount: output.metadata.inputTokens + output.metadata.outputTokens,
      costUsd: output.metadata.costUsd,
    });
    await stateManager.advance(pipelineId, "QA_VALIDATION");
    return result;
  }

  private async validateQaStage(
    pipelineId: string,
    output: AgentOutput<QaOutput>,
    prd: PrdOutput
  ): Promise<ValidationResult> {
    const stageLog = await pipelineRepo.startStage({
      pipelineId,
      stage: "QA_VALIDATION",
      inputJson: output.parsed as unknown as Prisma.InputJsonValue,
    });
    const result = validateQa(output.parsed, prd);
    await pipelineRepo.completeStage({
      stageLogId: stageLog.id,
      output: result as unknown as Prisma.InputJsonValue,
      validationResult: result as unknown as Prisma.InputJsonValue,
      status: result.passed ? "COMPLETED" : "AWAITING_HUMAN",
    });
    if (result.passed) await stateManager.advance(pipelineId, "OUTPUT");
    return result;
  }

  private async writeBackToJira(
    pipelineId: string,
    jiraKey: string,
    output: Record<string, unknown>
  ): Promise<void> {
    const stageLog = await pipelineRepo.startStage({
      pipelineId,
      stage: "OUTPUT",
      inputJson: { jiraKey, output } as unknown as Prisma.InputJsonValue,
    });
    await getPipelineJiraClient().addAttachmentNote(jiraKey, "Agentos pipeline output", output);
    await pipelineRepo.completeStage({
      stageLogId: stageLog.id,
      output: { jiraKey, written: true },
    });
    await auditRepo.log(pipelineId, "JIRA_WRITEBACK_COMPLETED", { jiraKey });
  }

  private async continueOrPause(
    pipelineId: string,
    stage: PipelineStage,
    validation: ValidationResult
  ): Promise<boolean> {
    if (validation.passed) return true;
    await stateManager.pauseForHuman(
      pipelineId,
      stage,
      validation.issues.map((i) => i.message).join("; ")
    );
    return false;
  }
}

export const orchestrator = new PipelineOrchestrator();
