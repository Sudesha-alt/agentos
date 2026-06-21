import type { Prisma, PipelineStage } from "../db/prisma";
import { EngineeringAgent } from "../agents/engineeringAgent";
import { buildEngineeringAgentSystemPrompt } from "../agents/engineeringAgentPrompt";
import { runCanaryCycle } from "../canaryAgent";
import { runEngineeringCodingAgentic } from "../engineeringCodingAgent";
import {
  clearCodingArtifacts,
  getCodingArtifacts,
  snapshotCodingArtifacts,
} from "../engineering/codingArtifactStore";
import {
  resolveDeliverableFiles,
  resolveImplementationMode,
  resolveTargetFilePaths,
} from "../engineering/resolveImplementationMode";
import { emitEngineeringCodingEvent } from "../engineering/codingEventsHub";
import {
  MAX_COMPILE_ATTEMPTS,
  runEngineeringSandboxCompile,
} from "../engineering/sandboxCompile";
import { publishPipelineArtifact, mirrorPmContextArtifacts } from "./artifacts";
import { resolveCodingBranchName } from "../engineeringCodingAgent/inputBuilder";
import { gitClient } from "../integrations/gitProvider";
import { runQaAgentic } from "../qaAgent";
import { completeTicketInJira } from "../jira/writeback/completeTicketInJira";
import {
  writeEngineeringToTicket,
  writeGitPushToTicket,
  writePrdToTicket,
  writeQaToTicket,
} from "../jira/writeback/stageWriteback";
import type { QaExecutionReport } from "../qa/report/reportGenerator";
import type { GeneratedPRD } from "../prd/prdGenerator";
import { orgIntelligence } from "../orgIntelligence";
import { buildEnrichedCodebaseContext } from "../codebaseIntelligence/enrichedContextService";
import { resolveRepoScope } from "../codebaseIntelligence/repoScope";
import {
  DiscoveryPausedError,
  runDiscovery,
} from "../discovery/discoveryOrchestrator";
import { auditRepo } from "../db/repositories/auditRepo";
import { pipelineRepo } from "../db/repositories/pipelineRepo";
import { ticketRepo } from "../db/repositories/ticketRepo";
import { indexer } from "../rag/indexer";
import { retriever } from "../rag/retriever";
import { unifiedRetriever } from "../rag/unifiedRetriever";
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
import {
  evaluateSecurityGate,
  mergeSecurityGateIntoValidation,
} from "../validators/securityGate";
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
      await orgIntelligence.captureValidation({
        pipelineId: pipeline.id,
        jiraKey: normalizedTicket.jiraKey,
        sourceType: "PRD",
        validation: prdValidation,
        components: normalizedTicket.components ?? [],
      });
      if (!(await this.continueOrPause(pipeline.id, "PRD_VALIDATION", prdValidation))) {
        await ticketRepo.setStatus(ticket.id, "AWAITING_HUMAN");
        return;
      }
      await writePrdToTicket(
        normalizedTicket.jiraKey,
        productStage.agentOutput.parsed,
        this.extractGeneratedPrd(productStage.enrichedPrdDocument, productStage.agentOutput)
      );
      await indexer.indexPrd(
        normalizedTicket.jiraTicketId,
        normalizedTicket.jiraKey,
        productStage.agentOutput.parsed
      );

      const engStage = await this.runEngineeringAgent(
        pipeline.id,
        normalizedTicket,
        productStage.agentOutput.parsed,
        productStage.enrichedPrdDocument
      );
      let implementationOutput = await this.runEngineeringCodingAgent(
        pipeline.id,
        normalizedTicket,
        productStage.agentOutput.parsed,
        engStage.output,
        productStage.enrichedPrdDocument,
        engStage.stageLogId
      );
      const implementationValidation = await this.validateImplementationStage(
        pipeline.id,
        implementationOutput,
        productStage.agentOutput.parsed,
        normalizedTicket,
        productStage.enrichedPrdDocument
      );
      await orgIntelligence.captureValidation({
        pipelineId: pipeline.id,
        jiraKey: normalizedTicket.jiraKey,
        sourceType: "ENGINEERING",
        validation: implementationValidation,
        components: normalizedTicket.components ?? [],
        implementation: implementationOutput.parsed,
      });
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
      await writeQaToTicket(
        normalizedTicket.jiraKey,
        qaOutput.parsed,
        qaStage.executionReport
      );

      const canaryResult = await runCanaryCycle({
        pipelineId: pipeline.id,
        jiraKey: normalizedTicket.jiraKey,
        trigger: "pipeline",
        environment: "staging",
        scope: "changed_files",
        orientation: {
          prdSummary: productStage.agentOutput.parsed.title,
          implementationSummary: implementationOutput.parsed.summary,
          qaSummary: qaOutput.parsed.testSummary,
        },
      });

      const qaValidation = this.applySecurityGate(
        await this.validateQaStage(
          pipeline.id,
          qaOutput,
          productStage.agentOutput.parsed
        ),
        qaStage,
        qaOutput.parsed,
        [
          normalizedTicket.summary,
          normalizedTicket.description,
          productStage.agentOutput.parsed.title,
        ].join(" "),
        canaryResult
      );
      await orgIntelligence.captureValidation({
        pipelineId: pipeline.id,
        jiraKey: normalizedTicket.jiraKey,
        sourceType: "QA_FAILURE",
        validation: qaValidation,
        components: normalizedTicket.components ?? [],
        qa: qaOutput.parsed,
      });
      if (!(await this.continueOrPause(pipeline.id, "QA_VALIDATION", qaValidation))) {
        await ticketRepo.setStatus(ticket.id, "AWAITING_HUMAN");
        return;
      }
      if (canaryResult?.findings.length) {
        await auditRepo.log(pipeline.id, "CANARY_FINDINGS", {
          runId: canaryResult.runId,
          count: canaryResult.findings.length,
          critical: canaryResult.findings.filter((f) => f.severity === "critical").length,
        });
      }

      await indexer.indexQaReport(
        normalizedTicket.jiraTicketId,
        normalizedTicket.jiraKey,
        qaOutput.parsed
      );

      const generatedPrd = this.extractGeneratedPrd(productStage.enrichedPrdDocument, productStage.agentOutput);
      const canaryCriticals = canaryResult?.findings
        .filter((f) => f.severity === "critical")
        .map((f) => ({ title: f.title, description: f.description })) ?? [];

      const jiraResult = await this.completeOutputStage(pipeline.id, normalizedTicket.jiraKey, {
        prd: productStage.agentOutput.parsed,
        generatedPrd,
        implementation: implementationOutput.parsed,
        qa: qaOutput.parsed,
        executionReport: qaStage.executionReport as Record<string, unknown> | undefined,
        validations: {
          prd: prdValidation,
          implementation: implementationValidation,
          qa: qaValidation,
        },
        canaryCriticals,
      });

      await orgIntelligence.capturePipelineComplete({
        pipelineId: pipeline.id,
        jiraKey: normalizedTicket.jiraKey,
        components: normalizedTicket.components ?? [],
        prd: productStage.agentOutput.parsed,
        implementation: implementationOutput.parsed,
        qa: qaOutput.parsed,
        validations: { prd: prdValidation, implementation: implementationValidation, qa: qaValidation },
      });

      await auditRepo.log(pipeline.id, "JIRA_WRITEBACK_COMPLETED", {
        jiraKey: normalizedTicket.jiraKey,
        ...jiraResult,
      });

      await stateManager.complete(pipeline.id);
      await ticketRepo.setStatus(ticket.id, "COMPLETED");
      logger.info({ pipelineId: pipeline.id, jiraResult }, "pipeline completed");
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
      const failedPipeline = await pipelineRepo.findById(pipeline.id);
      await stateManager.fail(
        pipeline.id,
        failedPipeline?.currentStage ?? pipeline.currentStage,
        message
      );
      await ticketRepo.setStatus(ticket.id, "FAILED");
      logger.error({ err, pipelineId: pipeline.id }, "pipeline failed");
      throw err;
    }
  }

  async resume(pipelineId: string): Promise<void> {
    const pipeline = await pipelineRepo.findById(pipelineId);
    if (!pipeline) throw new Error(`Pipeline ${pipelineId} not found`);

    const ticket = pipeline.ticket;
    const normalizedTicket = ticket.normalizedData as unknown as NormalizedTicket;
    const completedStages = new Set(await pipelineRepo.listCompletedStages(pipelineId));

    logger.info({ pipelineId, completedStages: [...completedStages] }, "pipeline resume started");
    await pipelineRepo.setStage(pipelineId, pipeline.currentStage, "RUNNING");
    await ticketRepo.setStatus(ticket.id, "PROCESSING");
    await auditRepo.log(pipelineId, "PIPELINE_RESUMED", { ticketId: ticket.id });

    try {
      if (!completedStages.has("INGESTION")) {
        await this.ingest(pipelineId, normalizedTicket);
      }

      let productStage: {
        agentOutput: AgentOutput<PrdOutput>;
        enrichedPrdDocument: Record<string, unknown>;
      };
      if (!completedStages.has("PRODUCT_AGENT")) {
        productStage = await this.runProductAgent(pipelineId, normalizedTicket.jiraKey, normalizedTicket);
      } else {
        productStage = this.loadProductStageFromLog(
          (await pipelineRepo.getStageOutput(pipelineId, "PRODUCT_AGENT"))!
        );
      }

      let prdValidation: ValidationResult;
      const prdValLog = await pipelineRepo.getStageOutput(pipelineId, "PRD_VALIDATION");
      if (prdValLog?.validationResult) {
        prdValidation = prdValLog.validationResult as unknown as ValidationResult;
      } else {
        prdValidation = await this.validatePrdStage(pipelineId, productStage.agentOutput);
      }
      if (!(await this.continueOrPause(pipelineId, "PRD_VALIDATION", prdValidation))) {
        await ticketRepo.setStatus(ticket.id, "AWAITING_HUMAN");
        return;
      }
      await writePrdToTicket(
        normalizedTicket.jiraKey,
        productStage.agentOutput.parsed,
        this.extractGeneratedPrd(productStage.enrichedPrdDocument, productStage.agentOutput)
      );
      if (!completedStages.has("PRD_VALIDATION")) {
        await indexer.indexPrd(
          normalizedTicket.jiraTicketId,
          normalizedTicket.jiraKey,
          productStage.agentOutput.parsed
        );
      }

      let implementationOutput: AgentOutput<ImplementationOutput>;
      if (!completedStages.has("ENGINEERING_AGENT")) {
        const engStage = await this.runEngineeringAgent(
          pipelineId,
          normalizedTicket,
          productStage.agentOutput.parsed,
          productStage.enrichedPrdDocument
        );
        implementationOutput = await this.runEngineeringCodingAgent(
          pipelineId,
          normalizedTicket,
          productStage.agentOutput.parsed,
          engStage.output,
          productStage.enrichedPrdDocument,
          engStage.stageLogId
        );
      } else {
        const engLog = await pipelineRepo.getStageOutput(pipelineId, "ENGINEERING_AGENT");
        const parsed = engLog?.output as unknown as ImplementationOutput;
        implementationOutput = {
          raw: JSON.stringify(engLog?.output),
          parsed,
          metadata: { inputTokens: 0, outputTokens: 0, costUsd: 0, durationMs: 0 },
        };
        const needsCoding = !parsed.codingSummary && !(parsed.codeChanges?.length);
        if (needsCoding) {
          implementationOutput = await this.runEngineeringCodingAgent(
            pipelineId,
            normalizedTicket,
            productStage.agentOutput.parsed,
            implementationOutput,
            productStage.enrichedPrdDocument,
            null
          );
        }
      }

      let implementationValidation: ValidationResult;
      const implValLog = await pipelineRepo.getStageOutput(pipelineId, "IMPLEMENTATION_VALIDATION");
      if (implValLog?.validationResult) {
        implementationValidation = implValLog.validationResult as unknown as ValidationResult;
      } else {
        implementationValidation = await this.validateImplementationStage(
          pipelineId,
          implementationOutput,
          productStage.agentOutput.parsed,
          normalizedTicket,
          productStage.enrichedPrdDocument
        );
      }
      if (
        !(await this.continueOrPause(pipelineId, "IMPLEMENTATION_VALIDATION", implementationValidation))
      ) {
        await ticketRepo.setStatus(ticket.id, "AWAITING_HUMAN");
        return;
      }
      if (!completedStages.has("IMPLEMENTATION_VALIDATION")) {
        await indexer.indexImplementation(
          normalizedTicket.jiraTicketId,
          normalizedTicket.jiraKey,
          implementationOutput.parsed
        );
      }

      let qaStage: {
        agentOutput: AgentOutput<QaOutput>;
        executionReport?: QaExecutionReport;
        toolCallLog: unknown[];
      };
      if (!completedStages.has("QA_AGENT")) {
        qaStage = await this.runQaAgent(
          pipelineId,
          normalizedTicket.jiraKey,
          productStage.agentOutput.parsed,
          implementationOutput.parsed
        );
      } else {
        const qaLog = await pipelineRepo.getStageOutput(pipelineId, "QA_AGENT");
        const out = qaLog?.output as {
          qa: QaOutput;
          executionReport?: QaExecutionReport;
        } | null;
        if (!out?.qa) throw new Error("QA stage output missing on resume");
        qaStage = {
          agentOutput: {
            raw: JSON.stringify(out.qa),
            parsed: out.qa,
            metadata: { inputTokens: 0, outputTokens: 0, costUsd: 0, durationMs: 0 },
          },
          executionReport: out.executionReport,
          toolCallLog: [],
        };
      }
      const qaOutput = qaStage.agentOutput;
      await writeQaToTicket(
        normalizedTicket.jiraKey,
        qaOutput.parsed,
        qaStage.executionReport
      );

      const canaryResult = await runCanaryCycle({
        pipelineId,
        jiraKey: normalizedTicket.jiraKey,
        trigger: "pipeline",
        environment: "staging",
        scope: "changed_files",
        orientation: {
          prdSummary: productStage.agentOutput.parsed.title,
          implementationSummary: implementationOutput.parsed.summary,
          qaSummary: qaOutput.parsed.testSummary,
        },
      });

      let qaValidation: ValidationResult;
      const qaValLog = await pipelineRepo.getStageOutput(pipelineId, "QA_VALIDATION");
      if (qaValLog?.validationResult) {
        qaValidation = qaValLog.validationResult as unknown as ValidationResult;
      } else {
        qaValidation = this.applySecurityGate(
          await this.validateQaStage(pipelineId, qaOutput, productStage.agentOutput.parsed),
          qaStage,
          qaOutput.parsed,
          [
            normalizedTicket.summary,
            normalizedTicket.description,
            productStage.agentOutput.parsed.title,
          ].join(" "),
          canaryResult
        );
      }
      if (!(await this.continueOrPause(pipelineId, "QA_VALIDATION", qaValidation))) {
        await ticketRepo.setStatus(ticket.id, "AWAITING_HUMAN");
        return;
      }

      if (canaryResult?.findings.length) {
        await auditRepo.log(pipelineId, "CANARY_FINDINGS", {
          runId: canaryResult.runId,
          count: canaryResult.findings.length,
          critical: canaryResult.findings.filter((f) => f.severity === "critical").length,
        });
      }

      await indexer.indexQaReport(
        normalizedTicket.jiraTicketId,
        normalizedTicket.jiraKey,
        qaOutput.parsed
      );

      const generatedPrd = this.extractGeneratedPrd(productStage.enrichedPrdDocument, productStage.agentOutput);
      const canaryCriticals = canaryResult?.findings
        .filter((f) => f.severity === "critical")
        .map((f) => ({ title: f.title, description: f.description })) ?? [];

      const jiraResult = await this.completeOutputStage(pipelineId, normalizedTicket.jiraKey, {
        prd: productStage.agentOutput.parsed,
        generatedPrd,
        implementation: implementationOutput.parsed,
        qa: qaOutput.parsed,
        executionReport: qaStage.executionReport as Record<string, unknown> | undefined,
        validations: {
          prd: prdValidation,
          implementation: implementationValidation,
          qa: qaValidation,
        },
        canaryCriticals,
      });

      await orgIntelligence.capturePipelineComplete({
        pipelineId,
        jiraKey: normalizedTicket.jiraKey,
        components: normalizedTicket.components ?? [],
        prd: productStage.agentOutput.parsed,
        implementation: implementationOutput.parsed,
        qa: qaOutput.parsed,
        validations: { prd: prdValidation, implementation: implementationValidation, qa: qaValidation },
      });

      await auditRepo.log(pipelineId, "JIRA_WRITEBACK_COMPLETED", {
        jiraKey: normalizedTicket.jiraKey,
        ...jiraResult,
      });

      await stateManager.complete(pipelineId);
      await ticketRepo.setStatus(ticket.id, "COMPLETED");
      logger.info({ pipelineId }, "pipeline resume completed");
    } catch (err) {
      if (err instanceof DiscoveryPausedError) {
        await ticketRepo.setStatus(ticket.id, "AWAITING_HUMAN");
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      const failedPipeline = await pipelineRepo.findById(pipelineId);
      await stateManager.fail(
        pipelineId,
        failedPipeline?.currentStage ?? pipeline.currentStage,
        message
      );
      await ticketRepo.setStatus(ticket.id, "FAILED");
      throw err;
    }
  }

  private loadProductStageFromLog(stageLog: { output: unknown }): {
    agentOutput: AgentOutput<PrdOutput>;
    enrichedPrdDocument: Record<string, unknown>;
  } {
    const output = stageLog.output as Record<string, unknown>;
    const prd = output.prd as PrdOutput;
    const generatedPrd = (output.generatedPrd ?? (output.discovery as Record<string, unknown>)?.generatedPrd) as
      | GeneratedPRD
      | undefined;
    const enrichedPrdDocument: Record<string, unknown> = {
      prdOutput: prd,
      generatedPrd,
      ...(output.discovery ? { discovery: output.discovery } : {}),
    };
    return {
      agentOutput: {
        raw: JSON.stringify(prd),
        parsed: prd,
        metadata: { inputTokens: 0, outputTokens: 0, costUsd: 0, durationMs: 0 },
      },
      enrichedPrdDocument,
    };
  }

  private extractGeneratedPrd(
    enrichedPrdDocument: Record<string, unknown>,
    agentOutput: AgentOutput<PrdOutput>
  ): GeneratedPRD | undefined {
    const fromDoc = enrichedPrdDocument.generatedPrd as GeneratedPRD | undefined;
    if (fromDoc) return fromDoc;
    try {
      return JSON.parse(agentOutput.raw) as GeneratedPRD;
    } catch {
      return undefined;
    }
  }

  private async completeOutputStage(
    pipelineId: string,
    jiraKey: string,
    payload: Parameters<typeof completeTicketInJira>[1]
  ) {
    const stageLog = await pipelineRepo.startStage({
      pipelineId,
      stage: "OUTPUT",
      inputJson: { jiraKey, payload } as unknown as Prisma.InputJsonValue,
    });
    const result = await completeTicketInJira(jiraKey, payload);
    await pipelineRepo.completeStage({
      stageLogId: stageLog.id,
      output: result as unknown as Prisma.InputJsonValue,
    });
    return result;
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
    if (ticket.pmContext) {
      const ctx = ticket.pmContext;
      const stageLog = await pipelineRepo.startStage({
        pipelineId,
        stage: "PRODUCT_AGENT",
        inputJson: {
          mode: "pm_prd",
          jiraKey: ticket.jiraKey,
          source: ctx.source,
        } as unknown as Prisma.InputJsonValue,
      });

      const output: AgentOutput<PrdOutput> = {
        raw: JSON.stringify(ctx.generatedPrd),
        parsed: ctx.prdOutput,
        metadata: {
          inputTokens: 0,
          outputTokens: 0,
          costUsd: 0,
          durationMs: 0,
        },
      };

      await pipelineRepo.completeStage({
        stageLogId: stageLog.id,
        output: {
          prd: ctx.prdOutput,
          generatedPrd: ctx.generatedPrd,
          source: "pm_agents",
          skippedDiscovery: true,
          systemDesign: ctx.enrichedPrdDocument.pmSystemDesign ?? null,
          taskBreakdown: ctx.enrichedPrdDocument.pmTaskBreakdown ?? null,
        } as unknown as Prisma.InputJsonValue,
        confidenceScore: ctx.prdOutput.confidenceScore,
        tokenCount: 0,
        costUsd: 0,
      });
      mirrorPmContextArtifacts({ pipelineId, pmContext: ctx });
      await stateManager.advance(pipelineId, "PRD_VALIDATION");
      return { agentOutput: output, enrichedPrdDocument: ctx.enrichedPrdDocument };
    }

    const stageLog = await pipelineRepo.startStage({
      pipelineId,
      stage: "PRODUCT_AGENT",
      inputJson: {
        mode: "discovery",
        jiraKey: ticket.jiraKey,
      } as unknown as Prisma.InputJsonValue,
    });

    let discovery;
    try {
      discovery = await runDiscovery(ticket, pipelineId);
    } catch (err) {
      if (err instanceof DiscoveryPausedError) {
        const snap = err.snapshot;
        await pipelineRepo.completeStage({
          stageLogId: stageLog.id,
          output: {
            paused: true,
            blockingGaps: err.blockingGaps,
            pauseReason: snap?.pauseReason ?? "blocking_gaps",
            discoveryQuestions: snap?.discoveryQuestions ?? [],
            scores: null,
            discovery: snap
              ? {
                  ticketAnalysis: snap.ticketAnalysis ?? null,
                  historicalIntelligence: snap.historicalIntelligence ?? null,
                  gapAnalysis: snap.gapAnalysis ?? null,
                  retrievalContext: snap.retrievalContext ?? [],
                }
              : { retrievalContext: [] },
          } as unknown as Prisma.InputJsonValue,
          status: "AWAITING_HUMAN",
        });
      }
      throw err;
    }

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
        generatedPrd: discovery.prd,
        scores: discovery.scores,
        toolCallLog: discovery.toolCallLog,
        discovery: {
          ticketAnalysis: discovery.ticketAnalysis,
          historicalIntelligence: discovery.historicalIntelligence,
          gapAnalysis: discovery.gapAnalysis,
          complexityAssessment: discovery.complexityAssessment,
          generatedPrd: discovery.prd,
          retrievalContext: discovery.retrievalContext,
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

  private resolveImplementationContext(
    ticket: NormalizedTicket,
    enrichedPrdDocument: Record<string, unknown>
  ) {
    const generatedPrd =
      ticket.pmContext?.generatedPrd ??
      (enrichedPrdDocument.generatedPrd as GeneratedPRD | undefined);
    const modeInput = { generatedPrd, pmContext: ticket.pmContext, ticket };
    const implementationMode = resolveImplementationMode(modeInput);
    const deliverableFiles = resolveDeliverableFiles(modeInput);
    const targetFilePaths = resolveTargetFilePaths(modeInput);
    return { generatedPrd, implementationMode, deliverableFiles, targetFilePaths };
  }

  private async runEngineeringAgent(
    pipelineId: string,
    ticket: NormalizedTicket,
    prd: PrdOutput,
    enrichedPrdDocument: Record<string, unknown>
  ): Promise<{ output: AgentOutput<ImplementationOutput>; stageLogId: string }> {
    const { implementationMode, deliverableFiles, targetFilePaths } =
      this.resolveImplementationContext(ticket, enrichedPrdDocument);
    const query = `${prd.title} ${prd.problemStatement} ${prd.proposedSolution}`;
    const scope = resolveRepoScope();
    const branch = scope?.defaultBranch ?? "main";

    const unified = await unifiedRetriever.retrieveUnified(query, {
      ticketTypes: ["prd", "implementation", "ticket"],
      codebase: { branchName: branch, topK: 10 },
      topKTotal: 12,
      currentJiraKey: ticket.jiraKey,
    });

    const codebaseIntelligence = await this.getCodebaseIntelligenceSnapshot(prd);
    const enrichedPrdSummary = this.buildEnrichedPrdSummary(enrichedPrdDocument);
    const context = buildEngineeringAgentContext(
      prd,
      unified.retrievedContext.length > 0
        ? unified.retrievedContext
        : await retriever.retrieveForEngineeringAgent(prd, ticket.jiraKey),
      `${enrichedPrdSummary}\n\nUnified retrieval (tickets + codebase):\n${unified.fusedBlock}\n\n${codebaseIntelligence.snapshotText}`
    );
    const input = {
      context,
      enrichedPrdDocument,
      codebaseIntelligence,
      prd,
      instruction:
        implementationMode === "content"
          ? "Produce a content implementation plan with targetFiles for every deliverable document."
          : "Produce an implementation plan mapped to every acceptance criterion.",
      implementationMode,
      deliverableFiles,
      targetFilePaths,
    };
    const stageLog = await pipelineRepo.startStage({
      pipelineId,
      stage: "ENGINEERING_AGENT",
      inputJson: input as unknown as Prisma.InputJsonValue,
    });
    const output = await this.engineeringAgent.run(
      pipelineId,
      JSON.stringify(input, null, 2),
      { systemPrompt: buildEngineeringAgentSystemPrompt(implementationMode) }
    );
    output.parsed.implementationMode =
      output.parsed.implementationMode ?? implementationMode;
    output.parsed.targetFiles =
      output.parsed.targetFiles?.length ? output.parsed.targetFiles : targetFilePaths;
    publishPipelineArtifact({
      pipelineId,
      jiraKey: ticket.jiraKey,
      type: "IMPLEMENTATION_PLAN",
      producer: "engineering",
      title: "Implementation plan",
      payload: output.parsed as unknown as Record<string, unknown>,
    });
    // Stage log completed after coding agent finishes (see runEngineeringCodingAgent).
    return { output, stageLogId: stageLog.id };
  }

  private async runEngineeringCodingAgent(
    pipelineId: string,
    ticket: NormalizedTicket,
    prd: PrdOutput,
    implementationOutput: AgentOutput<ImplementationOutput>,
    enrichedPrdDocument: Record<string, unknown>,
    stageLogId: string | null
  ): Promise<AgentOutput<ImplementationOutput>> {
    await auditRepo.log(pipelineId, "ENGINEERING_CODING_STARTED", {
      jiraKey: ticket.jiraKey,
      hasPmContext: Boolean(ticket.pmContext),
    });
    emitEngineeringCodingEvent({
      type: "coding_started",
      pipelineId,
      jiraKey: ticket.jiraKey,
      timestamp: new Date().toISOString(),
    });

    const branchName = resolveCodingBranchName();
    const { implementationMode, deliverableFiles, targetFilePaths } =
      this.resolveImplementationContext(ticket, enrichedPrdDocument);
    const requiredPaths =
      implementationOutput.parsed.targetFiles?.length
        ? implementationOutput.parsed.targetFiles
        : targetFilePaths;

    let compileFeedback: string | undefined;
    let codingResult: Awaited<ReturnType<typeof runEngineeringCodingAgentic>> | null = null;

    for (let attempt = 1; attempt <= MAX_COMPILE_ATTEMPTS; attempt++) {
      clearCodingArtifacts(pipelineId);
      codingResult = await runEngineeringCodingAgentic({
        pipelineId,
        jiraKey: ticket.jiraKey,
        prd,
        implementation: implementationOutput.parsed,
        enrichedPrdDocument,
        pmContext: ticket.pmContext,
        compileFeedback,
        retainArtifacts: true,
        implementationMode,
        deliverableFiles,
      });

      const staged = getCodingArtifacts(pipelineId).stagedFiles;

      if (implementationMode === "content") {
        if (staged.length === 0) {
          throw new Error(
            `Content deliverable required ${requiredPaths.length || "at least one"} file(s) (${requiredPaths.join(", ") || "see PRD deliverableFiles"}); Ananta staged 0. Resume after updating PRD deliverableFiles or re-run.`
          );
        }
        if (requiredPaths.length > 0) {
          const stagedPaths = new Set(staged.map((f) => f.filePath));
          const missing = requiredPaths.filter((p) => !stagedPaths.has(p));
          if (missing.length > 0) {
            throw new Error(
              `Content deliverable missing staged files: ${missing.join(", ")}. Staged ${staged.length} of ${requiredPaths.length} required path(s).`
            );
          }
        }
        break;
      }

      if (staged.length === 0) {
        break;
      }

      const compile = await runEngineeringSandboxCompile({
        pipelineId,
        branchName,
        stagedFiles: staged,
      });

      await auditRepo.log(pipelineId, "ENGINEERING_SANDBOX_COMPILE", {
        jiraKey: ticket.jiraKey,
        attempt,
        success: compile.success,
        sandboxAvailable: compile.sandboxAvailable,
      });

      if (compile.success || attempt >= MAX_COMPILE_ATTEMPTS) {
        break;
      }

      compileFeedback = compile.errors.join("\n\n");
      logger.warn(
        { pipelineId, attempt, errors: compile.errors },
        "engineering sandbox compile failed — retrying coding agent"
      );
    }

    const finalStaged = getCodingArtifacts(pipelineId).stagedFiles;
    let pushResult: { sha: string } | undefined;
    if (finalStaged.length > 0) {
      const targetBranch = process.env.ENGINEERING_TARGET_BRANCH ?? "work/agentos";
      const lastCompileSucceeded = compileFeedback === undefined;
      const commitPrefix = lastCompileSucceeded ? "" : "[compile-warnings] ";
      try {
        pushResult = await gitClient.pushFilesToBranch(
          targetBranch,
          branchName,
          finalStaged.map((f) => ({ filePath: f.filePath, content: f.content })),
          `${commitPrefix}[${ticket.jiraKey}] ${codingResult?.codingSummary ?? "Engineering agent changes"}`
        );
        await auditRepo.log(pipelineId, "ENGINEERING_PUSHED_TO_BRANCH", {
          jiraKey: ticket.jiraKey,
          targetBranch,
          filesCount: finalStaged.length,
          commitSha: pushResult.sha,
        });
        logger.info(
          { pipelineId, targetBranch, files: finalStaged.length, sha: pushResult.sha },
          "engineering staged files pushed to branch"
        );
        await writeGitPushToTicket(ticket.jiraKey, {
          targetBranch,
          commitSha: pushResult.sha,
          sourceBranch: branchName,
        });
      } catch (err) {
        logger.warn(
          { pipelineId, err },
          "failed to push staged files to branch — continuing pipeline"
        );
      }
    }

    snapshotCodingArtifacts(pipelineId);
    clearCodingArtifacts(pipelineId);

    if (!codingResult) {
      throw new Error("Engineering coding agent did not produce a result");
    }

    const merged: ImplementationOutput = {
      ...implementationOutput.parsed,
      codeChanges: codingResult.codeChanges,
      codingSummary: codingResult.codingSummary,
    };

    const output: AgentOutput<ImplementationOutput> = {
      raw: codingResult.raw,
      parsed: merged,
      metadata: {
        inputTokens:
          implementationOutput.metadata.inputTokens +
          codingResult.metadata.inputTokens,
        outputTokens:
          implementationOutput.metadata.outputTokens +
          codingResult.metadata.outputTokens,
        costUsd:
          implementationOutput.metadata.costUsd + codingResult.metadata.costUsd,
        durationMs:
          implementationOutput.metadata.durationMs +
          codingResult.metadata.durationMs,
      },
    };

    publishPipelineArtifact({
      pipelineId,
      jiraKey: ticket.jiraKey,
      type: "CODE_SUMMARY",
      producer: "engineering",
      title: "Code summary",
      payload: {
        codingSummary: codingResult.codingSummary,
        codeChanges: codingResult.codeChanges,
        toolCallLog: codingResult.toolCallLog,
      },
    });

    await auditRepo.log(pipelineId, "ENGINEERING_CODING_COMPLETED", {
      jiraKey: ticket.jiraKey,
      filesChanged: codingResult.codeChanges.length,
      toolCalls: codingResult.toolCallLog.length,
    });
    emitEngineeringCodingEvent({
      type: "coding_completed",
      pipelineId,
      jiraKey: ticket.jiraKey,
      timestamp: new Date().toISOString(),
    });

    await writeEngineeringToTicket(ticket.jiraKey, merged);

    if (stageLogId) {
      await pipelineRepo.completeStage({
        stageLogId,
        output: merged as unknown as Prisma.InputJsonValue,
        confidenceScore: merged.confidenceScore,
        tokenCount:
          implementationOutput.metadata.inputTokens +
          codingResult.metadata.inputTokens +
          implementationOutput.metadata.outputTokens +
          codingResult.metadata.outputTokens,
        costUsd:
          implementationOutput.metadata.costUsd + codingResult.metadata.costUsd,
      });
    }

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
      const query = `${prd.title}\n${prd.problemStatement}\n${prd.acceptanceCriteria.join("\n")}`;
      const bundle = await buildEnrichedCodebaseContext({
        query,
        branchName: branch,
        topN: 10,
        fetchFreshContent: false,
      });

      const semanticMatches = bundle.files.map((f) => ({
        file_path: f.path,
        similarity: f.score,
        summary: f.summary,
        contentSource: f.contentSource,
      }));

      const featureFiles = bundle.files.map((f) => ({
        filePath: f.path,
        summary: f.summary,
        neighbors: f.neighbors,
      }));

      const recentChanges: unknown[] = [];

      const snapshotText = bundle.formatted || [
        `Branch: ${branch}`,
        "No enriched codebase context available.",
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
    prd: PrdOutput,
    ticket: NormalizedTicket,
    enrichedPrdDocument: Record<string, unknown>
  ): Promise<ValidationResult> {
    const { implementationMode, targetFilePaths } = this.resolveImplementationContext(
      ticket,
      enrichedPrdDocument
    );
    const stageLog = await pipelineRepo.startStage({
      pipelineId,
      stage: "IMPLEMENTATION_VALIDATION",
      inputJson: output.parsed as unknown as Prisma.InputJsonValue,
    });
    const result = validateImplementation(output.parsed, prd, {
      implementationMode,
      targetFiles: output.parsed.targetFiles?.length
        ? output.parsed.targetFiles
        : targetFilePaths,
    });
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
      implementationMode: implementation.implementationMode,
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
    publishPipelineArtifact({
      pipelineId,
      jiraKey,
      type: "TEST_PLAN",
      producer: "qa",
      title: "QA test plan & report",
      payload: {
        testSummary: output.parsed.testSummary,
        executionReport: result.executionReport ?? null,
        toolCallLog: result.toolCallLog,
      },
    });
    await stateManager.advance(pipelineId, "QA_VALIDATION");
    return result;
  }

  private applySecurityGate(
    validation: ValidationResult,
    qaStage: { executionReport?: QaExecutionReport },
    qaOutput: QaOutput,
    ticketText: string,
    canaryResult: Awaited<ReturnType<typeof runCanaryCycle>>
  ): ValidationResult {
    const canaryCriticals =
      canaryResult?.findings
        .filter((f) => f.severity === "critical")
        .map((f) => ({ title: f.title, description: f.description })) ?? [];

    const gate = evaluateSecurityGate({
      securityScan: qaStage.executionReport?.securityScan ?? null,
      canaryCriticals,
      canarySkipped: !canaryResult,
      canarySkipReason: !canaryResult
        ? "Canary cycle did not run (disabled or missing staging URL)."
        : undefined,
      qaOutput,
      ticketText,
    });

    if (gate.blocked) {
      logger.warn({ reasons: gate.reasons }, "QA security gate blocked pipeline");
    }

    return mergeSecurityGateIntoValidation(validation, gate);
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
