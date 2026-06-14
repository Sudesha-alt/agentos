import { companyIntelligence, mapBusinessFitToRevenueRisk } from "../../companyIntelligence";
import { analyzeCompetitorApproaches } from "../../companyIntelligence/competitorAnalyzer";
import { mergeUsage } from "../../llm/openaiCompletion";
import type { GeneratedPRD } from "../../prd/prdGenerator";
import { recordRetrospectiveLearning } from "../../rag/retrievalLearning";
import { logger } from "../../utils/logger";
import { gatherPmContext, resolveTicketInput } from "../pm/contextGatherer";
import { runPmStage } from "../pm/runStage";
import { pmAnalysisStore } from "../pm/store";
import type { PmAnalysisRecord, PmTicketInput } from "../pm/types";
import { VIRIN_BEHAVIOR, VIRIN_SYSTEM_PROMPT } from "./persona";
import {
  PROMPT_CODEBASE_ANALYSIS,
  PROMPT_HANDOFF,
  PROMPT_INFER_ANSWER,
  PROMPT_INTAKE,
  PROMPT_NEXT_QUESTION,
  PROMPT_POST_SHIP,
  PROMPT_PRD,
  PROMPT_RETROSPECTIVE,
  PROMPT_SOLUTIONING,
  PROMPT_SYSTEM_DESIGN,
  PROMPT_TASK_PLANNING,
  renderTemplate,
} from "./prompts";
import type {
  CodebaseAnalysisOutput,
  HandoffPackageOutput,
  IntakeOutput,
  QuestionModeState,
  SolutioningOutput,
  CompetitorAnalysisState,
  SystemDesignOutput,
  TaskBreakdownItem,
  VirinAnalysisStatus,
  VirinNextQuestionResult,
  VirinRunMode,
  VirinStageId,
  PostShipOutput,
} from "./types";
import { VIRIN_STAGE_ORDER } from "./types";
import { getPipelineSettings } from "../../pipeline/settingsStore";

export type { VirinRunMode };

const STAGE_TOKENS: Partial<Record<VirinStageId, number>> = {
  PRD: 8000,
  HANDOFF: 6000,
  CODEBASE_ANALYSIS: 6000,
  SYSTEM_DESIGN: 6000,
  TASK_PLANNING: 5000,
};

async function runVirinStage<T>(
  jiraKey: string,
  stage: VirinStageId,
  userPrompt: string,
  maxTokens?: number
): Promise<T> {
  const startedAt = new Date().toISOString();
  pmAnalysisStore.appendStageMeta(jiraKey, { stage, status: "RUNNING", startedAt });
  try {
    const { parsed, usage } = await runPmStage<T>({
      stage,
      systemPrompt: VIRIN_SYSTEM_PROMPT,
      userPrompt,
      maxTokens: maxTokens ?? STAGE_TOKENS[stage] ?? 4000,
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

function companyContextFromRecord(
  record: PmAnalysisRecord,
  ctx?: Awaited<ReturnType<typeof gatherPmContext>>
): string {
  if (ctx?.companyContextBlock) return ctx.companyContextBlock;
  const stored = record.context as { companyContextBlock?: string } | undefined;
  return stored?.companyContextBlock ?? companyIntelligence.toPromptBlock();
}

function truncateForPrompt(text: string, max = 2800): string {
  if (!text || text.length <= max) return text || "none";
  return `${text.slice(0, max)}…`;
}

function formatCodebaseIntelligenceBlock(
  ctx: Awaited<ReturnType<typeof gatherPmContext>>
): string {
  return [
    `Affected components: ${ctx.affectedComponents}`,
    `Similar tickets / past work:\n${truncateForPrompt(ctx.similarTicketsList, 1800)}`,
    `Candidate files & modules:\n${truncateForPrompt(ctx.candidateFilesList, 2200)}`,
    `Recent commit signal: ${ctx.recentCommitSummary}`,
    `Open bugs in shared components: ${ctx.componentBugCount}`,
    `Branch: ${ctx.branchName}`,
  ].join("\n\n");
}

function questionPromptContext(ctx: Awaited<ReturnType<typeof gatherPmContext>>) {
  return {
    company_context: ctx.companyContextBlock,
    business_context: ctx.companyContextBlock,
    strategic_goals: ctx.okrList,
    codebase_intelligence: formatCodebaseIntelligenceBlock(ctx),
  };
}

function normalizeQuestionOptions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((o) => String(o).trim())
    .filter((o) => o.length > 0 && !/^other\b/i.test(o))
    .slice(0, 4);
}

function competitorBlock(record: PmAnalysisRecord): string {
  const ca = record.competitorAnalysis;
  if (!ca || ca.decision !== "run" || !ca.analyses?.length) {
    return "Competitor analysis: not run or skipped.";
  }
  const parts = [
    ca.summaryMarkdown ?? "",
    ...ca.analyses.map(
      (a) =>
        `**${a.competitorName}** (${a.competitorWebsite}): ${a.howTheySolveIt}\nStrengths: ${a.strengths.join("; ")}\nGaps: ${a.gaps.join("; ")}`
    ),
  ];
  return parts.filter(Boolean).join("\n\n");
}

function isAffirmativeCompetitorAnswer(answer: string): boolean {
  const a = answer.trim().toLowerCase();
  return /^(yes|yeah|y|run|analyze|sure|ok|do it)/.test(a) || a.includes("analyze competitor");
}

function formatConversation(state: QuestionModeState | undefined): string {
  if (!state?.conversation?.length) return "No questions yet.";
  return state.conversation
    .map(
      (t, i) =>
        `Q${i + 1}: ${t.question}\nA${i + 1}: ${t.answer}${t.flag ? `\nFLAG: ${t.flag}` : ""}`
    )
    .join("\n\n");
}

function syncLegacyFields(
  jiraKey: string,
  record: PmAnalysisRecord,
  intake?: IntakeOutput,
  qm?: QuestionModeState,
  codebase?: CodebaseAnalysisOutput,
  solution?: SolutioningOutput
): void {
  const discovery = qm?.discoverySummary ?? record.questionMode?.discoverySummary ?? "";
  pmAnalysisStore.update(jiraKey, {
    neelIntake: intake ?? record.neelIntake,
    questionMode: qm ?? record.questionMode,
    codebaseAnalysis: codebase ?? record.codebaseAnalysis,
    solutioning: solution ?? record.solutioning,
    enrichment: discovery
      ? {
          cleanSummary: record.ticketInput.summary,
          realUserProblem: solution?.problemStatement ?? discovery.slice(0, 500),
          missingContext: [],
          relatedTicketsSummary: "",
          reporterContext: record.ticketInput.reporter,
          okrAlignment: solution?.alignmentNotes ?? solution?.companyValidationSummary ?? "",
          redFlags: [
            ...(qm?.flagsRaised ?? []),
            ...(solution?.businessFit === "misaligned"
              ? [`Business misalignment: ${solution.companyValidationSummary ?? solution.alignmentNotes ?? "see solutioning"}`]
              : []),
          ],
        }
      : record.enrichment,
    classification: intake
      ? {
          type: intake.ticketType,
          subtype: intake.ticketType,
          severity: "medium",
          severityReasoning: intake.reasoning,
          affectedUserSegment: "unknown",
          estimatedUsersAffected: "unknown",
          revenueRisk: mapBusinessFitToRevenueRisk(solution?.businessFit),
          strategicAlignment:
            solution?.businessFit === "strong"
              ? 0.9
              : solution?.businessFit === "moderate"
                ? 0.65
                : solution?.businessFit === "weak"
                  ? 0.35
                  : solution?.businessFit === "misaligned"
                    ? 0.1
                    : 0.5,
          strategicAlignmentReason:
            solution?.companyValidationSummary ?? solution?.alignmentNotes ?? intake.reasoning,
          isDuplicate: false,
          duplicateOf: null,
          classificationConfidence: 0.8,
          requiresHumanEscalation: false,
          escalationReason: null,
        }
      : record.classification,
    codebaseImpact: codebase
      ? {
          affectedFiles: codebase.relevantModules.map((m) => ({
            path: m.path,
            reason: m.reason,
            role: m.role,
            confidence: 0.8,
            riskLevel: "medium",
          })),
          recentChangeConnection: "",
          dependencyWarnings: codebase.architectureConstraints,
          scopeAssessment: codebase.scopeAssessment,
          suggestedFirstFile: codebase.suggestedFirstFile,
        }
      : record.codebaseImpact,
    acceptanceCriteria: codebase?.testableAcceptanceCriteria?.length
      ? {
          userStory: discovery.slice(0, 200),
          happyPath: codebase.testableAcceptanceCriteria.slice(0, 5).map((ac) => ({
            given: ac,
            when: "executed",
            then: "passes",
          })),
          edgeCases: [],
          explicitlyOutOfScope: solution?.explicitNonGoals ?? [],
          regressionRisks: codebase.technicalRisks,
          definitionOfDone: record.handoffPackage?.definitionOfDone ?? [],
        }
      : record.acceptanceCriteria,
  });
}

export function getVirinResumeStage(record: PmAnalysisRecord): VirinStageId | null {
  if (record.currentStage && VIRIN_STAGE_ORDER.includes(record.currentStage as VirinStageId)) {
    return record.currentStage as VirinStageId;
  }
  const failed = [...record.stageMeta].reverse().find((m) => m.status === "FAILED");
  return (failed?.stage as VirinStageId) ?? null;
}

export async function runVirinPipeline(input: {
  jiraKey: string;
  ticket?: Partial<PmTicketInput>;
  resumeFrom?: VirinStageId;
  mode?: VirinRunMode;
}): Promise<PmAnalysisRecord> {
  const jiraKey = input.jiraKey.toUpperCase();
  const mode = input.mode ?? "interactive";
  const existing = pmAnalysisStore.get(jiraKey);

  if (
    existing &&
    (existing.status === "AWAITING_INPUT" || existing.status === "AWAITING_CONFIRMATION")
  ) {
    return existing;
  }
  if (existing?.status === "RUNNING") {
    return existing;
  }

  const resumeFrom =
    input.resumeFrom ??
    (existing?.status === "FAILED" ? getVirinResumeStage(existing) : null);

  let record: PmAnalysisRecord;
  let ticket: PmTicketInput;
  let ctx: Awaited<ReturnType<typeof gatherPmContext>>;

  if (resumeFrom && existing) {
    ticket = existing.ticketInput;
    ctx = await gatherPmContext(ticket);
    const updated = pmAnalysisStore.update(jiraKey, {
      status: "RUNNING",
      error: undefined,
      completedAt: undefined,
      neelMode: mode,
      context: { ...ctx, ticket },
    });
    if (!updated) throw new Error(`Virin record missing for ${jiraKey}`);
    record = updated;
  } else {
    ticket = await resolveTicketInput(jiraKey, input.ticket);
    ctx = await gatherPmContext(ticket);
    record = pmAnalysisStore.create({
      jiraKey,
      agentName: "Virin",
      status: "RUNNING",
      currentStage: "INTAKE",
      ticketInput: ticket,
      context: { ...ctx, ticket },
      stageMeta: [],
      neelMode: mode,
      startedAt: new Date().toISOString(),
    });
  }

  const startIdx = resumeFrom ? VIRIN_STAGE_ORDER.indexOf(resumeFrom) : 0;

  try {
    for (const stage of VIRIN_STAGE_ORDER.slice(startIdx)) {
      pmAnalysisStore.setCurrentStage(jiraKey, stage);
      const pause = await runVirinStageHandler(jiraKey, stage, ticket, ctx, record, mode);
      const updated = pmAnalysisStore.get(jiraKey);
      if (updated) Object.assign(record, updated);
      if (pause) return record;
    }

    pmAnalysisStore.setStatus(jiraKey, "COMPLETED");
    pmAnalysisStore.setCurrentStage(jiraKey, null);
    return pmAnalysisStore.get(jiraKey)!;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, jiraKey }, "Virin pipeline failed");
    pmAnalysisStore.setStatus(jiraKey, "FAILED", message);
    return pmAnalysisStore.get(jiraKey)!;
  }
}

async function runVirinStageHandler(
  jiraKey: string,
  stage: VirinStageId,
  ticket: PmTicketInput,
  ctx: Awaited<ReturnType<typeof gatherPmContext>>,
  record: PmAnalysisRecord,
  mode: VirinRunMode
): Promise<boolean> {
  switch (stage) {
    case "INTAKE":
      return runIntake(jiraKey, ticket, ctx, record, mode);
    case "QUESTION_MODE":
      return runQuestionMode(jiraKey, ticket, ctx, record, mode);
    case "COMPETITOR_ANALYSIS":
      return runCompetitorAnalysis(jiraKey, ticket, ctx, record, mode);
    case "CODEBASE_ANALYSIS":
      await runCodebaseAnalysis(jiraKey, ticket, ctx, record);
      return false;
    case "SYSTEM_DESIGN":
      await runSystemDesign(jiraKey, ctx, pmAnalysisStore.get(jiraKey) ?? record);
      return false;
    case "TASK_PLANNING":
      await runTaskPlanning(jiraKey, ctx, pmAnalysisStore.get(jiraKey) ?? record);
      return false;
    case "SOLUTIONING":
      return runSolutioning(jiraKey, ctx, record, mode);
    case "PRD":
      await runPrdGeneration(jiraKey, ticket, ctx, record);
      return false;
    case "HANDOFF":
      await runHandoff(jiraKey, record);
      return false;
    default:
      return false;
  }
}

async function runIntake(
  jiraKey: string,
  ticket: PmTicketInput,
  ctx: Awaited<ReturnType<typeof gatherPmContext>>,
  record: PmAnalysisRecord,
  mode: VirinRunMode
): Promise<boolean> {
  const priorAnswer = record.pendingAnswer ?? "";
  const qctx = questionPromptContext(ctx);
  const prompt = renderTemplate(PROMPT_INTAKE, {
    ticket_summary: ticket.summary,
    ticket_description: ticket.description,
    ticket_type: ticket.issueType,
    ticket_priority: ticket.priority,
    ticket_components: ticket.components.join(", ") || "none",
    ticket_labels: ticket.labels.join(", ") || "none",
    company_context: companyContextFromRecord(record, ctx),
    business_context: qctx.business_context,
    strategic_goals: qctx.strategic_goals,
    codebase_intelligence: qctx.codebase_intelligence,
    prior_clarification_block: priorAnswer
      ? `Prior clarifying answer: ${priorAnswer}`
      : "",
  });

  const intake = await runVirinStage<IntakeOutput>(jiraKey, "INTAKE", prompt);
  pmAnalysisStore.update(jiraKey, {
    neelIntake: intake,
    pendingAnswer: undefined,
  });
  syncLegacyFields(jiraKey, record, intake);

  if (intake.ticketType === "unclear" && intake.clarifyingQuestion && !priorAnswer) {
    if (mode === "interactive") {
      pmAnalysisStore.update(jiraKey, {
        status: "AWAITING_INPUT",
        pendingQuestion: intake.clarifyingQuestion,
        pendingQuestionOptions: normalizeQuestionOptions(intake.clarifyingOptions),
        pendingQuestionStage: "INTAKE",
      });
      return true;
    }
    const inferred = await runVirinStage<{ answer: string }>(jiraKey, "INTAKE", renderTemplate(PROMPT_INFER_ANSWER, {
      question: intake.clarifyingQuestion,
      ticket_summary: ticket.summary,
      ticket_description: ticket.description,
      business_context: qctx.business_context,
      codebase_intelligence: qctx.codebase_intelligence,
      conversation_history: "",
    }));
    pmAnalysisStore.update(jiraKey, { pendingAnswer: inferred.answer });
    return runIntake(jiraKey, ticket, ctx, pmAnalysisStore.get(jiraKey)!, mode);
  }

  return false;
}

async function runQuestionMode(
  jiraKey: string,
  ticket: PmTicketInput,
  ctx: Awaited<ReturnType<typeof gatherPmContext>>,
  record: PmAnalysisRecord,
  mode: VirinRunMode
): Promise<boolean> {
  const intake = record.neelIntake!;
  let state: QuestionModeState = record.questionMode ?? {
    conversation: [],
    discoverySummary: "",
    readyToProceed: false,
    flagsRaised: [],
  };

  if (record.pendingAnswer && record.pendingQuestion) {
    state.conversation.push({
      question: record.pendingQuestion,
      answer: record.pendingAnswer,
      flag: record.pendingFlag ?? null,
      askedAt: new Date().toISOString(),
      answeredAt: new Date().toISOString(),
    });
    pmAnalysisStore.update(jiraKey, {
      pendingAnswer: undefined,
      pendingQuestion: undefined,
      pendingQuestionOptions: undefined,
      pendingFlag: undefined,
      questionMode: state,
    });
  }

  const qctx = questionPromptContext(ctx);

  while (!state.readyToProceed && state.conversation.length < VIRIN_BEHAVIOR.maxDiscoveryTurns) {
    const next = await runVirinStage<VirinNextQuestionResult>(
      jiraKey,
      "QUESTION_MODE",
      renderTemplate(PROMPT_NEXT_QUESTION, {
        ticket_type: intake.ticketType,
        symptom_vs_root: intake.symptomVsRootCause,
        conversation_history: formatConversation(state),
        ticket_summary: ticket.summary,
        ticket_description: ticket.description,
        company_context: companyContextFromRecord(record, ctx),
        business_context: qctx.business_context,
        strategic_goals: qctx.strategic_goals,
        codebase_intelligence: qctx.codebase_intelligence,
      })
    );

    if (next.action === "flag" && next.flag) {
      state.flagsRaised.push(next.flag);
    }

    if (next.action === "ready" && next.discoverySummary) {
      state.discoverySummary = next.discoverySummary;
      state.readyToProceed = true;
      state.pendingQuestion = null;
      break;
    }

    if (!next.question) break;

    if (mode === "interactive") {
      state.pendingQuestion = next.question;
      pmAnalysisStore.update(jiraKey, {
        questionMode: state,
        status: "AWAITING_INPUT",
        pendingQuestion: next.question,
        pendingQuestionOptions: normalizeQuestionOptions(next.options),
        pendingQuestionStage: "QUESTION_MODE",
        pendingFlag: next.flag ?? undefined,
      });
      syncLegacyFields(jiraKey, record, intake, state);
      return true;
    }

    const inferred = await runVirinStage<{ answer: string }>(
      jiraKey,
      "QUESTION_MODE",
      renderTemplate(PROMPT_INFER_ANSWER, {
        question: next.question,
        ticket_summary: ticket.summary,
        ticket_description: ticket.description,
        business_context: qctx.business_context,
        codebase_intelligence: qctx.codebase_intelligence,
        conversation_history: formatConversation(state),
      })
    );

    state.conversation.push({
      question: next.question,
      answer: inferred.answer,
      flag: next.flag ?? null,
      askedAt: new Date().toISOString(),
      answeredAt: new Date().toISOString(),
    });
  }

  if (!state.discoverySummary && state.conversation.length) {
    state.discoverySummary = state.conversation.map((t) => `${t.question} → ${t.answer}`).join("\n");
    state.readyToProceed = true;
  }

  pmAnalysisStore.update(jiraKey, { questionMode: state, status: "RUNNING" });
  syncLegacyFields(jiraKey, record, intake, state);
  return false;
}

async function runCompetitorAnalysis(
  jiraKey: string,
  ticket: PmTicketInput,
  _ctx: Awaited<ReturnType<typeof gatherPmContext>>,
  record: PmAnalysisRecord,
  mode: VirinRunMode
): Promise<boolean> {
  const profile = await companyIntelligence.getProfile();
  const competitors = profile.competitors ?? [];
  const featureSummary =
    record.questionMode?.discoverySummary?.trim() || ticket.summary;

  let state: CompetitorAnalysisState = record.competitorAnalysis ?? {
    decision: "pending",
    featureSummary,
    analyses: [],
  };

  if (record.pendingAnswer && record.pendingQuestionStage === "COMPETITOR_ANALYSIS") {
    const runAnalysis = isAffirmativeCompetitorAnswer(record.pendingAnswer);
    state.decision = runAnalysis ? "run" : "skipped";
    pmAnalysisStore.update(jiraKey, {
      pendingAnswer: undefined,
      pendingQuestion: undefined,
      pendingQuestionOptions: undefined,
      pendingQuestionStage: undefined,
      pendingFlag: undefined,
      competitorAnalysis: state,
    });
    if (!runAnalysis) return false;
  } else if (state.decision === "skipped") {
    return false;
  } else if (state.decision === "run" && state.analyses.length > 0) {
    return false;
  } else if (!competitors.length) {
    state.decision = "skipped";
    pmAnalysisStore.update(jiraKey, { competitorAnalysis: state });
    return false;
  } else if (mode === "interactive" && state.decision === "pending") {
    const names = competitors.map((c) => c.name).join(", ");
    pmAnalysisStore.update(jiraKey, {
      status: "AWAITING_INPUT",
      pendingQuestion: `Discovery is complete. Should I run competitor analysis on how ${names} approach this problem today?`,
      pendingQuestionOptions: ["Yes, analyze competitors", "No, skip for now"],
      pendingQuestionStage: "COMPETITOR_ANALYSIS",
      competitorAnalysis: { ...state, featureSummary },
    });
    return true;
  } else if (state.decision === "pending") {
    state.decision = "skipped";
    pmAnalysisStore.update(jiraKey, { competitorAnalysis: state });
    return false;
  }

  if (state.decision === "run" && !state.analyses.length) {
    const result = await analyzeCompetitorApproaches({
      featureSummary,
      ticketSummary: ticket.summary,
      competitors,
    });
    state = {
      ...state,
      analyses: result.analyses,
      summaryMarkdown: result.summaryMarkdown,
      completedAt: new Date().toISOString(),
    };
    pmAnalysisStore.update(jiraKey, { competitorAnalysis: state });
    pmAnalysisStore.appendStageMeta(jiraKey, {
      stage: "COMPETITOR_ANALYSIS",
      status: "COMPLETED",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      costUsd: result.usage.costUsd,
    });
  }

  return false;
}

async function runCodebaseAnalysis(
  jiraKey: string,
  ticket: PmTicketInput,
  ctx: Awaited<ReturnType<typeof gatherPmContext>>,
  record: PmAnalysisRecord
): Promise<void> {
  const prompt = renderTemplate(PROMPT_CODEBASE_ANALYSIS, {
    discovery_summary: record.questionMode?.discoverySummary ?? "",
    ticket_type: record.neelIntake?.ticketType ?? "task",
    candidate_files_list: ctx.candidateFilesList,
    recent_commit_summary: ctx.recentCommitSummary,
    affected_components: ctx.affectedComponents,
  });
  const analysis = await runVirinStage<CodebaseAnalysisOutput>(
    jiraKey,
    "CODEBASE_ANALYSIS",
    prompt,
    STAGE_TOKENS.CODEBASE_ANALYSIS
  );
  pmAnalysisStore.update(jiraKey, { codebaseAnalysis: analysis });
  syncLegacyFields(jiraKey, record, record.neelIntake, record.questionMode, analysis);
}

function deriveComplexityScore(record: PmAnalysisRecord): number {
  const intake = record.neelIntake;
  if (intake?.ticketType === "large_feature") return 8;
  if (intake?.ticketType === "small_feature") return 5;
  if (intake?.ticketType === "bug" || intake?.ticketType === "task") return 3;
  const modules = record.codebaseAnalysis?.relevantModules?.length ?? 0;
  const risks = record.codebaseAnalysis?.technicalRisks?.length ?? 0;
  const scope = record.codebaseAnalysis?.scopeAssessment?.toLowerCase() ?? "";
  let score = 2 + modules * 0.6 + risks * 0.8;
  if (scope.includes("large") || scope.includes("high")) score += 2;
  return Math.min(10, Math.round(score * 10) / 10);
}

function shouldRunSystemDesignStages(record: PmAnalysisRecord): boolean {
  const threshold = getPipelineSettings().systemDesignComplexityThreshold;
  return deriveComplexityScore(record) >= threshold;
}

async function runSystemDesign(
  jiraKey: string,
  ctx: Awaited<ReturnType<typeof gatherPmContext>>,
  record: PmAnalysisRecord
): Promise<void> {
  if (!shouldRunSystemDesignStages(record)) {
    pmAnalysisStore.appendStageMeta(jiraKey, {
      stage: "SYSTEM_DESIGN",
      status: "COMPLETED",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      error: "skipped — below system design complexity threshold",
    });
    return;
  }

  if (record.systemDesign) return;

  const prompt = renderTemplate(PROMPT_SYSTEM_DESIGN, {
    discovery_summary: record.questionMode?.discoverySummary ?? "",
    codebase_analysis_json: JSON.stringify(record.codebaseAnalysis ?? {}, null, 2),
    system_design_scope: record.neelIntake?.ticketType ?? "task",
  });
  const systemDesign = await runVirinStage<SystemDesignOutput>(
    jiraKey,
    "SYSTEM_DESIGN",
    prompt,
    STAGE_TOKENS.SYSTEM_DESIGN
  );
  pmAnalysisStore.update(jiraKey, { systemDesign });
}

async function runTaskPlanning(
  jiraKey: string,
  ctx: Awaited<ReturnType<typeof gatherPmContext>>,
  record: PmAnalysisRecord
): Promise<void> {
  if (!shouldRunSystemDesignStages(record)) {
    pmAnalysisStore.appendStageMeta(jiraKey, {
      stage: "TASK_PLANNING",
      status: "COMPLETED",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      error: "skipped — below system design complexity threshold",
    });
    return;
  }

  if (record.taskBreakdown?.length) return;

  const taskResult = await runVirinStage<{
    tasks: TaskBreakdownItem[];
    summaryMarkdown?: string;
  }>(
    jiraKey,
    "TASK_PLANNING",
    renderTemplate(PROMPT_TASK_PLANNING, {
      system_design_json: JSON.stringify(record.systemDesign ?? {}, null, 2),
      codebase_analysis_json: JSON.stringify(record.codebaseAnalysis ?? {}, null, 2),
      discovery_summary: record.questionMode?.discoverySummary ?? "",
    }),
    STAGE_TOKENS.TASK_PLANNING
  );
  pmAnalysisStore.update(jiraKey, { taskBreakdown: taskResult.tasks ?? [] });
}

async function runSolutioning(
  jiraKey: string,
  ctx: Awaited<ReturnType<typeof gatherPmContext>>,
  record: PmAnalysisRecord,
  mode: VirinRunMode
): Promise<boolean> {
  if (record.solutioning?.humanConfirmed) {
    return false;
  }

  const prompt = renderTemplate(PROMPT_SOLUTIONING, {
    company_context: companyContextFromRecord(record, ctx),
    discovery_summary: record.questionMode?.discoverySummary ?? "",
    competitor_analysis: competitorBlock(record),
    codebase_analysis_json: JSON.stringify(record.codebaseAnalysis ?? {}, null, 2),
    flags: (record.questionMode?.flagsRaised ?? []).join("\n") || "none",
  });
  const solution = await runVirinStage<SolutioningOutput>(jiraKey, "SOLUTIONING", prompt);
  solution.humanConfirmed = false;
  pmAnalysisStore.update(jiraKey, { solutioning: solution });
  syncLegacyFields(jiraKey, record, record.neelIntake, record.questionMode, record.codebaseAnalysis, solution);

  if (mode === "interactive") {
    pmAnalysisStore.setStatus(jiraKey, "AWAITING_CONFIRMATION" as VirinAnalysisStatus);
    return true;
  }

  solution.humanConfirmed = true;
  pmAnalysisStore.update(jiraKey, { solutioning: solution, status: "RUNNING" });
  return false;
}

async function runPrdGeneration(
  jiraKey: string,
  ticket: PmTicketInput,
  ctx: Awaited<ReturnType<typeof gatherPmContext>>,
  record: PmAnalysisRecord
): Promise<void> {
  const prompt = renderTemplate(PROMPT_PRD, {
    company_context: companyContextFromRecord(record, ctx),
    solution_summary: record.solutioning?.summaryMarkdown ?? "",
    discovery_summary: record.questionMode?.discoverySummary ?? "",
    competitor_analysis: competitorBlock(record),
    codebase_analysis_json: JSON.stringify(record.codebaseAnalysis ?? {}, null, 2),
    jira_key: jiraKey,
    ticket_summary: ticket.summary,
    today_iso: new Date().toISOString(),
  });
  const generatedPrd = await runVirinStage<GeneratedPRD>(jiraKey, "PRD", prompt, STAGE_TOKENS.PRD);
  pmAnalysisStore.update(jiraKey, { generatedPrd });
}

async function runHandoff(jiraKey: string, record: PmAnalysisRecord): Promise<void> {
  const prompt = renderTemplate(PROMPT_HANDOFF, {
    prd_title: record.generatedPrd?.title ?? record.ticketInput.summary,
    problem_statement: record.generatedPrd?.problemStatement ?? "",
    prd_json: JSON.stringify(record.generatedPrd ?? {}, null, 2),
    codebase_analysis_json: JSON.stringify(record.codebaseAnalysis ?? {}, null, 2),
  });
  const handoffPackage = await runVirinStage<HandoffPackageOutput>(
    jiraKey,
    "HANDOFF",
    prompt,
    STAGE_TOKENS.HANDOFF
  );
  pmAnalysisStore.update(jiraKey, {
    handoffPackage,
    artifacts: {
      engineeringPing: handoffPackage.engineeringTickets.map((t) => t.title).join("; "),
      stakeholderUpdate: record.solutioning?.summaryMarkdown ?? "",
      pmOneLiner: record.generatedPrd?.title ?? "",
      sprintPlanningNote: handoffPackage.dependencyMapMarkdown.slice(0, 500),
    },
  });
}

export async function submitVirinAnswer(jiraKey: string, answer: string): Promise<PmAnalysisRecord> {
  const key = jiraKey.toUpperCase();
  const record = pmAnalysisStore.get(key);
  if (!record) throw new Error(`No Virin analysis for ${key}`);
  if (record.status !== "AWAITING_INPUT") {
    throw new Error("Analysis is not waiting for input");
  }

  pmAnalysisStore.update(key, {
    pendingAnswer: answer.trim(),
    status: "RUNNING",
  });

  const stage = (record.pendingQuestionStage ?? record.currentStage) as VirinStageId;
  const mode = (record.neelMode ?? "interactive") as VirinRunMode;

  if (stage === "INTAKE") {
    return runVirinPipeline({ jiraKey: key, resumeFrom: "INTAKE", mode });
  }
  if (stage === "QUESTION_MODE" || record.currentStage === "QUESTION_MODE") {
    return runVirinPipeline({ jiraKey: key, resumeFrom: "QUESTION_MODE", mode });
  }
  if (stage === "COMPETITOR_ANALYSIS" || record.currentStage === "COMPETITOR_ANALYSIS") {
    return runVirinPipeline({ jiraKey: key, resumeFrom: "COMPETITOR_ANALYSIS", mode });
  }

  return runVirinPipeline({ jiraKey: key, resumeFrom: stage ?? "QUESTION_MODE", mode });
}

export async function confirmVirinSolution(
  jiraKey: string,
  confirmed: boolean,
  feedback?: string
): Promise<PmAnalysisRecord> {
  const key = jiraKey.toUpperCase();
  const record = pmAnalysisStore.get(key);
  if (!record) throw new Error(`No Virin analysis for ${key}`);
  if (record.status !== "AWAITING_CONFIRMATION") {
    throw new Error("Analysis is not waiting for direction confirmation");
  }

  if (!confirmed) {
    const solution = record.solutioning!;
    pmAnalysisStore.update(key, {
      solutioning: {
        ...solution,
        humanConfirmed: false,
        humanFeedback: feedback ?? "Direction rejected — revise approach",
      },
      status: "RUNNING",
    });
    return runVirinPipeline({
      jiraKey: key,
      resumeFrom: "SOLUTIONING",
      mode: (record.neelMode ?? "interactive") as VirinRunMode,
    });
  }

  pmAnalysisStore.update(key, {
    solutioning: {
      ...record.solutioning!,
      humanConfirmed: true,
      humanFeedback: feedback ?? null,
    },
    status: "RUNNING",
  });

  return runVirinPipeline({
    jiraKey: key,
    resumeFrom: "PRD",
    mode: (record.neelMode ?? "interactive") as VirinRunMode,
  });
}

export async function runVirinPostShip(input: {
  jiraKey: string;
  metricsInput?: string;
  launchNotes?: string;
}): Promise<PmAnalysisRecord> {
  const key = input.jiraKey.toUpperCase();
  const record = pmAnalysisStore.get(key);
  if (!record?.generatedPrd) {
    throw new Error(`Complete Virin analysis with PRD first for ${key}`);
  }

  const prompt = renderTemplate(PROMPT_POST_SHIP, {
    success_metrics_json: JSON.stringify(record.generatedPrd.successMetrics ?? []),
    metrics_input: input.metricsInput ?? "Not provided — note gaps",
    launch_notes: input.launchNotes ?? "",
  });

  pmAnalysisStore.setCurrentStage(key, "POST_SHIP");
  const postShip = await runVirinStage<PostShipOutput>(key, "POST_SHIP", prompt, 6000);
  pmAnalysisStore.update(key, { postShip });
  pmAnalysisStore.setCurrentStage(key, null);
  return pmAnalysisStore.get(key)!;
}

export async function runVirinRetrospective(input: {
  jiraKey: string;
  humanFeedback?: string;
}): Promise<PmAnalysisRecord> {
  const key = input.jiraKey.toUpperCase();
  const record = pmAnalysisStore.get(key);
  if (!record?.neelIntake) throw new Error(`Run Virin analysis first for ${key}`);

  const prompt = renderTemplate(PROMPT_RETROSPECTIVE, {
    ticket_type: record.neelIntake.ticketType,
    turn_count: String(record.questionMode?.conversation.length ?? 0),
    flags: (record.questionMode?.flagsRaised ?? []).join("; ") || "none",
    prd_confidence: String(record.generatedPrd?.prdConfidence ?? 0),
    human_feedback: input.humanFeedback ?? "none",
  });

  pmAnalysisStore.setCurrentStage(key, "RETROSPECTIVE");
  const retrospective = await runVirinStage<Record<string, unknown>>(key, "RETROSPECTIVE", prompt);
  pmAnalysisStore.update(key, {
    retrospective: retrospective as unknown as PmAnalysisRecord["retrospective"],
  });
  pmAnalysisStore.setCurrentStage(key, null);

  const components = record.ticketInput.components ?? [];
  if (record.retrospective) {
    recordRetrospectiveLearning(record.retrospective, components);
  }

  return pmAnalysisStore.get(key)!;
}

export function estimateVirinCost(record: PmAnalysisRecord): number {
  return record.stageMeta.reduce((sum, m) => sum + (m.costUsd ?? 0), 0);
}

export { VIRIN_STAGE_ORDER };
