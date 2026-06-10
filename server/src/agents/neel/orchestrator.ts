import { companyIntelligence, mapBusinessFitToRevenueRisk } from "../../companyIntelligence";
import { mergeUsage } from "../../llm/openaiCompletion";
import type { GeneratedPRD } from "../../prd/prdGenerator";
import { recordRetrospectiveLearning } from "../../rag/retrievalLearning";
import { logger } from "../../utils/logger";
import { gatherPmContext, resolveTicketInput } from "../pm/contextGatherer";
import { runPmStage } from "../pm/runStage";
import { pmAnalysisStore } from "../pm/store";
import type { PmAnalysisRecord, PmTicketInput } from "../pm/types";
import { NEEL_BEHAVIOR, NEEL_SYSTEM_PROMPT } from "./persona";
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
  renderTemplate,
} from "./prompts";
import type {
  CodebaseAnalysisOutput,
  HandoffPackageOutput,
  IntakeOutput,
  NeelAnalysisStatus,
  NeelNextQuestionResult,
  NeelStageId,
  PostShipOutput,
  QuestionModeState,
  SolutioningOutput,
} from "./types";
import { NEEL_STAGE_ORDER } from "./types";

export type NeelRunMode = "interactive" | "auto";

const STAGE_TOKENS: Partial<Record<NeelStageId, number>> = {
  PRD: 8000,
  HANDOFF: 6000,
  CODEBASE_ANALYSIS: 6000,
};

async function runNeelStage<T>(
  jiraKey: string,
  stage: NeelStageId,
  userPrompt: string,
  maxTokens?: number
): Promise<T> {
  const startedAt = new Date().toISOString();
  pmAnalysisStore.appendStageMeta(jiraKey, { stage, status: "RUNNING", startedAt });
  try {
    const { parsed, usage } = await runPmStage<T>({
      stage,
      systemPrompt: NEEL_SYSTEM_PROMPT,
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

export function getNeelResumeStage(record: PmAnalysisRecord): NeelStageId | null {
  if (record.currentStage && NEEL_STAGE_ORDER.includes(record.currentStage as NeelStageId)) {
    return record.currentStage as NeelStageId;
  }
  const failed = [...record.stageMeta].reverse().find((m) => m.status === "FAILED");
  return (failed?.stage as NeelStageId) ?? null;
}

export async function runNeelPipeline(input: {
  jiraKey: string;
  ticket?: Partial<PmTicketInput>;
  resumeFrom?: NeelStageId;
  mode?: NeelRunMode;
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
    (existing?.status === "FAILED" ? getNeelResumeStage(existing) : null);

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
    if (!updated) throw new Error(`Neel record missing for ${jiraKey}`);
    record = updated;
  } else {
    ticket = await resolveTicketInput(jiraKey, input.ticket);
    ctx = await gatherPmContext(ticket);
    record = pmAnalysisStore.create({
      jiraKey,
      agentName: "Neel",
      status: "RUNNING",
      currentStage: "INTAKE",
      ticketInput: ticket,
      context: { ...ctx, ticket },
      stageMeta: [],
      neelMode: mode,
      startedAt: new Date().toISOString(),
    });
  }

  const startIdx = resumeFrom ? NEEL_STAGE_ORDER.indexOf(resumeFrom) : 0;

  try {
    for (const stage of NEEL_STAGE_ORDER.slice(startIdx)) {
      pmAnalysisStore.setCurrentStage(jiraKey, stage);
      const pause = await runNeelStageHandler(jiraKey, stage, ticket, ctx, record, mode);
      const updated = pmAnalysisStore.get(jiraKey);
      if (updated) Object.assign(record, updated);
      if (pause) return record;
    }

    pmAnalysisStore.setStatus(jiraKey, "COMPLETED");
    pmAnalysisStore.setCurrentStage(jiraKey, null);
    return pmAnalysisStore.get(jiraKey)!;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, jiraKey }, "Neel pipeline failed");
    pmAnalysisStore.setStatus(jiraKey, "FAILED", message);
    return pmAnalysisStore.get(jiraKey)!;
  }
}

async function runNeelStageHandler(
  jiraKey: string,
  stage: NeelStageId,
  ticket: PmTicketInput,
  ctx: Awaited<ReturnType<typeof gatherPmContext>>,
  record: PmAnalysisRecord,
  mode: NeelRunMode
): Promise<boolean> {
  switch (stage) {
    case "INTAKE":
      return runIntake(jiraKey, ticket, ctx, record, mode);
    case "QUESTION_MODE":
      return runQuestionMode(jiraKey, ticket, ctx, record, mode);
    case "CODEBASE_ANALYSIS":
      await runCodebaseAnalysis(jiraKey, ticket, ctx, record);
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
  mode: NeelRunMode
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

  const intake = await runNeelStage<IntakeOutput>(jiraKey, "INTAKE", prompt);
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
    const inferred = await runNeelStage<{ answer: string }>(jiraKey, "INTAKE", renderTemplate(PROMPT_INFER_ANSWER, {
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
  mode: NeelRunMode
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

  while (!state.readyToProceed && state.conversation.length < NEEL_BEHAVIOR.maxDiscoveryTurns) {
    const next = await runNeelStage<NeelNextQuestionResult>(
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

    const inferred = await runNeelStage<{ answer: string }>(
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
  const analysis = await runNeelStage<CodebaseAnalysisOutput>(
    jiraKey,
    "CODEBASE_ANALYSIS",
    prompt,
    STAGE_TOKENS.CODEBASE_ANALYSIS
  );
  pmAnalysisStore.update(jiraKey, { codebaseAnalysis: analysis });
  syncLegacyFields(jiraKey, record, record.neelIntake, record.questionMode, analysis);
}

async function runSolutioning(
  jiraKey: string,
  ctx: Awaited<ReturnType<typeof gatherPmContext>>,
  record: PmAnalysisRecord,
  mode: NeelRunMode
): Promise<boolean> {
  if (record.solutioning?.humanConfirmed) {
    return false;
  }

  const prompt = renderTemplate(PROMPT_SOLUTIONING, {
    company_context: companyContextFromRecord(record, ctx),
    discovery_summary: record.questionMode?.discoverySummary ?? "",
    codebase_analysis_json: JSON.stringify(record.codebaseAnalysis ?? {}, null, 2),
    flags: (record.questionMode?.flagsRaised ?? []).join("\n") || "none",
  });
  const solution = await runNeelStage<SolutioningOutput>(jiraKey, "SOLUTIONING", prompt);
  solution.humanConfirmed = false;
  pmAnalysisStore.update(jiraKey, { solutioning: solution });
  syncLegacyFields(jiraKey, record, record.neelIntake, record.questionMode, record.codebaseAnalysis, solution);

  if (mode === "interactive") {
    pmAnalysisStore.setStatus(jiraKey, "AWAITING_CONFIRMATION" as NeelAnalysisStatus);
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
    codebase_analysis_json: JSON.stringify(record.codebaseAnalysis ?? {}, null, 2),
    jira_key: jiraKey,
    ticket_summary: ticket.summary,
    today_iso: new Date().toISOString(),
  });
  const generatedPrd = await runNeelStage<GeneratedPRD>(jiraKey, "PRD", prompt, STAGE_TOKENS.PRD);
  pmAnalysisStore.update(jiraKey, { generatedPrd });
}

async function runHandoff(jiraKey: string, record: PmAnalysisRecord): Promise<void> {
  const prompt = renderTemplate(PROMPT_HANDOFF, {
    prd_title: record.generatedPrd?.title ?? record.ticketInput.summary,
    problem_statement: record.generatedPrd?.problemStatement ?? "",
    prd_json: JSON.stringify(record.generatedPrd ?? {}, null, 2),
    codebase_analysis_json: JSON.stringify(record.codebaseAnalysis ?? {}, null, 2),
  });
  const handoffPackage = await runNeelStage<HandoffPackageOutput>(
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

export async function submitNeelAnswer(jiraKey: string, answer: string): Promise<PmAnalysisRecord> {
  const key = jiraKey.toUpperCase();
  const record = pmAnalysisStore.get(key);
  if (!record) throw new Error(`No Neel analysis for ${key}`);
  if (record.status !== "AWAITING_INPUT") {
    throw new Error("Analysis is not waiting for input");
  }

  pmAnalysisStore.update(key, {
    pendingAnswer: answer.trim(),
    status: "RUNNING",
  });

  const stage = (record.pendingQuestionStage ?? record.currentStage) as NeelStageId;
  const mode = (record.neelMode ?? "interactive") as NeelRunMode;

  if (stage === "INTAKE") {
    return runNeelPipeline({ jiraKey: key, resumeFrom: "INTAKE", mode });
  }
  if (stage === "QUESTION_MODE" || record.currentStage === "QUESTION_MODE") {
    return runNeelPipeline({ jiraKey: key, resumeFrom: "QUESTION_MODE", mode });
  }

  return runNeelPipeline({ jiraKey: key, resumeFrom: stage ?? "QUESTION_MODE", mode });
}

export async function confirmNeelSolution(
  jiraKey: string,
  confirmed: boolean,
  feedback?: string
): Promise<PmAnalysisRecord> {
  const key = jiraKey.toUpperCase();
  const record = pmAnalysisStore.get(key);
  if (!record) throw new Error(`No Neel analysis for ${key}`);
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
    return runNeelPipeline({
      jiraKey: key,
      resumeFrom: "SOLUTIONING",
      mode: (record.neelMode ?? "interactive") as NeelRunMode,
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

  return runNeelPipeline({
    jiraKey: key,
    resumeFrom: "PRD",
    mode: (record.neelMode ?? "interactive") as NeelRunMode,
  });
}

export async function runNeelPostShip(input: {
  jiraKey: string;
  metricsInput?: string;
  launchNotes?: string;
}): Promise<PmAnalysisRecord> {
  const key = input.jiraKey.toUpperCase();
  const record = pmAnalysisStore.get(key);
  if (!record?.generatedPrd) {
    throw new Error(`Complete Neel analysis with PRD first for ${key}`);
  }

  const prompt = renderTemplate(PROMPT_POST_SHIP, {
    success_metrics_json: JSON.stringify(record.generatedPrd.successMetrics ?? []),
    metrics_input: input.metricsInput ?? "Not provided — note gaps",
    launch_notes: input.launchNotes ?? "",
  });

  pmAnalysisStore.setCurrentStage(key, "POST_SHIP");
  const postShip = await runNeelStage<PostShipOutput>(key, "POST_SHIP", prompt, 6000);
  pmAnalysisStore.update(key, { postShip });
  pmAnalysisStore.setCurrentStage(key, null);
  return pmAnalysisStore.get(key)!;
}

export async function runNeelRetrospective(input: {
  jiraKey: string;
  humanFeedback?: string;
}): Promise<PmAnalysisRecord> {
  const key = input.jiraKey.toUpperCase();
  const record = pmAnalysisStore.get(key);
  if (!record?.neelIntake) throw new Error(`Run Neel analysis first for ${key}`);

  const prompt = renderTemplate(PROMPT_RETROSPECTIVE, {
    ticket_type: record.neelIntake.ticketType,
    turn_count: String(record.questionMode?.conversation.length ?? 0),
    flags: (record.questionMode?.flagsRaised ?? []).join("; ") || "none",
    prd_confidence: String(record.generatedPrd?.prdConfidence ?? 0),
    human_feedback: input.humanFeedback ?? "none",
  });

  pmAnalysisStore.setCurrentStage(key, "RETROSPECTIVE");
  const retrospective = await runNeelStage<Record<string, unknown>>(key, "RETROSPECTIVE", prompt);
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

export function estimateNeelCost(record: PmAnalysisRecord): number {
  return record.stageMeta.reduce((sum, m) => sum + (m.costUsd ?? 0), 0);
}

export { NEEL_STAGE_ORDER };
