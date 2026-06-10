/** PM agents API — powered by Neel product discovery agent */
export {
  runNeelPipeline as runPmAnalysisPipeline,
  getNeelResumeStage as getPmResumeStage,
  submitNeelAnswer,
  confirmNeelSolution,
  runNeelPostShip,
  runNeelRetrospective as runPmRetrospective,
  estimateNeelCost as estimateAnalysisCost,
  NEEL_STAGE_ORDER as PM_STAGE_ORDER,
} from "../neel/orchestrator";

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
