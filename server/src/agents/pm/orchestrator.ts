/** PM agents API — powered by Virin product discovery agent */
export {
  runVirinPipeline as runPmAnalysisPipeline,
  getVirinResumeStage as getPmResumeStage,
  submitVirinAnswer,
  confirmVirinSolution,
  runVirinPostShip,
  runVirinRetrospective as runPmRetrospective,
  estimateVirinCost as estimateAnalysisCost,
  VIRIN_STAGE_ORDER as PM_STAGE_ORDER,
} from "../virin/orchestrator";

import { mergeUsage } from "../../llm/openaiCompletion";
import type { PmAnalysisRecord } from "./types";

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
