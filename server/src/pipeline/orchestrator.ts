import type { Prisma, PipelineStage } from "@prisma/client";
import { ProductAgent } from "../agents/productAgent";
import { EngineeringAgent } from "../agents/engineeringAgent";
import { QAAgent } from "../agents/qaAgent";
import { auditRepo } from "../db/repositories/auditRepo";
import { pipelineRepo } from "../db/repositories/pipelineRepo";
import { ticketRepo } from "../db/repositories/ticketRepo";
import { jiraClient } from "../integrations/jiraClient";
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
import {
  buildEngineeringAgentContext,
  buildProductAgentContext,
  buildQaAgentContext,
} from "./contextBuilder";
import { stateManager } from "./stateManager";

export class PipelineOrchestrator {
  private readonly productAgent = new ProductAgent();
  private readonly engineeringAgent = new EngineeringAgent();
  private readonly qaAgent = new QAAgent();

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

      const prdOutput = await this.runProductAgent(
        pipeline.id,
        normalizedTicket.jiraKey,
        normalizedTicket,
      );
      const prdValidation = await this.validatePrdStage(pipeline.id, prdOutput);
      if (!(await this.continueOrPause(pipeline.id, "PRD_VALIDATION", prdValidation))) {
        await ticketRepo.setStatus(ticket.id, "AWAITING_HUMAN");
        return;
      }
      await indexer.indexPrd(
        normalizedTicket.jiraTicketId,
        normalizedTicket.jiraKey,
        prdOutput.parsed
      );

      const implementationOutput = await this.runEngineeringAgent(
        pipeline.id,
        normalizedTicket.jiraKey,
        prdOutput.parsed
      );
      const implementationValidation = await this.validateImplementationStage(
        pipeline.id,
        implementationOutput,
        prdOutput.parsed
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

      const qaOutput = await this.runQaAgent(
        pipeline.id,
        normalizedTicket.jiraKey,
        prdOutput.parsed,
        implementationOutput.parsed
      );
      const qaValidation = await this.validateQaStage(
        pipeline.id,
        qaOutput,
        prdOutput.parsed
      );
      if (!(await this.continueOrPause(pipeline.id, "QA_VALIDATION", qaValidation))) {
        await ticketRepo.setStatus(ticket.id, "AWAITING_HUMAN");
        return;
      }
      await indexer.indexQaReport(
        normalizedTicket.jiraTicketId,
        normalizedTicket.jiraKey,
        qaOutput.parsed
      );

      await this.writeBackToJira(pipeline.id, normalizedTicket.jiraKey, {
        prd: prdOutput.parsed,
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
    jiraKey: string,
    ticket: NormalizedTicket
  ): Promise<AgentOutput<PrdOutput>> {
    const retrieved = await retriever.retrieveForProductAgent(ticket, jiraKey);
    const context = buildProductAgentContext(ticket, retrieved);
    const stageLog = await pipelineRepo.startStage({
      pipelineId,
      stage: "PRODUCT_AGENT",
      inputJson: { context },
    });
    const output = await this.productAgent.run(pipelineId, context);
    await pipelineRepo.completeStage({
      stageLogId: stageLog.id,
      output: output.parsed as unknown as Prisma.InputJsonValue,
      confidenceScore: output.parsed.confidenceScore,
      tokenCount: output.metadata.inputTokens + output.metadata.outputTokens,
      costUsd: output.metadata.costUsd,
    });
    await stateManager.advance(pipelineId, "PRD_VALIDATION");
    return output;
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
    prd: PrdOutput
  ): Promise<AgentOutput<ImplementationOutput>> {
    const retrieved = await retriever.retrieveForEngineeringAgent(prd, jiraKey);
    const context = buildEngineeringAgentContext(prd, retrieved);
    const input = {
      context,
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
  ): Promise<AgentOutput<QaOutput>> {
    const retrieved = await retriever.retrieveForQAAgent(prd, jiraKey);
    const context = buildQaAgentContext(prd, implementation, retrieved);
    const input = {
      context,
      prd,
      implementation,
      instruction: "Generate test cases mapped directly to each acceptance criterion.",
    };
    const stageLog = await pipelineRepo.startStage({
      pipelineId,
      stage: "QA_AGENT",
      inputJson: input as unknown as Prisma.InputJsonValue,
    });
    const output = await this.qaAgent.run(pipelineId, JSON.stringify(input, null, 2));
    await pipelineRepo.completeStage({
      stageLogId: stageLog.id,
      output: output.parsed as unknown as Prisma.InputJsonValue,
      confidenceScore: output.parsed.confidenceScore,
      tokenCount: output.metadata.inputTokens + output.metadata.outputTokens,
      costUsd: output.metadata.costUsd,
    });
    await stateManager.advance(pipelineId, "QA_VALIDATION");
    return output;
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
    await jiraClient.addAttachmentNote(jiraKey, "Agentos pipeline output", output);
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
