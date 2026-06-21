export const AGENT_PIPELINE_STAGES = {
  virin: ["INGESTION", "PRODUCT_AGENT", "PRD_VALIDATION"],
  ananta: ["ENGINEERING_AGENT", "IMPLEMENTATION_VALIDATION"],
  neel: ["QA_AGENT", "QA_VALIDATION", "OUTPUT"],
};

export function pipelineMatchesAgentStage(currentStage, agentKey) {
  const stages = AGENT_PIPELINE_STAGES[agentKey] ?? [];
  return stages.includes(currentStage);
}
