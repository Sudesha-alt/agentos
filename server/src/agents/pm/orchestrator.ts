import { mergeUsage } from "../../llm/openaiCompletion";
import {
  applyFilePatternBoostsFromRetrospective,
  recordRetrospectiveLearning,
} from "../../rag/retrievalLearning";
import { logger } from "../../utils/logger";
import { gatherPmContext, resolveTicketInput } from "./contextGatherer";
import {
  PROMPT_ACCEPTANCE_CRITERIA,
  PROMPT_ARTIFACTS,
  PROMPT_CLASSIFICATION,
  PROMPT_CODEBASE_IMPACT,
  PROMPT_EFFORT,
  PROMPT_IMPLEMENTATION,
  PROMPT_PRIORITIZATION,
  PROMPT_ENRICHMENT,
  PROMPT_RETROSPECTIVE,
  renderTemplate,
} from "./prompts";
import { runPmStage } from "./runStage";
import { pmAnalysisStore } from "./store";
import type {
  AcceptanceCriteriaOutput,
  ArtifactsOutput,
  ClassificationOutput,
  CodebaseImpactOutput,
  EffortEstimateOutput,
  EnrichmentOutput,
  ImplementationOutput,
  PmAnalysisRecord,
  PmStageId,
  PmTicketInput,
  PrioritizationOutput,
  RetrospectiveInput,
  RetrospectiveOutput,
} from "./types";
import { PM_STAGE_ORDER } from "./types";

const SYSTEM =
  "You are an expert product management AI assistant. Follow instructions precisely. Always respond with a single valid JSON object.";

function formatEnrichmentBrief(e: EnrichmentOutput): string {
  return JSON.stringify(e, null, 2);
}

function formatAffectedFiles(
  impact: CodebaseImpactOutput | undefined
): string {
  if (!impact?.affectedFiles?.length) return "none identified yet";
  return impact.affectedFiles
    .map(
      (f) =>
        `- ${f.path} (${f.role}, risk ${f.riskLevel}): ${f.reason}`
    )
    .join("\n");
}

function acSummary(ac: AcceptanceCriteriaOutput | undefined): string {
  if (!ac) return "not yet generated";
  const hp = ac.happyPath?.length ?? 0;
  const ec = ac.edgeCases?.length ?? 0;
  return `${ac.userStory}; ${hp} happy-path + ${ec} edge-case criteria`;
}

const PM_STAGE_MAX_TOKENS: Partial<Record<PmStageId, number>> = {
  ACCEPTANCE_CRITERIA: 8000,
  ARTIFACTS: 6000,
  RETROSPECTIVE: 6000,
};

async function runStageWithMeta<T>(
  jiraKey: string,
  stage: PmStageId,
  userPrompt: string
): Promise<T> {
  const startedAt = new Date().toISOString();
  pmAnalysisStore.appendStageMeta(jiraKey, {
    stage,
    status: "RUNNING",
    startedAt,
  });

  try {
    const { parsed, usage } = await runPmStage<T>({
      stage,
      systemPrompt: SYSTEM,
      userPrompt,
      maxTokens: PM_STAGE_MAX_TOKENS[stage] ?? 4000,
    });

    pmAnalysisStore.appendStageMeta(jiraKey, {
      stage,
      status: "COMPLETED",
      startedAt,
      completedAt: new Date().toISOString(),
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      costUsd: usage.costUsd,
    });

    return parsed;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    pmAnalysisStore.appendStageMeta(jiraKey, {
      stage,
      status: "FAILED",
      startedAt,
      completedAt: new Date().toISOString(),
      error: message,
    });
    throw err;
  }
}

export function getPmResumeStage(record: PmAnalysisRecord): PmStageId | null {
  if (record.currentStage && PM_STAGE_ORDER.includes(record.currentStage)) {
    return record.currentStage;
  }
  const failed = [...record.stageMeta]
    .reverse()
    .find((meta) => meta.status === "FAILED");
  return failed?.stage ?? null;
}

export async function runPmAnalysisPipeline(input: {
  jiraKey: string;
  ticket?: Partial<PmTicketInput>;
  resumeFrom?: PmStageId;
}): Promise<PmAnalysisRecord> {
  const jiraKey = input.jiraKey.toUpperCase();
  const existing = pmAnalysisStore.get(jiraKey);
  if (existing?.status === "RUNNING") {
    return existing;
  }

  const resumeFrom =
    input.resumeFrom ??
    (existing?.status === "FAILED" ? getPmResumeStage(existing) : null);

  let record: PmAnalysisRecord;
  let ticket: PmTicketInput;
  let contextBundle: Awaited<ReturnType<typeof gatherPmContext>>;

  if (resumeFrom && existing) {
    ticket = existing.ticketInput;
    contextBundle = await gatherPmContext(ticket);
    const resumed = pmAnalysisStore.update(jiraKey, {
      status: "RUNNING",
      error: undefined,
      completedAt: undefined,
      context: { ...contextBundle, ticket },
    });
    if (!resumed) {
      throw new Error(`PM analysis record missing for ${jiraKey}`);
    }
    record = resumed;
  } else {
    ticket = await resolveTicketInput(jiraKey, input.ticket);
    contextBundle = await gatherPmContext(ticket);
    const contextRecord = { ...contextBundle, ticket };

    record = pmAnalysisStore.create({
      jiraKey,
      status: "RUNNING",
      currentStage: "ENRICHMENT",
      ticketInput: ticket,
      context: contextRecord,
      stageMeta: [],
      startedAt: new Date().toISOString(),
    });
  }

  const startIdx = resumeFrom ? PM_STAGE_ORDER.indexOf(resumeFrom) : 0;
  if (startIdx < 0) {
    throw new Error(`Invalid PM resume stage: ${resumeFrom}`);
  }

  try {
    for (const stage of PM_STAGE_ORDER.slice(startIdx)) {
      pmAnalysisStore.setCurrentStage(jiraKey, stage);
      await runSingleStage(jiraKey, stage, ticket, contextBundle, record);
      const updated = pmAnalysisStore.get(jiraKey);
      if (updated) Object.assign(record, updated);
    }

    pmAnalysisStore.setStatus(jiraKey, "COMPLETED");
    pmAnalysisStore.setCurrentStage(jiraKey, null);
    return pmAnalysisStore.get(jiraKey)!;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, jiraKey, resumeFrom }, "pm analysis pipeline failed");
    pmAnalysisStore.setStatus(jiraKey, "FAILED", message);
    return pmAnalysisStore.get(jiraKey)!;
  }
}

async function runSingleStage(
  jiraKey: string,
  stage: PmStageId,
  ticket: PmTicketInput,
  ctx: Awaited<ReturnType<typeof gatherPmContext>>,
  record: PmAnalysisRecord
): Promise<void> {
  switch (stage) {
    case "ENRICHMENT": {
      const prompt = renderTemplate(PROMPT_ENRICHMENT, {
        ticket_summary: ticket.summary,
        ticket_description: ticket.description,
        ticket_type: ticket.issueType,
        ticket_reporter: ticket.reporter,
        ticket_labels: ticket.labels.join(", ") || "none",
        ticket_components: ticket.components.join(", ") || "none",
        ticket_created_date: ticket.createdDate,
        ticket_priority_as_set_by_reporter: ticket.priority,
        reporter_tier: ctx.reporterTier,
        similar_tickets_list: ctx.similarTicketsList,
        component_bug_count: ctx.componentBugCount,
        okr_list: ctx.okrList,
        linked_prs: ctx.linkedPrs,
      });
      const enrichment = await runStageWithMeta<EnrichmentOutput>(
        jiraKey,
        stage,
        prompt
      );
      pmAnalysisStore.update(jiraKey, { enrichment });
      record.enrichment = enrichment;
      break;
    }
    case "CLASSIFICATION": {
      const prompt = renderTemplate(PROMPT_CLASSIFICATION, {
        enriched_brief_from_prompt_1: formatEnrichmentBrief(
          record.enrichment!
        ),
        affected_components: ctx.affectedComponents,
        churn_rate: ctx.churnRate,
        test_coverage: ctx.testCoverage,
        recent_commit_summary: ctx.recentCommitSummary,
      });
      const classification = await runStageWithMeta<ClassificationOutput>(
        jiraKey,
        stage,
        prompt
      );
      pmAnalysisStore.update(jiraKey, { classification });
      record.classification = classification;
      break;
    }
    case "CODEBASE_IMPACT": {
      const prompt = renderTemplate(PROMPT_CODEBASE_IMPACT, {
        enriched_brief: formatEnrichmentBrief(record.enrichment!),
        candidate_files_list: ctx.candidateFilesList,
        relevant_commit_history: ctx.relevantCommitHistory,
      });
      const codebaseImpact = await runStageWithMeta<CodebaseImpactOutput>(
        jiraKey,
        stage,
        prompt
      );
      pmAnalysisStore.update(jiraKey, { codebaseImpact });
      record.codebaseImpact = codebaseImpact;
      break;
    }
    case "EFFORT": {
      const prompt = renderTemplate(PROMPT_EFFORT, {
        enriched_brief: formatEnrichmentBrief(record.enrichment!),
        affected_files_with_signals: formatAffectedFiles(record.codebaseImpact),
        recent_commit_history: ctx.relevantCommitHistory,
        ticket_type: record.classification?.type ?? "unknown",
        severity: record.classification?.severity ?? "unknown",
      });
      const effortEstimate = await runStageWithMeta<EffortEstimateOutput>(
        jiraKey,
        stage,
        prompt
      );
      pmAnalysisStore.update(jiraKey, { effortEstimate });
      record.effortEstimate = effortEstimate;
      break;
    }
    case "IMPLEMENTATION": {
      const prompt = renderTemplate(PROMPT_IMPLEMENTATION, {
        enriched_brief: formatEnrichmentBrief(record.enrichment!),
        affected_files_with_summaries: formatAffectedFiles(record.codebaseImpact),
        recent_commit_history: ctx.relevantCommitHistory,
        ticket_type: record.classification?.type ?? "unknown",
        severity: record.classification?.severity ?? "unknown",
        story_points: record.effortEstimate?.storyPoints ?? "unknown",
      });
      const implementation = await runStageWithMeta<ImplementationOutput>(
        jiraKey,
        stage,
        prompt
      );
      pmAnalysisStore.update(jiraKey, { implementation });
      record.implementation = implementation;
      break;
    }
    case "PRIORITIZATION": {
      const prompt = renderTemplate(PROMPT_PRIORITIZATION, {
        enriched_brief: formatEnrichmentBrief(record.enrichment!),
        ticket_type: record.classification?.type ?? "unknown",
        severity: record.classification?.severity ?? "unknown",
        revenue_risk: record.classification?.revenueRisk ?? "unknown",
        strategic_alignment_score:
          record.classification?.strategicAlignment ?? 0,
        users_affected:
          record.classification?.estimatedUsersAffected ?? "unknown",
        reporter_tier: ctx.reporterTier,
        tshirt: record.effortEstimate?.tshirt ?? "unknown",
        story_points: record.effortEstimate?.storyPoints ?? "unknown",
        risk_factors: (record.effortEstimate?.riskFactors ?? []).join("; "),
        okr_list: ctx.okrList,
        capacity_remaining: ctx.capacityRemaining,
        inflight_count: ctx.inflightCount,
      });
      const prioritization = await runStageWithMeta<PrioritizationOutput>(
        jiraKey,
        stage,
        prompt
      );
      pmAnalysisStore.update(jiraKey, { prioritization });
      record.prioritization = prioritization;
      break;
    }
    case "ACCEPTANCE_CRITERIA": {
      const prompt = renderTemplate(PROMPT_ACCEPTANCE_CRITERIA, {
        enriched_brief: formatEnrichmentBrief(record.enrichment!),
        ticket_type: record.classification?.type ?? "unknown",
        implementation_summary_from_prompt_5:
          record.implementation?.approachSummary ?? "unknown",
        affected_files_summary: formatAffectedFiles(record.codebaseImpact),
      });
      const acceptanceCriteria =
        await runStageWithMeta<AcceptanceCriteriaOutput>(jiraKey, stage, prompt);
      pmAnalysisStore.update(jiraKey, { acceptanceCriteria });
      record.acceptanceCriteria = acceptanceCriteria;
      break;
    }
    case "ARTIFACTS": {
      const prompt = renderTemplate(PROMPT_ARTIFACTS, {
        clean_summary: record.enrichment?.cleanSummary ?? "",
        ticket_type: record.classification?.type ?? "unknown",
        severity: record.classification?.severity ?? "unknown",
        prioritization_recommendation:
          record.prioritization?.recommendation ?? "unknown",
        recommendation_reasoning:
          record.prioritization?.recommendationReasoning ?? "",
        tshirt: record.effortEstimate?.tshirt ?? "unknown",
        story_points: record.effortEstimate?.storyPoints ?? "unknown",
        affected_components: formatAffectedFiles(record.codebaseImpact),
        ac_summary: acSummary(record.acceptanceCriteria),
      });
      const artifacts = await runStageWithMeta<ArtifactsOutput>(
        jiraKey,
        stage,
        prompt
      );
      pmAnalysisStore.update(jiraKey, { artifacts });
      record.artifacts = artifacts;
      break;
    }
    default:
      break;
  }
}

export async function runPmRetrospective(input: {
  jiraKey: string;
  retrospective?: RetrospectiveInput;
}): Promise<PmAnalysisRecord> {
  const jiraKey = input.jiraKey.toUpperCase();
  const record = pmAnalysisStore.get(jiraKey);
  if (!record) {
    throw new Error(`No PM analysis found for ${jiraKey}`);
  }
  if (!record.enrichment) {
    throw new Error(`Analysis for ${jiraKey} is incomplete — run analyze first`);
  }

  const retro = input.retrospective ?? {};
  const stageDurations = record.stageMeta
    .filter((m) => m.completedAt)
    .map((m) => `${m.stage}: ${m.completedAt}`)
    .join("; ");

  const prompt = renderTemplate(PROMPT_RETROSPECTIVE, {
    agent_classification: record.classification?.type ?? "unknown",
    agent_severity: record.classification?.severity ?? "unknown",
    agent_recommendation: record.prioritization?.recommendation ?? "unknown",
    agent_estimate: record.effortEstimate?.storyPoints ?? "unknown",
    agent_affected_files: (record.codebaseImpact?.affectedFiles ?? [])
      .map((f) => f.path)
      .join(", "),
    actual_type: retro.actualType ?? "unknown",
    actual_severity: retro.actualSeverity ?? "unknown",
    human_decision: retro.humanDecision ?? record.prioritization?.recommendation ?? "unknown",
    override_reason: retro.overrideReason ?? "none",
    actual_points: retro.actualPoints ?? "unknown",
    actual_files_changed: (retro.actualFilesChanged ?? []).join(", ") || "unknown",
    ac_coverage_rating: retro.acCoverageRating ?? 3,
    stage_durations: retro.stageDurations
      ? JSON.stringify(retro.stageDurations)
      : stageDurations,
  });

  pmAnalysisStore.setCurrentStage(jiraKey, "RETROSPECTIVE");
  const retrospective = await runStageWithMeta<RetrospectiveOutput>(
    jiraKey,
    "RETROSPECTIVE",
    prompt
  );
  pmAnalysisStore.update(jiraKey, { retrospective });
  pmAnalysisStore.setCurrentStage(jiraKey, null);

  const components = record.ticketInput.components ?? [];
  recordRetrospectiveLearning(retrospective, components);
  const branchName =
    typeof record.context.branchName === "string"
      ? record.context.branchName
      : "main";
  await applyFilePatternBoostsFromRetrospective(
    retrospective,
    (record.codebaseImpact?.affectedFiles ?? []).map((f) => f.path),
    branchName
  );

  return pmAnalysisStore.get(jiraKey)!;
}

export function estimateAnalysisCost(record: PmAnalysisRecord): number {
  return record.stageMeta.reduce((sum, m) => sum + (m.costUsd ?? 0), 0);
}

export function mergeStageUsage(record: PmAnalysisRecord) {
  const usages = record.stageMeta
    .filter((m) => m.inputTokens !== undefined)
    .map((m) => ({
      inputTokens: m.inputTokens ?? 0,
      outputTokens: m.outputTokens ?? 0,
      costUsd: m.costUsd ?? 0,
    }));
  return mergeUsage(usages);
}
